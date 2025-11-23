-- Create table for saved recipient lists
CREATE TABLE IF NOT EXISTS public.recipient_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  list_name text NOT NULL,
  recipient_emails text[] NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipient_lists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own recipient lists"
ON public.recipient_lists
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipient lists"
ON public.recipient_lists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipient lists"
ON public.recipient_lists
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipient lists"
ON public.recipient_lists
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_recipient_lists_user_id ON public.recipient_lists(user_id);
CREATE INDEX idx_recipient_lists_is_default ON public.recipient_lists(user_id, is_default);

-- Add trigger for updated_at
CREATE TRIGGER update_recipient_lists_updated_at
BEFORE UPDATE ON public.recipient_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.recipient_lists IS 'Saved recipient email lists for users to reuse when sharing reports';