-- Create table for accounting comments on reports
CREATE TABLE IF NOT EXISTS public.accounting_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.accounting_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounting_comments
-- Accounting managers can create comments
CREATE POLICY "Accounting managers can create comments"
ON public.accounting_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.accounting_manager_email IS NOT NULL
  )
);

-- Accounting managers can view all comments
CREATE POLICY "Accounting managers can view all comments"
ON public.accounting_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.accounting_manager_email IS NOT NULL
  )
);

-- Accounting managers can update their own comments
CREATE POLICY "Accounting managers can update comments"
ON public.accounting_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.accounting_manager_email IS NOT NULL
  )
);

-- Report owners can view comments on their reports
CREATE POLICY "Report owners can view comments"
ON public.accounting_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reports
    WHERE reports.id = accounting_comments.report_id
    AND reports.user_id = auth.uid()
  )
);

-- Managers can view comments on reports they manage
CREATE POLICY "Managers can view comments on team reports"
ON public.accounting_comments
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM reports
    JOIN profiles ON profiles.id = reports.user_id
    WHERE reports.id = accounting_comments.report_id
    AND profiles.manager_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_accounting_comments_report_id ON public.accounting_comments(report_id);
CREATE INDEX idx_accounting_comments_created_by ON public.accounting_comments(created_by);