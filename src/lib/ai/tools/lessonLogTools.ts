import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const lessonLogToolDeclarations = [
  {
    name: 'getLessonLogs',
    description: 'Get lesson logs or teaching history',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'Optional. Filter by class ID' },
        date: { type: Type.STRING, description: 'Optional. Filter by date' }
      }
    }
  },
  {
    name: 'proposeAddLessonLog',
    description: 'Propose to add a new lesson log/teaching history. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID' },
        date: { type: Type.STRING, description: 'The date (YYYY-MM-DD)' },
        topic: { type: Type.STRING, description: 'The lesson topic taught' },
        exercises: { type: Type.STRING, description: 'Exercises given (Optional)' },
        notes: { type: Type.STRING, description: 'Additional notes (Optional)' }
      },
      required: ['classId', 'date', 'topic']
    }
  }
];

export const executeLessonLogTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getLessonLogs') {
    const records = await db.getAll('lessonLogs', academicYear);
    const filtered = records.filter(r => 
      (!args.classId || r.classId === args.classId) && 
      (!args.date || r.date === args.date)
    );
    
    return {
      resultType: 'lesson_log_summary',
      count: filtered.length,
      classId: args.classId || null,
      date: args.date || null,
      details: filtered.map(r => ({
        ref: `log_${r.id}`,
        classId: r.classId,
        date: r.date,
        topic: r.topic,
        exercises: r.exercises
      })),
      responseGuidance: 'Summarize the teaching history conversationally. Do not list all details unless requested.'
    };
  }
  
  if (name === 'proposeAddLessonLog') {
    return {
      action: 'ADD_LESSON_LOG',
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  return null;
};
