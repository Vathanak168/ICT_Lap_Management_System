import { initDB } from '../../../store/db';
import type {
  ClassRecord,
  CurriculumLessonRecord,
  SubjectRecord,
  TeachingLogStatus,
} from '../../../store/db';

export interface TeachingActionContext {
  userId?: string | null;
}

const normalize = (value: string) => value
  .trim()
  .toLocaleLowerCase()
  .replace(/^ថ្នាក់ទី\s*/u, '')
  .replace(/^microsoft\s+/i, '')
  .replace(/\s+/g, ' ');

const resolveByReference = <T extends { id: string }>(
  records: T[],
  reference: string,
  getName: (record: T) => string,
  entityLabel: string,
) => {
  const query = normalize(reference);
  const exactMatches = records.filter(record => record.id === reference || normalize(getName(record)) === query);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) throw new Error(`${entityLabel}មានឈ្មោះដូចគ្នាច្រើន។ សូមបញ្ជាក់ឲ្យច្បាស់ជាងនេះ។`);
  throw new Error(`រកមិនឃើញ${entityLabel} «${reference}» ទេ។`);
};

const resolveClass = (classes: ClassRecord[], reference: string) =>
  resolveByReference(classes, reference, item => item.name, 'ថ្នាក់');

const resolveSubject = (subjects: SubjectRecord[], reference: string) =>
  resolveByReference(subjects, reference, item => item.name, 'មុខវិជ្ជា');

const resolveLesson = (
  lessons: CurriculumLessonRecord[],
  reference: string,
  subjectId?: string,
) => resolveByReference(
  lessons.filter(lesson => !subjectId || lesson.subjectId === subjectId),
  reference,
  item => item.title,
  'មេរៀន',
);

const validateColor = (color: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('ពណ៌ត្រូវសរសេរជា Hex ដូចជា #3B82F6។');
  return color.toUpperCase();
};

const teachingActions = new Set([
  'ADD_SUBJECT',
  'UPDATE_SUBJECT',
  'ADD_CURRICULUM_LESSON',
  'UPDATE_CURRICULUM_LESSON',
  'DELETE_CURRICULUM_LESSON',
  'ASSIGN_SUBJECT_TO_CLASS',
  'UNASSIGN_SUBJECT_FROM_CLASS',
  'RECORD_TEACHING',
  'SET_TEACHING_SCHEDULE',
  'DELETE_TEACHING_SCHEDULE',
]);

