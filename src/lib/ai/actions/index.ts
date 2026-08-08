import { handleClassAction } from './classActions';
import { handleStudentAction } from './studentActions';
import { handlePcIssueAction } from './pcIssueActions';
import { handleGradeAction } from './gradeActions';
import { handleAttendanceAction } from './attendanceActions';
import { handleLessonLogAction } from './lessonLogActions';
import { handleLessonPlanAction } from './lessonPlanActions';

export const handleAction = async (actionStr: string, data: any, activeYear: string) => {
  let handled = false;
  
  handled = await handleClassAction(actionStr, data, activeYear);
  if (handled) return;
  
  handled = await handleStudentAction(actionStr, data, activeYear);
  if (handled) return;
  
  handled = await handlePcIssueAction(actionStr, data, activeYear);
  if (handled) return;
  
  handled = await handleGradeAction(actionStr, data, activeYear);
  if (handled) return;

  handled = await handleAttendanceAction(actionStr, data, activeYear);
  if (handled) return;
  
  handled = await handleLessonLogAction(actionStr, data, activeYear);
  if (handled) return;
  
  handled = await handleLessonPlanAction(actionStr, data, activeYear);
  if (handled) return;
  
  throw new Error(`មិនគាំទ្រសកម្មភាពប្រភេទនេះទេ (Unsupported action: ${actionStr})`);
};
