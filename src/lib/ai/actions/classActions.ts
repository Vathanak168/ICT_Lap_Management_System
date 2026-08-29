import { initDB } from '../../../store/db';

export const handleClassAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'DELETE_CLASS') {
    if (!data.classId) throw new Error('បញ្ជាក់លេខកូដថ្នាក់ (Missing classId)');
    const classRecs = await db.getAll('classes');
    const classToDelete = classRecs.find((c: any) => c.id === data.classId || c.name === data.classId);
    if (!classToDelete) throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
    
    const [students, attendance, grades, seatingPlans, lessonLogs] = await Promise.all([
      db.getAllFromIndex('students', 'class', classToDelete.id),
      db.getAllFromIndex('attendance', 'classId', classToDelete.id),
      db.getAllFromIndex('grades', 'classId', classToDelete.id),
      db.getAllFromIndex('seatingPlans', 'classId', classToDelete.id),
      db.getAllFromIndex('lessonLogs', 'classId', classToDelete.id)
    ]);

    for (const item of students || []) await db.delete('students', item.id);
    for (const item of attendance || []) await db.delete('attendance', item.id);
    for (const item of grades || []) await db.delete('grades', item.id);
    for (const item of seatingPlans || []) await db.delete('seatingPlans', item.id);
    for (const item of lessonLogs || []) await db.delete('lessonLogs', item.id);
    
    await db.delete('classes', classToDelete.id);
    return true;
  }
  
  if (action === 'ADD_CLASS') {
    if (!data.name || !data.shift) throw new Error('ទិន្នន័យមិនពេញលេញ (Missing class name or shift)');
    const newClass = {
      id: crypto.randomUUID(),
      name: data.name,
      shift: data.shift,
      academicYear: activeYear || '2026-2027',
      notes: data.notes || ''
    };
    await db.put('classes', newClass);
    return true;
  }
  
  if (action === 'UPDATE_CLASS') {
    if (!data.classId) throw new Error('បញ្ជាក់លេខកូដថ្នាក់ (Missing classId)');
    const classesToUpdate = await db.getAll('classes');
    const classToUpdate = classesToUpdate.find((c: any) => c.id === data.classId || c.name === data.classId);
    if (!classToUpdate) throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
    
    const newName = data.name || classToUpdate.name;
    const newShift = data.shift || classToUpdate.shift;

    await db.update('classes', classToUpdate.id, {
      name: newName,
      shift: newShift,
      notes: data.notes !== undefined ? data.notes : classToUpdate.notes
    });

    if (newShift !== classToUpdate.shift) {
      const [students, attendance, grades, seatingPlans, lessonLogs] = await Promise.all([
        db.getAllFromIndex('students', 'class', classToUpdate.id),
        db.getAllFromIndex('attendance', 'classId', classToUpdate.id),
        db.getAllFromIndex('grades', 'classId', classToUpdate.id),
        db.getAllFromIndex('seatingPlans', 'classId', classToUpdate.id),
        db.getAllFromIndex('lessonLogs', 'classId', classToUpdate.id)
      ]);

      for (const item of students || []) await db.update('students', item.id, { shift: newShift });
      for (const item of attendance || []) await db.update('attendance', item.id, { shift: newShift });
      for (const item of grades || []) await db.update('grades', item.id, { shift: newShift });
      for (const item of seatingPlans || []) await db.update('seatingPlans', item.id, { shift: newShift });
      for (const item of lessonLogs || []) await db.update('lessonLogs', item.id, { shift: newShift });
    }

    return true;
  }
  
  return false;
};
