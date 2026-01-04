-- Add allowance_days column to store custom number of days for daily allowance
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS allowance_days integer;