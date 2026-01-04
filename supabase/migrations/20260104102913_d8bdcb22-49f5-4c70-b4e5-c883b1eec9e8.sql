-- Add policy for travel request approvers to view attachments
CREATE POLICY "Travel request approvers can view attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'travel-attachments'
  AND EXISTS (
    SELECT 1 
    FROM travel_request_attachments tra
    JOIN travel_request_approvals tapp ON tapp.travel_request_id = tra.travel_request_id
    WHERE tra.file_url = objects.name
    AND tapp.approver_id = auth.uid()
  )
);

-- Also add policy for org_admin to view all travel attachments in their organization
CREATE POLICY "Org admin can view organization travel attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'travel-attachments'
  AND has_role(auth.uid(), 'org_admin'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM travel_request_attachments tra
    JOIN travel_requests tr ON tr.id = tra.travel_request_id
    JOIN profiles p ON p.id = tr.requested_by
    WHERE tra.file_url = objects.name
    AND p.organization_id = get_user_organization_id(auth.uid())
  )
);