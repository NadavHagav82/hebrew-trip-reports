-- Drop the old restrictive delete policy
DROP POLICY IF EXISTS "Users can delete their own draft travel requests" ON public.travel_requests;

-- Create new policy that allows deletion of draft, rejected, and cancelled requests
CREATE POLICY "Users can delete their own editable travel requests"
ON public.travel_requests
FOR DELETE
USING (
  auth.uid() = requested_by 
  AND status IN ('draft', 'rejected', 'cancelled')
);