-- Add manager general comment field to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS manager_general_comment text;

COMMENT ON COLUMN public.reports.manager_general_comment IS 'General comment from manager about the entire report';