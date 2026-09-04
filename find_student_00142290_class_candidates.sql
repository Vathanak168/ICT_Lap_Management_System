-- Read-only class recovery evidence for student 00142290.
-- This does not update or delete anything. Run it in Supabase SQL Editor and
-- send back the full result ordered by priority.

with target_student as (
  select
    id as student_uuid,
    student_id,
    name as student_name,
    class as stored_class_id,
    shift as stored_shift,
    branch,
    academic_year
  from public.students
  where id = 'b5b5acbd-f984-471c-a493-b48566c26808'
    and student_id = '00142290'
    and branch = 'BELTEI IS 25'
    and academic_year = '2026-2027'
), raw_history as (
  select
    a.class_id,
    'ATTENDANCE'::text as source,
    count(*)::integer as evidence_count,
    max(a.date)::text as latest_reference
  from public.attendance a
  cross join target_student t
  where a.branch = t.branch
    and a.academic_year = t.academic_year
    and a.records_json ? t.student_uuid::text
  group by a.class_id

  union all

  select
    g.class_id,
    'GRADES'::text as source,
    count(*)::integer as evidence_count,
    max(g.month)::text as latest_reference
  from public.grades g
  cross join target_student t
  where g.branch = t.branch
    and g.academic_year = t.academic_year
    and g.scores_json ? t.student_uuid::text
  group by g.class_id
), history as (
  select
    class_id,
    sum(evidence_count)::integer as evidence_count,
    string_agg(source || ':' || evidence_count || ' latest=' || coalesce(latest_reference, '?'), '; ' order by source) as evidence
  from raw_history
  group by class_id
), evidence_rows as (
  select
    'CURRENT_STUDENT'::text as row_type,
    t.student_id,
    t.student_name,
    t.stored_shift,
    t.stored_class_id as class_id,
    null::text as class_name,
    null::text as class_shift,
    t.branch as class_branch,
    t.academic_year as class_academic_year,
    null::integer as evidence_count,
    'Stored orphan class reference'::text as evidence,
    10000::integer as priority,
    'Reference only; do not select this missing class ID'::text as note
  from target_student t

  union all

  select
    'ID_MATCH_OTHER_SCOPE'::text,
    t.student_id,
    t.student_name,
    t.stored_shift,
    c.id,
    c.name,
    c.shift,
    c.branch,
    c.academic_year,
    null::integer,
    'Same ID ignoring uppercase/lowercase, but outside the student scope'::text,
    9000::integer,
    'Use only as evidence; branch/year differs'::text
  from target_student t
  join public.classes c
    on lower(c.id) = lower(t.stored_class_id)
  where c.branch <> t.branch or c.academic_year <> t.academic_year

  union all

  select
    'HISTORY_REFERENCE'::text,
    t.student_id,
    t.student_name,
    t.stored_shift,
    h.class_id,
    c.name,
    c.shift,
    c.branch,
    c.academic_year,
    h.evidence_count,
    h.evidence,
    8000 + h.evidence_count,
    case when c.id is null then 'Historical class is also missing' else 'Strong candidate from saved records' end
  from target_student t
  join history h on true
  left join public.classes c
    on c.id = h.class_id
    and c.branch = t.branch
    and c.academic_year = t.academic_year

  union all

  select
    'CURRENT_CLASS_CANDIDATE'::text,
    t.student_id,
    t.student_name,
    t.stored_shift,
    c.id,
    c.name,
    c.shift,
    c.branch,
    c.academic_year,
    coalesce(h.evidence_count, 0),
    coalesce(h.evidence, 'No attendance/grade reference found'),
    coalesce(h.evidence_count, 0) * 100 + case when c.shift = t.stored_shift then 10 else 0 end,
    case
      when h.evidence_count > 0 then 'History match'
      when c.shift = t.stored_shift then 'Shift match only; confirm class name manually'
      else 'No direct evidence; confirm manually'
    end
  from target_student t
  join public.classes c
    on c.branch = t.branch
    and c.academic_year = t.academic_year
  left join history h on h.class_id = c.id
)
select *
from evidence_rows
order by priority desc, row_type, class_name nulls last;

