-- Add daily_allowance column to reports table
ALTER TABLE public.reports 
ADD COLUMN daily_allowance numeric DEFAULT 100;