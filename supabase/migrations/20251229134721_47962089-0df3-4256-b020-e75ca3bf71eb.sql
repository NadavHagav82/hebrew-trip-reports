-- Drop the ineffective restrictive policy
DROP POLICY IF EXISTS "block_anonymous_access" ON public.profiles;