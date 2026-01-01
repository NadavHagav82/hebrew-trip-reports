-- Drop the current delete policy
DROP POLICY IF EXISTS "Users can delete their own editable travel requests" ON public.travel_requests;

-- Create new policy that also allows deletion of pending_approval requests
CREATE POLICY "Users can delete their own editable travel requests"
ON public.travel_requests
FOR DELETE
USING (
  auth.uid() = requested_by 
  AND status IN ('draft', 'pending_approval', 'rejected', 'cancelled')
);