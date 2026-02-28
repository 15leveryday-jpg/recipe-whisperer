
-- Create storage bucket for recipe images
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to recipe-images bucket
CREATE POLICY "Users can upload recipe images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images');

-- Allow public read access
CREATE POLICY "Public read access for recipe images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own recipe images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add reference_image_url column to recipes
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS reference_image_url text;
