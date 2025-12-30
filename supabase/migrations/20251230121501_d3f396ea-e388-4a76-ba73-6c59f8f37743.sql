-- Fix profiles table RLS policies to explicitly require authentication
-- Drop all existing SELECT policies and recreate with TO authenticated

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their direct reports profiles" ON public.profiles;
DROP POLICY IF EXISTS "Accounting managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can view users in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can view managers in their org for assignment only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Accounting managers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can update profiles in their org" ON public.profiles;

-- Recreate all SELECT policies with explicit TO authenticated

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

CREATE POLICY "Accounting managers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'::app_role));

CREATE POLICY "Org admins can view users in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Users can view managers in their org for assignment only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_manager = true 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Recreate INSERT policy with TO authenticated
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Recreate UPDATE policies with TO authenticated
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Accounting managers can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'::app_role));

CREATE POLICY "Org admins can update profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));