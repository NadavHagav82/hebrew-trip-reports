-- Create storage bucket for manager comment attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('manager-attachments', 'manager-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create table for manager comment attachments
CREATE TABLE IF NOT EXISTS public.manager_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Enable RLS on manager_comment_attachments
ALTER TABLE public.manager_comment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manager_comment_attachments
-- Users can view attachments for their expenses
CREATE POLICY "Users can view attachments for their expenses"
ON public.manager_comment_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM expenses
    JOIN reports ON reports.id = expenses.report_id
    WHERE expenses.id = expense_id
    AND reports.user_id = auth.uid()
  )
);

-- Managers can insert attachments
CREATE POLICY "Managers can insert attachments"
ON public.manager_comment_attachments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
);

-- Managers can view all attachments
CREATE POLICY "Managers can view all attachments"
ON public.manager_comment_attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
);

-- Storage policies for manager-attachments bucket
-- Managers can upload files
CREATE POLICY "Managers can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'manager-attachments' AND
  has_role(auth.uid(), 'manager'::app_role)
);

-- Users can view files for their expenses
CREATE POLICY "Users can view their expense attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'manager-attachments' AND
  (
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM manager_comment_attachments mca
      JOIN expenses e ON e.id = mca.expense_id
      JOIN reports r ON r.id = e.report_id
      WHERE mca.file_url = storage.objects.name
      AND r.user_id = auth.uid()
    )
  )
);

-- Managers can delete files they uploaded
CREATE POLICY "Managers can delete files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'manager-attachments' AND
  has_role(auth.uid(), 'manager'::app_role)
);