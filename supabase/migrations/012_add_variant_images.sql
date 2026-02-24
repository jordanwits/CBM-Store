-- Add image_url column to product_variants
-- This allows each variant (especially colors) to have their own product image

ALTER TABLE product_variants 
ADD COLUMN image_url TEXT;

-- Add index for better query performance when filtering by image
CREATE INDEX idx_product_variants_image_url ON product_variants(image_url) WHERE image_url IS NOT NULL;

COMMENT ON COLUMN product_variants.image_url IS 
'Optional image URL for this specific variant. Used primarily for color variants to show different product images when customer selects a color.';
