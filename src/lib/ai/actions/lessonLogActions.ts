import { initDB } from '../../../store/db';

export const handleLessonLogAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'ADD_LESSON_LOG') {
    if (!data.classId || !data.date || !data.topic) {
      throw new Error('ទិន្នន័យមិនពេញលេញ (Missing classId, date, or topic)');
    }
    
    const classes = await db.getAll('classes', activeYear);
    const cls = classes.find(c => c.id === data.classId);
    
    if (!cls) {
      throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
    }
    
    const newRecord = {
      id: crypto.randomUUID(),
      date: data.date,
      classId: data.classId,
      class: data.classId, // For backwards compatibility
      shift: cls.shift || 'Morning',
      academicYear: activeYear,
      topic: data.topic,
      exercises: data.exercises || '',
      notes: data.notes || '',
      teacherName: 'AI Assistant'
    };
    
    await db.put('lessonLogs', newRecord);
    
    return true;
  }
  
  return false;
};
