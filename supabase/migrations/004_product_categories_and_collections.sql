-- Add category and collections fields to products table
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN collections TEXT[];

-- Add indexes for better query performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_collections ON products USING GIN(collections);

-- Backfill existing seed products with starter categories and collections
UPDATE products
SET 
  category = CASE
    WHEN name LIKE '%T-Shirt%' OR name LIKE '%Shirt%' THEN 'Apparel'
    WHEN name LIKE '%Bottle%' OR name LIKE '%Mug%' THEN 'Drinkware'
    WHEN name LIKE '%Backpack%' THEN 'Bags'
    WHEN name LIKE '%Headphones%' OR name LIKE '%Mouse%' THEN 'Electronics'
    WHEN name LIKE '%Notebook%' THEN 'Accessories'
    ELSE 'Accessories'
  END,
  collections = CASE
    WHEN name LIKE '%T-Shirt%' THEN ARRAY['New Arrivals', 'Essentials']
    WHEN name LIKE '%Bottle%' THEN ARRAY['Essentials', 'Eco-Friendly']
    WHEN name LIKE '%Backpack%' THEN ARRAY['Premium', 'Work Essentials']
    WHEN name LIKE '%Headphones%' THEN ARRAY['Premium', 'Electronics']
    WHEN name LIKE '%Mug%' OR name LIKE '%Notebook%' THEN ARRAY['Essentials']
    WHEN name LIKE '%Mouse%' THEN ARRAY['Electronics', 'Work Essentials']
    ELSE ARRAY['New Arrivals']
  END
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005'
);
