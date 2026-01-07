-- Allow managers to create notifications for their team members
CREATE POLICY "Managers can create notifications for their employees"
ON public.notifications
FOR INSERT
WITH CHECK (
  -- The notification recipient (user_id) must be managed by the authenticated user
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_id
    AND p.manager_id = auth.uid()
  )
);

-- Allow users to create notifications for themselves (for system-generated notifications)
CREATE POLICY "Users can create notifications for themselves"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);