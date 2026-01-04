-- Drop the existing delete policy
DROP POLICY IF EXISTS "Users can delete their own draft reports" ON public.reports;

-- Create a new policy that allows deletion of draft and open reports
CREATE POLICY "Users can delete their own draft or open reports" 
ON public.reports 
FOR DELETE 
USING (auth.uid() = user_id AND status IN ('draft', 'open'));