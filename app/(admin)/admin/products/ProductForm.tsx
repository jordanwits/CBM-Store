'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Card, CardContent } from 'core/components/Card';
import { createProduct, updateProduct, uploadProductImage } from './actions';
import { VariantCreationList } from './VariantCreationList';

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  initialData?: {
    name: string;
    description: string;
    base_usd: number;
    category?: string;
    collections?: string[];
    images?: string[];
  };
  isDevMode: boolean;
}

export function ProductForm({ mode, productId, initialData, isDevMode }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [baseUsd, setBaseUsd] = useState(initialData?.base_usd?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [selectedCollections, setSelectedCollections] = useState<string[]>(initialData?.collections || []);
  const [imagesInput, setImagesInput] = useState(initialData?.images?.join('\n') || '');
  
  // Variant state for creation mode
  const [pendingVariants, setPendingVariants] = useState<Array<{
    name: string;
    sku?: string;
    size?: string;
    color?: string;
    price_adjustment_usd: number;
    inventory_count?: number;
    image_url?: string;
  }>>([]);

  const availableCollections = [
    'New Arrivals',
    'Essentials',
    'Eco-Friendly',
    'Premium',
    'Work Essentials',
    'Electronics',
  ];

  const toggleCollection = (collection: string) => {
    setSelectedCollections(prev => 
      prev.includes(collection)
        ? prev.filter(c => c !== collection)
        : [...prev, collection]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setUploadMessage(null);

    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        const result = await uploadProductImage(formData);
        
        if (result.success && result.url) {
          uploadedUrls.push(result.url);
        } else {
          setUploadMessage(`Failed to upload ${file.name}: ${result.error}`);
          break;
        }
      }
      
      if (uploadedUrls.length > 0) {
        // Append new URLs to existing images
        const existingImages = imagesInput.trim();
        const newImagesText = existingImages 
          ? existingImages + '\n' + uploadedUrls.join('\n')
          : uploadedUrls.join('\n');
        setImagesInput(newImagesText);
        setUploadMessage(`Successfully uploaded ${uploadedUrls.length} image(s)`);
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      setUploadMessage('An error occurred during upload');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    
    const images = imagesInput
      .split('\n')
      .map(img => img.trim())
      .filter(img => img.length > 0);

    const data = {
      name,
      description,
      base_usd: parseFloat(baseUsd),
      category: category || undefined,
      collections: selectedCollections.length > 0 ? selectedCollections : undefined,
      images: images.length > 0 ? images : undefined,
    };

    let result;
    if (mode === 'create') {
      result = await createProduct(data);
      
      // If product created successfully and there are pending variants, create them
      if (result.success && result.productId && pendingVariants.length > 0) {
        const { createVariant } = await import('./actions');
        
        let successCount = 0;
        for (const variant of pendingVariants) {
          const variantResult = await createVariant({
            ...variant,
            product_id: result.productId,
          });
          if (variantResult.success) {
            successCount++;
          }
        }
        
        console.log(`Created ${successCount} of ${pendingVariants.length} variants`);
      }
    } else {
      result = await updateProduct(productId!, data);
    }

    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: `Product ${mode === 'create' ? 'created' : 'updated'} successfully!` });
      setTimeout(() => {
        router.push('/admin/products');
      }, 1500);
    } else {
      setMessage({ type: 'error', text: result.error || `Failed to ${mode} product` });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          
          <Input
            label="Product Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isDevMode || loading}
            placeholder="e.g., Company Logo T-Shirt"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isDevMode || loading}
              placeholder="Detailed product description..."
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          
          <Input
            label="Base Price (USD)"
            type="number"
            step="0.01"
            min="0"
            value={baseUsd}
            onChange={(e) => setBaseUsd(e.target.value)}
            disabled={isDevMode || loading}
            placeholder="25.00"
            required
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Categorization & Filtering</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isDevMode || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Select a category</option>
              <option value="Apparel">Apparel</option>
              <option value="Drinkware">Drinkware</option>
              <option value="Bags">Bags</option>
              <option value="Electronics">Electronics</option>
              <option value="Accessories">Accessories</option>
              <option value="Office">Office</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">Used for filtering on the storefront</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collections
            </label>
            <div className="space-y-2">
              {availableCollections.map((collection) => (
                <label
                  key={collection}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection)}
                    onChange={() => toggleCollection(collection)}
                    disabled={isDevMode || loading}
                    className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className={`text-sm ${isDevMode || loading ? 'text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {collection}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">Select all collections that apply to this product</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Images</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Images
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={isDevMode || loading || uploadingImage}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800 file:cursor-pointer disabled:file:bg-gray-300"
              />
            </div>
            {uploadingImage && (
              <p className="text-sm text-primary mt-2">Uploading...</p>
            )}
            {uploadMessage && (
              <p className={`text-sm mt-2 ${uploadMessage.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>
                {uploadMessage}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">Images will be uploaded to Supabase Storage (max 10MB per image)</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Images
            </label>
            {(() => {
              const imageUrls = imagesInput
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              return imageUrls.length > 0 ? (
                <div className="flex flex-wrap gap-3 mb-4">
                  {imageUrls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="relative group flex-shrink-0"
                    >
                      <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
                        <img
                          src={url}
                          alt={`Product ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="%23e5e7eb" width="80" height="80"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10" font-family="sans-serif">?</text></svg>';
                          }}
                        />
                      </div>
                      {!isDevMode && !loading && (
                        <button
                          type="button"
                          onClick={() => {
                            const rest = imageUrls.filter((_, i) => i !== index);
                            setImagesInput(rest.join('\n'));
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center hover:bg-red-700 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            <textarea
              value={imagesInput}
              onChange={(e) => setImagesInput(e.target.value)}
              disabled={isDevMode || loading}
              placeholder="Paste image URLs, one per line. Or upload above."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
            />
            <p className="text-xs text-gray-600 mt-1">One URL per line. Uploaded images appear above as previews</p>
          </div>
        </CardContent>
      </Card>

      {/* Variants Section */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Product Variants {mode === 'create' && '(Optional)'}</h2>
              <p className="text-sm text-gray-600 mt-1">
                Add size and color options. Each variant can have its own image and price adjustment.
              </p>
            </div>
          </div>

          {mode === 'create' && (
            <VariantCreationList
              variants={pendingVariants}
              onAdd={(variant) => setPendingVariants(prev => [...prev, variant])}
              onRemove={(index) => setPendingVariants(prev => prev.filter((_, i) => i !== index))}
              isDevMode={isDevMode}
              disabled={loading}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/products')}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isDevMode || loading || !name || !description || !baseUsd}
        >
          {loading ? (mode === 'create' ? 'Creating...' : 'Updating...') : (mode === 'create' ? 'Create Product' : 'Update Product')}
        </Button>
      </div>

      {isDevMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Configure Supabase to enable product management. See SETUP.txt for instructions.
          </p>
        </div>
      )}

      {message && (
        <div
          className={`rounded-md p-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}
    </form>
  );
}

