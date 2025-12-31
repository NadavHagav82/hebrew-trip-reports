-- Create enum for travel request status
CREATE TYPE travel_request_status AS ENUM ('draft', 'pending_approval', 'approved', 'partially_approved', 'rejected', 'cancelled');

-- Create enum for approval status
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'skipped');

-- Table 1: travel_requests (בקשות נסיעה)
CREATE TABLE public.travel_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Destination details
  destination_city TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (end_date - start_date) STORED,
  days INTEGER GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  
  -- Purpose
  purpose TEXT NOT NULL,
  purpose_details TEXT,
  
  -- Estimated costs
  estimated_flights NUMERIC(10,2) DEFAULT 0,
  estimated_flights_currency expense_currency DEFAULT 'USD',
  estimated_accommodation_per_night NUMERIC(10,2) DEFAULT 0,
  estimated_accommodation_currency expense_currency DEFAULT 'USD',
  estimated_meals_per_day NUMERIC(10,2) DEFAULT 0,
  estimated_meals_currency expense_currency DEFAULT 'USD',
  estimated_transport NUMERIC(10,2) DEFAULT 0,
  estimated_transport_currency expense_currency DEFAULT 'USD',
  estimated_other NUMERIC(10,2) DEFAULT 0,
  estimated_other_currency expense_currency DEFAULT 'USD',
  estimated_total_ils NUMERIC(10,2) DEFAULT 0,
  
  -- Employee notes
  employee_notes TEXT,
  
  -- Status
  status travel_request_status NOT NULL DEFAULT 'draft',
  current_approval_level INTEGER DEFAULT 1,
  
  -- Final approved amounts (set after approval)
  approved_flights NUMERIC(10,2),
  approved_accommodation_per_night NUMERIC(10,2),
  approved_meals_per_day NUMERIC(10,2),
  approved_transport NUMERIC(10,2),
  approved_other NUMERIC(10,2),
  approved_total_ils NUMERIC(10,2),
  
  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE,
  final_decision_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table 2: travel_request_approvals (שרשרת אישורים)
CREATE TABLE public.travel_request_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  travel_request_id UUID NOT NULL REFERENCES public.travel_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL DEFAULT 1,
  
  -- Decision
  status approval_status NOT NULL DEFAULT 'pending',
  
  -- Approved amounts (can be different from requested)
  approved_flights NUMERIC(10,2),
  approved_accommodation_per_night NUMERIC(10,2),
  approved_meals_per_day NUMERIC(10,2),
  approved_transport NUMERIC(10,2),
  approved_other NUMERIC(10,2),
  
  -- Comments
  comments TEXT,
  
  -- Timestamps
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint per request/approver/level
  UNIQUE(travel_request_id, approver_id, approval_level)
);

-- Table 3: travel_request_violations (חריגות מדיניות)
CREATE TABLE public.travel_request_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  travel_request_id UUID NOT NULL REFERENCES public.travel_requests(id) ON DELETE CASCADE,
  
  -- Violation details
  category expense_category NOT NULL,
  requested_amount NUMERIC(10,2) NOT NULL,
  policy_limit NUMERIC(10,2) NOT NULL,
  overage_amount NUMERIC(10,2) NOT NULL,
  overage_percentage NUMERIC(5,2) NOT NULL,
  
  -- Employee explanation
  employee_explanation TEXT,
  
  -- Status
  requires_special_approval BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table 4: approved_travels (נסיעות מאושרות)
