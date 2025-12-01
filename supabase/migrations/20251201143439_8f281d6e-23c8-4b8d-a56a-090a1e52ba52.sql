-- Fix infinite recursion in user_roles RLS policies
-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Accounting managers can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Accounting managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Recreate policies using the security definer function has_role
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accounting managers can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accounting_manager'::app_role));

CREATE POLICY "Accounting managers can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'accounting_manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'accounting_manager'::app_role));