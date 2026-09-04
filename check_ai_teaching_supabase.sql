-- AI + Teaching update: focused Supabase diagnostic
-- READ-ONLY: this script does not create, alter, update, or delete anything.
--
-- Run the whole file in Supabase Dashboard -> SQL Editor.
-- Read the SUMMARY row first, then inspect FAIL and WARNING rows.

WITH
required_tables(table_name, migration) AS (
  VALUES
    ('subjects', 'teaching_tracker_schema.sql'),
    ('curriculum_lessons', 'teaching_tracker_schema.sql'),
    ('class_curriculums', 'teaching_tracker_schema.sql'),
    ('teaching_logs', 'teaching_tracker_schema.sql'),
    ('teaching_schedules', 'teaching_schedule_schema.sql'),
    ('ai_history', 'create_ai_history.sql / compatibility fix')
),
expected_columns(table_name, column_name) AS (
  VALUES
    ('subjects', 'id'), ('subjects', 'name'), ('subjects', 'color'),
    ('subjects', 'branch'), ('subjects', 'academic_year'),

    ('curriculum_lessons', 'id'), ('curriculum_lessons', 'subject_id'),
    ('curriculum_lessons', 'order_no'), ('curriculum_lessons', 'module'),
    ('curriculum_lessons', 'title'), ('curriculum_lessons', 'estimated_periods'),
    ('curriculum_lessons', 'branch'), ('curriculum_lessons', 'academic_year'),

    ('class_curriculums', 'id'), ('class_curriculums', 'class_id'),
    ('class_curriculums', 'subject_id'), ('class_curriculums', 'branch'),
    ('class_curriculums', 'academic_year'),

    ('teaching_logs', 'id'), ('teaching_logs', 'class_id'),
    ('teaching_logs', 'lesson_id'), ('teaching_logs', 'teacher_id'),
    ('teaching_logs', 'status'), ('teaching_logs', 'progress_percent'),
    ('teaching_logs', 'taught_at'), ('teaching_logs', 'branch'),
    ('teaching_logs', 'academic_year'),

    ('teaching_schedules', 'id'), ('teaching_schedules', 'teacher_id'),
    ('teaching_schedules', 'shift'), ('teaching_schedules', 'day_of_week'),
    ('teaching_schedules', 'start_time'), ('teaching_schedules', 'end_time'),
    ('teaching_schedules', 'class_id'), ('teaching_schedules', 'subject_id'),
    ('teaching_schedules', 'branch'), ('teaching_schedules', 'academic_year'),

    -- Current application code expects these exact ai_history columns.
    ('ai_history', 'id'), ('ai_history', 'messages'), ('ai_history', 'title'),
    ('ai_history', 'branch'), ('ai_history', 'updated_at')
),
table_state AS (
  SELECT
    required.table_name,
    required.migration,
    to_regclass(format('public.%I', required.table_name)) IS NOT NULL AS table_exists
  FROM required_tables AS required
),
column_state AS (
  SELECT
    expected.table_name,
    COUNT(*) FILTER (WHERE actual.column_name IS NULL) AS missing_count,
    COALESCE(
      string_agg(expected.column_name, ', ' ORDER BY expected.column_name)
        FILTER (WHERE actual.column_name IS NULL),
      ''
    ) AS missing_columns
  FROM expected_columns AS expected
  LEFT JOIN information_schema.columns AS actual
    ON actual.table_schema = 'public'
   AND actual.table_name = expected.table_name
   AND actual.column_name = expected.column_name
  GROUP BY expected.table_name
),
rls_state AS (
  SELECT
    required.table_name,
    COALESCE(table_class.relrowsecurity, FALSE) AS rls_enabled
  FROM required_tables AS required
  LEFT JOIN pg_namespace AS namespace
    ON namespace.nspname = 'public'
  LEFT JOIN pg_class AS table_class
    ON table_class.relnamespace = namespace.oid
   AND table_class.relname = required.table_name
   AND table_class.relkind IN ('r', 'p')
),
policy_state AS (
  SELECT
    required.table_name,
    COUNT(policy.policyname) AS policy_count,
    COALESCE(
      string_agg(policy.policyname || ' [' || policy.cmd || ']', '; ' ORDER BY policy.policyname),
      'No policy'
    ) AS policy_names,
    COALESCE(
      bool_or(
        lower(COALESCE(policy.qual, '') || ' ' || COALESCE(policy.with_check, ''))
          LIKE '%branch%'
      ),
      FALSE
    ) AS has_branch_filter,
    COALESCE(
      bool_or(
        lower(COALESCE(policy.qual, '') || ' ' || COALESCE(policy.with_check, ''))
          LIKE '%teacher_id%'
        AND lower(COALESCE(policy.qual, '') || ' ' || COALESCE(policy.with_check, ''))
          LIKE '%auth.uid%'
      ),
      FALSE
    ) AS has_teacher_filter
  FROM required_tables AS required
  LEFT JOIN pg_policies AS policy
    ON policy.schemaname = 'public'
   AND policy.tablename = required.table_name
  GROUP BY required.table_name
),
table_checks AS (
  SELECT
    'TABLE'::TEXT AS check_type,
    state.table_name AS object_name,
    CASE WHEN state.table_exists THEN 'PASS' ELSE 'FAIL' END AS status,
    CASE WHEN state.table_exists THEN 'Table exists' ELSE 'Table is missing' END AS details,
    CASE WHEN state.table_exists THEN 'No action required' ELSE 'Review ' || state.migration END AS next_action
  FROM table_state AS state
),
column_checks AS (
  SELECT
    'COLUMNS'::TEXT AS check_type,
    columns.table_name AS object_name,
    CASE
      WHEN NOT tables.table_exists THEN 'FAIL'
      WHEN columns.missing_count = 0 THEN 'PASS'
      ELSE 'FAIL'
    END AS status,
    CASE
      WHEN NOT tables.table_exists THEN 'Cannot check columns because the table is missing'
      WHEN columns.missing_count = 0 THEN 'All columns required by the updated code exist'
      ELSE 'Missing: ' || columns.missing_columns
    END AS details,
    CASE
      WHEN tables.table_exists AND columns.missing_count = 0 THEN 'No action required'
      WHEN columns.table_name = 'ai_history'
        THEN 'The current code needs ai_history.branch and ai_history.title; branch_name alone is not compatible'
      ELSE 'Review ' || tables.migration
    END AS next_action
  FROM column_state AS columns
  JOIN table_state AS tables USING (table_name)
),
rls_checks AS (
  SELECT
    'RLS / POLICY'::TEXT AS check_type,
    tables.table_name AS object_name,
    CASE
      WHEN NOT tables.table_exists THEN 'FAIL'
      WHEN NOT rls.rls_enabled THEN 'FAIL'
      WHEN policies.policy_count = 0 THEN 'FAIL'
      WHEN NOT policies.has_branch_filter THEN 'FAIL'
      WHEN tables.table_name = 'teaching_schedules' AND NOT policies.has_teacher_filter THEN 'FAIL'
      ELSE 'PASS'
    END AS status,
    'RLS=' || CASE WHEN rls.rls_enabled THEN 'ON' ELSE 'OFF' END
      || '; policies=' || policies.policy_names
      || '; branch filter=' || CASE WHEN policies.has_branch_filter THEN 'FOUND' ELSE 'MISSING' END
      || CASE
        WHEN tables.table_name = 'teaching_schedules'
          THEN '; teacher/auth.uid filter=' || CASE WHEN policies.has_teacher_filter THEN 'FOUND' ELSE 'MISSING' END
        ELSE ''
      END AS details,
    CASE
      WHEN tables.table_exists
       AND rls.rls_enabled
       AND policies.policy_count > 0
       AND policies.has_branch_filter
       AND (tables.table_name <> 'teaching_schedules' OR policies.has_teacher_filter)
        THEN 'No action required'
      ELSE 'Review the RLS section in ' || tables.migration
    END AS next_action
  FROM table_state AS tables
  JOIN rls_state AS rls USING (table_name)
  JOIN policy_state AS policies USING (table_name)
),
special_checks AS (
  -- Suspected mismatch: old create_ai_history.sql used branch_name, while db.ts uses branch.
  SELECT
    'AI HISTORY COMPATIBILITY'::TEXT AS check_type,
    'ai_history.branch vs branch_name'::TEXT AS object_name,
    CASE
      WHEN to_regclass('public.ai_history') IS NULL THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_history' AND column_name = 'branch'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS status,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_history' AND column_name = 'branch_name'
      ) THEN 'Old column branch_name was found; current code reads/writes branch'
      ELSE 'Current code requires a branch column'
    END AS details,
    'If FAIL, migrate branch_name to branch without losing existing history'::TEXT AS next_action

  UNION ALL

  -- The new timetable flow depends on shift being part of the unique teacher slot.
  SELECT
    'SCHEDULE CONSTRAINT',
    'teaching_schedules unique shift slot',
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = to_regclass('public.teaching_schedules')
        AND contype = 'u'
        AND replace(pg_get_constraintdef(oid), ' ', '')
          LIKE 'UNIQUE(teacher_id,academic_year,shift,day_of_week,start_time,end_time)%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Expected UNIQUE(teacher_id, academic_year, shift, day_of_week, start_time, end_time)',
    'If FAIL, run/review teaching_schedule_schema.sql'

  UNION ALL

  -- This is not necessarily wrong, but it must match the intended permissions.
  SELECT
    'PERMISSION REVIEW',
    'curriculum write access',
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('subjects', 'curriculum_lessons', 'class_curriculums')
        AND cmd = 'ALL'
        AND 'authenticated' = ANY(roles)
    ) THEN 'WARNING' ELSE 'PASS' END,
    'A FOR ALL authenticated policy means same-branch teachers may be able to add, edit, and delete curriculum data',
    'Keep it if intended; otherwise restrict curriculum writes to admin'
),
checks AS (
  SELECT * FROM table_checks
  UNION ALL SELECT * FROM column_checks
  UNION ALL SELECT * FROM rls_checks
  UNION ALL SELECT * FROM special_checks
),
summary AS (
  SELECT
    'SUMMARY'::TEXT AS check_type,
    'AI + Teaching update'::TEXT AS object_name,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'FAIL') > 0 THEN 'FAIL'
      WHEN COUNT(*) FILTER (WHERE status = 'WARNING') > 0 THEN 'WARNING'
      ELSE 'PASS'
    END AS status,
    'PASS=' || (COUNT(*) FILTER (WHERE status = 'PASS'))::TEXT
      || ', WARNING=' || (COUNT(*) FILTER (WHERE status = 'WARNING'))::TEXT
      || ', FAIL=' || (COUNT(*) FILTER (WHERE status = 'FAIL'))::TEXT AS details,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'FAIL') > 0 THEN 'Send the FAIL rows back for a safe migration script'
      WHEN COUNT(*) FILTER (WHERE status = 'WARNING') > 0 THEN 'Review the warning before production use'
      ELSE 'Ready for signed-in end-to-end AI testing'
    END AS next_action
  FROM checks
)
SELECT check_type, object_name, status, details, next_action
FROM (
  SELECT 0 AS display_order, summary.* FROM summary
  UNION ALL
  SELECT 1 AS display_order, checks.* FROM checks
) AS report
ORDER BY
  display_order,
  CASE status WHEN 'FAIL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
  check_type,
  object_name;

