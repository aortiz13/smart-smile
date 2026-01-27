-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('uploads', 'uploads', true),
  ('scans', 'scans', true),
  ('generated', 'generated', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anyone (anon) to upload
CREATE POLICY "Allow Public Uploads"
ON storage.objects
FOR INSERT
WITH CHECK ( bucket_id IN ('uploads', 'scans', 'generated') );

-- Policy to allow anyone (anon) to read
CREATE POLICY "Allow Public Select"
ON storage.objects
FOR SELECT
USING ( bucket_id IN ('uploads', 'scans', 'generated') );

-- Policy to allow anyone (anon) to update their own uploads (optional, but good for retries)
-- For simplicity, we stick to Insert/Select. Update might need auth check.
