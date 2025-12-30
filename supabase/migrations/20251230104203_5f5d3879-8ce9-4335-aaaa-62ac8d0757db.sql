-- Fix all remaining tables' RLS policies to require explicit authentication

-- ========== ORGANIZATIONS ==========
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Admins can manage organizations" ON public.organizations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can update their organization" ON public.organizations FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Org admins can view their organization" ON public.organizations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own organization" ON public.organizations FOR SELECT TO authenticated
USING (id = get_user_organization_id(auth.uid()));

-- ========== EXPENSES ==========
DROP POLICY IF EXISTS "Users can view expenses for their reports" ON public.expenses;
DROP POLICY IF EXISTS "Users can create expenses for their reports" ON public.expenses;
DROP POLICY IF EXISTS "Users can update expenses for their reports" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete expenses for their reports" ON public.expenses;
DROP POLICY IF EXISTS "Managers can view subordinate expenses" ON public.expenses;
DROP POLICY IF EXISTS "Managers can view expenses in submitted reports" ON public.expenses;
DROP POLICY IF EXISTS "Accounting managers can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Accounting managers can create expenses for any report" ON public.expenses;
DROP POLICY IF EXISTS "Accounting managers can update all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Accounting managers can delete all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Org admins can view expenses from their organization" ON public.expenses;

CREATE POLICY "Users can view expenses for their reports" ON public.expenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = expenses.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can create expenses for their reports" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM reports WHERE reports.id = expenses.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can update expenses for their reports" ON public.expenses FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = expenses.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can delete expenses for their reports" ON public.expenses FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = expenses.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Managers can view subordinate expenses" ON public.expenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports r WHERE r.id = expenses.report_id AND r.user_id IN (SELECT get_team_user_ids(auth.uid()))));

CREATE POLICY "Managers can view expenses in submitted reports" ON public.expenses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'manager') AND EXISTS (SELECT 1 FROM reports WHERE reports.id = expenses.report_id AND reports.status = ANY (ARRAY['pending_approval'::expense_status, 'closed'::expense_status])));

CREATE POLICY "Accounting managers can view all expenses" ON public.expenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can create expenses for any report" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can update all expenses" ON public.expenses FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can delete all expenses" ON public.expenses FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Org admins can view expenses from their organization" ON public.expenses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND EXISTS (SELECT 1 FROM reports r JOIN profiles p ON r.user_id = p.id WHERE r.id = expenses.report_id AND p.organization_id = get_org_id_for_policy(auth.uid())));

-- ========== RECEIPTS ==========
DROP POLICY IF EXISTS "Users can view receipts for their expenses" ON public.receipts;
DROP POLICY IF EXISTS "Users can create receipts for their expenses" ON public.receipts;
DROP POLICY IF EXISTS "Users can delete receipts for their expenses" ON public.receipts;
DROP POLICY IF EXISTS "Managers can view subordinate receipts" ON public.receipts;
DROP POLICY IF EXISTS "Managers can view receipts in submitted reports" ON public.receipts;
DROP POLICY IF EXISTS "Accounting managers can view all receipts" ON public.receipts;
DROP POLICY IF EXISTS "Accounting managers can create receipts for any expense" ON public.receipts;
DROP POLICY IF EXISTS "Org admins can view receipts from their organization" ON public.receipts;

CREATE POLICY "Users can view receipts for their expenses" ON public.receipts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM expenses JOIN reports ON reports.id = expenses.report_id WHERE expenses.id = receipts.expense_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can create receipts for their expenses" ON public.receipts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM expenses JOIN reports ON reports.id = expenses.report_id WHERE expenses.id = receipts.expense_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can delete receipts for their expenses" ON public.receipts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM expenses JOIN reports ON reports.id = expenses.report_id WHERE expenses.id = receipts.expense_id AND reports.user_id = auth.uid()));

CREATE POLICY "Managers can view subordinate receipts" ON public.receipts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM expenses e JOIN reports r ON r.id = e.report_id WHERE e.id = receipts.expense_id AND r.user_id IN (SELECT get_team_user_ids(auth.uid()))));

CREATE POLICY "Managers can view receipts in submitted reports" ON public.receipts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'manager') AND EXISTS (SELECT 1 FROM expenses JOIN reports ON reports.id = expenses.report_id WHERE expenses.id = receipts.expense_id AND reports.status = ANY (ARRAY['pending_approval'::expense_status, 'closed'::expense_status])));

