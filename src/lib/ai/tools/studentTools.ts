import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const studentToolDeclarations = [
  {
    name: 'getStudents',
    description: 'Get a list of students, optionally filtered by classId',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'Optional. The ID of the class to filter by.' }
      },
    },
  },
  {
    name: 'proposeAddStudent',
    description: 'Propose to add a new student to a class. The user will review and approve this action.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        studentId: { type: Type.STRING, description: 'The student ID (e.g., STU-8A1-001)' },
        name: { type: Type.STRING, description: 'The student name in Khmer' },
        gender: { type: Type.STRING, description: 'Gender: M or F' },
        classId: { type: Type.STRING, description: 'The ID of the class (must exist)' },
        shift: { type: Type.STRING, description: 'The shift of the student (Morning, Afternoon, Evening)' }
      },
      required: ['studentId', 'name', 'gender', 'classId']
    }
  },
  {
    name: 'proposeUpdateStudent',
    description: 'Propose to update an existing student. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        studentId: { type: Type.STRING, description: 'The student ID to update' },
        name: { type: Type.STRING, description: 'New name' },
        gender: { type: Type.STRING, description: 'New gender (M or F)' },
        classId: { type: Type.STRING, description: 'New class ID' },
        shift: { type: Type.STRING, description: 'New shift (Morning, Afternoon, Evening)' },
        status: { type: Type.STRING, description: 'New status (e.g., Active, Dropped)' },
        isShiftSwitching: { type: Type.BOOLEAN, description: 'Whether the student is temporarily switching to a different shift/class' },
        alternateClassId: { type: Type.STRING, description: 'The class ID they are temporarily switching to (if isShiftSwitching is true)' }
      },
      required: ['studentId']
    }
  },
  {
    name: 'proposeDeleteStudent',
    description: 'Propose to delete a student. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        studentId: { type: Type.STRING, description: 'The student ID to delete' }
      },
      required: ['studentId']
    }
  }
];

export const executeStudentTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getStudents') {
    const allStudents = await db.getAll('students', academicYear);
    const filtered = args.classId ? allStudents.filter(s => s.class === args.classId) : allStudents;
    
    return {
      resultType: 'student_summary',
      count: filtered.length,
      classId: args.classId || null,
      names: filtered.map(s => s.name),
      details: filtered.map(s => ({
        name: s.name,
        studentId: s.studentId,
        gender: s.gender,
        pcNumber: s.pcNumber || null
      })),
      responseGuidance: 'Normally state the count and names conversationally. Only mention IDs, gender, PC assignments, or individual details if the user asked for them.'
    };
  }
  
  const proposeActions = ['proposeAddStudent', 'proposeUpdateStudent', 'proposeDeleteStudent'];
  if (proposeActions.includes(name)) {
    const actionMap: Record<string, string> = {
      'proposeAddStudent': 'ADD_STUDENT',
      'proposeUpdateStudent': 'UPDATE_STUDENT',
      'proposeDeleteStudent': 'DELETE_STUDENT'
    };
    return {
      action: actionMap[name],
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  return null;
};
