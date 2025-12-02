-- Fix RLS policies for report_history table
-- Allow users to insert history records for their own reports
CREATE POLICY "Users can insert history for their reports"
ON public.report_history
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM reports
    WHERE reports.id = report_history.report_id 
    AND reports.user_id = auth.uid()
  )
);

-- Allow managers to insert history for their team's reports
CREATE POLICY "Managers can insert history for team reports"
ON public.report_history
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM reports r
    JOIN profiles p ON r.user_id = p.id
    WHERE r.id = report_history.report_id 
    AND p.manager_id = auth.uid()
  )
);

-- Allow accounting managers to insert history for any report
CREATE POLICY "Accounting managers can insert history for any report"
ON public.report_history
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'
  )
);

-- Fix ManagerDashboard query - add RLS policy for managers to view team reports
CREATE POLICY "Managers can view their team reports"
ON public.reports
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = reports.user_id
    AND profiles.manager_id = auth.uid()
  )
);