-- Allow managers to view profiles of their direct reports
CREATE POLICY "Managers can view their direct reports profiles"
ON public.profiles
FOR SELECT
USING (manager_id = auth.uid());