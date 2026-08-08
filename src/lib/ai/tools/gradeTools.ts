import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const gradeToolDeclarations = [
  {
    name: 'getGrades',
    description: 'Get student grades/scores',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'Optional. Filter by class ID' },
        month: { type: Type.STRING, description: 'Optional. Filter by month (e.g. October)' }
      }
    }
  },
  {
    name: 'proposeUpdateGrades',
    description: 'Propose to update a student\'s grades. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID' },
        studentId: { type: Type.STRING, description: 'The student ID' },
        month: { type: Type.STRING, description: 'The month (e.g., October)' },
        practice: { type: Type.NUMBER, description: 'Practice score (Optional)' },
        book: { type: Type.NUMBER, description: 'Book score (Optional)' },
        exam: { type: Type.NUMBER, description: 'Exam score (Optional)' },
        adjustment: { type: Type.NUMBER, description: 'Adjustment score (Optional)' },
        adjustmentNote: { type: Type.STRING, description: 'Reason for adjustment (Optional)' }
      },
      required: ['classId', 'studentId', 'month']
    }
  }
];

export const executeGradeTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getGrades') {
    const records = await db.getAll('grades', academicYear);
    return records.filter(r => 
      (!args.classId || r.classId === args.classId) && 
      (!args.month || r.month === args.month)
    );
  }
  
  if (name === 'proposeUpdateGrades') {
    return {
      action: 'UPDATE_GRADES',
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  return null;
};
