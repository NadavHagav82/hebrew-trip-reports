-- Fix reports policies that join profiles table
DROP POLICY IF EXISTS "Managers can view subordinate reports" ON public.reports;
DROP POLICY IF EXISTS "Managers can view their team reports" ON public.reports;

-- Create a security definer function to get manager's team user IDs
CREATE OR REPLACE FUNCTION public.get_team_user_ids(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE manager_id = _manager_id
$$;

-- Recreate with security definer
CREATE POLICY "Managers can view their team reports"
ON public.reports
FOR SELECT
USING (user_id IN (SELECT public.get_team_user_ids(auth.uid())));

-- Fix expenses policies
DROP POLICY IF EXISTS "Managers can view subordinate expenses" ON public.expenses;

CREATE POLICY "Managers can view subordinate expenses"
ON public.expenses
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM reports r 
  WHERE r.id = expenses.report_id 
  AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
));

-- Fix receipts policies
DROP POLICY IF EXISTS "Managers can view subordinate receipts" ON public.receipts;

CREATE POLICY "Managers can view subordinate receipts"
ON public.receipts
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM expenses e
  JOIN reports r ON r.id = e.report_id
  WHERE e.id = receipts.expense_id 
  AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
));

-- Fix manager_comment_attachments policies  
DROP POLICY IF EXISTS "Managers can view subordinate manager_comment_attachments" ON public.manager_comment_attachments;

CREATE POLICY "Managers can view subordinate manager_comment_attachments"
ON public.manager_comment_attachments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM expenses e
  JOIN reports r ON r.id = e.report_id
  WHERE e.id = manager_comment_attachments.expense_id 
  AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
));

-- Fix accounting_comments policies
DROP POLICY IF EXISTS "Managers can view comments on team reports" ON public.accounting_comments;
DROP POLICY IF EXISTS "Managers can view subordinate accounting_comments" ON public.accounting_comments;

CREATE POLICY "Managers can view subordinate accounting_comments"
ON public.accounting_comments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM reports r 
  WHERE r.id = accounting_comments.report_id 
  AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
));

-- Fix report_history policies
DROP POLICY IF EXISTS "Managers can view subordinate report_history" ON public.report_history;
DROP POLICY IF EXISTS "Managers can insert history for team reports" ON public.report_history;

CREATE POLICY "Managers can view subordinate report_history"
ON public.report_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM reports r 
  WHERE r.id = report_history.report_id 
  AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
));

CREATE POLICY "Managers can insert history for team reports"
ON public.report_history
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM reports r 
  WHERE r.id = report_history.report_id 
  AND r.user_id IN (SELECT public.get_team_user_ids(auth.uid()))
));