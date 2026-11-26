import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGradebookSavePlan,
  selectGradebookScopeStudents,
} from '../src/lib/gradebookPlan.ts';

/**
 * Simulates PostgreSQL's guard_monthly_grade_scores_trigger + unique class index
 * on every single put/delete operation so any ordering bug triggers an immediate error.
 */
function createGuardedGradeStore(initialGrades, validStudentIds) {
  const rows = new Map(initialGrades.map(g => [g.id, structuredClone(g)]));

  const put = (record) => {
    if (record.type === 'Monthly') {
      const scoreKeys = Object.keys(record.scores || {});
      for (const key of scoreKeys) {
        if (!validStudentIds.has(key)) {
          throw new Error(`INVALID_GRADE_STUDENT_KEY: ${key}`);
        }
      }
      for (const existing of rows.values()) {
        if (
          existing.id !== record.id
          && existing.type === 'Monthly'
          && existing.academicYear === record.academicYear
          && existing.month === record.month
        ) {
          if (existing.classId === record.classId) {
            throw new Error(`DUPLICATE_MONTHLY_GRADE_RECORD: ${record.classId}`);
          }
          for (const key of scoreKeys) {
            if (Object.prototype.hasOwnProperty.call(existing.scores || {}, key)) {
              throw new Error(`DUPLICATE_MONTHLY_STUDENT_SCORE: ${key}`);
            }
          }
        }
      }
    }
    rows.set(record.id, structuredClone(record));
  };

  const remove = (id) => {
    rows.delete(id);
  };

  const executePlan = (plan) => {
    for (const r of plan.otherClassCleanups) put(r);
    for (const id of plan.duplicateIdsToDelete) remove(id);
    for (const r of plan.preCleanOps) put(r);
    for (const r of plan.recordsToSave) put(r);
  };

  return { rows, executePlan };
}

const classes = [
  { id: 'cA', shift: 'Morning' },
  { id: 'cB', shift: 'Morning' },
  { id: 'cC', shift: 'Afternoon' },
];

const score = (practice, book, exam) => ({
  practice,
  book,
  exam,
  adjustment: null,
  adjustmentNote: '',
});

const emptyRow = (id, gradeClassId) => ({
  id,
  gradeClassId,
  practice: null,
  book: null,
  exam: null,
  adjustment: null,
  adjustmentNote: '',
});

test('saving new class on past month with blank inputs does NOT wipe out transferred student scores in old class', () => {
  const validIds = new Set(['s1', 's2']);
  const initialGrades = [
    { id: 'gA', classId: 'cA', shift: 'Morning', academicYear: '2026-2027', month: 'តុលា', type: 'Monthly', scores: { s1: score(10, 10, 28) } },
  ];
  const store = createGuardedGradeStore(initialGrades, validIds);

  const plan = buildGradebookSavePlan({
    editableStudents: [
      emptyRow('s1', 'cB'), // s1 transferred to cB, has blank inputs for October
      { id: 's2', gradeClassId: 'cB', practice: 8, book: 9, exam: 25, adjustment: null, adjustmentNote: '' },
    ],
    allYearGrades: [...store.rows.values()],
    allYearStudents: [{ id: 's1' }, { id: 's2' }],
    classes,
    academicYear: '2026-2027',
    month: 'តុលា',
    gradeType: 'Monthly',
    createId: () => 'gB',
  });

  store.executePlan(plan);

  // s1's October score in cA must stay intact!
  assert.deepEqual(store.rows.get('gA').scores.s1, score(10, 10, 28));
  // cB must only contain s2, not a null placeholder for s1
  assert.deepEqual(Object.keys(store.rows.get('gB').scores), ['s2']);
});

