-- Fix infinite recursion between travel_requests and travel_request_approvals RLS
-- by using a SECURITY DEFINER helper function (bypasses RLS inside the function).

CREATE OR REPLACE FUNCTION public.is_travel_request_approver(_user_id uuid, _travel_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.travel_request_approvals tra
    WHERE tra.travel_request_id = _travel_request_id
      AND tra.approver_id = _user_id
  );
$$;

-- Replace policy to avoid cross-table reference that triggers recursion
DROP POLICY IF EXISTS "Approvers can view assigned travel requests" ON public.travel_requests;

CREATE POLICY "Approvers can view assigned travel requests"
ON public.travel_requests
FOR SELECT
USING (
  public.is_travel_request_approver(auth.uid(), travel_requests.id)
);