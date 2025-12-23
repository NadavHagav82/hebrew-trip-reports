-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;

-- Create a better policy that allows users to view receipts from their reports
CREATE POLICY "Users can view receipts from their reports" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'receipts' AND (
    -- Owner can always see their files
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Users can see receipts attached to their reports
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN expenses e ON e.id = r.expense_id
      JOIN reports rep ON rep.id = e.report_id
      WHERE r.file_url = name AND rep.user_id = auth.uid()
    )
    OR
    -- Managers can see receipts from their team's reports
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN expenses e ON e.id = r.expense_id
      JOIN reports rep ON rep.id = e.report_id
      WHERE r.file_url = name AND rep.user_id IN (SELECT get_team_user_ids(auth.uid()))
    )
    OR
    -- Accounting managers can see all receipts
    has_role(auth.uid(), 'accounting_manager'::app_role)
    OR
    -- Org admins can see receipts from their organization
    (
      has_role(auth.uid(), 'org_admin'::app_role) AND
      EXISTS (
        SELECT 1 FROM receipts r
        JOIN expenses e ON e.id = r.expense_id
        JOIN reports rep ON rep.id = e.report_id
        JOIN profiles p ON p.id = rep.user_id
        WHERE r.file_url = name AND p.organization_id = get_org_id_for_policy(auth.uid())
      )
    )
  )
);