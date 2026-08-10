'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Card, CardContent } from 'core/components/Card';
import { createVariant, updateVariant, deleteVariant, uploadProductImage } from './actions';
import { VariantMatrixBuilder } from './VariantMatrixBuilder';
import { sizeOptions, colorOptions, CUSTOM_VALUE } from './variantOptions';

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
  const [variantType, setVariantType] = useState<'sizecolor' | 'custom'>('sizecolor');
  // True when the size/color is typed in manually rather than picked from the list
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [formData, setFormData] = useState({
    value: '',
    size: '',
    color: '',
    sku: '',
    price_adjustment_usd: '0',
    inventory_count: '',
    image_url: '',
  });

  // Built the same way the matrix builder names its combinations, so a variant added
  // here and one generated there read identically on the fulfillment page
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
    setFormData({
      value: '',
      size: '',
      color: '',
      sku: '',
      price_adjustment_usd: '0',
      inventory_count: '',
      image_url: '',
    });
    setVariantType('sizecolor');
    setIsCustomSize(false);
    setIsCustomColor(false);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (variant: Variant) => {
    const size = variant.size || '';
    const color = variant.color || '';
    // A variant carrying neither dimension is a standalone entry named by hand
    const type: 'sizecolor' | 'custom' = size || color ? 'sizecolor' : 'custom';

    setVariantType(type);
    // Values saved before the list was trimmed (or entered manually) aren't in the
    // dropdown — edit them as custom entries so they aren't silently blanked
    setIsCustomSize(!!size && !sizeOptions.includes(size));
    setIsCustomColor(!!color && !colorOptions.includes(color));
    setFormData({
      value: type === 'custom' ? variant.name : '',
      size,
      color,
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
    if (!derivedName) {
      setMessage({
        type: 'error',
        text: variantType === 'custom'
          ? 'Please enter a variant name'
          : 'Please choose a size, a color, or both',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    // Both dimensions go on every save — sending only the one that changed leaves a
    // stale value behind when a variant is edited from, say, colored to size-only
    const variantData: any = {
      product_id: productId,
      name: derivedName,
      sku: formData.sku.trim() || undefined,
      size: variantType === 'custom' ? '' : formData.size.trim(),
      color: variantType === 'custom' ? '' : formData.color.trim(),
      price_adjustment_usd: parseFloat(formData.price_adjustment_usd) || 0,
      // null (not undefined) so clearing the field actually saves as untracked
      inventory_count: formData.inventory_count.trim() === ''
        ? null
        : parseInt(formData.inventory_count),
    };

    if (canShowImage) {
      variantData.image_url = formData.image_url.trim();
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
    label: string;
    size?: string;
    color?: string;
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
        name: combo.label,
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
    setMessage({ type: 'success', text: `${combinations.length} variants created successfully!` });
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
              <p className="text-sm text-gray-600 mt-1">
                Set a size, a color, or both. Fulfillment sees whichever you fill in.
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
                  disabled={isDevMode || disabled || loading}
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
                  disabled={isDevMode || disabled || loading}
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
                    disabled={isDevMode || disabled || loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={isDevMode || disabled || loading}
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
                    disabled={isDevMode || disabled || loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={isDevMode || disabled || loading}
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
                  Variant Image {variantType === 'custom' ? '(Optional)' : '(Recommended)'}
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
                    {variantType === 'custom'
                      ? 'Upload an image showing this specific variant'
                      : `Upload an image showing this product in ${formData.color.trim()}`}
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
                disabled={isDevMode || disabled || loading || !derivedName}
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
