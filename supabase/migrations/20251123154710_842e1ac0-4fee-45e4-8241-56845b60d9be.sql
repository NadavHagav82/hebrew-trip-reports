-- Update handle_new_user to notify manager when employee joins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_id uuid;
BEGIN
  -- Insert profile
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
  )
  RETURNING manager_id INTO v_manager_id;
  
  -- If employee has a manager, send notification email asynchronously
  IF v_manager_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := (SELECT url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/notify-manager-new-employee',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object(
        'employeeName', COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'employeeEmail', NEW.email,
        'employeeId', NULLIF(NEW.raw_user_meta_data->>'employee_id', ''),
        'department', COALESCE(NEW.raw_user_meta_data->>'department', ''),
        'managerId', v_manager_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;