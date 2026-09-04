-- Safe repair for invalid alternate-class / shift-switching relationships.
-- It preserves the student's current class, PC, password, and seat. It only
-- turns off invalid shift-switching and clears the unusable alternate class.
-- Run diagnose_student_placement.sql first and review its rows.

begin;

with normalized_classes as (
  select
    c.*,
    regexp_replace(
      regexp_replace(
        translate(trim(coalesce(c.name, '')), '០១២៣៤៥៦៧៨៩', '0123456789'),
        '^[[:space:]]*ថ្នាក់ទី[[:space:]]*',
        '',
        'i'
      ),
      '^[[:space:]]*grade[[:space:]]*',
      '',
      'i'
    ) as normalized_name
  from public.classes c
), class_catalog as (
  select
    normalized_classes.*,
    case
      when normalized_name ~ '^([0-9]{1,2})([^0-9]|$)'
        then substring(normalized_name from '^([0-9]{1,2})([^0-9]|$)')::integer
      else null
    end as grade_number
  from normalized_classes
), invalid_shift_switchers as (
  select s.id
  from public.students s
  join class_catalog current_class
    on current_class.id = s.class
    and current_class.branch = s.branch
    and current_class.academic_year = s.academic_year
  left join class_catalog alternate_class
    on alternate_class.id = s.alternate_class_id
    and alternate_class.branch = s.branch
    and alternate_class.academic_year = s.academic_year
  where s.is_shift_switching
    and current_class.grade_number is not null
    and (
      alternate_class.id is null
      or alternate_class.grade_number is null
      or current_class.grade_number <> alternate_class.grade_number
      or current_class.shift = alternate_class.shift
    )
)
update public.students s
set
  is_shift_switching = false,
  alternate_class_id = null
from invalid_shift_switchers invalid
where s.id = invalid.id
returning
  s.student_id,
  s.name,
  s.class as preserved_current_class,
  s.pc_number as preserved_pc_number,
  s.is_shift_switching,
  s.alternate_class_id;

commit;

