-- Allow users to update their rejected/cancelled travel requests back to draft
CREATE POLICY "Users can resubmit rejected or cancelled travel requests" 
ON public.travel_requests 
FOR UPDATE 
USING (
  auth.uid() = requested_by 
  AND status IN ('rejected', 'cancelled')
)
WITH CHECK (
  auth.uid() = requested_by 
  AND status = 'draft'
);