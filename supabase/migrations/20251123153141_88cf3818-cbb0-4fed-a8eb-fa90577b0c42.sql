-- Remove personal_email field (not needed - will use auth email)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS personal_email;