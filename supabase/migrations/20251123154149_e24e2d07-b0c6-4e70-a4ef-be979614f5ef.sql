-- Update handle_new_user function to use manager_id
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