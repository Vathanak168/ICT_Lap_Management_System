import { initDB } from '../../../store/db';

export const handleLessonPlanAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'DELETE_LESSON_PLAN') {
    if (!data.planId) throw new Error('បញ្ជាក់លេខកូដផែនការបង្រៀន (Missing planId)');
    await db.delete('lessonPlans', data.planId);
    return true;
  }
  
  if (action === 'ADD_LESSON_PLAN') {
    if (!data.classId || !data.lessonTitle) throw new Error('ទិន្នន័យមិនពេញលេញ (Missing classId or lessonTitle)');
    
    const newPlan = {
      id: crypto.randomUUID(),
      classId: data.classId,
      month: data.month || 'Unspecified',
      week: data.week || 'Unspecified',
      lessonTitle: data.lessonTitle,
      topics: data.topics || '',
      exercises: data.exercises || '',
      status: data.status || 'Planned',
      academicYear: activeYear,
      completedDate: data.status === 'Completed' ? new Date().toISOString().split('T')[0] : null
    };
    
    await db.add('lessonPlans', newPlan);
    return true;
  }
  
  if (action === 'UPDATE_LESSON_PLAN') {
    if (!data.planId) throw new Error('បញ្ជាក់លេខកូដផែនការបង្រៀន (Missing planId)');
    
    const plans = await db.getAll('lessonPlans', activeYear);
    const planToUpdate = plans.find((p: any) => p.id === data.planId);
    if (!planToUpdate) throw new Error('រកមិនឃើញផែនការបង្រៀននេះទេ (Lesson Plan not found)');
    
    const updates: any = {};
    if (data.classId !== undefined) updates.classId = data.classId;
    if (data.month !== undefined) updates.month = data.month;
    if (data.week !== undefined) updates.week = data.week;
    if (data.lessonTitle !== undefined) updates.lessonTitle = data.lessonTitle;
    if (data.topics !== undefined) updates.topics = data.topics;
    if (data.exercises !== undefined) updates.exercises = data.exercises;
    if (data.status !== undefined) {
      updates.status = data.status;
      if (data.status === 'Completed' && planToUpdate.status !== 'Completed') {
        updates.completedDate = new Date().toISOString().split('T')[0];
      } else if (data.status === 'Planned') {
        updates.completedDate = null;
      }
    }
    
    await db.update('lessonPlans', planToUpdate.id, updates);
    return true;
  }
  
  return false;
};
