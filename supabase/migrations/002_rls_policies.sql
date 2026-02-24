-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- PROFILES policies
CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- POINTS LEDGER policies
CREATE POLICY "Users can read their own points"
  ON points_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all points"
  ON points_ledger FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert points"
  ON points_ledger FOR INSERT
  WITH CHECK (is_admin());

-- STORE SETTINGS policies
CREATE POLICY "Anyone authenticated can read store settings"
  ON store_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update store settings"
  ON store_settings FOR UPDATE
  USING (is_admin());

-- PRODUCTS policies
CREATE POLICY "Anyone authenticated can read active products"
  ON products FOR SELECT
  USING (active = true OR is_admin());

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (is_admin());

-- PRODUCT VARIANTS policies
CREATE POLICY "Anyone authenticated can read active variants"
  ON product_variants FOR SELECT
  USING (
    active = true OR is_admin()
  );

CREATE POLICY "Admins can manage variants"
  ON product_variants FOR ALL
  USING (is_admin());

-- ORDERS policies
CREATE POLICY "Users can read their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  USING (is_admin());

-- ORDER ITEMS policies
CREATE POLICY "Users can read their own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items for their orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all order items"
  ON order_items FOR SELECT
  USING (is_admin());

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
