-- Add accounting manager email to profiles
ALTER TABLE public.profiles
ADD COLUMN accounting_manager_email text;

-- Add comment
COMMENT ON COLUMN public.profiles.accounting_manager_email IS 'Email address of the accounting manager who receives approved reports';