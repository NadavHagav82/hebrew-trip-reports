
-- 1. RECEIPTS BUCKET: Remove overly-permissive policies
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;

CREATE POLICY "Users can update their own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2. MANAGER-ATTACHMENTS BUCKET: Remove overly-permissive policies
DROP POLICY IF EXISTS "Authenticated users can view manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete manager attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload manager attachments" ON storage.objects;

CREATE POLICY "Managers can view own manager attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'manager-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Accounting managers can view all manager attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'manager-attachments'
  AND public.has_role(auth.uid(), 'accounting_manager'::app_role)
);

CREATE POLICY "Employees can view their own expense attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'manager-attachments'
  AND EXISTS (
    SELECT 1 FROM public.manager_comment_attachments mca
    JOIN public.expenses e ON e.id = mca.expense_id
    JOIN public.reports r ON r.id = e.report_id
    WHERE mca.file_url = storage.objects.name
      AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can update own manager attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'manager-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. USER_ROLES: Fix privilege escalation
DROP POLICY IF EXISTS "Users can insert their own role during registration" ON public.user_roles;

CREATE POLICY "Users can self-assign default user role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'user'::app_role
);

-- 4. MANAGER_COMMENT_ATTACHMENTS: Remove unscoped manager view
DROP POLICY IF EXISTS "Managers can view all attachments" ON public.manager_comment_attachments;

-- 5. ACCOUNTING_COMMENTS: Replace weak email check with proper role check
DROP POLICY IF EXISTS "Accounting managers can create comments" ON public.accounting_comments;
DROP POLICY IF EXISTS "Accounting managers can update comments" ON public.accounting_comments;
DROP POLICY IF EXISTS "Accounting managers can view all comments" ON public.accounting_comments;

CREATE POLICY "Accounting managers can create comments"
ON public.accounting_comments FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'accounting_manager'::app_role));

CREATE POLICY "Accounting managers can update comments"
ON public.accounting_comments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'accounting_manager'::app_role));

CREATE POLICY "Accounting managers can view all comments"
ON public.accounting_comments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accounting_manager'::app_role));
