-- Update lesson_plans table to add links support
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;
