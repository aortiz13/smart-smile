-- Create 'uploads' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anyone (anon) to upload to 'uploads'
CREATE POLICY "Allow Public Uploads"
ON storage.objects
FOR INSERT
WITH CHECK ( bucket_id = 'uploads' );

-- Policy to allow anyone (anon) to read from 'uploads'
CREATE POLICY "Allow Public Select"
ON storage.objects
FOR SELECT
USING ( bucket_id = 'uploads' );

-- Policy to allow anyone (anon) to update their own uploads (optional, but good for retries)
-- For simplicity, we stick to Insert/Select. Update might need auth check.
