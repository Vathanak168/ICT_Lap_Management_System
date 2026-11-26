import { initDB, queuePcSyncTask } from '../../../store/db';
import type { ClassRecord, Student } from '../../../store/db';
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
        { ...studentToUpdate, name: updateData.name } as Student,
        studentToUpdate.pcNumber,
        classChanged ? 'REMOVE' : 'ADD',
        targetYear,
        classChanged ? null : (studentToUpdate.password ?? null),
      );
    }
    return true;
  }
  
  if (action === 'DELETE_STUDENT') {
    const targetYear = data.academicYear || activeYear || '2026-2027';
    const studentsToDelete = await db.getAllFromIndex('students', 'studentId', data.studentId, targetYear);
    if (!studentsToDelete || studentsToDelete.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ');
    
    const studentToDelete = studentsToDelete[0];
    const id = studentToDelete.id;
    
    // Add PC sync task if assigned
    if (studentToDelete.pcNumber) {
      await queuePcSyncTask(
        db,
        studentToDelete,
        studentToDelete.pcNumber,
        'REMOVE',
        studentToDelete.academicYear || targetYear,
        null,
      );
    }

    // Cascade: clean attendance records
    try {
      const allAttendance = await db.getAll('attendance', targetYear);
      for (const att of allAttendance) {
        if (att.records && att.records[id] !== undefined) {
          const { [id]: _, ...cleanRecords } = att.records;
          await db.update('attendance', att.id, { records: cleanRecords });
        }
      }
    } catch (err) {
      console.warn('Failed to clean attendance for deleted student:', err);
    }

    // Cascade: clean book tracking in settings
    try {
      const candidateClasses = [
        studentToDelete.class,
        studentToDelete.alternateClassId
      ].filter(Boolean) as string[];

      for (const cId of candidateClasses) {
        const bookDocId = `attendance_books_${targetYear}_${cId}`;
        const bookSetting = await db.get('settings', bookDocId);
        if (bookSetting && bookSetting.config && typeof bookSetting.config === 'object') {
          let modified = false;
          const cleanConfig = { ...(bookSetting.config as Record<string, Record<string, boolean>>) };
          for (const d of Object.keys(cleanConfig)) {
            if (cleanConfig[d] && cleanConfig[d][id] !== undefined) {
              delete cleanConfig[d][id];
              modified = true;
              if (Object.keys(cleanConfig[d]).length === 0) {
                delete cleanConfig[d];
              }
            }
          }
          if (modified) {
            await db.put('settings', { id: bookDocId, config: cleanConfig });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to clean book tracking for deleted student:', err);
    }
    
    // Cascade: clean grade scores so no orphaned student UUID triggers INVALID_GRADE_STUDENT_KEY
    try {
      const allGrades = await db.getAll('grades', targetYear);
      for (const grade of allGrades) {
        if (grade.scores && Object.prototype.hasOwnProperty.call(grade.scores, id)) {
          const { [id]: _, ...cleanScores } = grade.scores;
          await db.update('grades', grade.id, { scores: cleanScores });
        }
      }
    } catch (err) {
      console.warn('Failed to clean grades for deleted student:', err);
    }

    await db.delete('students', studentToDelete.id);
    return true;
  }
  
  return false;
};
