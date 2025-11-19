-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE expense_status AS ENUM ('draft', 'open', 'pending', 'approved', 'rejected', 'closed');
CREATE TYPE expense_category AS ENUM ('flights', 'accommodation', 'food', 'transportation', 'miscellaneous');
CREATE TYPE expense_currency AS ENUM ('USD', 'EUR', 'ILS', 'PLN', 'GBP');
CREATE TYPE file_type_enum AS ENUM ('image', 'pdf');
CREATE TYPE report_action AS ENUM ('created', 'submitted', 'approved', 'rejected', 'edited');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trip_destination TEXT NOT NULL,
  trip_start_date DATE NOT NULL,
  trip_end_date DATE NOT NULL,
  trip_purpose TEXT NOT NULL,
  status expense_status NOT NULL DEFAULT 'draft',
  total_amount_ils DECIMAL(10, 2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency expense_currency NOT NULL,
  amount_in_ils DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type file_type_enum NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create report_comments table
CREATE TABLE public.report_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create report_history table
CREATE TABLE public.report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  action report_action NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for reports
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own draft reports"
  ON public.reports FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses for their reports"
  ON public.expenses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = expenses.report_id
    AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can create expenses for their reports"
  ON public.expenses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = expenses.report_id
    AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can update expenses for their reports"
  ON public.expenses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = expenses.report_id
    AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete expenses for their reports"
  ON public.expenses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = expenses.report_id
    AND reports.user_id = auth.uid()
  ));

-- RLS Policies for receipts
CREATE POLICY "Users can view receipts for their expenses"
  ON public.receipts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.expenses
    JOIN public.reports ON reports.id = expenses.report_id
    WHERE expenses.id = receipts.expense_id
    AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can create receipts for their expenses"
  ON public.receipts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses
    JOIN public.reports ON reports.id = expenses.report_id
    WHERE expenses.id = receipts.expense_id
    AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete receipts for their expenses"
  ON public.receipts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.expenses
    JOIN public.reports ON reports.id = expenses.report_id
    WHERE expenses.id = receipts.expense_id
    AND reports.user_id = auth.uid()
  ));

-- RLS Policies for report_comments
CREATE POLICY "Users can view comments on their reports"
  ON public.report_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_comments.report_id
    AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can create comments on their reports"
  ON public.report_comments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_comments.report_id
    AND reports.user_id = auth.uid()
  ) AND auth.uid() = user_id);

-- RLS Policies for report_history
CREATE POLICY "Users can view history for their reports"
  ON public.report_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_history.report_id
    AND reports.user_id = auth.uid()
  ));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, employee_id, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'department', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for reports updated_at
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts
CREATE POLICY "Users can view their own receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);