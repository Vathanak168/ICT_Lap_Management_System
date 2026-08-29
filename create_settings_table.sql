-- 1. Create the settings table for global configurations (like AI API Keys)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  config_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Everyone can read the settings (so AI works for all users)
DROP POLICY IF EXISTS "Allow public read access to settings" ON settings;
CREATE POLICY "Allow public read access to settings" 
  ON settings 
  FOR SELECT 
  USING (true);

-- 4. Policy: Only admins can insert or update settings
DROP POLICY IF EXISTS "Allow admins to modify settings" ON settings;
CREATE POLICY "Allow admins to modify settings" 
  ON settings 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 5. Insert an empty placeholder for AI keys if it doesn't exist
INSERT INTO settings (id, config_json) 
VALUES (
  'ai_keys', 
  '{"geminiKeys": [], "groqKey": ""}'::jsonb
) 
ON CONFLICT (id) DO NOTHING;
