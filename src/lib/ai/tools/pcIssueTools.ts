import { Type } from '@google/genai';
import { initDB } from '../../../store/db';

export const pcIssueToolDeclarations = [
  {
    name: 'getPcIssues',
    description: 'Get a list of PC issues or broken computers',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: 'Optional. Filter by status (e.g. pending, resolved)' }
      }
    }
  },
  {
    name: 'proposeAddPcIssue',
    description: 'Propose to report a broken PC or issue. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pcNumber: { type: Type.STRING, description: 'The PC number (e.g., PC-01)' },
        description: { type: Type.STRING, description: 'Description of the problem' },
        reportedBy: { type: Type.STRING, description: 'Name of person reporting' }
      },
      required: ['pcNumber', 'description']
    }
  },
  {
    name: 'proposeResolvePcIssue',
    description: 'Propose to mark a PC issue as resolved. User will review and approve.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'The ID of the issue to resolve' },
        resolution: { type: Type.STRING, description: 'How it was fixed' }
      },
      required: ['id']
    }
  }
];

export const executePcIssueTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getPcIssues') {
    const issues = await db.getAll('pcIssues', academicYear);
    const filtered = args.status 
      ? issues.filter(i => i.status.toLowerCase() === args.status.toLowerCase())
      : issues;
      
    return {
      resultType: 'pc_issue_summary',
      count: filtered.length,
      status: args.status || 'all',
      details: filtered.map(i => ({
        ref: `pcIssue_${i.id}`,
        pcNumber: i.pcNumber,
        status: i.status,
        description: i.description
      })),
      responseGuidance: 'Summarize PC issues. Mention specific PCs and their problems naturally.'
    };
  }
  
  const proposeActions = ['proposeAddPcIssue', 'proposeResolvePcIssue'];
  if (proposeActions.includes(name)) {
    const actionMap: Record<string, string> = {
      'proposeAddPcIssue': 'ADD_PC_ISSUE',
      'proposeResolvePcIssue': 'RESOLVE_PC_ISSUE'
    };
    return {
      action: actionMap[name],
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  return null;
};
