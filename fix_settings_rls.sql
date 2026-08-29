-- Drop the problematic ALL policy
DROP POLICY IF EXISTS "Allow admins to modify settings" ON settings;

-- Create separate, explicit policies for INSERT, UPDATE, and DELETE
CREATE POLICY "Admins can insert settings" 
  ON settings 
  FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update settings" 
  ON settings 
  FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete settings" 
  ON settings 
  FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