CREATE POLICY "Accounting managers can view all receipts" ON public.receipts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can create receipts for any expense" ON public.receipts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Org admins can view receipts from their organization" ON public.receipts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND EXISTS (SELECT 1 FROM expenses e JOIN reports r ON e.report_id = r.id JOIN profiles p ON r.user_id = p.id WHERE e.id = receipts.expense_id AND p.organization_id = get_org_id_for_policy(auth.uid())));

-- ========== USER_ROLES ==========
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role during registration" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Accounting managers can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Accounting managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Org admins can manage user_roles for org members" ON public.user_roles;
DROP POLICY IF EXISTS "Allow creating first admin" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role during registration" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting managers can manage roles" ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'accounting_manager')) WITH CHECK (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Accounting managers can view all roles" ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Org admins can manage user_roles for org members" ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND same_organization(auth.uid(), user_id))
WITH CHECK (has_role(auth.uid(), 'org_admin') AND same_organization(auth.uid(), user_id));

CREATE POLICY "Allow creating first admin" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (role = 'admin' AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin'));

-- ========== REPORT_COMMENTS ==========
DROP POLICY IF EXISTS "Users can view comments on their reports" ON public.report_comments;
DROP POLICY IF EXISTS "Users can create comments on their reports" ON public.report_comments;

CREATE POLICY "Users can view comments on their reports" ON public.report_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = report_comments.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can create comments on their reports" ON public.report_comments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM reports WHERE reports.id = report_comments.report_id AND reports.user_id = auth.uid()) AND auth.uid() = user_id);

-- ========== MANAGER_COMMENT_ATTACHMENTS ==========
DROP POLICY IF EXISTS "Users can view attachments for their expenses" ON public.manager_comment_attachments;
DROP POLICY IF EXISTS "Managers can insert attachments" ON public.manager_comment_attachments;
DROP POLICY IF EXISTS "Managers can view all attachments" ON public.manager_comment_attachments;
DROP POLICY IF EXISTS "Managers can view subordinate manager_comment_attachments" ON public.manager_comment_attachments;

CREATE POLICY "Users can view attachments for their expenses" ON public.manager_comment_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM expenses JOIN reports ON reports.id = expenses.report_id WHERE expenses.id = manager_comment_attachments.expense_id AND reports.user_id = auth.uid()));

CREATE POLICY "Managers can insert attachments" ON public.manager_comment_attachments FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can view all attachments" ON public.manager_comment_attachments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can view subordinate manager_comment_attachments" ON public.manager_comment_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM expenses e JOIN reports r ON r.id = e.report_id WHERE e.id = manager_comment_attachments.expense_id AND r.user_id IN (SELECT get_team_user_ids(auth.uid()))));

-- ========== REPORT_PREFERENCES ==========
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can create their own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.report_preferences;

CREATE POLICY "Users can view their own preferences" ON public.report_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences" ON public.report_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.report_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON public.report_preferences FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ========== ACCOUNTING_COMMENTS ==========
DROP POLICY IF EXISTS "Report owners can view comments" ON public.accounting_comments;
DROP POLICY IF EXISTS "Accounting managers can view all comments" ON public.accounting_comments;
DROP POLICY IF EXISTS "Accounting managers can create comments" ON public.accounting_comments;
DROP POLICY IF EXISTS "Accounting managers can update comments" ON public.accounting_comments;
DROP POLICY IF EXISTS "Managers can view subordinate accounting_comments" ON public.accounting_comments;

CREATE POLICY "Report owners can view comments" ON public.accounting_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = accounting_comments.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Accounting managers can view all comments" ON public.accounting_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.accounting_manager_email IS NOT NULL));

CREATE POLICY "Accounting managers can create comments" ON public.accounting_comments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.accounting_manager_email IS NOT NULL));

CREATE POLICY "Accounting managers can update comments" ON public.accounting_comments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.accounting_manager_email IS NOT NULL));

CREATE POLICY "Managers can view subordinate accounting_comments" ON public.accounting_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports r WHERE r.id = accounting_comments.report_id AND r.user_id IN (SELECT get_team_user_ids(auth.uid()))));

-- ========== EXPENSE_ALERTS ==========
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.expense_alerts;
DROP POLICY IF EXISTS "Users can create their own alerts" ON public.expense_alerts;
DROP POLICY IF EXISTS "Users can update their own alerts" ON public.expense_alerts;
DROP POLICY IF EXISTS "Users can delete their own alerts" ON public.expense_alerts;

