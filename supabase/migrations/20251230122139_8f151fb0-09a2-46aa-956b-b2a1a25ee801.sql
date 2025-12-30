-- Create enum for policy rule per-type
CREATE TYPE public.policy_rule_per_type AS ENUM ('per_day', 'per_trip', 'per_item');

-- Create enum for policy action type
CREATE TYPE public.policy_action_type AS ENUM ('block', 'warn', 'require_approval');

-- Create enum for destination type
CREATE TYPE public.destination_type AS ENUM ('domestic', 'international', 'all');

-- Table for employee grades/levels in an organization
CREATE TABLE public.employee_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  level integer NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  UNIQUE(organization_id, level),
  UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE public.employee_grades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_grades
CREATE POLICY "Org admins can manage employee grades"
ON public.employee_grades FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Users can view their org employee grades"
ON public.employee_grades FOR SELECT
TO authenticated
USING (organization_id = get_org_id_for_policy(auth.uid()));

-- Table for travel policy rules by category
CREATE TABLE public.travel_policy_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  grade_id uuid REFERENCES public.employee_grades(id) ON DELETE CASCADE,
  max_amount numeric,
  currency public.expense_currency NOT NULL DEFAULT 'ILS',
  destination_type public.destination_type NOT NULL DEFAULT 'all',
  destination_countries text[],
  per_type public.policy_rule_per_type NOT NULL DEFAULT 'per_trip',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.travel_policy_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for travel_policy_rules
CREATE POLICY "Org admins can manage travel policy rules"
ON public.travel_policy_rules FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Users can view their org travel policy rules"
ON public.travel_policy_rules FOR SELECT
TO authenticated
USING (organization_id = get_org_id_for_policy(auth.uid()));

-- Table for travel restrictions (forbidden items)
CREATE TABLE public.travel_policy_restrictions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category public.expense_category,
  keywords text[],
  action_type public.policy_action_type NOT NULL DEFAULT 'block',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.travel_policy_restrictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for travel_policy_restrictions
CREATE POLICY "Org admins can manage travel restrictions"
ON public.travel_policy_restrictions FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Users can view their org travel restrictions"
ON public.travel_policy_restrictions FOR SELECT
TO authenticated
USING (organization_id = get_org_id_for_policy(auth.uid()));

-- Table for custom travel rules
CREATE TABLE public.custom_travel_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  description text,
  condition_json jsonb NOT NULL DEFAULT '{}',
  action_type public.policy_action_type NOT NULL DEFAULT 'warn',
  applies_to_grades uuid[],
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.custom_travel_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_travel_rules
CREATE POLICY "Org admins can manage custom travel rules"
ON public.custom_travel_rules FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'org_admin'::app_role) 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

CREATE POLICY "Users can view their org custom travel rules"
ON public.custom_travel_rules FOR SELECT
TO authenticated
USING (organization_id = get_org_id_for_policy(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_employee_grades_updated_at
BEFORE UPDATE ON public.employee_grades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_travel_policy_rules_updated_at
BEFORE UPDATE ON public.travel_policy_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_travel_rules_updated_at
BEFORE UPDATE ON public.custom_travel_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();