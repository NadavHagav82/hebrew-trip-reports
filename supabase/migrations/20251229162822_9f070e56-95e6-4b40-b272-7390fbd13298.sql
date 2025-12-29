-- Fix the profiles_limited view to use SECURITY INVOKER (not DEFINER)
DROP VIEW IF EXISTS public.profiles_limited;

CREATE VIEW public.profiles_limited 
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  department,
  is_manager,
  organization_id,
  manager_id,
  username
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_limited TO authenticated;