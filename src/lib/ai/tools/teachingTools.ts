import { Type } from '@google/genai';
import { initDB } from '../../../store/db';
import type { ClassRecord, CurriculumLessonRecord, SubjectRecord } from '../../../store/db';

const shiftDescription = 'Morning, Afternoon, or Evening';

export const teachingToolDeclarations = [
  {
    name: 'getCurriculum',
    description: 'Read subjects, curriculum lessons, and class-subject assignments. Use before answering or changing curriculum data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING, description: 'Optional subject ID or name, such as Microsoft Word, Word, Excel, or Typing' },
        className: { type: Type.STRING, description: 'Optional class ID or name, such as 5A1' },
      },
    },
  },
  {
    name: 'getTeachingStatus',
    description: 'Read practical teaching status by class and subject, including completed count, next lesson, partial progress, and latest record.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        className: { type: Type.STRING, description: 'Optional class ID or name' },
        subject: { type: Type.STRING, description: 'Optional subject ID or name' },
        shift: { type: Type.STRING, description: `Optional shift: ${shiftDescription}` },
      },
    },
  },
  {
    name: 'getTeachingSchedule',
    description: 'Read the teaching timetable. Use for questions about today, a day, a shift, a class, or a subject.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dayOfWeek: { type: Type.NUMBER, description: 'Optional day number: Sunday=0, Monday=1, ... Saturday=6' },
        shift: { type: Type.STRING, description: `Optional shift: ${shiftDescription}` },
        className: { type: Type.STRING, description: 'Optional class ID or name' },
        subject: { type: Type.STRING, description: 'Optional subject ID or name' },
      },
    },
  },
  {
    name: 'proposeAddSubject',
    description: 'Prepare a new curriculum subject for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Subject name' },
        color: { type: Type.STRING, description: 'Optional hex color, such as #3B82F6' },
      },
      required: ['name'],
    },
  },
  {
    name: 'proposeUpdateSubject',
    description: 'Prepare changes to an existing subject for approval. Read curriculum first when the subject reference is unclear.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING, description: 'Existing subject ID or name' },
        name: { type: Type.STRING, description: 'Optional new subject name' },
        color: { type: Type.STRING, description: 'Optional new hex color' },
      },
      required: ['subject'],
    },
  },
  {
    name: 'proposeAddCurriculumLesson',
    description: 'Prepare a new ordered lesson inside a subject for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING, description: 'Subject ID or name' },
        title: { type: Type.STRING, description: 'Lesson title' },
        module: { type: Type.STRING, description: 'Optional lesson group or module' },
        objectives: { type: Type.STRING, description: 'Optional learning objectives' },
        exercise: { type: Type.STRING, description: 'Optional exercise' },
        estimatedPeriods: { type: Type.NUMBER, description: 'Optional period count, defaults to 1' },
        orderNo: { type: Type.NUMBER, description: 'Optional lesson order. Defaults to the next available number.' },
      },
      required: ['subject', 'title'],
    },
  },
  {
    name: 'proposeUpdateCurriculumLesson',
    description: 'Prepare changes to an existing curriculum lesson for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        lesson: { type: Type.STRING, description: 'Lesson ID or exact title' },
        subject: { type: Type.STRING, description: 'Optional subject ID or name used to disambiguate the lesson' },
        title: { type: Type.STRING, description: 'Optional new lesson title' },
        module: { type: Type.STRING, description: 'Optional new module' },
        objectives: { type: Type.STRING, description: 'Optional new objectives' },
        exercise: { type: Type.STRING, description: 'Optional new exercise' },
        estimatedPeriods: { type: Type.NUMBER, description: 'Optional new period count' },
        orderNo: { type: Type.NUMBER, description: 'Optional new order number' },
      },
      required: ['lesson'],
    },
  },
  {
    name: 'proposeDeleteCurriculumLesson',
    description: 'Prepare deletion of a curriculum lesson for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        lesson: { type: Type.STRING, description: 'Lesson ID or exact title' },
        subject: { type: Type.STRING, description: 'Optional subject ID or name used to disambiguate the lesson' },
      },
      required: ['lesson'],
    },
  },
  {
    name: 'proposeAssignSubjectToClass',
    description: 'Prepare assignment of one subject to one class for approval. Call once per class-subject pair; multiple calls can be approved together.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        className: { type: Type.STRING, description: 'Class ID or name' },
        subject: { type: Type.STRING, description: 'Subject ID or name' },
      },
      required: ['className', 'subject'],
    },
  },
  {
    name: 'proposeUnassignSubjectFromClass',
    description: 'Prepare removal of one subject assignment from one class for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        className: { type: Type.STRING, description: 'Class ID or name' },
        subject: { type: Type.STRING, description: 'Subject ID or name' },
      },
      required: ['className', 'subject'],
    },
  },
  {
    name: 'proposeRecordTeaching',
    description: 'Prepare a Teaching Today record for approval. If no lesson is given, the system uses the next unfinished lesson for that class and subject.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        className: { type: Type.STRING, description: 'Class ID or name' },
        subject: { type: Type.STRING, description: 'Subject ID or name' },
        lesson: { type: Type.STRING, description: 'Optional lesson ID or exact title' },
        status: { type: Type.STRING, description: 'completed, partial, or skipped' },
        progressPercent: { type: Type.NUMBER, description: 'Required for partial; usually 25, 50, or 75' },
        note: { type: Type.STRING, description: 'Optional teaching note' },
      },
      required: ['className', 'subject', 'status'],
    },
  },
  {
    name: 'proposeSetTeachingSchedule',
    description: 'Prepare creation or replacement of one timetable slot for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scheduleId: { type: Type.STRING, description: 'Optional existing schedule ID to update' },
        className: { type: Type.STRING, description: 'Class ID or name' },
        subject: { type: Type.STRING, description: 'Subject ID or name' },
        shift: { type: Type.STRING, description: shiftDescription },
        dayOfWeek: { type: Type.NUMBER, description: 'Sunday=0, Monday=1, ... Saturday=6' },
        startTime: { type: Type.STRING, description: 'Start time in HH:mm format' },
        endTime: { type: Type.STRING, description: 'End time in HH:mm format' },
      },
      required: ['className', 'subject', 'shift', 'dayOfWeek', 'startTime', 'endTime'],
    },
  },
  {
    name: 'proposeDeleteTeachingSchedule',
    description: 'Prepare deletion of one timetable slot for approval. Read the schedule first to obtain the exact schedule reference.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scheduleId: { type: Type.STRING, description: 'Exact schedule ID' },
      },
      required: ['scheduleId'],
    },
  },
];

