import { initDB } from '../../../store/db';

export const handleClassAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'DELETE_CLASS') {
    if (!data.classId) throw new Error('បញ្ជាក់លេខកូដថ្នាក់ (Missing classId)');
    const classRecs = await db.getAll('classes');
    const classToDelete = classRecs.find((c: any) => c.id === data.classId || c.name === data.classId);
    if (!classToDelete) throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
    
    // Cascade delete students in this class
    const studentsInClass = await db.getAllFromIndex('students', 'class', classToDelete.name);
    if (studentsInClass && studentsInClass.length > 0) {
      for (const student of studentsInClass) {
        await db.delete('students', student.id);
      }
    }
    
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
    const oldName = classToUpdate.name;
    const newShift = data.shift || classToUpdate.shift;

    await db.update('classes', classToUpdate.id, {
      name: newName,
      shift: newShift,
      notes: data.notes !== undefined ? data.notes : classToUpdate.notes
    });

    if (newName !== oldName || newShift !== classToUpdate.shift) {
      // Update all students associated with this class
      const studentsInClass = await db.getAllFromIndex('students', 'class', oldName);
      if (studentsInClass && studentsInClass.length > 0) {
        for (const student of studentsInClass) {
          const updateData: any = {};
          if (newName !== oldName) updateData.class = newName;
          if (newShift !== classToUpdate.shift) updateData.shift = newShift;
          await db.update('students', student.id, updateData);
        }
      }
    }

    return true;
  }
  
  return false;
};