export const handleTeachingAction = async (
  action: string,
  data: any,
  activeYear: string,
  context?: TeachingActionContext,
) => {
  if (!teachingActions.has(action)) return false;
  if (!activeYear) throw new Error('សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន។');

  const db = await initDB();
  const [classes, subjects, lessons] = await Promise.all([
    db.getAll('classes', activeYear),
    db.getAll('subjects', activeYear),
    db.getAll('curriculumLessons', activeYear),
  ]);

  if (action === 'ADD_SUBJECT') {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('សូមបញ្ជាក់ឈ្មោះមុខវិជ្ជា។');
    if (subjects.some(subject => normalize(subject.name) === normalize(name))) {
      throw new Error(`មុខវិជ្ជា «${name}» មានរួចហើយ។`);
    }
    await db.add('subjects', {
      id: crypto.randomUUID(),
      name,
      color: data.color ? validateColor(String(data.color)) : '#6366F1',
      icon: 'book',
      academicYear: activeYear,
    });
    return true;
  }

  if (action === 'UPDATE_SUBJECT') {
    const subject = resolveSubject(subjects, String(data.subject || ''));
    const updates: Partial<SubjectRecord> = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new Error('ឈ្មោះមុខវិជ្ជាមិនអាចទទេបានទេ។');
      updates.name = name;
    }
    if (data.color !== undefined) updates.color = validateColor(String(data.color));
    if (!Object.keys(updates).length) throw new Error('មិនមានការផ្លាស់ប្តូរដើម្បីរក្សាទុកទេ។');
    await db.update('subjects', subject.id, updates);
    return true;
  }

  if (action === 'ADD_CURRICULUM_LESSON') {
    const subject = resolveSubject(subjects, String(data.subject || ''));
    const title = String(data.title || '').trim();
    if (!title) throw new Error('សូមបញ្ជាក់ចំណងជើងមេរៀន។');
    const subjectLessons = lessons.filter(lesson => lesson.subjectId === subject.id);
    const orderNo = Number(data.orderNo) || Math.max(0, ...subjectLessons.map(lesson => lesson.orderNo)) + 1;
    await db.add('curriculumLessons', {
      id: crypto.randomUUID(),
      subjectId: subject.id,
      orderNo,
      module: String(data.module || ''),
      title,
      objectives: data.objectives ? String(data.objectives) : null,
      exercise: data.exercise ? String(data.exercise) : null,
      estimatedPeriods: Math.max(1, Number(data.estimatedPeriods) || 1),
      academicYear: activeYear,
    });
    return true;
  }

  if (action === 'UPDATE_CURRICULUM_LESSON') {
    const subject = data.subject ? resolveSubject(subjects, String(data.subject)) : null;
    const lesson = resolveLesson(lessons, String(data.lesson || ''), subject?.id);
    const updates: Partial<CurriculumLessonRecord> = {};
    if (data.title !== undefined) updates.title = String(data.title).trim();
    if (data.module !== undefined) updates.module = String(data.module);
    if (data.objectives !== undefined) updates.objectives = data.objectives ? String(data.objectives) : null;
    if (data.exercise !== undefined) updates.exercise = data.exercise ? String(data.exercise) : null;
    if (data.estimatedPeriods !== undefined) updates.estimatedPeriods = Math.max(1, Number(data.estimatedPeriods) || 1);
    if (data.orderNo !== undefined) updates.orderNo = Math.max(1, Number(data.orderNo) || 1);
    if (!Object.keys(updates).length) throw new Error('មិនមានការផ្លាស់ប្តូរដើម្បីរក្សាទុកទេ។');
    await db.update('curriculumLessons', lesson.id, updates);
    return true;
  }

  if (action === 'DELETE_CURRICULUM_LESSON') {
    const subject = data.subject ? resolveSubject(subjects, String(data.subject)) : null;
    const lesson = resolveLesson(lessons, String(data.lesson || ''), subject?.id);
    const teachingLogs = await db.getAll('teachingLogs', activeYear);
    for (const log of teachingLogs.filter(item => item.lessonId === lesson.id)) {
      await db.delete('teachingLogs', log.id);
    }
    await db.delete('curriculumLessons', lesson.id);
    return true;
  }

  if (action === 'ASSIGN_SUBJECT_TO_CLASS' || action === 'UNASSIGN_SUBJECT_FROM_CLASS') {
    const classItem = resolveClass(classes, String(data.className || ''));
    const subject = resolveSubject(subjects, String(data.subject || ''));
    const assignments = await db.getAll('classCurriculums', activeYear);
    const existing = assignments.find(item => item.classId === classItem.id && item.subjectId === subject.id);

    if (action === 'ASSIGN_SUBJECT_TO_CLASS') {
      if (!existing) {
        await db.add('classCurriculums', {
          id: crypto.randomUUID(),
          classId: classItem.id,
          subjectId: subject.id,
          startDate: new Date().toISOString().slice(0, 10),
          academicYear: activeYear,
        });
      }
      return true;
    }

    if (existing) await db.delete('classCurriculums', existing.id);
    const schedules = await db.getAll('teachingSchedules', activeYear);
    for (const schedule of schedules.filter(item => item.classId === classItem.id && item.subjectId === subject.id)) {
      await db.delete('teachingSchedules', schedule.id);
    }
    return true;
  }

  if (action === 'RECORD_TEACHING') {
    const classItem = resolveClass(classes, String(data.className || ''));
    const subject = resolveSubject(subjects, String(data.subject || ''));
    const subjectLessons = lessons.filter(lesson => lesson.subjectId === subject.id).sort((a, b) => a.orderNo - b.orderNo);
    const allLogs = await db.getAll('teachingLogs', activeYear);
    const completedIds = new Set(
      allLogs.filter(log => log.classId === classItem.id && log.status === 'completed').map(log => log.lessonId),
    );
    const lesson = data.lesson
      ? resolveLesson(subjectLessons, String(data.lesson), subject.id)
      : subjectLessons.find(item => !completedIds.has(item.id));
    if (!lesson) throw new Error('មិនមានមេរៀនបន្ទាប់សម្រាប់ថ្នាក់ និងមុខវិជ្ជានេះទេ។');

    const status = String(data.status || '') as TeachingLogStatus;
    if (!['completed', 'partial', 'skipped'].includes(status)) throw new Error('ស្ថានភាពបង្រៀនមិនត្រឹមត្រូវ។');
    const progressPercent = status === 'completed' ? 100 : status === 'partial' ? Number(data.progressPercent) : 0;
    if (status === 'partial' && (!Number.isFinite(progressPercent) || progressPercent <= 0 || progressPercent >= 100)) {
      throw new Error('ភាគរយបង្រៀនមិនទាន់ចប់ត្រូវនៅចន្លោះ 1 ដល់ 99។');
    }

    for (const log of allLogs.filter(item => item.classId === classItem.id && item.lessonId === lesson.id && item.status === 'partial')) {
      await db.delete('teachingLogs', log.id);
    }
    await db.add('teachingLogs', {
      id: crypto.randomUUID(),
      classId: classItem.id,
      lessonId: lesson.id,
      teacherId: context?.userId || null,
      status,
      progressPercent,
      taughtAt: new Date().toISOString(),
      note: data.note ? String(data.note) : null,
      academicYear: activeYear,
    });
    return true;
  }

  if (action === 'SET_TEACHING_SCHEDULE') {
    const classItem = resolveClass(classes, String(data.className || ''));
    const subject = resolveSubject(subjects, String(data.subject || ''));
    if (!['Morning', 'Afternoon', 'Evening'].includes(data.shift)) throw new Error('វេនមិនត្រឹមត្រូវ។');
    const dayOfWeek = Number(data.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new Error('ថ្ងៃក្នុងសប្តាហ៍មិនត្រឹមត្រូវ។');
    const startTime = String(data.startTime || '').slice(0, 5);
    const endTime = String(data.endTime || '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
      throw new Error('ម៉ោងចាប់ផ្តើម និងបញ្ចប់មិនត្រឹមត្រូវ។');
    }
    const schedules = await db.getAll('teachingSchedules', activeYear);
    const actorTeacherId = context?.userId || null;
    const existing = data.scheduleId
      ? schedules.find(item => item.id === data.scheduleId)
      : schedules.find(item => item.teacherId === actorTeacherId && item.dayOfWeek === dayOfWeek && item.shift === data.shift && item.startTime.slice(0, 5) === startTime);
    const teacherId = actorTeacherId || existing?.teacherId;
    if (!teacherId) throw new Error('មិនអាចកំណត់គ្រូបង្រៀនបានទេ។ សូមចូលគណនីឡើងវិញ។');
    const assignments = await db.getAll('classCurriculums', activeYear);
    if (!assignments.some(item => item.classId === classItem.id && item.subjectId === subject.id)) {
      throw new Error('មុខវិជ្ជានេះមិនទាន់បានភ្ជាប់ទៅថ្នាក់នៅឡើយទេ។ សូមអនុម័តការភ្ជាប់មុខវិជ្ជាទៅថ្នាក់ជាមុន។');
    }
    await db.put('teachingSchedules', {
      id: existing?.id || crypto.randomUUID(),
      teacherId,
      shift: data.shift,
      dayOfWeek,
      startTime,
      endTime,
      classId: classItem.id,
      subjectId: subject.id,
      academicYear: activeYear,
    });
    return true;
  }

  if (action === 'DELETE_TEACHING_SCHEDULE') {
    const scheduleId = String(data.scheduleId || '');
    if (!scheduleId) throw new Error('សូមបញ្ជាក់កាលវិភាគដែលត្រូវលុប។');
    const schedules = await db.getAll('teachingSchedules', activeYear);
    if (!schedules.some(item => item.id === scheduleId)) throw new Error('រកមិនឃើញកាលវិភាគនេះទេ។');
    await db.delete('teachingSchedules', scheduleId);
    return true;
  }

  return false;
};