const normalize = (value: string) => value
  .trim()
  .toLocaleLowerCase()
  .replace(/^ថ្នាក់ទី\s*/u, '')
  .replace(/^microsoft\s+/i, '')
  .replace(/\s+/g, ' ');

const matchesReference = (id: string, name: string, reference?: string) => {
  if (!reference) return true;
  const query = normalize(reference);
  return id === reference || normalize(name) === query;
};

const findClass = (classes: ClassRecord[], reference?: string) => {
  if (!reference) return null;
  return classes.find(item => matchesReference(item.id, item.name, reference)) || null;
};

const findSubject = (subjects: SubjectRecord[], reference?: string) => {
  if (!reference) return null;
  return subjects.find(item => matchesReference(item.id, item.name, reference)) || null;
};

const findLesson = (
  lessons: CurriculumLessonRecord[],
  reference?: string,
  subjectId?: string,
) => {
  if (!reference) return null;
  const query = normalize(reference);
  return lessons.find(item => (
    (!subjectId || item.subjectId === subjectId)
    && (item.id === reference || normalize(item.title) === query)
  )) || null;
};

const proposalMap: Record<string, string> = {
  proposeAddSubject: 'ADD_SUBJECT',
  proposeUpdateSubject: 'UPDATE_SUBJECT',
  proposeAddCurriculumLesson: 'ADD_CURRICULUM_LESSON',
  proposeUpdateCurriculumLesson: 'UPDATE_CURRICULUM_LESSON',
  proposeDeleteCurriculumLesson: 'DELETE_CURRICULUM_LESSON',
  proposeAssignSubjectToClass: 'ASSIGN_SUBJECT_TO_CLASS',
  proposeUnassignSubjectFromClass: 'UNASSIGN_SUBJECT_FROM_CLASS',
  proposeRecordTeaching: 'RECORD_TEACHING',
  proposeSetTeachingSchedule: 'SET_TEACHING_SCHEDULE',
  proposeDeleteTeachingSchedule: 'DELETE_TEACHING_SCHEDULE',
};

