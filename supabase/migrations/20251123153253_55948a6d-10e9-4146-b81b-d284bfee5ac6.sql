-- Update handle_new_user to not include personal_email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    full_name, 
    employee_id, 
    department, 
    accounting_manager_email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'employee_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    NULLIF(NEW.raw_user_meta_data->>'accounting_manager_email', '')
  );
  RETURN NEW;
END;
$function$;