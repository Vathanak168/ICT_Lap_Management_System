import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const attendanceToolDeclarations = [
  {
    name: 'getAttendance',
    description: 'Get attendance records',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'Optional. Filter by class ID or name' },
        date: { type: Type.STRING, description: 'Optional. Filter by date (YYYY-MM-DD)' }
      }
    }
  },
  {
    name: 'proposeUpdateAttendance',
    description: 'Propose to update a student\'s attendance. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID' },
        studentId: { type: Type.STRING, description: 'The student ID' },
        date: { type: Type.STRING, description: 'The date (YYYY-MM-DD)' },
        status: { type: Type.STRING, description: 'Attendance status: "P" (Present / វត្តមាន), "A" (Absent / អវត្តមាន), "E" (Excused / Leave / សុំច្បាប់), "L" (Late / មកយឺត)' },
        noBook: { type: Type.BOOLEAN, description: 'Optional. True if the student forgot/has no book, False if they have book' }
      },
      required: ['classId', 'studentId', 'date', 'status']
    }
  },
  {
    name: 'proposeUpdateBookTracking',
    description: 'Propose to mark whether a student has or forgot their book. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID or name' },
        studentId: { type: Type.STRING, description: 'The student ID or name' },
        date: { type: Type.STRING, description: 'The date (YYYY-MM-DD)' },
        noBook: { type: Type.BOOLEAN, description: 'True if student forgot/has no book, False if they have book' }
      },
      required: ['classId', 'studentId', 'date', 'noBook']
    }
  }
];

export const executeAttendanceTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getAttendance') {
    let records: any[] = [];
    if (args.classId) {
      const classes = await db.getAll('classes', academicYear);
      const cls = classes.find(c => c.id === args.classId || c.name === args.classId);
      const targetClassId = cls ? cls.id : args.classId;
      records = await db.getAllFromIndex('attendance', 'class_id', targetClassId, academicYear).catch(() => []);
      if (records.length === 0) {
        records = await db.getAll('attendance', academicYear);
      }
    } else {
      records = await db.getAll('attendance', academicYear);
    }

    const filtered = records.filter(r => 
      (!args.classId || r.classId === args.classId || r.class === args.classId) && 
      (!args.date || r.date === args.date)
    );
    return {
      resultType: 'attendance_summary',
      count: filtered.length,
      classId: args.classId || null,
      date: args.date || null,
      details: filtered.map(r => ({
        ref: `attendance_${r.id}`,
        classId: r.classId,
        date: r.date,
        records: r.records
      })),
      responseGuidance: 'Summarize attendance records. If there are many, provide counts (e.g., 5 absent, 2 late).'
    };
  }
  
  if (name === 'proposeUpdateAttendance') {
    return {
      action: 'UPDATE_ATTENDANCE',
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }

  if (name === 'proposeUpdateBookTracking') {
    return {
      action: 'UPDATE_BOOK_TRACKING',
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  return null;
};
