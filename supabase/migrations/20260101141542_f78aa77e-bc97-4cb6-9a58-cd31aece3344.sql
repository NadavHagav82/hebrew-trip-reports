-- Drop the existing policy that doesn't allow status change properly
DROP POLICY IF EXISTS "Users can update their own draft travel requests" ON public.travel_requests;

-- Create a new policy that allows users to update their own draft requests and change status to pending_approval
CREATE POLICY "Users can update their own draft travel requests" 
ON public.travel_requests 
FOR UPDATE 
USING (
  auth.uid() = requested_by 
  AND status = 'draft'::travel_request_status
)
WITH CHECK (
  auth.uid() = requested_by 
  AND status IN ('draft'::travel_request_status, 'pending_approval'::travel_request_status)
);