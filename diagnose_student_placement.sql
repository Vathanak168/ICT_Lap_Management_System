-- Read-only diagnostic for INVALID_STUDENT_PLACEMENT_FOUND.
-- Run this by itself in Supabase SQL Editor and copy the returned rows.
-- This script does not update or delete any data.

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
), placement as (
  select
    s.id as student_uuid,
    s.student_id,
    s.name as student_name,
    s.branch,
    s.academic_year,
    s.is_shift_switching,
    s.class as current_class_id,
    current_class.name as current_class_name,
    current_class.grade_number as current_grade,
    current_class.shift as current_shift,
    s.alternate_class_id,
    alternate_class.name as alternate_class_name,
    alternate_class.grade_number as alternate_grade,
    alternate_class.shift as alternate_shift
  from public.students s
  left join class_catalog current_class
    on current_class.id = s.class
    and current_class.branch = s.branch
    and current_class.academic_year = s.academic_year
  left join class_catalog alternate_class
    on alternate_class.id = s.alternate_class_id
    and alternate_class.branch = s.branch
    and alternate_class.academic_year = s.academic_year
), diagnosed as (
  select
    placement.*,
    array_to_string(
      array_remove(array[
        case when current_class_name is null then 'CURRENT_CLASS_NOT_FOUND' end,
        case when current_class_name is not null and current_grade is null then 'CURRENT_GRADE_UNREADABLE' end,
        case when is_shift_switching and alternate_class_name is null then 'ALTERNATE_CLASS_NOT_FOUND' end,
        case when is_shift_switching and alternate_class_name is not null and alternate_grade is null then 'ALTERNATE_GRADE_UNREADABLE' end,
        case when is_shift_switching and current_grade is not null and alternate_grade is not null and current_grade <> alternate_grade then 'GRADE_MISMATCH' end,
        case when is_shift_switching and current_shift = alternate_shift then 'SAME_SHIFT' end
      ], null),
      ', '
    ) as problems
  from placement
)
select
  student_uuid,
  student_id,
  student_name,
  branch,
  academic_year,
  current_class_id,
  current_class_name,
  current_grade,
  current_shift,
  is_shift_switching,
  alternate_class_id,
  alternate_class_name,
  alternate_grade,
  alternate_shift,
  problems,
  case
    when current_class_name is null then 'MANUAL: choose the correct current class'
    when current_grade is null then 'MANUAL: rename the class so its grade can be read'
    else 'SAFE_REPAIR: disable the invalid shift-switching setup'
  end as recommended_action
from diagnosed
where problems <> ''
order by branch, academic_year, student_id;

