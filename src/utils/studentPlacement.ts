import type { ClassRecord, Student } from '../store/db';

const KHMER_DIGITS: Record<string, string> = {
  '០': '0',
  '១': '1',
  '២': '2',
  '៣': '3',
  '៤': '4',
  '៥': '5',
  '៦': '6',
  '៧': '7',
  '៨': '8',
  '៩': '9',
};

const normalizeDigits = (value: string) =>
  value.replace(/[០-៩]/g, digit => KHMER_DIGITS[digit] ?? digit);

/**
 * Reads the grade from common class labels such as 7A1, "ថ្នាក់ទី ៧A១",
 * or "Grade 7 A1". A null result is treated as unsafe for a transfer.
 */
export const getClassGrade = (className?: string | null): number | null => {
  const normalized = normalizeDigits(String(className ?? '').trim())
    .replace(/^ថ្នាក់ទី\s*/u, '')
    .replace(/^grade\s*/i, '');
  const match = normalized.match(/^(\d{1,2})(?=\D|$)/);
  if (!match) return null;
  const grade = Number(match[1]);
  return Number.isInteger(grade) && grade > 0 ? grade : null;
};

export const haveSameGrade = (
  sourceClass?: Pick<ClassRecord, 'name'> | null,
  targetClass?: Pick<ClassRecord, 'name'> | null,
) => {
  const sourceGrade = getClassGrade(sourceClass?.name);
  const targetGrade = getClassGrade(targetClass?.name);
  return sourceGrade !== null && targetGrade !== null && sourceGrade === targetGrade;
};

export const findSeatConflict = (
  students: Student[],
  classId: string,
  pcNumber: string,
  excludedStudentId?: string,
) => students.find(student =>
  student.id !== excludedStudentId
  && student.status === 'Active'
  && student.class === classId
  && student.pcNumber === pcNumber
);

