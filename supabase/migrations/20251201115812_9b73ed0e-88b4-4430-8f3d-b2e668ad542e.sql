-- Step 1: Add accounting_manager role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounting_manager';