/**
 * Khmer Alphabetical Sorting Utilities
 *
 * Provides accurate, consistent, and null-safe sorting for Khmer names and strings
 * based on standard Khmer alphabetical order (ក ដល់ អ) using Intl.Collator.
 */

const khmerCollator = new Intl.Collator(['km', 'en'], { numeric: true });

/**
 * Compare two strings according to Khmer alphabetical rules.
 * Handles null, undefined, and whitespace gracefully.
 * Empty or null values are sorted to the bottom.
 */
export const compareKhmer = (a?: string | null, b?: string | null): number => {
  const strA = (a ?? '').trim();
  const strB = (b ?? '').trim();

  if (!strA && !strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  return khmerCollator.compare(strA, strB);
};

export interface StudentLike {
  name?: string | null;
  studentId?: string | null;
  student_id?: string | null;
}

/**
 * Compare two student records by Khmer Full Name (ក ដល់ អ).
 * If names are identical, falls back to student_id / studentId for deterministic ordering.
 */
export const compareStudentsByKhmerName = <T extends StudentLike>(a: T, b: T): number => {
  const nameDiff = compareKhmer(a.name, b.name);
  if (nameDiff !== 0) return nameDiff;

  const idA = (a.student_id ?? a.studentId ?? '').trim();
  const idB = (b.student_id ?? b.studentId ?? '').trim();
  return compareKhmer(idA, idB);
};
