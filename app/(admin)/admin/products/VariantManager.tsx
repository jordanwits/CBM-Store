'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Card, CardContent } from 'core/components/Card';
import { createVariant, updateVariant, deleteVariant, uploadProductImage } from './actions';
import { VariantMatrixBuilder } from './VariantMatrixBuilder';

interface Variant {
  id: string;
  name: string;
  sku?: string;
  size?: string;
  color?: string;
  price_adjustment_usd: number;
  inventory_count?: number;
  image_url?: string;
  active: boolean;
}

interface VariantManagerProps {
  productId: string;
  initialVariants: Variant[];
  isDevMode: boolean;
  disabled: boolean;
}

export function VariantManager({ productId, initialVariants, isDevMode, disabled }: VariantManagerProps) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [isAdding, setIsAdding] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form state for new/editing variant
  const [variantType, setVariantType] = useState<'size' | 'color' | 'custom'>('size');
  const [formData, setFormData] = useState({
    value: '',
    sku: '',
    price_adjustment_usd: '0',
    inventory_count: '',
    image_url: '',
  });

  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size'];
  const colorOptions = [
    'Black',
    'White',
    'Gray',
    'Blue',
    'Navy',
    'Red',
    'Green',
    'Yellow',
    'Orange',
    'Purple',
    'Pink',
    'Brown',
    'Beige',
    'Silver',
    'Gold',
  ];

  const canShowImage = variantType === 'color' || variantType === 'custom';

  const resetForm = () => {
    setFormData({
      value: '',
      sku: '',
      price_adjustment_usd: '0',
      inventory_count: '',
      image_url: '',
    });
    setVariantType('size');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (variant: Variant) => {
    // Determine variant type from the variant data
    let type: 'size' | 'color' | 'custom' = 'custom';
    let value = variant.name;

    if (variant.size) {
      type = 'size';
      value = variant.size;
    } else if (variant.color) {
      type = 'color';
      value = variant.color;
    }

    setVariantType(type);
    setFormData({
      value: value,
      sku: variant.sku || '',
      price_adjustment_usd: variant.price_adjustment_usd.toString(),
      inventory_count: variant.inventory_count?.toString() || '',
      image_url: variant.image_url || '',
    });
    setEditingId(variant.id);
    setIsAdding(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    const result = await uploadProductImage(formDataUpload);
    setLoading(false);

    if (result.success && result.url) {
      setFormData(prev => ({ ...prev, image_url: result.url! }));
      setMessage({ type: 'success', text: 'Image uploaded successfully' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to upload image' });
    }
  };

  const handleSave = async () => {
    if (!formData.value.trim()) {
      setMessage({ type: 'error', text: 'Please select or enter a variant value' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const variantData: any = {
      product_id: productId,
      name: formData.value.trim(),
      sku: formData.sku.trim() || undefined,
      price_adjustment_usd: parseFloat(formData.price_adjustment_usd) || 0,
      inventory_count: formData.inventory_count ? parseInt(formData.inventory_count) : undefined,
    };

    // Add size, color, or leave both undefined for custom
    if (variantType === 'size') {
      variantData.size = formData.value.trim();
    } else if (variantType === 'color') {
      variantData.color = formData.value.trim();
      variantData.image_url = formData.image_url.trim() || undefined;
    } else {
      // custom variant - no size or color
      variantData.image_url = formData.image_url.trim() || undefined;
    }

    let result;
    if (editingId) {
      result = await updateVariant(editingId, variantData);
    } else {
      result = await createVariant(variantData);
    }

    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: `Variant ${editingId ? 'updated' : 'created'} successfully!` });
      setTimeout(() => setMessage(null), 3000);
      
      // Refresh the page to get updated variants
      window.location.reload();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save variant' });
    }
  };

  const handleDelete = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;

    setLoading(true);
    const result = await deleteVariant(variantId);
    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Variant deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
      window.location.reload();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to delete variant' });
    }
  };

  const handleMatrixSave = async (combinations: Array<{
    size: string;
    color: string;
    sku?: string;
    price_adjustment_usd: number;
    inventory_count?: number;
    image_url?: string;
  }>) => {
    setLoading(true);
    // Create all combinations as variants
    for (const combo of combinations) {
      await createVariant({
        product_id: productId,
        name: `${combo.size} - ${combo.color}`,
        sku: combo.sku,
        size: combo.size,
        color: combo.color,
        price_adjustment_usd: combo.price_adjustment_usd,
        inventory_count: combo.inventory_count,
        image_url: combo.image_url,
      });
    }
    setLoading(false);
    setShowMatrix(false);
    setMessage({ type: 'success', text: `${combinations.length} variant combinations created successfully!` });
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // If showing matrix builder, render that instead
  if (showMatrix) {
    return (
      <Card>
        <CardContent>
          <VariantMatrixBuilder
            onSave={handleMatrixSave}
            onCancel={() => setShowMatrix(false)}
            isDevMode={isDevMode}
            disabled={disabled || loading}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Product Variants</h2>
          {!isAdding && !editingId && (
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowMatrix(true)}
                disabled={isDevMode || disabled || loading}
              >
                📊 Size × Color Matrix
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(true)}
                disabled={isDevMode || disabled || loading}
              >
                + Add Individual
              </Button>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600">
          Add size and color options for this product. Each variant can have its own image, price adjustment, and inventory.
        </p>

        {/* Existing Variants List */}
        {variants.length > 0 && !isAdding && !editingId && (
          <div className="space-y-2">
            {variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{variant.name}</p>
                  <div className="flex gap-4 text-sm text-gray-600 mt-1">
                    {variant.sku && <span>SKU: {variant.sku}</span>}
                    {variant.size && <span>Size: {variant.size}</span>}
                    {variant.color && <span>Color: {variant.color}</span>}
                    {variant.price_adjustment_usd !== 0 && (
                      <span>Price Adj: ${variant.price_adjustment_usd.toFixed(2)}</span>
                    )}
                    {variant.inventory_count !== null && variant.inventory_count !== undefined && (
                      <span>Stock: {variant.inventory_count}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(variant)}
                    disabled={isDevMode || disabled || loading}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(variant.id)}
                    disabled={isDevMode || disabled || loading}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        {(isAdding || editingId) && (
          <div className="space-y-4 p-4 bg-primary/5 rounded-md border border-primary/20">
            <div>
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Edit Variant' : 'Add Variant'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">Add size, color, or custom variants separately</p>
            </div>

            {/* Variant Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variant Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVariantType('size');
                    setFormData({ ...formData, value: '', image_url: '' });
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    variantType === 'size'
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={isDevMode || disabled || loading}
                >
                  Size
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVariantType('color');
                    setFormData({ ...formData, value: '' });
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    variantType === 'color'
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={isDevMode || disabled || loading}
                >
                  Color
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVariantType('custom');
                    setFormData({ ...formData, value: '' });
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    variantType === 'custom'
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={isDevMode || disabled || loading}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Variant Value Input */}
            {variantType === 'size' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Size
                </label>
                <select
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  disabled={isDevMode || disabled || loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select size</option>
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {variantType === 'color' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <select
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  disabled={isDevMode || disabled || loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select color</option>
                  {colorOptions.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {variantType === 'custom' && (
              <Input
                label="Custom Variant"
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                disabled={isDevMode || disabled || loading}
                placeholder="e.g., Set of 3, Gift Box, Limited Edition"
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SKU (Optional)"
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                disabled={isDevMode || disabled || loading}
                placeholder="e.g., TSHIRT-L-BLUE"
              />

              <Input
                label="Price Adjustment (USD)"
                type="number"
                step="0.01"
                value={formData.price_adjustment_usd}
                onChange={(e) => setFormData({ ...formData, price_adjustment_usd: e.target.value })}
                disabled={isDevMode || disabled || loading}
                placeholder="0.00"
              />

              <Input
                label="Inventory Count (Optional)"
                type="number"
                value={formData.inventory_count}
                onChange={(e) => setFormData({ ...formData, inventory_count: e.target.value })}
                disabled={isDevMode || disabled || loading}
                placeholder="Leave empty for unlimited"
              />
            </div>

            {/* Image Upload - Only for Color and Custom */}
            {canShowImage && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variant Image {variantType === 'color' ? '(Recommended)' : '(Optional)'}
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isDevMode || disabled || loading}
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800 file:cursor-pointer disabled:file:bg-gray-300"
                  />
                  <Input
                    label="Or paste image URL"
                    type="text"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    disabled={isDevMode || disabled || loading}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-600">
                    Upload an image showing this specific {variantType}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isDevMode || disabled || loading || !formData.value.trim()}
              >
                {loading ? 'Saving...' : (editingId ? 'Update Variant' : 'Save Variant')}
              </Button>
            </div>
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

        {isDevMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Configure Supabase to enable variant management. See SETUP.txt for instructions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

