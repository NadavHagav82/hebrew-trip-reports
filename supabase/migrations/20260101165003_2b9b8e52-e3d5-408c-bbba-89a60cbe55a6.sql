-- Fix RLS policy for travel_request_attachments to use the helper function
-- and avoid infinite recursion

DROP POLICY IF EXISTS "Approvers can view request attachments" ON public.travel_request_attachments;

CREATE POLICY "Approvers can view request attachments"
ON public.travel_request_attachments
FOR SELECT
USING (
  public.is_travel_request_approver(auth.uid(), travel_request_id)
);