CREATE TABLE public.approved_travels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  travel_request_id UUID NOT NULL REFERENCES public.travel_requests(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Approval number (e.g., TR-2025-001)
  approval_number TEXT NOT NULL UNIQUE,
  
  -- Approved budget (stored as JSON for flexibility)
  approved_budget JSONB NOT NULL DEFAULT '{}',
  
  -- Link to expense report (after travel)
  expense_report_id UUID REFERENCES public.reports(id),
  
  -- Status
  is_used BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.travel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_request_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_request_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_travels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for travel_requests

-- Users can view their own requests
CREATE POLICY "Users can view their own travel requests"
ON public.travel_requests FOR SELECT
USING (auth.uid() = requested_by);

-- Users can create their own requests
CREATE POLICY "Users can create their own travel requests"
ON public.travel_requests FOR INSERT
WITH CHECK (auth.uid() = requested_by AND organization_id = get_org_id_for_policy(auth.uid()));

-- Users can update their own draft requests
CREATE POLICY "Users can update their own draft travel requests"
ON public.travel_requests FOR UPDATE
USING (auth.uid() = requested_by AND status = 'draft');

-- Users can delete their own draft requests
CREATE POLICY "Users can delete their own draft travel requests"
ON public.travel_requests FOR DELETE
USING (auth.uid() = requested_by AND status = 'draft');

-- Managers can view team travel requests
CREATE POLICY "Managers can view team travel requests"
ON public.travel_requests FOR SELECT
USING (requested_by IN (SELECT get_team_user_ids(auth.uid())));

-- Managers can update team travel requests (for approval)
CREATE POLICY "Managers can update team travel requests"
ON public.travel_requests FOR UPDATE
USING (has_role(auth.uid(), 'manager') AND requested_by IN (SELECT get_team_user_ids(auth.uid())));

-- Org admins can view all org travel requests
CREATE POLICY "Org admins can view org travel requests"
ON public.travel_requests FOR SELECT
USING (has_role(auth.uid(), 'org_admin') AND organization_id = get_org_id_for_policy(auth.uid()));

-- Accounting managers can view all travel requests
CREATE POLICY "Accounting managers can view all travel requests"
ON public.travel_requests FOR SELECT
USING (has_role(auth.uid(), 'accounting_manager'));

-- RLS Policies for travel_request_approvals

-- Approvers can view their approvals
CREATE POLICY "Approvers can view their approvals"
ON public.travel_request_approvals FOR SELECT
USING (auth.uid() = approver_id);

-- Approvers can insert their approvals
CREATE POLICY "Approvers can insert their approvals"
ON public.travel_request_approvals FOR INSERT
WITH CHECK (auth.uid() = approver_id);

-- Approvers can update their pending approvals
CREATE POLICY "Approvers can update their pending approvals"
ON public.travel_request_approvals FOR UPDATE
USING (auth.uid() = approver_id AND status = 'pending');

-- Request owners can view their request approvals
CREATE POLICY "Request owners can view their request approvals"
ON public.travel_request_approvals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.travel_requests
  WHERE travel_requests.id = travel_request_approvals.travel_request_id
  AND travel_requests.requested_by = auth.uid()
));

-- RLS Policies for travel_request_violations

-- Request owners can view their violations
CREATE POLICY "Request owners can view their violations"
ON public.travel_request_violations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.travel_requests
  WHERE travel_requests.id = travel_request_violations.travel_request_id
  AND travel_requests.requested_by = auth.uid()
));

-- Request owners can insert violations (during request creation)
CREATE POLICY "Request owners can insert their violations"
ON public.travel_request_violations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.travel_requests
  WHERE travel_requests.id = travel_request_violations.travel_request_id
  AND travel_requests.requested_by = auth.uid()
));

-- Request owners can update their violations
CREATE POLICY "Request owners can update their violations"
ON public.travel_request_violations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.travel_requests
  WHERE travel_requests.id = travel_request_violations.travel_request_id
  AND travel_requests.requested_by = auth.uid()
));

-- Approvers can view violations for requests they approve
CREATE POLICY "Approvers can view request violations"
ON public.travel_request_violations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.travel_request_approvals
  WHERE travel_request_approvals.travel_request_id = travel_request_violations.travel_request_id
  AND travel_request_approvals.approver_id = auth.uid()
));

-- RLS Policies for approved_travels

-- Users can view their approved travels
CREATE POLICY "Users can view their approved travels"
ON public.approved_travels FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.travel_requests
  WHERE travel_requests.id = approved_travels.travel_request_id
  AND travel_requests.requested_by = auth.uid()
));

-- Managers can view team approved travels
CREATE POLICY "Managers can view team approved travels"
ON public.approved_travels FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.travel_requests
  WHERE travel_requests.id = approved_travels.travel_request_id
  AND travel_requests.requested_by IN (SELECT get_team_user_ids(auth.uid()))
));

-- Org admins can view org approved travels
CREATE POLICY "Org admins can view org approved travels"
ON public.approved_travels FOR SELECT
USING (has_role(auth.uid(), 'org_admin') AND organization_id = get_org_id_for_policy(auth.uid()));

-- Managers can insert approved travels (when approving)
CREATE POLICY "Managers can insert approved travels"
ON public.approved_travels FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'));

-- Accounting managers can view all approved travels
CREATE POLICY "Accounting managers can view all approved travels"
ON public.approved_travels FOR SELECT
USING (has_role(auth.uid(), 'accounting_manager'));

-- Create updated_at trigger for travel_requests
CREATE TRIGGER update_travel_requests_updated_at
BEFORE UPDATE ON public.travel_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create sequence for approval numbers
CREATE SEQUENCE IF NOT EXISTS travel_approval_number_seq START 1;

-- Function to generate approval number
CREATE OR REPLACE FUNCTION public.generate_travel_approval_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val INTEGER;
  year_part TEXT;
BEGIN
  next_val := nextval('travel_approval_number_seq');
  year_part := to_char(CURRENT_DATE, 'YYYY');
  RETURN 'TR-' || year_part || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_travel_requests_org ON public.travel_requests(organization_id);
CREATE INDEX idx_travel_requests_user ON public.travel_requests(requested_by);
CREATE INDEX idx_travel_requests_status ON public.travel_requests(status);
CREATE INDEX idx_travel_request_approvals_request ON public.travel_request_approvals(travel_request_id);
CREATE INDEX idx_travel_request_approvals_approver ON public.travel_request_approvals(approver_id);
CREATE INDEX idx_approved_travels_request ON public.approved_travels(travel_request_id);