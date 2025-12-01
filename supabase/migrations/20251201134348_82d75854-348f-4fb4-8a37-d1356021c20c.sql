-- Create a security definer function to check if accounting manager exists
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.accounting_manager_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'accounting_manager'
  )
$$;

-- Grant execute permission to anonymous users for bootstrap page
GRANT EXECUTE ON FUNCTION public.accounting_manager_exists() TO anon;