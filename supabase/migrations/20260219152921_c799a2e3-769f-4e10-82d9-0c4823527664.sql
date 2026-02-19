
-- Add 'independent' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'independent';

-- RLS: Independent users can view and manage their own reports (already covered by existing user_id = auth.uid() policies)
-- RLS: Independent users can view their own roles (already covered by existing policies)
-- No additional schema changes needed - independent users use same reports/expenses/receipts tables
-- The role distinction is handled at application layer via user_roles table
