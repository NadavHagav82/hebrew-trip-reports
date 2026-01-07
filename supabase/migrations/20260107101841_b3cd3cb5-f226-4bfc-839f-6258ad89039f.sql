-- Add employee_reply column to expenses table for employee responses to manager comments
ALTER TABLE public.expenses 
ADD COLUMN employee_reply TEXT DEFAULT NULL;

-- Add employee_reply_at timestamp to track when the reply was made
ALTER TABLE public.expenses 
ADD COLUMN employee_reply_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;