-- Allow anyone to view active organization names for registration purposes
CREATE POLICY "Anyone can view active organization names"
ON public.organizations
FOR SELECT
TO authenticated, anon
USING (is_active = true);