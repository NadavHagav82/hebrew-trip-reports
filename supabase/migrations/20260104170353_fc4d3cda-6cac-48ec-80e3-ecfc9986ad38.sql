-- Create a SECURITY DEFINER function to get the manager_id without RLS checks
CREATE OR REPLACE FUNCTION public.get_user_manager_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_id FROM public.profiles WHERE id = _user_id;
$$;

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view their direct manager profile" ON public.profiles;

-- Recreate it using the SECURITY DEFINER function
CREATE POLICY "Users can view their direct manager profile"
ON public.profiles
FOR SELECT
USING (
  id = public.get_user_manager_id(auth.uid())
);