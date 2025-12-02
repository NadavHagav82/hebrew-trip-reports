-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add organization_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage organizations"
ON public.organizations
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Org admins can view their organization
CREATE POLICY "Org admins can view their organization"
ON public.organizations
FOR SELECT
USING (
  has_role(auth.uid(), 'org_admin') AND
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Org admins can update their organization
CREATE POLICY "Org admins can update their organization"
ON public.organizations
FOR UPDATE
USING (
  has_role(auth.uid(), 'org_admin') AND
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_organizations_updated_at();

-- Update RLS on profiles to allow org_admins to view users in their organization
CREATE POLICY "Org admins can view users in their organization"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'org_admin') AND
  organization_id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);