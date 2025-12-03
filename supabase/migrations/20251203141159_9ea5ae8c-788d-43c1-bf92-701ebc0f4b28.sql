-- Create invitation_codes table for the complete onboarding flow
CREATE TABLE public.invitation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_used boolean DEFAULT false NOT NULL,
  used_at timestamp with time zone,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  max_uses integer DEFAULT 1,
  use_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all invitation codes
CREATE POLICY "Admins can manage all invitation_codes"
ON public.invitation_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Accounting managers can manage all invitation codes
CREATE POLICY "Accounting managers can manage invitation_codes"
ON public.invitation_codes
FOR ALL
USING (has_role(auth.uid(), 'accounting_manager'::app_role));

-- Org admins can manage codes for their organization
CREATE POLICY "Org admins can view their org invitation_codes"
ON public.invitation_codes
FOR SELECT
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Org admins can create codes for their org"
ON public.invitation_codes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Org admins can update codes for their org"
ON public.invitation_codes
FOR UPDATE
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Anyone can read valid unused codes (for registration)
CREATE POLICY "Anyone can read valid unused codes"
ON public.invitation_codes
FOR SELECT
USING (
  is_used = false 
  AND expires_at > now() 
  AND (max_uses IS NULL OR use_count < max_uses)
);

-- Create index for faster lookups
CREATE INDEX idx_invitation_codes_code ON public.invitation_codes(code);
CREATE INDEX idx_invitation_codes_org ON public.invitation_codes(organization_id);