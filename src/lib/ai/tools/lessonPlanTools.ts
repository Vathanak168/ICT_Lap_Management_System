import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const lessonPlanToolDeclarations = [
  {
    name: 'getLessonPlans',
    description: 'Get existing lesson plans. Use this to check if a lesson plan exists for a specific class before proposing a new one.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'Optional. Filter by class ID or name (e.g., WEB-101, 10A1)' }
      }
    }
  },
  {
    name: 'proposeAddLessonPlan',
    description: 'Propose to add a new lesson plan. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID or name (e.g. 10A1)' },
        month: { type: Type.STRING, description: 'The month of the lesson plan (e.g. "តុលា", "November")' },
        week: { type: Type.STRING, description: 'The week of the month (e.g. "សប្តាហ៍ទី១", "Week 1")' },
        lessonTitle: { type: Type.STRING, description: 'The title of the lesson' },
        topics: { type: Type.STRING, description: 'The topics to cover' },
        exercises: { type: Type.STRING, description: 'The exercises or activities' },
        status: { type: Type.STRING, description: 'The status: "Planned" or "Completed"' }
      },
      required: ['classId', 'month', 'week', 'lessonTitle', 'topics', 'exercises']
    }
  },
  {
    name: 'proposeUpdateLessonPlan',
    description: 'Propose to update an existing lesson plan. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING, description: 'The ID of the lesson plan to update' },
        classId: { type: Type.STRING, description: 'The new class ID or name' },
        month: { type: Type.STRING, description: 'The new month' },
        week: { type: Type.STRING, description: 'The new week' },
        lessonTitle: { type: Type.STRING, description: 'The new lesson title' },
        topics: { type: Type.STRING, description: 'The new topics' },
        exercises: { type: Type.STRING, description: 'The new exercises' },
        status: { type: Type.STRING, description: 'The new status' }
      },
      required: ['planId']
    }
  },
  {
    name: 'proposeDeleteLessonPlan',
    description: 'Propose to delete a lesson plan. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING, description: 'The ID of the lesson plan to delete' }
      },
      required: ['planId']
    }
  }
];

export const executeLessonPlanTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();

  if (name === 'getLessonPlans') {
    const plans = await db.getAll('lessonPlans', academicYear);
    const filtered = args.classId 
      ? plans.filter((p: any) => p.classId === args.classId)
      : plans;
      
    return {
      resultType: 'lesson_plan_summary',
      count: filtered.length,
      classId: args.classId || null,
      details: filtered.map((p: any) => ({
        ref: `plan_${p.id}`,
        classId: p.classId,
        month: p.month,
        week: p.week,
        lessonTitle: p.lessonTitle,
        topics: p.topics,
        exercises: p.exercises,
        status: p.status
      })),
      responseGuidance: 'Summarize lesson plans naturally. Do not list all details unless requested.'
    };
  }
  
  if (name === 'proposeAddLessonPlan') {
    return {
      action: 'ADD_LESSON_PLAN',
      status: 'PENDING_APPROVAL',
      data: args,
      message: 'ត្រៀមបន្ថែមផែនការបង្រៀនថ្មី។'
    };
  }
  
  if (name === 'proposeUpdateLessonPlan') {
    return {
      action: 'UPDATE_LESSON_PLAN',
      status: 'PENDING_APPROVAL',
      data: args,
      message: 'ត្រៀមកែប្រែផែនការបង្រៀន។'
    };
  }

  if (name === 'proposeDeleteLessonPlan') {
    return {
      action: 'DELETE_LESSON_PLAN',
      status: 'PENDING_APPROVAL',
      data: args,
      message: 'ត្រៀមលុបផែនការបង្រៀន។'
    };
  }

  return null;
};
