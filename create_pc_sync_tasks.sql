-- Create pc_sync_tasks table
CREATE TABLE IF NOT EXISTS pc_sync_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pc_number TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ADD', 'REMOVE', 'UPDATE_PASSWORD')),
  password TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  branch TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pc_sync_tasks ENABLE ROW LEVEL SECURITY;

-- Create Branch-scoped policy
CREATE POLICY "Branch-scoped access to pc_sync_tasks" ON pc_sync_tasks 
  FOR ALL 
  TO authenticated
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid())) 
  WITH CHECK (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pc_sync_tasks_pc_number ON pc_sync_tasks(pc_number);
CREATE INDEX IF NOT EXISTS idx_pc_sync_tasks_student_id ON pc_sync_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_pc_sync_tasks_status ON pc_sync_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pc_sync_tasks_branch_year ON pc_sync_tasks(branch, academic_year);
