-- Add grade_id column to invitation_codes table
ALTER TABLE public.invitation_codes 
ADD COLUMN grade_id uuid REFERENCES public.employee_grades(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_invitation_codes_grade_id ON public.invitation_codes(grade_id);

-- Update handle_new_user function to assign grade from invitation code
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invitation_code_record RECORD;
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
    accounting_manager_email,
    organization_id
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
    NULLIF(NEW.raw_user_meta_data->>'accounting_manager_email', ''),
    NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid
  );
  RETURN NEW;
END;
$function$;

-- Create function to assign grade from invitation code after profile is created
CREATE OR REPLACE FUNCTION public.assign_grade_from_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invitation_grade_id uuid;
BEGIN
  -- Check if there's an invitation code with a grade_id that was used
  SELECT grade_id INTO _invitation_grade_id
  FROM public.invitation_codes
  WHERE used_by = NEW.id
  AND grade_id IS NOT NULL
  LIMIT 1;
  
  -- If found, update the profile with the grade
  IF _invitation_grade_id IS NOT NULL THEN
    UPDATE public.profiles
    SET grade_id = _invitation_grade_id
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;