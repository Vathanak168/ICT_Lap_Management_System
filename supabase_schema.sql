-- ICT Lab Management System - Supabase Schema
-- Run this script in your Supabase SQL Editor

-- 1. Create classes table
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  notes TEXT,
  linked_class_ids JSONB
);

-- 2. Create students table
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  english_name TEXT,
  gender TEXT NOT NULL,
  class TEXT NOT NULL,
  shift TEXT NOT NULL,
  status TEXT DEFAULT 'Active'
);

-- 3. Create attendance table
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  records_json JSONB NOT NULL
);

-- 4. Create pc_issues table
CREATE TABLE pc_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pc_number TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reported_date TEXT NOT NULL,
  resolved_date TEXT
);

-- 5. Create seating_plans table
CREATE TABLE seating_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  grid_layout_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create lesson_logs table
CREATE TABLE lesson_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  topic TEXT NOT NULL,
  teacher_name TEXT NOT NULL
);

-- 7. Create grades table
CREATE TABLE grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  type TEXT NOT NULL,
  scores_json JSONB NOT NULL
);

-- Set up Row Level Security (RLS) policies
-- Note: Currently allowing all authenticated users to read and write.
-- In production, you should refine this based on user roles (Admin vs Teacher).

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to classes" ON classes FOR ALL TO authenticated USING (true);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to students" ON students FOR ALL TO authenticated USING (true);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to attendance" ON attendance FOR ALL TO authenticated USING (true);

ALTER TABLE pc_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to pc_issues" ON pc_issues FOR ALL TO authenticated USING (true);

ALTER TABLE seating_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to seating_plans" ON seating_plans FOR ALL TO authenticated USING (true);

ALTER TABLE lesson_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to lesson_logs" ON lesson_logs FOR ALL TO authenticated USING (true);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to grades" ON grades FOR ALL TO authenticated USING (true);