test('linked classes swapping students in the same save pass DB trigger without DUPLICATE_MONTHLY_STUDENT_SCORE', () => {
  const validIds = new Set(['s1', 's2']);
  const initialGrades = [
    { id: 'gA', classId: 'cA', shift: 'Morning', academicYear: '2026-2027', month: 'វិច្ឆិកា', type: 'Monthly', scores: { s1: score(9, 8, 24) } },
    { id: 'gB', classId: 'cB', shift: 'Morning', academicYear: '2026-2027', month: 'វិច្ឆិកា', type: 'Monthly', scores: { s2: score(7, 8, 22) } },
  ];
  const store = createGuardedGradeStore(initialGrades, validIds);

  // s1 moved cA -> cB and s2 moved cB -> cA simultaneously
  const plan = buildGradebookSavePlan({
    editableStudents: [
      { id: 's2', gradeClassId: 'cA', practice: 8, book: 9, exam: 26, adjustment: null, adjustmentNote: '' },
      { id: 's1', gradeClassId: 'cB', practice: 10, book: 10, exam: 29, adjustment: null, adjustmentNote: '' },
    ],
    allYearGrades: [...store.rows.values()],
    allYearStudents: [{ id: 's1' }, { id: 's2' }],
    classes,
    academicYear: '2026-2027',
    month: 'វិច្ឆិកា',
    gradeType: 'Monthly',
  });

  store.executePlan(plan);

  assert.deepEqual(Object.keys(store.rows.get('gA').scores), ['s2']);
  assert.deepEqual(Object.keys(store.rows.get('gB').scores), ['s1']);
  assert.equal(store.rows.get('gB').scores.s1.exam, 29);
});

test('prunes deleted student UUIDs and legacy duplicates in otherClassRecords & primaryRecord before saving', () => {
  const validIds = new Set(['s1', 's2']);
  // Legacy broken state: s1 exists in BOTH gA and gC, plus gC and gA both have deleted/invalid UUIDs
  const initialGrades = [
    {
      id: 'gA',
      classId: 'cA',
      shift: 'Morning',
      academicYear: '2026-2027',
      month: 'ធ្នូ',
      type: 'Monthly',
      scores: {
        s1: score(8, 8, 20),
        'deleted-uuid-1': score(5, 5, 10),
      },
    },
    {
      id: 'gC',
      classId: 'cC',
      shift: 'Afternoon',
      academicYear: '2026-2027',
      month: 'ធ្នូ',
      type: 'Monthly',
      scores: {
        s1: score(9, 9, 25),
        s2: score(10, 10, 30),
        'deleted-uuid-2': score(4, 4, 12),
      },
    },
  ];
  const store = createGuardedGradeStore(initialGrades, validIds);

  // Saving cC with s1 (moved to cC) and s2
  const plan = buildGradebookSavePlan({
    editableStudents: [
      { id: 's1', gradeClassId: 'cC', practice: 9, book: 9, exam: 27, adjustment: null, adjustmentNote: '' },
      { id: 's2', gradeClassId: 'cC', practice: 10, book: 10, exam: 30, adjustment: null, adjustmentNote: '' },
    ],
    allYearGrades: [...store.rows.values()],
    allYearStudents: [{ id: 's1' }, { id: 's2' }],
    classes,
    academicYear: '2026-2027',
    month: 'ធ្នូ',
    gradeType: 'Monthly',
  });

  store.executePlan(plan);

  assert.deepEqual(store.rows.get('gA').scores, {});
  assert.deepEqual(Object.keys(store.rows.get('gC').scores).sort(), ['s1', 's2']);
  assert.equal(store.rows.get('gC').scores.s1.exam, 27);
});

test('selectGradebookScopeStudents keeps transferred student visible in old class past month as historical', () => {
  const allYearStudents = [
    { id: 's1', studentId: '001', name: 'A', gender: 'M', class: 'cB', shift: 'Morning', academicYear: '2026-2027', status: 'Active' },
    { id: 's2', studentId: '002', name: 'B', gender: 'F', class: 'cA', shift: 'Morning', academicYear: '2026-2027', status: 'Active' },
  ];
  const allYearGrades = [
    { id: 'gA', classId: 'cA', shift: 'Morning', academicYear: '2026-2027', month: 'តុលា', type: 'Monthly', scores: { s1: score(10, 9, 28), s2: score(8, 8, 25) } },
  ];

  const scope = selectGradebookScopeStudents({
    allYearStudents,
    allYearGrades,
    classesToFetch: ['cA'],
    month: 'តុលា',
    gradeType: 'Monthly',
  });

  assert.deepEqual(scope.activeStudents.map(s => s.id), ['s2']);
  assert.equal(scope.historicalRowsMeta.length, 1);
  assert.equal(scope.historicalRowsMeta[0].student.id, 's1');
  assert.equal(scope.historicalRowsMeta[0].reason, 'transferred');
  assert.equal(scope.scoresLookup.s1.exam, 28);
});
