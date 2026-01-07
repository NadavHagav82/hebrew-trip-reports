-- Fix permissive notifications insert policy flagged by linter
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'service_role');
