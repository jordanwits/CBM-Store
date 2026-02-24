-- Add composite indexes for better query performance
-- These indexes optimize common query patterns used in the application

-- Points ledger: user_id + created_at DESC (for paginated points history)
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created 
  ON points_ledger(user_id, created_at DESC);

-- Orders: user_id + created_at DESC (for paginated orders list)
CREATE INDEX IF NOT EXISTS idx_orders_user_created 
  ON orders(user_id, created_at DESC);

-- Product variants: product_id + active (for filtering active variants by product)
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active 
  ON product_variants(product_id, active);

-- Product variants: active + size (for size filter in product catalog)
CREATE INDEX IF NOT EXISTS idx_product_variants_active_size 
  ON product_variants(active, size) WHERE size IS NOT NULL;

-- Product variants: active + color (for color filter in product catalog)
CREATE INDEX IF NOT EXISTS idx_product_variants_active_color 
  ON product_variants(active, color) WHERE color IS NOT NULL;

-- Order items: product_id (for checking if product can be deleted)
CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
  ON order_items(product_id);

-- Products: active + created_at DESC (for "newest" sort in catalog)
CREATE INDEX IF NOT EXISTS idx_products_active_created 
  ON products(active, created_at DESC);

-- Products: active + base_usd (for price sorting in catalog)
CREATE INDEX IF NOT EXISTS idx_products_active_price 
  ON products(active, base_usd);

-- Products: active + name (for name sorting in catalog)
CREATE INDEX IF NOT EXISTS idx_products_active_name 
  ON products(active, name);

-- Add text search index for product search (GIN index for faster ILIKE queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm 
  ON products USING gin(description gin_trgm_ops);

-- Comment explaining the performance improvements
COMMENT ON INDEX idx_points_ledger_user_created IS 
  'Speeds up paginated points history queries by user';
COMMENT ON INDEX idx_orders_user_created IS 
  'Speeds up paginated order list queries by user';
COMMENT ON INDEX idx_product_variants_product_active IS 
  'Speeds up variant lookups for active products';
