-- Logged-in users can suggest products for the store; admins view in database / email.
CREATE TABLE product_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggestion TEXT NOT NULL CHECK (char_length(suggestion) <= 500 AND btrim(suggestion) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_suggestions_created_at ON product_suggestions(created_at DESC);
CREATE INDEX idx_product_suggestions_user_id ON product_suggestions(user_id);

ALTER TABLE product_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all product suggestions"
  ON product_suggestions FOR SELECT
  USING (is_admin());

CREATE POLICY "Users insert own product suggestions"
  ON product_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE product_suggestions IS
  'User-submitted product ideas for the merch store; visible to admins.';
