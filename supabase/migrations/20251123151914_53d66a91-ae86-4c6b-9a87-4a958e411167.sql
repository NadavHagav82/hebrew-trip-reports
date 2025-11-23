-- Enable realtime for reports table
ALTER TABLE public.reports REPLICA IDENTITY FULL;

-- Add the reports table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;