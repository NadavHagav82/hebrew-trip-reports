-- Fix profiles table RLS policies to require authentication
-- Drop existing SELECT policies and recreate with explicit auth check

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their direct reports profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can view users in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Accounting managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view limited manager info in their organization" ON public.profiles;

-- Recreate SELECT policies with explicit authentication requirement
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Managers can view their direct reports profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (manager_id = auth.uid());

CREATE POLICY "Org admins can view users in their organization" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin') 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Accounting managers can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Users can view limited manager info in their organization" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  is_manager = true 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Also fix INSERT and UPDATE policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Accounting managers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can update profiles in their org" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Accounting managers can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Org admins can update profiles in their org" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin') 
  AND organization_id = get_org_id_for_policy(auth.uid())
);