-- Allow users to update their own pending_approval travel requests to cancelled
CREATE POLICY "Users can cancel their pending travel requests" 
ON public.travel_requests 
FOR UPDATE 
USING (
  auth.uid() = requested_by 
  AND status = 'pending_approval'
)
WITH CHECK (
  auth.uid() = requested_by 
  AND status = 'cancelled'
);

-- Allow request owners to delete pending approvals when cancelling
CREATE POLICY "Request owners can delete pending approvals" 
ON public.travel_request_approvals 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM travel_requests
    WHERE travel_requests.id = travel_request_approvals.travel_request_id
    AND travel_requests.requested_by = auth.uid()
  )
  AND status = 'pending'
);