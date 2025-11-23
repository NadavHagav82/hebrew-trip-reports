-- Allow anyone to view manager profiles (for registration page)
CREATE POLICY "Anyone can view manager profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (is_manager = true);