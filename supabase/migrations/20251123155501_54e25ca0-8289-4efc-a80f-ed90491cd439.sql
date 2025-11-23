-- Add email column to profiles table to store the actual email address
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Update existing profiles with email from auth.users
UPDATE public.profiles
SET email = (
  SELECT email FROM auth.users WHERE auth.users.id = profiles.id
)
WHERE email IS NULL;

-- Update handle_new_user to also save email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    email,
    full_name, 
    employee_id, 
    department,
    is_manager,
    manager_id,
    accounting_manager_email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'employee_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_manager')::boolean, false),
    NULLIF(NEW.raw_user_meta_data->>'manager_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data->>'accounting_manager_email', '')
  );
  RETURN NEW;
END;
$function$;