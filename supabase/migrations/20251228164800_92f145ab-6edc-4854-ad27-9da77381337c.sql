-- Drop the dangerous public read policy
DROP POLICY IF EXISTS "Anyone can read unused unexpired tokens" ON public.bootstrap_tokens;

-- Create secure policy: Only accounting managers and admins can view tokens
CREATE POLICY "Only admins and accounting managers can view tokens"
ON public.bootstrap_tokens
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'accounting_manager'::app_role)
);