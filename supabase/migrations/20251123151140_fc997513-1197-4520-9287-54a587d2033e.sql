-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for admins to manage roles (we'll need this later)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Add policy for managers to view submitted/pending reports
CREATE POLICY "Managers can view submitted reports"
ON public.reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') 
  AND status IN ('pending_approval', 'closed')
);

-- Add policy for managers to approve/update reports
CREATE POLICY "Managers can approve reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Add policy for managers to view expenses in reports they can access
CREATE POLICY "Managers can view expenses in submitted reports"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = expenses.report_id
    AND reports.status IN ('pending_approval', 'closed')
  )
);

-- Add policy for managers to view receipts in reports they can access
CREATE POLICY "Managers can view receipts in submitted reports"
ON public.receipts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.expenses
    JOIN public.reports ON reports.id = expenses.report_id
    WHERE expenses.id = receipts.expense_id
    AND reports.status IN ('pending_approval', 'closed')
  )
);

-- Add is_manager flag to profiles for backward compatibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role DEFAULT 'user';

-- Update existing managers to have manager role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'manager'::public.app_role
FROM public.profiles
WHERE is_manager = true
ON CONFLICT (user_id, role) DO NOTHING;