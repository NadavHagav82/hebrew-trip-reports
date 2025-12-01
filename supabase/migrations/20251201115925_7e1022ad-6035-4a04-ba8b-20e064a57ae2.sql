-- Step 2: Create indexes and RLS policies for accounting managers

-- Create index on profiles for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_manager ON public.profiles(is_manager);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);

-- Update RLS policy for accounting managers to view all profiles
CREATE POLICY "Accounting managers can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Accounting managers can update all profiles
CREATE POLICY "Accounting managers can update all profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'accounting_manager'::app_role
  )
);

-- Accounting managers can view all user roles
CREATE POLICY "Accounting managers can view all roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'accounting_manager'::app_role
  )
);

-- Accounting managers can manage all roles
CREATE POLICY "Accounting managers can manage roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'accounting_manager'::app_role
  )
);