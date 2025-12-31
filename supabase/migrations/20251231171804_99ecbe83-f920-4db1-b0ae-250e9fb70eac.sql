-- Create storage bucket for travel request attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('travel-attachments', 'travel-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create table for travel request attachments
CREATE TABLE public.travel_request_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  travel_request_id UUID NOT NULL REFERENCES public.travel_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- 'flights', 'accommodation', 'transport', 'other', 'link'
  link_url TEXT, -- For external links (Expedia, Booking.com, etc.)
  notes TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.travel_request_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attachments
CREATE POLICY "Request owners can insert attachments"
ON public.travel_request_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM travel_requests
    WHERE travel_requests.id = travel_request_attachments.travel_request_id
    AND travel_requests.requested_by = auth.uid()
  )
);

CREATE POLICY "Request owners can view their attachments"
ON public.travel_request_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM travel_requests
    WHERE travel_requests.id = travel_request_attachments.travel_request_id
    AND travel_requests.requested_by = auth.uid()
  )
);

CREATE POLICY "Request owners can delete their attachments"
ON public.travel_request_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM travel_requests
    WHERE travel_requests.id = travel_request_attachments.travel_request_id
    AND travel_requests.requested_by = auth.uid()
    AND travel_requests.status IN ('draft', 'pending_approval')
  )
);

CREATE POLICY "Approvers can view request attachments"
ON public.travel_request_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM travel_request_approvals
    WHERE travel_request_approvals.travel_request_id = travel_request_attachments.travel_request_id
    AND travel_request_approvals.approver_id = auth.uid()
  )
);

CREATE POLICY "Managers can view team attachments"
ON public.travel_request_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM travel_requests
    WHERE travel_requests.id = travel_request_attachments.travel_request_id
    AND travel_requests.requested_by IN (SELECT get_team_user_ids(auth.uid()))
  )
);

CREATE POLICY "Accounting managers can view all attachments"
ON public.travel_request_attachments
FOR SELECT
USING (has_role(auth.uid(), 'accounting_manager'));

-- Storage policies for travel-attachments bucket
CREATE POLICY "Users can upload travel attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'travel-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their travel attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'travel-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their travel attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'travel-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Managers can view team travel attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'travel-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id::text = (storage.foldername(name))[1]
    AND profiles.manager_id = auth.uid()
  )
);

CREATE POLICY "Accounting managers can view all travel attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'travel-attachments'
  AND has_role(auth.uid(), 'accounting_manager')
);