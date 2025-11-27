-- Add approval tracking columns to expenses table
DO $$ 
BEGIN
  -- Create enum for expense approval status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_approval_status') THEN
    CREATE TYPE expense_approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Add columns to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS approval_status expense_approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS manager_comment text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_approval_status ON public.expenses(approval_status);

-- Add comment
COMMENT ON COLUMN public.expenses.approval_status IS 'Status of manager approval for this specific expense';
COMMENT ON COLUMN public.expenses.manager_comment IS 'Manager comments or feedback on this expense';
COMMENT ON COLUMN public.expenses.reviewed_by IS 'Manager who reviewed this expense';
COMMENT ON COLUMN public.expenses.reviewed_at IS 'Timestamp when expense was reviewed';