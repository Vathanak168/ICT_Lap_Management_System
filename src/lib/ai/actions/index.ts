import { handleClassAction } from './classActions';
import { handleStudentAction } from './studentActions';
import { handlePcIssueAction } from './pcIssueActions';
import { handleGradeAction } from './gradeActions';
import { handleAttendanceAction } from './attendanceActions';
import { handleLessonLogAction } from './lessonLogActions';
import { handleLessonPlanAction } from './lessonPlanActions';
import { handleTeachingAction, type TeachingActionContext } from './teachingActions';

export const handleAction = async (
  actionStr: string,
  data: any,
  activeYear: string,
  context?: TeachingActionContext,
) => {
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

  handled = await handleTeachingAction(actionStr, data, activeYear, context);
  if (handled) return;
  
  throw new Error(`មិនគាំទ្រសកម្មភាពប្រភេទនេះទេ៖ ${actionStr}`);
};
