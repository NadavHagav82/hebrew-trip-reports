-- Add RLS policies for expense_alerts table
CREATE POLICY "Users can view their own alerts"
ON public.expense_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts"
ON public.expense_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
ON public.expense_alerts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
ON public.expense_alerts
FOR DELETE
USING (auth.uid() = user_id);

-- Add RLS policies for report_preferences table
CREATE POLICY "Users can view their own preferences"
ON public.report_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences"
ON public.report_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.report_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
ON public.report_preferences
FOR DELETE
USING (auth.uid() = user_id);