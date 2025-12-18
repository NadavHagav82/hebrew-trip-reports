-- Add reimbursement tracking fields to reports table
ALTER TABLE public.reports
ADD COLUMN reimbursement_paid boolean DEFAULT false,
ADD COLUMN reimbursement_paid_at timestamp with time zone,
ADD COLUMN reimbursement_paid_by uuid REFERENCES public.profiles(id);