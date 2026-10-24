'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { uploadProductImage } from './actions';
import { confirmSmallImages, prepareImageForUpload } from '@/lib/products/prepare-image-upload';
import { variantConflict } from '@/lib/products/variant-set';
import { VariantMatrixBuilder } from './VariantMatrixBuilder';
import { sizeOptions, colorOptions, CUSTOM_VALUE } from './variantOptions';

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

const EMPTY_FORM = {
  value: '',
  size: '',
  color: '',
  sku: '',
  price_adjustment_usd: '0',
  inventory_count: '',
  image_url: '',
};

export function VariantCreationList({ variants, onAdd, onRemove, isDevMode, disabled }: VariantCreationListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  // Why the last variant could not join the list, or what the matrix had to leave out
  const [listMessage, setListMessage] = useState<string | null>(null);

  // A size, a color, or both on one variant, the same as the edit page. Adding sizes and
  // colors as separate variants made products whose page asks for one of each and then
  // finds no variant carrying both, so nothing could be added to a cart.
  const [variantType, setVariantType] = useState<'sizecolor' | 'custom'>('sizecolor');
  // True when the size/color is typed in manually rather than picked from the list
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Built the same way the matrix builder names its combinations
  const derivedName =
    variantType === 'custom'
      ? formData.value.trim()
      : [formData.size.trim(), formData.color.trim()].filter(Boolean).join(' - ');

  const canShowImage = variantType === 'custom' || !!formData.color.trim();

  const handleSizeSelect = (selected: string) => {
    if (selected === CUSTOM_VALUE) {
      setIsCustomSize(true);
      setFormData(prev => ({ ...prev, size: '' }));
    } else {
      setIsCustomSize(false);
      setFormData(prev => ({ ...prev, size: selected }));
    }
  };

  const handleColorSelect = (selected: string) => {
    if (selected === CUSTOM_VALUE) {
      setIsCustomColor(true);
      setFormData(prev => ({ ...prev, color: '' }));
    } else {
      setIsCustomColor(false);
      setFormData(prev => ({ ...prev, color: selected }));
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setVariantType('sizecolor');
    setIsCustomSize(false);
    setIsCustomColor(false);
    setUploadMessage(null);
  };

  const cancelAdding = () => {
    resetForm();
    setListMessage(null);
    setIsAdding(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    if ((await confirmSmallImages([file])).length === 0) {
      input.value = '';
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    const formDataUpload = new FormData();
    formDataUpload.append('file', await prepareImageForUpload(file));

    // A failed request (often a file over the host's upload limit) used to leave it uploading
    let result: Awaited<ReturnType<typeof uploadProductImage>>;
    try {
      result = await uploadProductImage(formDataUpload);
    } catch {
      result = { success: false, error: 'The upload failed. The image may be too large; try a smaller one.' };
    }
    setUploading(false);

    if (result.success && result.url) {
      setFormData(prev => ({ ...prev, image_url: result.url! }));
      setUploadMessage('Image uploaded successfully');
      setTimeout(() => setUploadMessage(null), 3000);
    } else {
      setUploadMessage(result.error || 'Failed to upload image');
    }
  };

  /** Adds the form's variant to the list. Returns false when it can't be added. */
  const handleAddAnother = (): boolean => {
    if (!derivedName) {
      setListMessage(
        variantType === 'custom'
          ? 'Please enter a variant name'
          : 'Please choose a size, a color, or both'
      );
      return false;
    }

    const variant: PendingVariant = {
      name: derivedName,
      sku: formData.sku.trim() || undefined,
      price_adjustment_usd: parseFloat(formData.price_adjustment_usd) || 0,
      inventory_count: formData.inventory_count ? parseInt(formData.inventory_count) : undefined,
    };

    if (variantType === 'sizecolor') {
      variant.size = formData.size.trim() || undefined;
      variant.color = formData.color.trim() || undefined;
    }
    if (canShowImage) {
      variant.image_url = formData.image_url.trim() || undefined;
    }

    const conflict = variantConflict(variants, variant);
    if (conflict) {
      setListMessage(conflict);
      return false;
    }

    onAdd(variant);
    setListMessage(null);
    resetForm();
    // Keep the form open for adding more
    return true;
  };

  const handleSaveVariants = () => {
    if (!derivedName) {
      // No current form data, just close
      cancelAdding();
      return;
    }

    // Add the current variant first, then close the form if it went in
    if (handleAddAnother()) {
      setIsAdding(false);
    }
  };

  const handleMatrixSave = (combinations: Array<{
    label: string;
    size?: string;
    color?: string;
    sku?: string;
    price_adjustment_usd: number;
    inventory_count?: number;
    image_url?: string;
  }>) => {
    // Checked one at a time against the list as it grows, so the matrix can't repeat a
    // variant already listed or mix with ones the product page could not offer alongside
    const accepted: PendingVariant[] = [...variants];
    const skipped: string[] = [];

    combinations.forEach(combo => {
      const variant: PendingVariant = {
        name: combo.label,
        sku: combo.sku,
        size: combo.size,
        color: combo.color,
        price_adjustment_usd: combo.price_adjustment_usd,
        inventory_count: combo.inventory_count,
        image_url: combo.image_url,
      };

      const conflict = variantConflict(accepted, variant);
      if (conflict) {
        skipped.push(`${combo.label}: ${conflict}`);
        return;
      }

      accepted.push(variant);
      onAdd(variant);
    });

    setListMessage(
      skipped.length > 0
        ? `${skipped.length} of ${combinations.length} combinations were left out. ${skipped.join(' ')}`
        : null
    );
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

      {listMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{listMessage}</p>
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
            <p className="text-sm text-gray-600 mt-1">
              Set a size, a color, or both. Once a product has both, every variant needs both.
            </p>
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
                  setVariantType('sizecolor');
                  setFormData({ ...formData, value: '' });
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  variantType === 'sizecolor'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
                disabled={disabled}
              >
                Size / Color
              </button>
              <button
                type="button"
                onClick={() => {
                  setVariantType('custom');
                  setIsCustomSize(false);
                  setIsCustomColor(false);
                  setFormData({ ...formData, size: '', color: '' });
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
          {variantType === 'sizecolor' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Size <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <select
                  value={isCustomSize ? CUSTOM_VALUE : formData.size}
                  onChange={(e) => handleSizeSelect(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">No size</option>
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE}>Custom size...</option>
                </select>
                {isCustomSize && (
                  <div className="mt-2">
                    <Input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      disabled={disabled}
                      placeholder="Enter a custom size (e.g., 34x32)"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <select
                  value={isCustomColor ? CUSTOM_VALUE : formData.color}
                  onChange={(e) => handleColorSelect(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">No color</option>
                  {colorOptions.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE}>Custom color...</option>
                </select>
                {isCustomColor && (
                  <div className="mt-2">
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      disabled={disabled}
                      placeholder="Enter a custom color (e.g., Forest Green)"
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <p className="text-sm text-gray-600">
                  Saves as:{' '}
                  <span className="font-medium text-gray-900">
                    {derivedName || '—'}
                  </span>
                </p>
              </div>
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

          {/* Image Upload - for a variant with a color, or a custom one */}
          {canShowImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variant Image {variantType === 'sizecolor' ? '(Recommended)' : '(Optional)'}
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
                  Upload an image showing this specific {variantType === 'sizecolor' ? 'color' : 'variant'}
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
                onClick={() => handleAddAnother()}
                disabled={disabled || !derivedName || uploading}
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
