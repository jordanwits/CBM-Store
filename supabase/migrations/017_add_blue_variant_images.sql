-- Add blue and silver variant images for t-shirt and water bottle
-- This migration adds the blue and silver product images to the color variants

-- Update all blue t-shirt variants to use the blue t-shirt image
UPDATE product_variants 
SET image_url = '/tshirt blue.png'
WHERE product_id = '00000000-0000-0000-0000-000000000001'
  AND color = 'Blue';

-- Update blue water bottle variant to use the blue bottle image
UPDATE product_variants 
SET image_url = '/Bottle blue.png'
WHERE product_id = '00000000-0000-0000-0000-000000000002'
  AND color = 'Blue';

-- Update silver water bottle variant to use the silver bottle image
UPDATE product_variants 
SET image_url = '/Bottle silver.png'
WHERE product_id = '00000000-0000-0000-0000-000000000002'
  AND color = 'Silver';
