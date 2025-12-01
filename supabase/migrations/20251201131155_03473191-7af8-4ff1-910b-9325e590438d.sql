-- Create bootstrap tokens table for initial accounting manager setup
CREATE TABLE public.bootstrap_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.bootstrap_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read unexpired, unused tokens (for validation)
CREATE POLICY "Anyone can read unused unexpired tokens"
ON public.bootstrap_tokens
FOR SELECT
USING (
  is_used = false 
  AND expires_at > now()
);

-- Allow token updates only during registration
CREATE POLICY "System can update tokens"
ON public.bootstrap_tokens
FOR UPDATE
USING (is_used = false);

-- Insert first bootstrap token (valid for 7 days)
-- Token: BOOTSTRAP-2025-FIRST-ADMIN
INSERT INTO public.bootstrap_tokens (token, expires_at, notes)
VALUES (
  'BOOTSTRAP-2025-FIRST-ADMIN',
  now() + interval '7 days',
  'קוד הקמה ראשוני למנהל חשבונות ראשון במערכת'
);