-- Add manager_id as foreign key to profiles table
ALTER TABLE public.profiles
ADD COLUMN manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);

-- Migrate existing data: try to match manager_email to actual user profiles
UPDATE public.profiles
SET manager_id = (
  SELECT id FROM public.profiles p2 
  WHERE p2.username = public.profiles.manager_email
  LIMIT 1
)
WHERE manager_email IS NOT NULL;

-- Drop old manager columns
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS manager_email,
DROP COLUMN IF EXISTS manager_first_name,
DROP COLUMN IF EXISTS manager_last_name;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.manager_id IS 'Foreign key to the manager profile';