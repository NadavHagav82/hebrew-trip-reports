-- Create enum for approval chain level types
CREATE TYPE public.approval_level_type AS ENUM ('direct_manager', 'org_admin', 'accounting_manager', 'specific_user');

-- Create approval chain configurations table
CREATE TABLE public.approval_chain_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create approval chain levels table (each level in the chain)
CREATE TABLE public.approval_chain_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.approval_chain_configs(id) ON DELETE CASCADE,
  level_order INTEGER NOT NULL DEFAULT 1,
  level_type approval_level_type NOT NULL,
  specific_user_id UUID REFERENCES auth.users(id),
  is_required BOOLEAN NOT NULL DEFAULT true,
  can_skip_if_approved_amount_under NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_specific_user CHECK (
    (level_type = 'specific_user' AND specific_user_id IS NOT NULL) OR
    (level_type != 'specific_user' AND specific_user_id IS NULL)
  )
);

-- Create grade-based chain assignment table
CREATE TABLE public.grade_chain_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES public.employee_grades(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL REFERENCES public.approval_chain_configs(id) ON DELETE CASCADE,
  min_amount NUMERIC,
  max_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, grade_id, min_amount, max_amount)
);

-- Enable RLS on all tables
ALTER TABLE public.approval_chain_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chain_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_chain_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for approval_chain_configs
CREATE POLICY "Org admins can manage approval chains"
ON public.approval_chain_configs
FOR ALL
USING (
  has_role(auth.uid(), 'org_admin') AND 
  organization_id = get_org_id_for_policy(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin') AND 
  organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Accounting managers can manage approval chains"
ON public.approval_chain_configs
FOR ALL
USING (has_role(auth.uid(), 'accounting_manager'))
WITH CHECK (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Users can view their org approval chains"
ON public.approval_chain_configs
FOR SELECT
USING (organization_id = get_org_id_for_policy(auth.uid()));

-- RLS policies for approval_chain_levels
CREATE POLICY "Org admins can manage chain levels"
ON public.approval_chain_levels
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.approval_chain_configs c
    WHERE c.id = approval_chain_levels.chain_id
    AND (
      (has_role(auth.uid(), 'org_admin') AND c.organization_id = get_org_id_for_policy(auth.uid()))
      OR has_role(auth.uid(), 'accounting_manager')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.approval_chain_configs c
    WHERE c.id = approval_chain_levels.chain_id
    AND (
      (has_role(auth.uid(), 'org_admin') AND c.organization_id = get_org_id_for_policy(auth.uid()))
      OR has_role(auth.uid(), 'accounting_manager')
    )
  )
);

CREATE POLICY "Users can view their org chain levels"
ON public.approval_chain_levels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.approval_chain_configs c
    WHERE c.id = approval_chain_levels.chain_id
    AND c.organization_id = get_org_id_for_policy(auth.uid())
  )
);

-- RLS policies for grade_chain_assignments
CREATE POLICY "Org admins can manage grade assignments"
ON public.grade_chain_assignments
FOR ALL
USING (
  has_role(auth.uid(), 'org_admin') AND 
  organization_id = get_org_id_for_policy(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin') AND 
  organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Accounting managers can manage grade assignments"
ON public.grade_chain_assignments
FOR ALL
USING (has_role(auth.uid(), 'accounting_manager'))
WITH CHECK (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Users can view their org grade assignments"
ON public.grade_chain_assignments
FOR SELECT
USING (organization_id = get_org_id_for_policy(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_approval_chain_configs_updated_at
BEFORE UPDATE ON public.approval_chain_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_approval_chain_levels_chain_id ON public.approval_chain_levels(chain_id);
CREATE INDEX idx_grade_chain_assignments_org_id ON public.grade_chain_assignments(organization_id);
CREATE INDEX idx_grade_chain_assignments_chain_id ON public.grade_chain_assignments(chain_id);