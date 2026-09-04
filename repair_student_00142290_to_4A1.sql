-- Narrow repair for student 00142290 -> class 4A1 (Morning).
-- Safety checks prevent changing any other student or using a changed target.
-- The student's PC, seat, password, and status are preserved when no target
-- seat conflict exists. Any failed check rolls back the whole transaction.

begin;

do $$
declare
  target_student public.students%rowtype;
  target_class public.classes%rowtype;
  conflicting_student text;
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

  if target_student.class <> '122a1e5a-da6b-43f9-8b81-d0578A2a4935' then
    raise exception using
      message = 'STUDENT_CLASS_REFERENCE_CHANGED',
      detail = 'No update was made because the student no longer has the diagnosed orphan class ID.';
  end if;

  select * into target_class
  from public.classes
  where id = '122a1e5a-da6b-43f9-8b81-d0578d2a4935'
    and name = '4A1'
    and shift = 'Morning'
    and branch = target_student.branch
    and academic_year = target_student.academic_year;

  if not found then
    raise exception using
      message = 'VERIFIED_4A1_TARGET_NOT_FOUND',
      detail = 'No update was made because the 4A1 target changed after diagnosis.';
  end if;

  if target_student.pc_number is not null then
    select other.student_id || ' - ' || other.name
    into conflicting_student
    from public.students other
    where other.id <> target_student.id
      and other.branch = target_student.branch
      and other.academic_year = target_student.academic_year
      and other.class = target_class.id
      and other.status = 'Active'
      and other.pc_number = target_student.pc_number
    limit 1;

    if conflicting_student is not null then
      raise exception using
        message = 'TARGET_4A1_SEAT_CONFLICT',
        detail = 'PC ' || target_student.pc_number || ' is already occupied in 4A1 by ' || conflicting_student || '. No update was made.';
    end if;
  end if;

  update public.students
  set
    class = target_class.id,
    shift = target_class.shift
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
  c.id as repaired_class_id,
  c.name as repaired_class_name,
  s.shift,
  s.pc_number as preserved_pc_number,
  s.status,
  s.is_shift_switching
from public.students s
join public.classes c
  on c.id = s.class
  and c.branch = s.branch
  and c.academic_year = s.academic_year
where s.id = 'b5b5acbd-f984-471c-a493-b48566c26808';

commit;

