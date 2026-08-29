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

    let actualClassId = data.classId;
    let shift = data.shift || 'Morning';
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.classId);
    
    if (!isUUID && data.classId) {
      const classes = await db.getAllFromIndex('classes', 'name', data.classId);
      if (classes && classes.length > 0) {
        const matchedClass = data.shift ? classes.find(c => c.shift === data.shift) || classes[0] : classes[0];
        actualClassId = matchedClass.id;
        shift = matchedClass.shift;
      } else {
        throw new Error(`រកមិនឃើញថ្នាក់ឈ្មោះ "${data.classId}" ទេ (Class not found)`);
      }
    } else if (isUUID) {
      const classRecord = await db.get('classes', data.classId);
      if (classRecord) {
        shift = data.shift || classRecord.shift;
      }
    }

    const newStudent = {
      id: crypto.randomUUID(),
      studentId: data.studentId,
      name: data.name,
      gender: data.gender,
      class: actualClassId,
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

    let actualClassId = data.classId || studentToUpdate.class;
    let shiftToUpdate = data.shift || studentToUpdate.shift;

    if (data.classId && data.classId !== studentToUpdate.class) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.classId);
      if (!isUUID) {
        const classes = await db.getAllFromIndex('classes', 'name', data.classId);
        if (classes && classes.length > 0) {
          const matchedClass = data.shift ? classes.find(c => c.shift === data.shift) || classes[0] : classes[0];
          actualClassId = matchedClass.id;
          shiftToUpdate = matchedClass.shift;
        } else {
          throw new Error(`រកមិនឃើញថ្នាក់ឈ្មោះ "${data.classId}" ទេ (Class not found)`);
        }
      } else {
        const classRecord = await db.get('classes', data.classId);
        if (classRecord) {
          shiftToUpdate = data.shift || classRecord.shift;
        }
      }
    }

    const updateData: any = {
      name: data.name || studentToUpdate.name,
      gender: data.gender || studentToUpdate.gender,
      class: actualClassId,
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
    
    const studentToDelete = studentsToDelete[0];
    
    // Add PC sync task if assigned
    if (studentToDelete.pcNumber) {
      try {
        const newTask = {
          id: crypto.randomUUID(),
          pcNumber: studentToDelete.pcNumber,
          studentId: studentToDelete.studentId,
          studentName: studentToDelete.name,
          action: 'REMOVE' as const,
          password: null,
          status: 'PENDING' as const,
          createdAt: new Date().toISOString(),
          branch: '', 
          academicYear: studentToDelete.academicYear || activeYear || '2026-2027'
        };
        await db.put('pcSyncTasks', newTask);
      } catch (err) {
        console.error('Failed to create pc sync task', err);
      }
    }
    
    await db.delete('students', studentToDelete.id);
    return true;
  }
  
  return false;
};
