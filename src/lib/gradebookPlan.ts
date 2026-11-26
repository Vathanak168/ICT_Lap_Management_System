import type { ClassRecord, GradeRecord, GradeType, Student } from '../store/db';

export interface GradebookScoreEntry {
  practice: number | null;
  book: number | null;
  exam: number | null;
  adjustment: number | null;
  adjustmentNote: string;
}

export interface GradebookEditableStudent {
  id: string;
  gradeClassId: string;
  practice: number | null;
  book: number | null;
  exam: number | null;
  adjustment: number | null;
  adjustmentNote: string;
  isHistoricalOnly?: boolean;
}

export interface GradebookSavePlan {
  otherClassCleanups: GradeRecord[];
  duplicateIdsToDelete: string[];
  preCleanOps: GradeRecord[];
  recordsToSave: GradeRecord[];
}

export const hasSavedScoreEntry = (entry: Record<string, any> | undefined | null): boolean => {
  if (!entry || typeof entry !== 'object') return false;
  return (
    (entry.practice !== null && entry.practice !== undefined)
    || (entry.book !== null && entry.book !== undefined)
    || (entry.exam !== null && entry.exam !== undefined)
    || (typeof entry.adjustment === 'number' && entry.adjustment !== 0)
    || (typeof entry.adjustmentNote === 'string' && entry.adjustmentNote.trim().length > 0)
  );
};

export const hasStudentScore = (
  row: Pick<GradebookEditableStudent, 'practice' | 'book' | 'exam' | 'adjustment' | 'adjustmentNote'>
): boolean =>
  row.practice !== null
  || row.book !== null
  || row.exam !== null
  || (row.adjustment !== null && row.adjustment !== 0)
  || Boolean(row.adjustmentNote?.trim());

/**
 * Builds the ordered set of database operations required to save monthly grades
 * without violating PostgreSQL's guard_monthly_grade_scores_trigger.
 */
export function buildGradebookSavePlan(params: {
  editableStudents: GradebookEditableStudent[];
  allYearGrades: GradeRecord[];
  allYearStudents: Array<Pick<Student, 'id'>>;
  classes: Array<Pick<ClassRecord, 'id' | 'shift'>>;
  academicYear: string;
  month: string;
  gradeType: GradeType;
  createId?: () => string;
}): GradebookSavePlan {
  const {
    editableStudents,
    allYearGrades,
    allYearStudents,
    classes,
    academicYear,
    month,
    gradeType,
    createId = () => crypto.randomUUID(),
  } = params;

  const activeEditable = editableStudents.filter(s => !s.isHistoricalOnly);
  const scopeClassIds = Array.from(new Set(activeEditable.map(s => s.gradeClassId)));
  if (scopeClassIds.length === 0) {
    return {
      otherClassCleanups: [],
      duplicateIdsToDelete: [],
      preCleanOps: [],
      recordsToSave: [],
    };
  }

  const scoresByClass: Record<string, Record<string, GradebookScoreEntry>> = {};
  for (const cid of scopeClassIds) {
    scoresByClass[cid] = {};
  }

  const savingScoreStudentIds = new Set<string>();
  const clearedScopeStudentIds = new Set<string>();

  for (const s of activeEditable) {
    if (hasStudentScore(s)) {
      savingScoreStudentIds.add(s.id);
      scoresByClass[s.gradeClassId][s.id] = {
        practice: s.practice,
        book: s.book,
        exam: s.exam,
        adjustment: s.adjustment,
        adjustmentNote: s.adjustmentNote || '',
      };
    } else {
      clearedScopeStudentIds.add(s.id);
    }
  }

  const validStudentIds = new Set(allYearStudents.map(s => s.id));
  const monthlyGrades = allYearGrades.filter(
    g => g.month === month && g.type === gradeType
  );

  // Pass 0: strip conflicting/invalid/empty keys from classes outside scope first
  const otherClassRecords = monthlyGrades.filter(g => !scopeClassIds.includes(g.classId));
  const otherClassStudentIds = new Set<string>();
  const otherClassCleanups: GradeRecord[] = [];

  for (const otherRecord of otherClassRecords) {
    const cleanedScores = { ...(otherRecord.scores || {}) };
    let modified = false;

    for (const sid of Object.keys(cleanedScores)) {
      if (
        !validStudentIds.has(sid)
        || savingScoreStudentIds.has(sid)
        || !hasSavedScoreEntry(cleanedScores[sid])
        || otherClassStudentIds.has(sid)
      ) {
        delete cleanedScores[sid];
        modified = true;
      } else {
        otherClassStudentIds.add(sid);
      }
    }

    if (modified) {
      otherClassCleanups.push({ ...otherRecord, scores: cleanedScores });
    }
  }

  // Pass 1 & Pass 2: merge duplicates, pre-clean transferred/stale keys from DB rows, then write final rows
  const duplicateIdsToDelete: string[] = [];
  const preCleanOps: GradeRecord[] = [];
  const recordsToSave: GradeRecord[] = [];

  for (const cid of scopeClassIds) {
    const matchingRecords = monthlyGrades.filter(g => g.classId === cid);
    const hadExistingDbRecord = matchingRecords.length > 0;
    let primaryRecord: GradeRecord;

    if (matchingRecords.length > 0) {
      primaryRecord = {
        ...matchingRecords[0],
        scores: { ...(matchingRecords[0].scores || {}) },
      };
      for (let i = 1; i < matchingRecords.length; i++) {
        const dup = matchingRecords[i];
        primaryRecord.scores = { ...(dup.scores || {}), ...primaryRecord.scores };
        duplicateIdsToDelete.push(dup.id);
      }
    } else {
      primaryRecord = {
        id: createId(),
        classId: cid,
        shift: classes.find(c => c.id === cid)?.shift || 'Morning',
        academicYear,
        month,
        type: gradeType,
        scores: {},
      };
    }

    const keptExistingScores: Record<string, any> = {};
    let removedAnyFromDbRecord = false;

    for (const [sid, entry] of Object.entries(primaryRecord.scores || {})) {
      const belongsToOtherScopeClass = savingScoreStudentIds.has(sid) && !scoresByClass[cid][sid];
      if (
        !validStudentIds.has(sid)
        || clearedScopeStudentIds.has(sid)
        || otherClassStudentIds.has(sid)
        || belongsToOtherScopeClass
        || !hasSavedScoreEntry(entry)
      ) {
        removedAnyFromDbRecord = true;
      } else {
        keptExistingScores[sid] = entry;
      }
    }

    const shift = classes.find(c => c.id === cid)?.shift || primaryRecord.shift || 'Morning';

    if (hadExistingDbRecord && removedAnyFromDbRecord) {
      preCleanOps.push({
        id: primaryRecord.id,
        classId: cid,
        shift,
        academicYear,
        month,
        type: gradeType,
        scores: keptExistingScores,
      });
    }

    const mergedScores = { ...keptExistingScores, ...scoresByClass[cid] };
    if (hadExistingDbRecord || Object.keys(mergedScores).length > 0) {
      recordsToSave.push({
        id: primaryRecord.id,
        classId: cid,
        shift,
        academicYear,
        month,
        type: gradeType,
        scores: mergedScores as any,
      });
    }
  }

  return {
    otherClassCleanups,
    duplicateIdsToDelete,
    preCleanOps,
    recordsToSave,
  };
}

