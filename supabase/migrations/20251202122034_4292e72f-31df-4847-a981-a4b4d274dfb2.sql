-- Allow managers to view their employees' reports and related data

-- Reports: manager of report owner can SELECT
CREATE POLICY "Managers can view subordinate reports"
ON public.reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = reports.user_id
      AND p.manager_id = auth.uid()
  )
);

-- Expenses: manager of report owner can SELECT
CREATE POLICY "Managers can view subordinate expenses"
ON public.expenses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.id = expenses.report_id
      AND p.manager_id = auth.uid()
  )
);

-- Receipts: manager of report owner can SELECT
CREATE POLICY "Managers can view subordinate receipts"
ON public.receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.reports r ON r.id = e.report_id
    JOIN public.profiles p ON p.id = r.user_id
    WHERE e.id = receipts.expense_id
      AND p.manager_id = auth.uid()
  )
);

-- Report history: manager of report owner can SELECT
CREATE POLICY "Managers can view subordinate report_history"
ON public.report_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.id = report_history.report_id
      AND p.manager_id = auth.uid()
  )
);

-- Accounting comments: manager of report owner can SELECT
CREATE POLICY "Managers can view subordinate accounting_comments"
ON public.accounting_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.id = accounting_comments.report_id
      AND p.manager_id = auth.uid()
  )
);

-- Manager comment attachments: manager of report owner can SELECT
CREATE POLICY "Managers can view subordinate manager_comment_attachments"
ON public.manager_comment_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.reports r ON r.id = e.report_id
    JOIN public.profiles p ON p.id = r.user_id
    WHERE e.id = manager_comment_attachments.expense_id
      AND p.manager_id = auth.uid()
  )
);