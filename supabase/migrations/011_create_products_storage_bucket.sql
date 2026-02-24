-- Create a public storage bucket for product images
-- This allows admins to upload images and make them publicly accessible

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,  -- public bucket so images are accessible via public URL
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
);

-- Storage RLS policies for the products bucket

-- Allow authenticated users to read (public bucket, so this is redundant but explicit)
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

-- Only admins can upload product images
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'products' 
    AND (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );

-- Only admins can update product images
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'products' 
    AND (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );

-- Only admins can delete product images
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'products' 
    AND (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );
