-- Drop existing storage policies if any exist and recreate with explicit authentication

-- Receipts bucket policies
DROP POLICY IF EXISTS "Users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;

-- Manager attachments bucket policies
DROP POLICY IF EXISTS "Users can view manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete manager attachments" ON storage.objects;

-- Create new policies for receipts bucket with explicit authentication
CREATE POLICY "Authenticated users can view receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- Create new policies for manager-attachments bucket with explicit authentication
CREATE POLICY "Authenticated users can view manager attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'manager-attachments');

CREATE POLICY "Authenticated users can upload manager attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'manager-attachments');

CREATE POLICY "Authenticated users can update manager attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'manager-attachments');

CREATE POLICY "Authenticated users can delete manager attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'manager-attachments');