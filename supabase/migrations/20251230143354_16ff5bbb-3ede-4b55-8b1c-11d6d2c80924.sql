-- Create audit log table for policy changes
CREATE TABLE public.policy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.policy_audit_log ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_policy_audit_log_org_id ON public.policy_audit_log(organization_id);
CREATE INDEX idx_policy_audit_log_created_at ON public.policy_audit_log(created_at DESC);

-- Org admins can view audit logs for their organization
CREATE POLICY "Org admins can view policy audit logs"
ON public.policy_audit_log
FOR SELECT
USING (
  has_role(auth.uid(), 'org_admin') 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

-- Org admins can insert audit logs for their organization
CREATE POLICY "Org admins can insert policy audit logs"
ON public.policy_audit_log
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'org_admin') 
  AND organization_id = get_org_id_for_policy(auth.uid())
);

-- Accounting managers can view all audit logs
CREATE POLICY "Accounting managers can view all policy audit logs"
ON public.policy_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'accounting_manager'));

-- Admins can view all audit logs
CREATE POLICY "Admins can view all policy audit logs"
ON public.policy_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'));