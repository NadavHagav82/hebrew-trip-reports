-- Create table for logging receipt analysis results for debugging and improvement
CREATE TABLE public.receipt_analysis_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  
  -- Original image reference (file path in storage or hash for identification)
  image_file_name TEXT,
  image_file_size INTEGER,
  
  -- AI extraction results
  extracted_date TEXT,
  extracted_amount NUMERIC,
  extracted_currency TEXT,
  extracted_category TEXT,
  extracted_description TEXT,
  
  -- Raw AI response for debugging
  raw_ai_response JSONB,
  
  -- User corrections (to track if AI was wrong)
  user_corrected_date TEXT,
  user_corrected_amount NUMERIC,
  user_corrected_currency TEXT,
  user_swapped_day_month BOOLEAN DEFAULT false,
  
  -- Metadata
  trip_destination TEXT,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipt_analysis_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own logs
CREATE POLICY "Users can view their own receipt logs" 
ON public.receipt_analysis_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own logs
CREATE POLICY "Users can insert their own receipt logs" 
ON public.receipt_analysis_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own logs (for corrections)
CREATE POLICY "Users can update their own receipt logs" 
ON public.receipt_analysis_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_receipt_logs_user_id ON public.receipt_analysis_logs(user_id);
CREATE INDEX idx_receipt_logs_created_at ON public.receipt_analysis_logs(created_at DESC);