import { initDB } from '../../../store/db';

export const handleStudentAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'ADD_STUDENT') {
    if (!data.studentId || !data.classId) {
      throw new Error('ទិន្នន័យមិនពេញលេញ (Missing studentId or classId)');
    }
    const existing = await db.getAllFromIndex('students', 'studentId', data.studentId);
    if (existing && existing.length > 0) {
      throw new Error('លេខអត្តសញ្ញាណសិស្សនេះមានរួចហើយ (Student ID already exists)');
    }

    let shift = data.shift || 'Morning';
    if (!data.shift && data.classId) {
      const classes = await db.getAllFromIndex('classes', 'name', data.classId);
      if (classes && classes.length > 0) {
        shift = classes[0].shift;
      }
    }

    const newStudent = {
      id: crypto.randomUUID(),
      studentId: data.studentId,
      name: data.name,
      gender: data.gender,
      class: data.classId,
      shift,
      status: 'Active',
      academicYear: data.academicYear || activeYear || '2026-2027'
    };
    await db.put('students', newStudent);
    return true;
  }
  
  if (action === 'UPDATE_STUDENT') {
    const studentsToUpdate = await db.getAllFromIndex('students', 'studentId', data.studentId);
    if (!studentsToUpdate || studentsToUpdate.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ (Student not found)');
    const studentToUpdate = studentsToUpdate[0];

    let shiftToUpdate = data.shift || studentToUpdate.shift;
    if (!data.shift && data.classId && data.classId !== studentToUpdate.class) {
      const classes = await db.getAllFromIndex('classes', 'name', data.classId);
      if (classes && classes.length > 0) {
        shiftToUpdate = classes[0].shift;
      }
    }

    const updateData: any = {
      name: data.name || studentToUpdate.name,
      gender: data.gender || studentToUpdate.gender,
      class: data.classId || studentToUpdate.class,
      shift: shiftToUpdate,
      status: data.status || studentToUpdate.status
    };

    if (data.isShiftSwitching !== undefined) {
      updateData.isShiftSwitching = data.isShiftSwitching;
    }
    if (data.alternateClassId !== undefined) {
      updateData.alternateClassId = data.alternateClassId;
    }

    await db.update('students', studentToUpdate.id, updateData);
    return true;
  }
  
  if (action === 'DELETE_STUDENT') {
    const studentsToDelete = await db.getAllFromIndex('students', 'studentId', data.studentId);
    if (!studentsToDelete || studentsToDelete.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ (Student not found)');
    await db.delete('students', studentsToDelete[0].id);
    return true;
  }
  
  return false;
};
