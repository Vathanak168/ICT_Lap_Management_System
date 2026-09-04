import { initDB } from '../../../store/db';
import type { ClassRecord, PcSyncTask, Student } from '../../../store/db';
import { haveSameGrade } from '../../../utils/studentPlacement';

const resolveClass = async (
  db: any,
  classReference: string,
  academicYear: string,
  preferredShift?: string,
): Promise<ClassRecord> => {
  let classRecord: ClassRecord | null = await db.get('classes', classReference);
  if (!classRecord) {
    const matches = await db.getAllFromIndex('classes', 'name', classReference, academicYear);
    classRecord = preferredShift
      ? matches.find((item: ClassRecord) => item.shift === preferredShift) || matches[0] || null
      : matches[0] || null;
  }
  if (!classRecord || classRecord.academicYear !== academicYear) {
    throw new Error(`រកមិនឃើញថ្នាក់ "${classReference}" ក្នុងឆ្នាំសិក្សា ${academicYear} ទេ`);
  }
  return classRecord;
};

const queuePcSyncTask = async (
  db: any,
  student: Student,
  action: PcSyncTask['action'],
  academicYear: string,
) => {
  if (!student.pcNumber) return;
  const task: PcSyncTask = {
    id: crypto.randomUUID(),
    pcNumber: student.pcNumber,
    studentId: student.studentId,
    studentName: student.name,
    action,
    password: null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    branch: '',
    academicYear,
  };
  try {
    await db.put('pcSyncTasks', task);
  } catch (error) {
    console.error('Failed to queue PC Sync task:', error);
  }
};

export const handleStudentAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'ADD_STUDENT') {
    if (!data.studentId || !data.classId) {
      throw new Error('ទិន្នន័យមិនពេញលេញ (ខ្វះលេខអត្តសញ្ញាណ ឬថ្នាក់)');
    }
    const targetYear = data.academicYear || activeYear || '2026-2027';
    const existing = await db.getAllFromIndex('students', 'studentId', data.studentId, targetYear);
    if (existing && existing.length > 0) {
      throw new Error('លេខអត្តសញ្ញាណសិស្សនេះមានរួចហើយ');
    }

    const classRecord = await resolveClass(db, data.classId, targetYear, data.shift);

    const newStudent = {
      id: crypto.randomUUID(),
      studentId: data.studentId,
      name: data.name,
      gender: data.gender,
      class: classRecord.id,
      shift: classRecord.shift,
      status: 'Active',
      academicYear: targetYear,
    };
    await db.put('students', newStudent);
    return true;
  }
  
  if (action === 'UPDATE_STUDENT') {
    const targetYear = data.academicYear || activeYear || '2026-2027';
    const studentsToUpdate = await db.getAllFromIndex('students', 'studentId', data.studentId, targetYear);
    if (!studentsToUpdate || studentsToUpdate.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ');
    const studentToUpdate = studentsToUpdate[0];

    const currentClass = await resolveClass(db, studentToUpdate.class, targetYear);
    const targetClass = data.classId
      ? await resolveClass(db, data.classId, targetYear, data.shift)
      : currentClass;
    const classChanged = targetClass.id !== studentToUpdate.class;

    if (classChanged && studentToUpdate.isShiftSwitching) {
      throw new Error('សិស្សនេះកំពុងប្តូរវេន។ សូមដកស្ថានភាពប្តូរវេនជាមុនសិន មុនផ្ទេរថ្នាក់ជាអចិន្ត្រៃយ៍។');
    }
    if (classChanged && !haveSameGrade(currentClass, targetClass)) {
      throw new Error('មិនអាចផ្ទេរសិស្សឆ្លងកម្រិតថ្នាក់បានទេ។ ថ្នាក់ចាស់ និងថ្នាក់ថ្មីត្រូវមាន Grade ដូចគ្នា។');
    }

    const nextIsShiftSwitching = data.isShiftSwitching ?? studentToUpdate.isShiftSwitching ?? false;
    const nextAlternateClassId = data.alternateClassId ?? studentToUpdate.alternateClassId ?? '';
    let resolvedAlternateClassId = nextAlternateClassId;
    if (nextIsShiftSwitching) {
      if (!nextAlternateClassId) {
        throw new Error('ត្រូវកំណត់ថ្នាក់បម្រុងសម្រាប់សិស្សប្តូរវេន។');
      }
      const alternateClass = await resolveClass(db, nextAlternateClassId, targetYear);
      resolvedAlternateClassId = alternateClass.id;
      if (!haveSameGrade(targetClass, alternateClass) || targetClass.shift === alternateClass.shift) {
        throw new Error('ថ្នាក់បម្រុងត្រូវមាន Grade ដូចគ្នា និងវេនខុសពីថ្នាក់បច្ចុប្បន្ន។');
      }
    }

    const updateData: any = {
      name: data.name || studentToUpdate.name,
      gender: data.gender || studentToUpdate.gender,
      class: targetClass.id,
      shift: targetClass.shift,
      status: data.status || studentToUpdate.status,
      ...(classChanged ? { pcNumber: null } : {}),
    };

    if (data.isShiftSwitching !== undefined || data.alternateClassId !== undefined) {
      updateData.isShiftSwitching = nextIsShiftSwitching;
      updateData.alternateClassId = nextIsShiftSwitching ? resolvedAlternateClassId : null;
    }

    await db.update('students', studentToUpdate.id, updateData);
    if (studentToUpdate.pcNumber) {
      await queuePcSyncTask(
        db,
        { ...studentToUpdate, name: updateData.name },
        classChanged ? 'REMOVE' : 'ADD',
        targetYear,
      );
    }
    return true;
  }
  
  if (action === 'DELETE_STUDENT') {
    const targetYear = data.academicYear || activeYear || '2026-2027';
    const studentsToDelete = await db.getAllFromIndex('students', 'studentId', data.studentId, targetYear);
    if (!studentsToDelete || studentsToDelete.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ');
    
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
          academicYear: studentToDelete.academicYear || targetYear
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
