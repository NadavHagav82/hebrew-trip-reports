-- Drop the existing foreign key constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_travel_request_id_fkey;

-- Re-add with ON DELETE SET NULL so deleting a travel request nullifies the link instead of blocking
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_travel_request_id_fkey 
FOREIGN KEY (travel_request_id) 
REFERENCES public.travel_requests(id) 
ON DELETE SET NULL;