-- Create the ai_history table
CREATE TABLE public.ai_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    branch_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users based on their branch
CREATE POLICY "Users can manage their branch ai_history" 
ON public.ai_history 
FOR ALL 
USING (
    branch_name = (
        SELECT branch 
        FROM profiles 
        WHERE id = auth.uid()
    )
);

-- Note: Depending on your exact profile/auth setup, the RLS policy above might need tweaking. 
-- Make sure to run this script in your Supabase SQL Editor.
