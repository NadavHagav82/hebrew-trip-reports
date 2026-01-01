-- Add travel_request_id column to notifications table
ALTER TABLE public.notifications
ADD COLUMN travel_request_id uuid REFERENCES public.travel_requests(id);

-- Create index for faster lookups
CREATE INDEX idx_notifications_travel_request_id ON public.notifications(travel_request_id);