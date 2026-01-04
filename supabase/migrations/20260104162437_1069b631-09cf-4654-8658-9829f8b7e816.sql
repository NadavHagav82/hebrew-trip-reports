-- Drop the existing delete policy
DROP POLICY IF EXISTS "Users can delete their own draft or open reports" ON public.reports;

-- Create a new policy that allows deletion of draft, open, and closed reports
CREATE POLICY "Users can delete their own reports" 
ON public.reports 
FOR DELETE 
USING (auth.uid() = user_id);