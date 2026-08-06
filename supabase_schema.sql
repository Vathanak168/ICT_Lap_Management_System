-- ICT Lab Management System - Supabase Schema
-- Run this script in your Supabase SQL Editor

-- 0. Create academic_years table
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default year if not exists
INSERT INTO academic_years (year, is_active) VALUES ('2026-2027', true) ON CONFLICT (year) DO NOTHING;

-- 1. Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  notes TEXT,
  linked_class_ids JSONB
);

-- Drop tables that need academic_year added (WARNING: This deletes test data in these tables!)
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS pc_issues;
DROP TABLE IF EXISTS seating_plans;
DROP TABLE IF EXISTS lesson_logs;
DROP TABLE IF EXISTS grades;
DROP TABLE IF EXISTS lesson_plans;

-- 2. Create students table
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  english_name TEXT,
  gender TEXT NOT NULL,
  class TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  status TEXT DEFAULT 'Active'
);

-- 3. Create attendance table
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
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
  academic_year TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  resolved_date TEXT
);

-- 5. Create seating_plans table
CREATE TABLE seating_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  grid_layout_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create lesson_logs table
CREATE TABLE lesson_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  topic TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  teacher_name TEXT NOT NULL
);

-- 7. Create grades table
CREATE TABLE grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  class_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  type TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  scores_json JSONB NOT NULL
);

-- 8. Create lesson_plans table
CREATE TABLE lesson_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id TEXT NOT NULL,
  month TEXT NOT NULL,
  week TEXT NOT NULL,
  lesson_title TEXT NOT NULL,
  topics TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  exercises TEXT,
  branch TEXT NOT NULL DEFAULT 'BELTEI IS 1',
  status TEXT DEFAULT 'Planned',
  completed_date TEXT
);

-- 9. Create profiles table (No changes needed)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  branch TEXT,
  profile_image_url TEXT,
  role TEXT DEFAULT 'teacher',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create mini_apps table (No changes needed)
CREATE TABLE IF NOT EXISTS mini_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'ទូទៅ',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS) policies

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to academic_years" ON academic_years FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users full access to academic_years" ON academic_years FOR ALL TO authenticated USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON profiles;
CREATE POLICY "Allow public read access to profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow users to insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to classes" ON classes;
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

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to lesson_plans" ON lesson_plans FOR ALL TO authenticated USING (true);

ALTER TABLE mini_apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to mini_apps" ON mini_apps;
CREATE POLICY "Allow authenticated users full access to mini_apps" ON mini_apps FOR ALL TO authenticated USING (true) WITH CHECK (true);
