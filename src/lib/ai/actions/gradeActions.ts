import { initDB } from '../../../store/db';
import type { GradeRecord } from '../../../store/db';

const MONTH_ALIASES: Record<string, string> = {
  october: 'តុលា', november: 'វិច្ឆិកា', december: 'ធ្នូ', january: 'មករា',
  february: 'កុម្ភៈ', march: 'មីនា', april: 'មេសា', may: 'ឧសភា', june: 'មិថុនា', july: 'កក្កដា',
  'semester 1': 'ឆមាសទី១', 'semester 2': 'ឆមាសទី២',
};

const normalizeMonth = (value: unknown) => {
  const month = String(value ?? '').trim();
  return MONTH_ALIASES[month.toLowerCase()] || month;
};

const validateScore = (label: string, value: unknown, maximum: number) => {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} ត្រូវស្ថិតនៅចន្លោះ 0 និង ${maximum}`);
  }
};

export const handleGradeAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'UPDATE_GRADES') {
    if (!data.classId || !data.studentId || !data.month) {
      throw new Error('ទិន្នន័យមិនពេញលេញ');
    }
    
    const month = normalizeMonth(data.month);
    const [classes, students, gradeConfigSetting, allGradeRecords] = await Promise.all([
      db.getAll('classes', activeYear),
      db.getAllFromIndex('students', 'studentId', String(data.studentId), activeYear),
      db.get('settings', 'gradeConfig'),
      db.getAll('grades', activeYear),
    ]);
    const requestedClass = classes.find(c => c.id === data.classId || c.name === data.classId);
    if (!requestedClass) throw new Error('រកមិនឃើញថ្នាក់នេះទេ');
    if (students.length !== 1) throw new Error('រកមិនឃើញសិស្សតែមួយគត់តាមអត្តលេខនេះទេ។');
    const student = students[0];

    const config = (gradeConfigSetting?.config || { practice: 10, book: 10, exam: 30 }) as {
      practice: number; book: number; exam: number;
    };
    validateScore('ពិន្ទុលំហាត់', data.practice, Number(config.practice || 0));
    validateScore('ពិន្ទុសៀវភៅ', data.book, Number(config.book || 0));
    validateScore('ពិន្ទុប្រឡង', data.exam, Number(config.exam || 0));

    const existingOwners = allGradeRecords.filter(record =>
      record.month === month
      && record.type === 'Monthly'
      && Object.prototype.hasOwnProperty.call(record.scores || {}, student.id)
    );
    if (existingOwners.length > 1) {
      throw new Error('សិស្សនេះមានពិន្ទុស្ទួនក្នុងខែនេះ។ សូមដោះស្រាយ Grade Conflict មុនកែតាម AI។');
    }
    if (existingOwners.length === 0 && student.class !== requestedClass.id) {
      throw new Error('សិស្សមិនស្ថិតក្នុងថ្នាក់ដែលបានជ្រើសទេ។ សម្រាប់សិស្សប្តូរវេន សូមប្រើថ្នាក់បច្ចុប្បន្ន។');
    }

    const ownerClassId = existingOwners[0]?.classId || requestedClass.id;
    const ownerClass = classes.find(c => c.id === ownerClassId) || requestedClass;
    const classMonthRecords = allGradeRecords.filter(record =>
      record.classId === ownerClassId && record.month === month && record.type === 'Monthly'
    );
    if (classMonthRecords.length > 1) {
      throw new Error('ថ្នាក់នេះមាន Monthly Grade Record ស្ទួន។ សូមដោះស្រាយ Grade Conflict មុនកែតាម AI។');
    }
    const record: GradeRecord = existingOwners[0] || classMonthRecords[0] || {
      id: crypto.randomUUID(),
      classId: ownerClassId,
      shift: ownerClass.shift,
      academicYear: activeYear,
      month,
      type: 'Monthly',
      scores: {},
    };

    const existingScoresForStudent = record.scores[student.id] || {};
    const practice = data.practice !== undefined ? data.practice : existingScoresForStudent.practice ?? null;
    const book = data.book !== undefined ? data.book : existingScoresForStudent.book ?? null;
    const exam = data.exam !== undefined ? data.exam : existingScoresForStudent.exam ?? null;
    const previousAdjustment = existingScoresForStudent.adjustment ?? 0;
    const availableBank = (student.pointsBalance ?? 0) + previousAdjustment;
    const hasAnyScore = practice !== null || book !== null || exam !== null;
    const rawBase = (practice ?? 0) + (book ?? 0) + (exam ?? 0);

    let adjustment = 0;
    if (hasAnyScore) {
      const lostPractice = practice === null ? 0 : Math.max(0, Number(config.practice || 0) - practice);
      const lostBook = book === null ? 0 : Math.max(0, Number(config.book || 0) - book);
      const lostExam = exam === null ? 0 : Math.max(0, Number(config.exam || 0) - exam);
      const needed = lostPractice + lostBook + lostExam;
      if (needed > 0 && availableBank > 0) adjustment = Math.min(needed, availableBank);
      else if (availableBank < 0) adjustment = Math.max(-rawBase, availableBank);
    }

    const newBalance = availableBank - adjustment;
    const adjustmentNote = adjustment === 0
      ? ''
      : student.pointsNote ? `ទាញពីស្តុក៖ ${student.pointsNote}` : 'ទាញពីស្តុក';
    record.scores[student.id] = {
      ...existingScoresForStudent,
      practice,
      book,
      exam,
      adjustment: adjustment === 0 ? null : adjustment,
      adjustmentNote,
    };
    
    await db.put('grades', record);
    if (newBalance !== (student.pointsBalance ?? 0)) {
      await db.update('students', student.id, { pointsBalance: newBalance });
    }
    
    return true;
  }
  
  return false;
};
