-- Drop the insecure update policy
DROP POLICY IF EXISTS "System can update tokens" ON public.bootstrap_tokens;

-- Create secure policy: Only admins and accounting managers can update tokens
CREATE POLICY "Only admins and accounting managers can update tokens"
ON public.bootstrap_tokens
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'accounting_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'accounting_manager'::app_role)
);