-- Fix RLS recursion by ensuring security-definer helpers bypass row security

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_org_id_for_policy(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.same_organization(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.get_user_organization_id(_a) IS NOT NULL
     AND public.get_user_organization_id(_a) = public.get_user_organization_id(_b);
$$;

-- Rebuild profiles policies without self-referencing functions (avoid recursion)
DROP POLICY IF EXISTS "Accounting managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Accounting managers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can view users in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can update profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their direct reports profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view manager profiles" ON public.profiles;

CREATE POLICY "Accounting managers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accounting_manager'::public.app_role));

CREATE POLICY "Accounting managers can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'accounting_manager'::public.app_role));

CREATE POLICY "Org admins can view users in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND organization_id = public.get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Org admins can update profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND organization_id = public.get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Managers can view their direct reports profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (manager_id = auth.uid());

CREATE POLICY "Anyone can view manager profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_manager = true);

-- Rebuild user_roles policies to avoid joins back to profiles under RLS
DROP POLICY IF EXISTS "Org admins can manage user_roles for org members" ON public.user_roles;

CREATE POLICY "Org admins can manage user_roles for org members"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND public.same_organization(auth.uid(), user_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'org_admin'::public.app_role)
  AND public.same_organization(auth.uid(), user_id)
);
