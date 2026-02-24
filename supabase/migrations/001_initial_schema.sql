-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points ledger (immutable audit trail)
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta_points INTEGER NOT NULL, -- positive for earning, negative for spending
  reason TEXT NOT NULL,
  order_id UUID, -- optional reference to order if spending points
  created_by UUID REFERENCES profiles(id), -- admin who made the change
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store settings (single row config)
CREATE TABLE store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- enforce single row
  usd_to_points_rate NUMERIC(10,2) NOT NULL DEFAULT 1.00, -- e.g., $1 = 100 points
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insert default store settings
INSERT INTO store_settings (usd_to_points_rate) VALUES (100.00);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  base_usd NUMERIC(10,2) NOT NULL, -- base price in USD
  images TEXT[], -- array of image URLs
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product variants (optional: size, color, etc.)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL, -- e.g., "Large - Red"
  size TEXT,
  color TEXT,
  price_adjustment_usd NUMERIC(10,2) DEFAULT 0.00, -- additional cost beyond base
  inventory_count INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_points INTEGER NOT NULL,
  
  -- Shipping info
  ship_name TEXT NOT NULL,
  ship_address_line1 TEXT NOT NULL,
  ship_address_line2 TEXT,
  ship_city TEXT NOT NULL,
  ship_state TEXT NOT NULL,
  ship_zip TEXT NOT NULL,
  ship_country TEXT NOT NULL DEFAULT 'US',
  
  -- Tracking
  tracking_number TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  
  -- Snapshot at time of order (immutable)
  product_name TEXT NOT NULL,
  variant_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  points_per_item INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_points_ledger_user_id ON points_ledger(user_id);
CREATE INDEX idx_points_ledger_created_at ON points_ledger(created_at DESC);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Function to calculate user's current points balance
CREATE OR REPLACE FUNCTION get_user_points_balance(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(delta_points), 0)::INTEGER
  FROM points_ledger
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
