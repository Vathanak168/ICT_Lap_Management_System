import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const attendanceToolDeclarations = [
  {
    name: 'getAttendance',
    description: 'Get attendance records',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'Optional. Filter by class ID' },
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
        status: { type: Type.STRING, description: 'Attendance status: "P" (Present), "A" (Absent), "L" (Leave), "P_LATE" (Late)' }
      },
      required: ['classId', 'studentId', 'date', 'status']
    }
  }
];

export const executeAttendanceTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getAttendance') {
    const records = await db.getAll('attendance', academicYear);
    const filtered = records.filter(r => 
      (!args.classId || r.classId === args.classId) && 
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
  
  return null;
};
