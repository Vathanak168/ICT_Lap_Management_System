-- Safe, single-student repair for CURRENT_CLASS_NOT_FOUND.
-- This only canonicalizes a case-mismatched class ID. It does not change the
-- student's PC, seat, password, status, branch, or academic year.

begin;

do $$
declare
  target_student public.students%rowtype;
  candidate_count integer;
  canonical_class_id text;
  canonical_shift text;
  updated_count integer;
begin
  select * into target_student
  from public.students
  where id = 'b5b5acbd-f984-471c-a493-b48566c26808'
    and student_id = '00142290'
    and branch = 'BELTEI IS 25'
    and academic_year = '2026-2027'
  for update;

  if not found then
    raise exception 'TARGET_STUDENT_NOT_FOUND_OR_CHANGED';
  end if;

  select count(*), min(c.id), min(c.shift)
  into candidate_count, canonical_class_id, canonical_shift
  from public.classes c
  where lower(c.id) = lower(target_student.class)
    and c.branch = target_student.branch
    and c.academic_year = target_student.academic_year;

  if candidate_count = 0 then
    raise exception using
      message = 'NO_CASE_INSENSITIVE_CLASS_MATCH',
      detail = 'The referenced class was deleted or belongs to another branch/year. Choose the correct class manually.';
  end if;

  if candidate_count > 1 then
    raise exception using
      message = 'MULTIPLE_CASE_INSENSITIVE_CLASS_MATCHES',
      detail = 'No update was made because the correct class is ambiguous.';
  end if;

  update public.students
  set
    class = canonical_class_id,
    shift = canonical_shift
  where id = target_student.id;

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'STUDENT_CLASS_REPAIR_DID_NOT_UPDATE_EXACTLY_ONE_ROW';
  end if;
end;
$$;

select
  s.student_id,
  s.name,
  s.class as repaired_class_id,
  c.name as repaired_class_name,
  s.shift,
  s.pc_number as preserved_pc_number,
  s.is_shift_switching
from public.students s
join public.classes c
  on c.id = s.class
  and c.branch = s.branch
  and c.academic_year = s.academic_year
where s.id = 'b5b5acbd-f984-471c-a493-b48566c26808';

commit;

