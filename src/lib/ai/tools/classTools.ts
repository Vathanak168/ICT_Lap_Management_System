import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const classToolDeclarations = [
  {
    name: 'getClasses',
    description: 'Get a list of all classes in the system',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dummy: { type: Type.STRING, description: 'Ignore this' }
      },
    },
  },
  {
    name: 'proposeAddClass',
    description: 'Propose to add a new class. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'The name of the class (e.g. 6A1)' },
        shift: { type: Type.STRING, description: 'The shift (Morning, Afternoon, Evening)' },
        notes: { type: Type.STRING, description: 'Optional notes' }
      },
      required: ['name', 'shift']
    }
  },
  {
    name: 'proposeUpdateClass',
    description: 'Propose to update an existing class. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID to update' },
        name: { type: Type.STRING, description: 'New name of the class' },
        shift: { type: Type.STRING, description: 'New shift' },
        notes: { type: Type.STRING, description: 'New notes' }
      },
      required: ['classId']
    }
  },
  {
    name: 'proposeDeleteClass',
    description: 'Propose to delete a class. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classId: { type: Type.STRING, description: 'The class ID to delete' }
      },
      required: ['classId']
    }
  }
];

export const executeClassTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getClasses') {
    const classes = await db.getAll('classes', academicYear);
    classes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return {
      resultType: 'class_summary',
      count: classes.length,
      names: classes.map(c => c.name),
      details: classes.map(c => ({
        id: c.id,
        name: c.name,
        shift: c.shift
      })),
      responseGuidance: 'Normally state the count and names conversationally. Only mention shift or other details if the user asked for them.'
    };
  }
  
  const proposeActions = ['proposeAddClass', 'proposeUpdateClass', 'proposeDeleteClass'];
  if (proposeActions.includes(name)) {
    const actionMap: Record<string, string> = {
      'proposeAddClass': 'ADD_CLASS',
      'proposeUpdateClass': 'UPDATE_CLASS',
      'proposeDeleteClass': 'DELETE_CLASS'
    };
    return {
      action: actionMap[name],
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  return null;
};
