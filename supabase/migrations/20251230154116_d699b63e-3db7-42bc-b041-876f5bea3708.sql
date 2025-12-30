-- Add grade_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN grade_id uuid REFERENCES public.employee_grades(id) ON DELETE SET NULL;

-- Create an index for better query performance
CREATE INDEX idx_profiles_grade_id ON public.profiles(grade_id);