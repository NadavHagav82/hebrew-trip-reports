-- Allow accounting managers to view all bootstrap tokens
CREATE POLICY "Accounting managers can view all tokens"
ON public.bootstrap_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'accounting_manager'
  )
);

-- Allow accounting managers to create new bootstrap tokens
CREATE POLICY "Accounting managers can create tokens"
ON public.bootstrap_tokens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'accounting_manager'
  )
);