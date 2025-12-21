-- Create a function to handle user role assignment from invitation codes
CREATE OR REPLACE FUNCTION public.handle_user_role_from_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation_code_record RECORD;
  _role app_role;
BEGIN
  -- Check if there's an invitation code that was just used by this user
  SELECT * INTO _invitation_code_record
  FROM public.invitation_codes
  WHERE used_by = NEW.id
  AND is_used = true
  LIMIT 1;
  
  -- If found, insert the role
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _invitation_code_record.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires after profile is inserted
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_role_from_invitation();

-- Also add a policy to allow anyone to insert their own role during registration
-- This is needed for the edge case where the invitation code update happens before the profile is created
CREATE POLICY "Users can insert their own role during registration"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);