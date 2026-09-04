-- ICT Lab student placement safety guard
-- Run this once in Supabase SQL Editor after reviewing the diagnostic output.
-- It prevents cross-grade transfers, invalid shift-switching pairs, and two
-- active students from occupying the same PC inside the same class.

begin;

create or replace function public.ictlab_extract_class_grade(class_name text)
returns integer
language plpgsql
immutable
as $$
declare
  normalized text;
  matched text[];
begin
  normalized := translate(trim(coalesce(class_name, '')), '០១២៣៤៥៦៧៨៩', '0123456789');
  normalized := regexp_replace(normalized, '^[[:space:]]*ថ្នាក់ទី[[:space:]]*', '', 'i');
  normalized := regexp_replace(normalized, '^[[:space:]]*grade[[:space:]]*', '', 'i');
  matched := regexp_match(normalized, '^([0-9]{1,2})([^0-9]|$)');
  if matched is null then
    return null;
  end if;
  return matched[1]::integer;
end;
$$;

-- Preflight 1: review existing duplicate seats. This must return zero rows.
select
  branch,
  academic_year,
  class,
  pc_number,
  count(*) as student_count,
  string_agg(student_id || ' - ' || name, ', ' order by student_id) as students
from public.students
where status = 'Active' and pc_number is not null
group by branch, academic_year, class, pc_number
having count(*) > 1
order by branch, academic_year, class, pc_number;

-- Preflight 2: review invalid current/alternate class references. Zero rows is expected.
select
  s.student_id,
  s.name,
  current_class.name as current_class,
  alternate_class.name as alternate_class,
  case
    when current_class.id is null then 'CURRENT_CLASS_NOT_FOUND'
    when s.is_shift_switching and alternate_class.id is null then 'ALTERNATE_CLASS_NOT_FOUND'
    when current_class.id is not null and public.ictlab_extract_class_grade(current_class.name) is null then 'CURRENT_GRADE_UNREADABLE'
    when s.is_shift_switching and public.ictlab_extract_class_grade(alternate_class.name) is null then 'ALTERNATE_GRADE_UNREADABLE'
    when s.is_shift_switching and public.ictlab_extract_class_grade(current_class.name)
      is distinct from public.ictlab_extract_class_grade(alternate_class.name) then 'GRADE_MISMATCH'
    when s.is_shift_switching and current_class.shift = alternate_class.shift then 'SAME_SHIFT'
  end as problem
from public.students s
left join public.classes current_class
  on current_class.id = s.class
  and current_class.branch = s.branch
  and current_class.academic_year = s.academic_year
left join public.classes alternate_class
  on alternate_class.id = s.alternate_class_id
  and alternate_class.branch = s.branch
  and alternate_class.academic_year = s.academic_year
where current_class.id is null
  or public.ictlab_extract_class_grade(current_class.name) is null
  or (
    s.is_shift_switching
    and (
      alternate_class.id is null
      or public.ictlab_extract_class_grade(current_class.name)
        is distinct from public.ictlab_extract_class_grade(alternate_class.name)
      or current_class.shift = alternate_class.shift
    )
  );

-- Stop instead of silently deleting or moving existing students. The query in
-- the exception identifies what must be fixed before this migration is rerun.
do $$
begin
  if exists (
    select 1
    from public.students
    where status = 'Active' and pc_number is not null
    group by branch, academic_year, class, pc_number
    having count(*) > 1
  ) then
    raise exception using
      message = 'DUPLICATE_ACTIVE_SEATS_FOUND',
      detail = 'Run the duplicate-seat diagnostic query at the bottom of student_placement_guard.sql, resolve those rows, then rerun this script.';
  end if;

  if exists (
    select 1
    from public.students s
    left join public.classes current_class
      on current_class.id = s.class
      and current_class.branch = s.branch
      and current_class.academic_year = s.academic_year
    left join public.classes alternate_class
      on alternate_class.id = s.alternate_class_id
      and alternate_class.branch = s.branch
      and alternate_class.academic_year = s.academic_year
    where current_class.id is null
      or public.ictlab_extract_class_grade(current_class.name) is null
      or (
        s.is_shift_switching
        and (
          alternate_class.id is null
          or public.ictlab_extract_class_grade(alternate_class.name) is null
          or public.ictlab_extract_class_grade(current_class.name)
            is distinct from public.ictlab_extract_class_grade(alternate_class.name)
          or current_class.shift = alternate_class.shift
        )
      )
  ) then
    raise exception using
      message = 'INVALID_STUDENT_PLACEMENT_FOUND',
      detail = 'Run diagnose_student_placement.sql, repair the returned rows, then rerun student_placement_guard.sql.';
  end if;
