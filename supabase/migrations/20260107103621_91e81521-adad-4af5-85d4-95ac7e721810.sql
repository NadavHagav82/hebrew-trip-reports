-- Create table for accounting send history
CREATE TABLE public.accounting_send_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL,
  sent_to_user_id UUID,
  sent_to_email TEXT NOT NULL,
  sent_to_name TEXT,
  send_method TEXT NOT NULL CHECK (send_method IN ('system', 'email')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_send_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view send history for reports they own or manage
CREATE POLICY "Users can view send history for their reports"
  ON public.accounting_send_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id
      AND (
        r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = r.user_id AND p.manager_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'accounting_manager')
        OR public.has_role(auth.uid(), 'org_admin')
      )
    )
  );

-- Policy: Managers and accounting managers can insert send history
CREATE POLICY "Managers can insert send history"
  ON public.accounting_send_history
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'accounting_manager')
    OR public.has_role(auth.uid(), 'org_admin')
  );

-- Create index for faster lookups
CREATE INDEX idx_accounting_send_history_report_id ON public.accounting_send_history(report_id);