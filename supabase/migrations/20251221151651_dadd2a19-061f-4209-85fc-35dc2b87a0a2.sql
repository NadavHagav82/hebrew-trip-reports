-- Drop all potentially recursive policies on profiles
DROP POLICY IF EXISTS "Managers can view their direct reports profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view manager profiles" ON public.profiles;

-- Create a security definer function to check if user is a manager of someone
CREATE OR REPLACE FUNCTION public.is_manager_of(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND manager_id = auth.uid()
  )
$$;

-- Create a security definer function to check if a profile is a manager
CREATE OR REPLACE FUNCTION public.is_user_a_manager(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND is_manager = true
  )
$$;

-- Recreate the policies using security definer functions
CREATE POLICY "Managers can view their direct reports profiles"
ON public.profiles
FOR SELECT
USING (public.is_manager_of(id));

CREATE POLICY "Anyone can view manager profiles"
ON public.profiles
FOR SELECT
USING (public.is_user_a_manager(id));