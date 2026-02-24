'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Card, CardContent } from 'core/components/Card';
import { uploadProductImage } from './actions';

interface Combination {
  size: string;
  color: string;
  sku?: string;
  price_adjustment_usd: number;
  inventory_count?: number;
  image_url?: string;
}

interface VariantMatrixBuilderProps {
  onSave: (combinations: Combination[]) => void;
  onCancel: () => void;
  isDevMode: boolean;
  disabled: boolean;
}

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

export function VariantMatrixBuilder({ onSave, onCancel, isDevMode, disabled }: VariantMatrixBuilderProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [colorImages, setColorImages] = useState<Record<string, string>>({});
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);

  const toggleSize = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  const handleColorImageUpload = async (color: string, file: File) => {
    setUploadingColor(color);
    const formData = new FormData();
    formData.append('file', file);
    
    const result = await uploadProductImage(formData);
    setUploadingColor(null);
    
    if (result.success && result.url) {
      setColorImages(prev => ({ ...prev, [color]: result.url! }));
    }
  };

  const generateCombinations = () => {
    const combos: Combination[] = [];
    
    selectedSizes.forEach(size => {
      selectedColors.forEach(color => {
        combos.push({
          size,
          color,
          price_adjustment_usd: 0,
          inventory_count: undefined,
          image_url: colorImages[color] || undefined,
        });
      });
    });
    
    setCombinations(combos);
    setStep(2);
  };

  const updateCombination = (index: number, field: keyof Combination, value: any) => {
    setCombinations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSave = () => {
    onSave(combinations);
  };

  if (step === 1) {
    return (
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Step 1: Select Sizes & Colors</h3>
            <p className="text-sm text-gray-600">
              Choose which sizes and colors you offer. We'll generate all combinations for you.
            </p>
          </div>

          {/* Sizes */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Available Sizes {selectedSizes.length > 0 && `(${selectedSizes.length} selected)`}
            </label>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedSizes.includes(size)
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Available Colors {selectedColors.length > 0 && `(${selectedColors.length} selected)`}
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => toggleColor(color)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedColors.includes(color)
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Color Images */}
          {selectedColors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Color Images (Optional but Recommended)
              </label>
              <div className="space-y-3">
                {selectedColors.map(color => (
                  <div key={color} className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                    <div className="w-24 font-medium text-gray-900">{color}</div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleColorImageUpload(color, file);
                        }}
                        disabled={isDevMode || disabled || uploadingColor === color}
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-white focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-1.5 file:px-3 file:rounded-l-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800"
                      />
                    </div>
                    {uploadingColor === color && (
                      <span className="text-sm text-primary">Uploading...</span>
                    )}
                    {colorImages[color] && !uploadingColor && (
                      <span className="text-sm text-green-600">✓ Uploaded</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Upload an image for each color to show when customers select that color
              </p>
            </div>
          )}

          {/* Summary */}
          {selectedSizes.length > 0 && selectedColors.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
              <p className="text-sm font-medium text-gray-900">
                This will create {selectedSizes.length} × {selectedColors.length} ={' '}
                <span className="text-primary font-bold">{selectedSizes.length * selectedColors.length} combinations</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                You'll be able to set inventory and pricing for each combination in the next step
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel} disabled={disabled}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={generateCombinations}
              disabled={disabled || selectedSizes.length === 0 || selectedColors.length === 0}
            >
              Next: Set Inventory →
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Manage combinations
  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Step 2: Set Inventory & Pricing
          </h3>
          <p className="text-sm text-gray-600">
            Configure inventory and pricing for each size-color combination
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Combination
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Inventory
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Price Adj ($)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {combinations.map((combo, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {combo.size} - {combo.color}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={combo.sku || ''}
                      onChange={(e) => updateCombination(index, 'sku', e.target.value)}
                      disabled={disabled}
                      placeholder="Optional"
                      className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={combo.inventory_count || ''}
                      onChange={(e) => updateCombination(index, 'inventory_count', e.target.value ? parseInt(e.target.value) : undefined)}
                      disabled={disabled}
                      placeholder="Unlimited"
                      className="w-32 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={combo.price_adjustment_usd}
                      onChange={(e) => updateCombination(index, 'price_adjustment_usd', parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      placeholder="0"
                      className="w-28 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setStep(1)} disabled={disabled}>
            ← Back
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={disabled}>
            Save All Combinations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

