-- Make employee_id optional (nullable)
ALTER TABLE public.profiles
ALTER COLUMN employee_id DROP NOT NULL;

-- Add personal email field for sending reports to user
ALTER TABLE public.profiles
ADD COLUMN personal_email text;

COMMENT ON COLUMN public.profiles.personal_email IS 'Personal email address for receiving report notifications';