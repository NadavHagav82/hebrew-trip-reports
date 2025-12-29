-- Block anonymous access to profiles table
CREATE POLICY "block_anonymous_access" 
ON public.profiles 
FOR SELECT 
TO anon 
USING (false);