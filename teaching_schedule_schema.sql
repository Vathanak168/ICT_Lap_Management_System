-- Teaching Schedule migration
-- Run once in the Supabase SQL Editor after teaching_tracker_schema.sql.

CREATE TABLE IF NOT EXISTS teaching_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift TEXT NOT NULL DEFAULT 'Morning',
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  class_id TEXT NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT teaching_schedules_valid_shift
    CHECK (shift IN ('Morning', 'Afternoon', 'Evening')),
  CONSTRAINT teaching_schedules_valid_time CHECK (start_time < end_time),
  CONSTRAINT teaching_schedules_unique_shift_slot
    UNIQUE (teacher_id, academic_year, shift, day_of_week, start_time, end_time)
);

-- Upgrade an existing table created by an earlier version of this migration.
ALTER TABLE teaching_schedules ADD COLUMN IF NOT EXISTS shift TEXT;

UPDATE teaching_schedules AS schedule
SET shift = COALESCE(
  (
    SELECT class_row.shift
    FROM classes AS class_row
    WHERE class_row.id::TEXT = schedule.class_id
    LIMIT 1
  ),
  'Morning'
)
WHERE schedule.shift IS NULL;

ALTER TABLE teaching_schedules ALTER COLUMN shift SET DEFAULT 'Morning';
ALTER TABLE teaching_schedules ALTER COLUMN shift SET NOT NULL;
ALTER TABLE teaching_schedules DROP CONSTRAINT IF EXISTS teaching_schedules_unique_slot;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'teaching_schedules'::regclass
      AND conname = 'teaching_schedules_valid_shift'
  ) THEN
    ALTER TABLE teaching_schedules
      ADD CONSTRAINT teaching_schedules_valid_shift
      CHECK (shift IN ('Morning', 'Afternoon', 'Evening'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'teaching_schedules'::regclass
      AND conname = 'teaching_schedules_unique_shift_slot'
  ) THEN
    ALTER TABLE teaching_schedules
      ADD CONSTRAINT teaching_schedules_unique_shift_slot
      UNIQUE (teacher_id, academic_year, shift, day_of_week, start_time, end_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS teaching_schedules_branch_year_idx
  ON teaching_schedules (branch, academic_year);
CREATE INDEX IF NOT EXISTS teaching_schedules_teacher_idx
  ON teaching_schedules (teacher_id);
CREATE INDEX IF NOT EXISTS teaching_schedules_teacher_shift_idx
  ON teaching_schedules (teacher_id, shift);

ALTER TABLE teaching_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch-scoped access to teaching_schedules" ON teaching_schedules;
CREATE POLICY "Branch-scoped access to teaching_schedules" ON teaching_schedules
  FOR ALL TO authenticated
  USING (
    branch = (SELECT branch FROM profiles WHERE id = auth.uid())
    AND teacher_id = auth.uid()
  )
  WITH CHECK (
    branch = (SELECT branch FROM profiles WHERE id = auth.uid())
    AND teacher_id = auth.uid()
  );
