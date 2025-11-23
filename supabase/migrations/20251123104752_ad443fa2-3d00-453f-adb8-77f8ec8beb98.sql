-- Add manager-related fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS manager_first_name text,
ADD COLUMN IF NOT EXISTS manager_last_name text,
ADD COLUMN IF NOT EXISTS manager_email text;

-- Update existing users to be managers (temporary - they can update later)
UPDATE public.profiles 
SET is_manager = true 
WHERE is_manager = false;

-- Add pending_approval status to expense_status enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t 
                   JOIN pg_enum e ON t.oid = e.enumtypid  
                   WHERE t.typname = 'expense_status' AND e.enumlabel = 'pending_approval') THEN
        ALTER TYPE public.expense_status ADD VALUE 'pending_approval';
    END IF;
END $$;

-- Add approval tracking columns to reports table
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS manager_approval_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS manager_approval_token text;

-- Create unique index for approval tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_approval_token_unique ON public.reports(manager_approval_token) WHERE manager_approval_token IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.reports.manager_approval_token IS 'Unique token for manager approval link';
COMMENT ON COLUMN public.reports.manager_approval_requested_at IS 'Timestamp when approval was requested from manager';