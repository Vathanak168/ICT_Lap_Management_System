-- Read-only Gradebook preflight.
-- Run this in Supabase SQL Editor. It does not update or delete any data.

with grade_rows as (
  select
    g.id::text as grade_record_id,
    g.branch,
    g.academic_year,
    g.month,
    g.class_id,
    g.type,
    coalesce(g.scores_json, '{}'::jsonb) as scores_json
  from public.grades g
  where g.type in ('Monthly', 'Final')
),
score_entries as (
  select
    g.grade_record_id,
    g.branch,
    g.academic_year,
    g.month,
    g.class_id,
    g.type,
    score_key.student_key
  from grade_rows g
  cross join lateral jsonb_object_keys(g.scores_json) as score_key(student_key)
),
resolved_scores as (
  select
    e.*,
    student_by_uuid.student_id,
    student_by_uuid.name as student_name,
    student_by_external_id.id::text as external_id_student_uuid
  from score_entries e
  left join public.students student_by_uuid
    on student_by_uuid.id::text = e.student_key
   and student_by_uuid.branch = e.branch
   and student_by_uuid.academic_year = e.academic_year
  left join public.students student_by_external_id
    on student_by_external_id.student_id = e.student_key
   and student_by_external_id.branch = e.branch
   and student_by_external_id.academic_year = e.academic_year
),
duplicate_records as (
  select
    branch,
    academic_year,
    month,
    class_id,
    count(*) as record_count,
    string_agg(grade_record_id, ', ' order by grade_record_id) as record_ids
  from grade_rows
  where type = 'Monthly'
  group by branch, academic_year, month, class_id
  having count(*) > 1
),
duplicate_student_scores as (
  select
    branch,
    academic_year,
    month,
    student_key,
    max(student_id) as student_id,
    max(student_name) as student_name,
    count(*) as score_count,
    string_agg(distinct class_id, ', ' order by class_id) as class_ids,
    string_agg(grade_record_id, ', ' order by grade_record_id) as record_ids
  from resolved_scores
  where type = 'Monthly'
  group by branch, academic_year, month, student_key
  having count(*) > 1
)
select
  'DUPLICATE_MONTHLY_RECORD'::text as check_type,
  d.branch,
  d.academic_year,
  d.month,
  d.class_id,
  null::text as student_uuid,
  null::text as student_id,
  null::text as student_name,
  format('%s Grade Records: %s', d.record_count, d.record_ids) as details
from duplicate_records d

union all

select
  'DUPLICATE_MONTHLY_STUDENT_SCORE',
  d.branch,
  d.academic_year,
  d.month,
  d.class_ids,
  d.student_key,
  d.student_id,
  d.student_name,
  format('%s score owners; records: %s', d.score_count, d.record_ids)
from duplicate_student_scores d

union all

select
  case
    when r.external_id_student_uuid is not null then 'SCORE_KEY_IS_EXTERNAL_STUDENT_ID'
    else 'SCORE_KEY_STUDENT_NOT_FOUND'
  end,
  r.branch,
  r.academic_year,
  r.month,
  r.class_id,
  coalesce(r.external_id_student_uuid, r.student_key),
  case when r.external_id_student_uuid is not null then r.student_key else null end,
  null::text,
  format('Grade record %s uses invalid score key %s', r.grade_record_id, r.student_key)
from resolved_scores r
where r.student_id is null

union all

select
  'LEGACY_FINAL_RECORD',
  g.branch,
  g.academic_year,
  g.month,
  g.class_id,
  null::text,
  null::text,
  null::text,
  format('Grade record %s has type Final; the Gradebook uses Monthly', g.grade_record_id)
from grade_rows g
where g.type = 'Final'

order by branch, academic_year, month, check_type, class_id, student_id;
