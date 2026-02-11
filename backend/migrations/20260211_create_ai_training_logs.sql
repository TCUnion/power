-- Create AI Training Logs table
CREATE TABLE IF NOT EXISTS public.ai_training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    summary TEXT,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.ai_training_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own training logs" 
ON public.ai_training_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own training logs" 
ON public.ai_training_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training logs" 
ON public.ai_training_logs FOR UPDATE 
USING (auth.uid() = user_id);
