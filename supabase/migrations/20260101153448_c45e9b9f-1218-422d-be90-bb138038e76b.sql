-- Add custom_message column to approval_chain_levels for custom approval level messages
ALTER TABLE public.approval_chain_levels 
ADD COLUMN custom_message text DEFAULT NULL;