/**
 * Resolves active scope students plus historical transferred/inactive students
 * who already have saved scores in one of classesToFetch for the selected month.
 */
export function selectGradebookScopeStudents(params: {
  allYearStudents: Student[];
  allYearGrades: GradeRecord[];
  classesToFetch: string[];
  month: string;
  gradeType: GradeType;
}) {
  const { allYearStudents, allYearGrades, classesToFetch, month, gradeType } = params;

  const activeStudents = allYearStudents.filter(
    s => classesToFetch.includes(s.class) && s.status === 'Active'
  );
  const activeStudentIds = new Set(activeStudents.map(s => s.id));
  const studentById = new Map(allYearStudents.map(s => [s.id, s]));

  const allMonthlyGrades = allYearGrades.filter(
    g => g.month === month && g.type === gradeType
  );
  const scopeGrades = allMonthlyGrades.filter(g => classesToFetch.includes(g.classId));

  const otherClassOwnedIds = new Set<string>();
  for (const g of allMonthlyGrades) {
    if (!classesToFetch.includes(g.classId)) {
      for (const [sid, sc] of Object.entries(g.scores || {})) {
        if (hasSavedScoreEntry(sc)) {
          otherClassOwnedIds.add(sid);
        }
      }
    }
  }

  const scoresLookup: Record<string, Record<string, any>> = {};
  const historicalRowsMeta: Array<{
    student: Student;
    gradeClassId: string;
    reason: 'transferred' | 'inactive';
  }> = [];
  const seenHistoricalIds = new Set<string>();

  for (const g of scopeGrades) {
    for (const [studentId, scores] of Object.entries(g.scores || {})) {
      if (!scoresLookup[studentId] || hasSavedScoreEntry(scores)) {
        scoresLookup[studentId] = scores as any;
      }
      if (
        !activeStudentIds.has(studentId)
        && !seenHistoricalIds.has(studentId)
        && !otherClassOwnedIds.has(studentId)
        && hasSavedScoreEntry(scores)
      ) {
        const stu = studentById.get(studentId);
        if (stu) {
          seenHistoricalIds.add(studentId);
          historicalRowsMeta.push({
            student: stu,
            gradeClassId: g.classId,
            reason: stu.status !== 'Active' ? 'inactive' : 'transferred',
          });
        }
      }
    }
  }

  return {
    activeStudents,
    historicalRowsMeta,
    scoresLookup,
  };
}
