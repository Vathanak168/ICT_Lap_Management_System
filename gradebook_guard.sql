-- Gradebook integrity guard for Supabase.
-- Run diagnose_gradebook_conflicts.sql first and repair every returned row.

begin;

do $$
begin
  if exists (
    select 1
    from public.grades
    where type = 'Monthly'
    group by branch, academic_year, class_id, month, type
    having count(*) > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'DUPLICATE_MONTHLY_GRADE_RECORD_FOUND',
      detail = 'Run diagnose_gradebook_conflicts.sql and merge duplicate Grade Records before installing this guard.';
  end if;

  if exists (
    select 1
    from public.grades g
    cross join lateral jsonb_object_keys(coalesce(g.scores_json, '{}'::jsonb)) score_key(student_key)
    where g.type = 'Monthly'
    group by g.branch, g.academic_year, g.month, score_key.student_key
    having count(*) > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'DUPLICATE_MONTHLY_STUDENT_SCORE_FOUND',
      detail = 'A student has more than one score owner for the same month. Run the diagnostic and repair it first.';
  end if;

  if exists (
    select 1
    from public.grades g
    cross join lateral jsonb_object_keys(coalesce(g.scores_json, '{}'::jsonb)) score_key(student_key)
    where g.type = 'Monthly'
      and not exists (
        select 1
        from public.students s
        where s.id::text = score_key.student_key
          and s.branch = g.branch
          and s.academic_year = g.academic_year
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_MONTHLY_SCORE_STUDENT_KEY_FOUND',
      detail = 'A score key is not an internal student UUID. Run the diagnostic and repair legacy AI score keys first.';
  end if;
end
$$;

create unique index if not exists grades_one_monthly_record_per_class_idx
  on public.grades (branch, academic_year, class_id, month, type)
  where type = 'Monthly';

create or replace function public.guard_monthly_grade_scores()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type <> 'Monthly' then
    return new;
  end if;

  if jsonb_typeof(new.scores_json) <> 'object' then
    raise exception using
      errcode = '23514',
      message = 'INVALID_GRADE_SCORES_JSON',
      detail = 'scores_json must be a JSON object keyed by internal student UUID.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(new.scores_json) score_key(student_key)
    where not exists (
      select 1
      from public.students s
      where s.id::text = score_key.student_key
        and s.branch = new.branch
        and s.academic_year = new.academic_year
    )
  ) then
    raise exception using
      errcode = '23503',
      message = 'INVALID_GRADE_STUDENT_KEY',
      detail = 'Every scores_json key must match an internal student UUID in the same branch and academic year.';
  end if;

  if exists (
    select 1
    from public.grades existing_grade
    cross join lateral jsonb_object_keys(coalesce(existing_grade.scores_json, '{}'::jsonb)) existing_key(student_key)
    where existing_grade.id <> new.id
      and existing_grade.type = 'Monthly'
      and existing_grade.branch = new.branch
      and existing_grade.academic_year = new.academic_year
      and existing_grade.month = new.month
      and new.scores_json ? existing_key.student_key
  ) then
    raise exception using
      errcode = '23505',
      message = 'DUPLICATE_MONTHLY_STUDENT_SCORE',
      detail = 'The student already has a Monthly score owner for this branch, academic year, and month.';
  end if;

  return new;
end
$$;

revoke all on function public.guard_monthly_grade_scores() from public;

drop trigger if exists guard_monthly_grade_scores_trigger on public.grades;
create trigger guard_monthly_grade_scores_trigger
before insert or update of branch, academic_year, month, type, scores_json
on public.grades
for each row
execute function public.guard_monthly_grade_scores();

commit;
