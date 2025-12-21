-- Add accounting type column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS accounting_type TEXT DEFAULT 'internal' CHECK (accounting_type IN ('internal', 'external'));

-- Add external accounting email for organizations that use external accounting
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS external_accounting_email TEXT;

-- Add external accounting name
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS external_accounting_name TEXT;