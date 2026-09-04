-- Teaching Tracker Schema Migration
-- Run this in your Supabase SQL Editor

-- 1. Subjects table (Microsoft Word, PowerPoint, Excel)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'book',
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  academic_year TEXT NOT NULL
);

-- 2. Curriculum Lessons (reusable lesson templates)
CREATE TABLE IF NOT EXISTS curriculum_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL DEFAULT 1,
  module TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  objectives TEXT,
  exercise TEXT,
  estimated_periods INTEGER NOT NULL DEFAULT 1,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  academic_year TEXT NOT NULL
);

-- 3. Class Curriculums (assigns subject → class)
CREATE TABLE IF NOT EXISTS class_curriculums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id TEXT NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  start_date TEXT,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  academic_year TEXT NOT NULL,
  UNIQUE(class_id, subject_id, academic_year)
);

-- 4. Teaching Logs (what actually happened)
CREATE TABLE IF NOT EXISTS teaching_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id TEXT NOT NULL,
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  progress_percent INTEGER NOT NULL DEFAULT 100,
  taught_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  academic_year TEXT NOT NULL
);

-- RLS Policies (Branch-scoped)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch-scoped access to subjects" ON subjects
  FOR ALL TO authenticated
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()))
  WITH CHECK (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

ALTER TABLE curriculum_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch-scoped access to curriculum_lessons" ON curriculum_lessons
  FOR ALL TO authenticated
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()))
  WITH CHECK (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

ALTER TABLE class_curriculums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch-scoped access to class_curriculums" ON class_curriculums
  FOR ALL TO authenticated
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()))
  WITH CHECK (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

ALTER TABLE teaching_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch-scoped access to teaching_logs" ON teaching_logs
  FOR ALL TO authenticated
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()))
  WITH CHECK (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));
