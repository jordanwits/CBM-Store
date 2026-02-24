-- Seed some sample products for testing
-- Note: In production, admins will add these through the admin panel

INSERT INTO products (id, name, description, base_usd, images, active) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Company Logo T-Shirt',
    'Premium cotton t-shirt with embroidered company logo. Available in multiple sizes and colors.',
    25.00,
    ARRAY['/ChrisCrossBlackCottonT-Shirt.webp'],
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Insulated Water Bottle',
    'Stainless steel insulated water bottle keeps drinks cold for 24 hours. Features company logo.',
    35.00,
    ARRAY['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'],
    true
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Laptop Backpack',
    'Durable laptop backpack with padded compartment for 15" laptops. Multiple pockets for organization.',
    75.00,
    ARRAY['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'],
    true
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Wireless Mouse',
    'Ergonomic wireless mouse with company branding. Includes USB receiver and batteries.',
    45.00,
    ARRAY['/b43457a0-76b6-11f0-9faf-5258f188704a.png'],
    true
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Notebook Set',
    'Set of 3 premium notebooks with company logo. Lined pages, elastic closure.',
    20.00,
    ARRAY['/moleskine-classic-hardcover-notebook-black.webp'],
    true
  );

-- Add some variants for the t-shirt
INSERT INTO product_variants (product_id, sku, name, size, color, price_adjustment_usd, active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-S-BLUE', 'Small - Blue', 'S', 'Blue', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-M-BLUE', 'Medium - Blue', 'M', 'Blue', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-L-BLUE', 'Large - Blue', 'L', 'Blue', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-XL-BLUE', 'X-Large - Blue', 'XL', 'Blue', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-S-BLACK', 'Small - Black', 'S', 'Black', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-M-BLACK', 'Medium - Black', 'M', 'Black', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-L-BLACK', 'Large - Black', 'L', 'Black', 0.00, true),
  ('00000000-0000-0000-0000-000000000001', 'TSHIRT-XL-BLACK', 'X-Large - Black', 'XL', 'Black', 0.00, true);

-- Add color variants for water bottle
INSERT INTO product_variants (product_id, sku, name, color, price_adjustment_usd, active) VALUES
  ('00000000-0000-0000-0000-000000000002', 'BOTTLE-BLUE', 'Blue', 'Blue', 0.00, true),
  ('00000000-0000-0000-0000-000000000002', 'BOTTLE-BLACK', 'Black', 'Black', 0.00, true),
  ('00000000-0000-0000-0000-000000000002', 'BOTTLE-SILVER', 'Silver', 'Silver', 0.00, true);
