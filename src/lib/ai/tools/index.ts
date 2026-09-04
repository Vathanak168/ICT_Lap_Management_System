import { classToolDeclarations, executeClassTool } from './classTools';
import { studentToolDeclarations, executeStudentTool } from './studentTools';
import { pcIssueToolDeclarations, executePcIssueTool } from './pcIssueTools';
import { attendanceToolDeclarations, executeAttendanceTool } from './attendanceTools';
import { gradeToolDeclarations, executeGradeTool } from './gradeTools';
import { lessonLogToolDeclarations, executeLessonLogTool } from './lessonLogTools';
import { lessonPlanToolDeclarations, executeLessonPlanTool } from './lessonPlanTools';
import { teachingToolDeclarations, executeTeachingTool } from './teachingTools';

export const tools: any = [{
  functionDeclarations: [
    ...classToolDeclarations,
    ...studentToolDeclarations,
    ...pcIssueToolDeclarations,
    ...attendanceToolDeclarations,
    ...gradeToolDeclarations,
    ...lessonLogToolDeclarations,
    ...lessonPlanToolDeclarations,
    ...teachingToolDeclarations
  ]
}];

export const executeTool = async (
  name: string,
  args: any,
  academicYear?: string,
  context?: { userId?: string },
) => {
  let result;
  
  result = await executeClassTool(name, args, academicYear);
  if (result !== null) return result;
  
  result = await executeStudentTool(name, args, academicYear);
  if (result !== null) return result;
  
  result = await executePcIssueTool(name, args, academicYear);
  if (result !== null) return result;
  
  result = await executeAttendanceTool(name, args, academicYear);
  if (result !== null) return result;
  
  result = await executeGradeTool(name, args, academicYear);
  if (result !== null) return result;
  
  result = await executeLessonLogTool(name, args, academicYear);
  if (result !== null) return result;
  
  result = await executeLessonPlanTool(name, args, academicYear);
  if (result !== null) return result;

  result = await executeTeachingTool(name, args, academicYear, context);
  if (result !== null) return result;
  
  throw new Error(`Tool ${name} not found or not implemented.`);
};
