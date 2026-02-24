'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { uploadProductImage } from './actions';
import { VariantMatrixBuilder } from './VariantMatrixBuilder';

interface PendingVariant {
  name: string;
  sku?: string;
  size?: string;
  color?: string;
  price_adjustment_usd: number;
  inventory_count?: number;
  image_url?: string;
}

interface VariantCreationListProps {
  variants: PendingVariant[];
  onAdd: (variant: PendingVariant) => void;
  onRemove: (index: number) => void;
  isDevMode: boolean;
  disabled: boolean;
}

export function VariantCreationList({ variants, onAdd, onRemove, isDevMode, disabled }: VariantCreationListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  
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
    setUploadMessage(null);
  };

  const cancelAdding = () => {
    resetForm();
    setIsAdding(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    const result = await uploadProductImage(formDataUpload);
    setUploading(false);

    if (result.success && result.url) {
      setFormData(prev => ({ ...prev, image_url: result.url! }));
      setUploadMessage('Image uploaded successfully');
      setTimeout(() => setUploadMessage(null), 3000);
    } else {
      setUploadMessage(result.error || 'Failed to upload image');
    }
  };

  const handleAddAnother = () => {
    if (!formData.value.trim()) {
      alert('Please select or enter a variant value');
      return;
    }

    const variant: PendingVariant = {
      name: formData.value.trim(),
      sku: formData.sku.trim() || undefined,
      price_adjustment_usd: parseFloat(formData.price_adjustment_usd) || 0,
      inventory_count: formData.inventory_count ? parseInt(formData.inventory_count) : undefined,
    };

    // Add size, color, or leave both undefined for custom
    if (variantType === 'size') {
      variant.size = formData.value.trim();
    } else if (variantType === 'color') {
      variant.color = formData.value.trim();
      variant.image_url = formData.image_url.trim() || undefined;
    } else {
      // custom variant - no size or color
      variant.image_url = formData.image_url.trim() || undefined;
    }

    onAdd(variant);
    resetForm();
    // Keep the form open for adding more
  };

  const handleSaveVariants = () => {
    if (!formData.value.trim()) {
      // No current form data, just close
      cancelAdding();
      return;
    }

    // Add the current variant first
    handleAddAnother();
    // Then close the form
    setIsAdding(false);
  };

  const handleMatrixSave = (combinations: Array<{
    size: string;
    color: string;
    sku?: string;
    price_adjustment_usd: number;
    inventory_count?: number;
    image_url?: string;
  }>) => {
    // Add all combinations as variants
    combinations.forEach(combo => {
      onAdd({
        name: `${combo.size} - ${combo.color}`,
        sku: combo.sku,
        size: combo.size,
        color: combo.color,
        price_adjustment_usd: combo.price_adjustment_usd,
        inventory_count: combo.inventory_count,
        image_url: combo.image_url,
      });
    });
    setShowMatrix(false);
  };

  // If showing matrix builder, render that instead
  if (showMatrix) {
    return (
      <VariantMatrixBuilder
        onSave={handleMatrixSave}
        onCancel={() => setShowMatrix(false)}
        isDevMode={isDevMode}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing Variants List */}
      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map((variant, index) => (
            <div
              key={index}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(index)}
                disabled={disabled}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Buttons */}
      {!isAdding && (
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowMatrix(true)}
            disabled={isDevMode || disabled}
          >
            📊 Use Size × Color Matrix
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isDevMode || disabled}
          >
            + Add Individual Variant
          </Button>
        </div>
      )}

      {/* Add Form */}
      {isAdding && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-md border border-blue-200">
          <div>
            <h3 className="font-semibold text-gray-900">Add Variants</h3>
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
                disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={disabled}
              placeholder="e.g., Set of 3, Gift Box, Limited Edition"
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU (Optional)"
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              disabled={disabled}
              placeholder="e.g., TSHIRT-L-BLUE"
            />

            <Input
              label="Price Adjustment (USD)"
              type="number"
              step="0.01"
              value={formData.price_adjustment_usd}
              onChange={(e) => setFormData({ ...formData, price_adjustment_usd: e.target.value })}
              disabled={disabled}
              placeholder="0.00"
            />

            <Input
              label="Inventory Count (Optional)"
              type="number"
              value={formData.inventory_count}
              onChange={(e) => setFormData({ ...formData, inventory_count: e.target.value })}
              disabled={disabled}
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
                  disabled={isDevMode || disabled || uploading}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800 file:cursor-pointer disabled:file:bg-gray-300"
                />
                {uploading && <p className="text-sm text-blue-600">Uploading...</p>}
                {uploadMessage && (
                  <p className={`text-sm ${uploadMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {uploadMessage}
                  </p>
                )}
                <Input
                  label="Or paste image URL"
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  disabled={disabled}
                  placeholder="https://..."
                />
                <p className="text-xs text-gray-600">
                  Upload an image showing this specific {variantType}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={cancelAdding}
              disabled={disabled}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleAddAnother}
                disabled={disabled || !formData.value.trim() || uploading}
              >
                Add Another
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveVariants}
                disabled={disabled || uploading}
              >
                Save Variants
              </Button>
            </div>
          </div>
        </div>
      )}

      {isDevMode && variants.length === 0 && !isAdding && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Configure Supabase to enable variant management. See SETUP.txt for instructions.
          </p>
        </div>
      )}
    </div>
  );
}

