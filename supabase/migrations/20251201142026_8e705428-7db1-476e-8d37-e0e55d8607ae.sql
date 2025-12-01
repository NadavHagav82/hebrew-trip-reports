-- Add policy to allow inserting first admin when no admin exists
CREATE POLICY "Allow creating first admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'admin'::app_role 
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role
  )
);