CREATE POLICY "Users can view their own alerts" ON public.expense_alerts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts" ON public.expense_alerts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" ON public.expense_alerts FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" ON public.expense_alerts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ========== NOTIFICATIONS ==========
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- ========== BOOTSTRAP_TOKENS ==========
DROP POLICY IF EXISTS "Accounting managers can view all tokens" ON public.bootstrap_tokens;
DROP POLICY IF EXISTS "Accounting managers can create tokens" ON public.bootstrap_tokens;
DROP POLICY IF EXISTS "Only admins and accounting managers can view tokens" ON public.bootstrap_tokens;
DROP POLICY IF EXISTS "Only admins and accounting managers can update tokens" ON public.bootstrap_tokens;

CREATE POLICY "Accounting managers can view all tokens" ON public.bootstrap_tokens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can create tokens" ON public.bootstrap_tokens FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Only admins and accounting managers can view tokens" ON public.bootstrap_tokens FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Only admins and accounting managers can update tokens" ON public.bootstrap_tokens FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounting_manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounting_manager'));

-- ========== EXPENSE_TEMPLATES ==========
DROP POLICY IF EXISTS "Accounting managers can view all templates" ON public.expense_templates;
DROP POLICY IF EXISTS "Accounting managers can create templates" ON public.expense_templates;
DROP POLICY IF EXISTS "Accounting managers can update templates" ON public.expense_templates;
DROP POLICY IF EXISTS "Accounting managers can delete templates" ON public.expense_templates;

CREATE POLICY "Accounting managers can view all templates" ON public.expense_templates FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can create templates" ON public.expense_templates FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can update templates" ON public.expense_templates FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

CREATE POLICY "Accounting managers can delete templates" ON public.expense_templates FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));

-- ========== INVITATION_CODES ==========
DROP POLICY IF EXISTS "Admins can manage all invitation_codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Accounting managers can manage invitation_codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Org admins can view their org invitation_codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Org admins can create codes for their org" ON public.invitation_codes;
DROP POLICY IF EXISTS "Org admins can update codes for their org" ON public.invitation_codes;
DROP POLICY IF EXISTS "Org admins can view valid codes for their org" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can view their invitation codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can create invitation codes for their team" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can update their invitation codes" ON public.invitation_codes;

CREATE POLICY "Admins can manage all invitation_codes" ON public.invitation_codes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting managers can manage invitation_codes" ON public.invitation_codes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'accounting_manager'));

CREATE POLICY "Org admins can view their org invitation_codes" ON public.invitation_codes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org admins can create codes for their org" ON public.invitation_codes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'org_admin') AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org admins can update codes for their org" ON public.invitation_codes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'org_admin') AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Managers can view their invitation codes" ON public.invitation_codes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'manager') AND manager_id = auth.uid());

CREATE POLICY "Managers can create invitation codes for their team" ON public.invitation_codes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager') AND manager_id = auth.uid() AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Managers can update their invitation codes" ON public.invitation_codes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'manager') AND manager_id = auth.uid());

-- ========== RECIPIENT_LISTS ==========
DROP POLICY IF EXISTS "Users can view their own recipient lists" ON public.recipient_lists;
DROP POLICY IF EXISTS "Users can create their own recipient lists" ON public.recipient_lists;
DROP POLICY IF EXISTS "Users can update their own recipient lists" ON public.recipient_lists;
DROP POLICY IF EXISTS "Users can delete their own recipient lists" ON public.recipient_lists;

CREATE POLICY "Users can view their own recipient lists" ON public.recipient_lists FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipient lists" ON public.recipient_lists FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipient lists" ON public.recipient_lists FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipient lists" ON public.recipient_lists FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ========== REPORT_HISTORY ==========
DROP POLICY IF EXISTS "Users can view history for their reports" ON public.report_history;
DROP POLICY IF EXISTS "Users can insert history for their reports" ON public.report_history;
DROP POLICY IF EXISTS "Managers can view subordinate report_history" ON public.report_history;
DROP POLICY IF EXISTS "Managers can insert history for team reports" ON public.report_history;
DROP POLICY IF EXISTS "Accounting managers can insert history for any report" ON public.report_history;

CREATE POLICY "Users can view history for their reports" ON public.report_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = report_history.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Users can insert history for their reports" ON public.report_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM reports WHERE reports.id = report_history.report_id AND reports.user_id = auth.uid()));

CREATE POLICY "Managers can view subordinate report_history" ON public.report_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM reports r WHERE r.id = report_history.report_id AND r.user_id IN (SELECT get_team_user_ids(auth.uid()))));

CREATE POLICY "Managers can insert history for team reports" ON public.report_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM reports r WHERE r.id = report_history.report_id AND r.user_id IN (SELECT get_team_user_ids(auth.uid()))));

CREATE POLICY "Accounting managers can insert history for any report" ON public.report_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'accounting_manager'));