-- Update the handle_new_user trigger to include organization_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
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
$$;