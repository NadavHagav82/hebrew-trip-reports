-- Drop the existing delete policy and create a new one that includes approved statuses
DROP POLICY IF EXISTS "Users can delete their own editable travel requests" ON public.travel_requests;

CREATE POLICY "Users can delete their own travel requests" 
ON public.travel_requests 
FOR DELETE 
USING (
  (auth.uid() = requested_by) 
  AND (status = ANY (ARRAY[
    'draft'::travel_request_status, 
    'pending_approval'::travel_request_status, 
    'rejected'::travel_request_status, 
    'cancelled'::travel_request_status,
    'approved'::travel_request_status,
    'partially_approved'::travel_request_status
  ]))
);