export const executeTeachingTool = async (
  name: string,
  args: any,
  academicYear?: string,
  context?: { userId?: string },
) => {
  if (!name.startsWith('get') && !proposalMap[name]) return null;
  const db = await initDB();
  const [classes, subjects, lessons, assignments, logs, schedules] = await Promise.all([
    db.getAll('classes', academicYear),
    db.getAll('subjects', academicYear),
    db.getAll('curriculumLessons', academicYear),
    db.getAll('classCurriculums', academicYear),
    db.getAll('teachingLogs', academicYear),
    db.getAll('teachingSchedules', academicYear),
  ]);

  const requestedClass = findClass(classes, args.className);
  const requestedSubject = findSubject(subjects, args.subject);

  if (name === 'getCurriculum') {
    const filteredSubjects = subjects.filter(subject => !args.subject || subject.id === requestedSubject?.id);
    const filteredClasses = classes.filter(classItem => !args.className || classItem.id === requestedClass?.id);
    return {
      resultType: 'curriculum_workspace',
      subjects: filteredSubjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        color: subject.color,
        lessons: lessons.filter(lesson => lesson.subjectId === subject.id).map(lesson => ({
          id: lesson.id,
          orderNo: lesson.orderNo,
          module: lesson.module,
          title: lesson.title,
          objectives: lesson.objectives,
          exercise: lesson.exercise,
          estimatedPeriods: lesson.estimatedPeriods,
        })),
      })),
      assignments: assignments
        .filter(assignment => filteredSubjects.some(subject => subject.id === assignment.subjectId))
        .filter(assignment => filteredClasses.some(classItem => classItem.id === assignment.classId))
        .map(assignment => ({
          classId: assignment.classId,
          className: classes.find(item => item.id === assignment.classId)?.name || '?',
          subjectId: assignment.subjectId,
          subjectName: subjects.find(item => item.id === assignment.subjectId)?.name || '?',
        })),
      responseGuidance: 'Answer with subject, lesson, and class names. Keep IDs private unless a later proposal tool needs them.',
    };
  }

  if (name === 'getTeachingStatus') {
    const rows = assignments.flatMap(assignment => {
      const classItem = classes.find(item => item.id === assignment.classId);
      const subject = subjects.find(item => item.id === assignment.subjectId);
      if (!classItem || !subject) return [];
      if (args.className && classItem.id !== requestedClass?.id) return [];
      if (args.subject && subject.id !== requestedSubject?.id) return [];
      if (args.shift && classItem.shift !== args.shift) return [];
      const subjectLessons = lessons.filter(lesson => lesson.subjectId === subject.id).sort((a, b) => a.orderNo - b.orderNo);
      const lessonIds = new Set(subjectLessons.map(lesson => lesson.id));
      const classLogs = logs.filter(log => log.classId === classItem.id && lessonIds.has(log.lessonId));
      const completedIds = new Set(classLogs.filter(log => log.status === 'completed').map(log => log.lessonId));
      const nextLesson = subjectLessons.find(lesson => !completedIds.has(lesson.id)) || null;
      const latestLog = [...classLogs].sort((a, b) => Date.parse(b.taughtAt) - Date.parse(a.taughtAt))[0] || null;
      return [{
        classId: classItem.id,
        className: classItem.name,
        shift: classItem.shift,
        subjectId: subject.id,
        subjectName: subject.name,
        completedLessons: completedIds.size,
        totalLessons: subjectLessons.length,
        nextLesson: nextLesson ? { id: nextLesson.id, orderNo: nextLesson.orderNo, title: nextLesson.title } : null,
        latestRecord: latestLog ? {
          status: latestLog.status,
          progressPercent: latestLog.progressPercent,
          taughtAt: latestLog.taughtAt,
          note: latestLog.note,
        } : null,
      }];
    });
    return { resultType: 'teaching_status', count: rows.length, details: rows };
  }

  if (name === 'getTeachingSchedule') {
    const details = schedules
      .filter(item => !context?.userId || item.teacherId === context.userId)
      .filter(item => args.dayOfWeek === undefined || item.dayOfWeek === args.dayOfWeek)
      .filter(item => !args.shift || item.shift === args.shift)
      .filter(item => !args.className || item.classId === requestedClass?.id)
      .filter(item => !args.subject || item.subjectId === requestedSubject?.id)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
      .map(item => ({
        id: item.id,
        dayOfWeek: item.dayOfWeek,
        shift: item.shift,
        startTime: item.startTime,
        endTime: item.endTime,
        classId: item.classId,
        className: classes.find(classItem => classItem.id === item.classId)?.name || '?',
        subjectId: item.subjectId,
        subjectName: subjects.find(subject => subject.id === item.subjectId)?.name || '?',
      }));
    return { resultType: 'teaching_schedule', count: details.length, details };
  }

  const action = proposalMap[name];
  if (!action) return null;

  const preview: Record<string, unknown> = {};
  if (args.className) preview.className = requestedClass?.name || args.className;
  if (args.subject) preview.subjectName = requestedSubject?.name || args.subject;
  if (args.lesson) {
    preview.lessonTitle = findLesson(lessons, args.lesson, requestedSubject?.id)?.title || args.lesson;
  }
  if (args.title) preview.lessonTitle = args.title;

  return {
    action,
    data: args,
    preview,
    status: 'PENDING_APPROVAL',
  };
};
