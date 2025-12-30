-- Drop the existing view
DROP VIEW IF EXISTS public.profiles_limited;

-- Recreate as a proper view with security_invoker to inherit RLS from profiles table
-- The security_invoker option makes the view execute queries as the calling user, not the view owner
CREATE VIEW public.profiles_limited 
WITH (security_invoker = true)
AS SELECT 
  id,
  full_name,
  username,
  department,
  is_manager,
  manager_id,
  organization_id
FROM public.profiles;

-- Explicitly revoke all access from public/anon roles
REVOKE ALL ON public.profiles_limited FROM anon;
REVOKE ALL ON public.profiles_limited FROM public;

-- Grant SELECT only to authenticated users
GRANT SELECT ON public.profiles_limited TO authenticated;

-- Also ensure the underlying profiles table has proper restrictions for anon
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;