end;
$$;

create or replace function public.ictlab_guard_student_placement()
returns trigger
language plpgsql
as $$
declare
  current_class public.classes%rowtype;
  previous_class public.classes%rowtype;
  alternate_class public.classes%rowtype;
  current_grade integer;
  previous_grade integer;
  alternate_grade integer;
begin
  select * into current_class
  from public.classes
  where id = new.class
    and branch = new.branch
    and academic_year = new.academic_year;

  if not found then
    raise exception 'STUDENT_CLASS_NOT_FOUND: class %, branch %, year %',
      new.class, new.branch, new.academic_year;
  end if;

  -- The class record is the source of truth for the student's current shift.
  new.shift := current_class.shift;
  current_grade := public.ictlab_extract_class_grade(current_class.name);

  if tg_op = 'UPDATE' and old.class is distinct from new.class then
    select * into previous_class
    from public.classes
    where id = old.class
      and branch = old.branch
      and academic_year = old.academic_year;

    previous_grade := public.ictlab_extract_class_grade(previous_class.name);
    if previous_grade is null or current_grade is null or previous_grade <> current_grade then
      raise exception 'CROSS_GRADE_TRANSFER_BLOCKED: % -> %',
        coalesce(previous_class.name, old.class), current_class.name;
    end if;
  end if;

  if coalesce(new.is_shift_switching, false) then
    if nullif(trim(new.alternate_class_id), '') is null then
      raise exception 'ALTERNATE_CLASS_REQUIRED_FOR_SHIFT_SWITCHING';
    end if;

    select * into alternate_class
    from public.classes
    where id = new.alternate_class_id
      and branch = new.branch
      and academic_year = new.academic_year;

    if not found then
      raise exception 'ALTERNATE_CLASS_NOT_FOUND: %', new.alternate_class_id;
    end if;

    alternate_grade := public.ictlab_extract_class_grade(alternate_class.name);
    if current_grade is null or alternate_grade is null or current_grade <> alternate_grade then
      raise exception 'SHIFT_SWITCH_GRADE_MISMATCH: % <-> %', current_class.name, alternate_class.name;
    end if;
    if current_class.shift = alternate_class.shift then
      raise exception 'SHIFT_SWITCH_REQUIRES_DIFFERENT_SHIFTS: % <-> %', current_class.name, alternate_class.name;
    end if;
  else
    new.alternate_class_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ictlab_guard_student_placement on public.students;
create trigger trg_ictlab_guard_student_placement
before insert or update of class, shift, academic_year, branch, is_shift_switching, alternate_class_id
on public.students
for each row execute function public.ictlab_guard_student_placement();

create unique index if not exists students_one_active_student_per_class_pc
on public.students (branch, academic_year, class, pc_number)
where status = 'Active' and pc_number is not null;

commit;

-- Diagnostic: this should return zero rows before the migration can succeed.
select
  branch,
  academic_year,
  class,
  pc_number,
  count(*) as student_count,
  string_agg(student_id || ' - ' || name, ', ' order by student_id) as students
from public.students
where status = 'Active' and pc_number is not null
group by branch, academic_year, class, pc_number
having count(*) > 1
order by branch, academic_year, class, pc_number;
