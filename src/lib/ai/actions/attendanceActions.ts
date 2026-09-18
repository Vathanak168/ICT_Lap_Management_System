import { initDB } from '../../../store/db';

export const handleAttendanceAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'UPDATE_ATTENDANCE') {
    if (!data.classId || !data.studentId || !data.date || !data.status) {
      throw new Error('ទិន្នន័យមិនពេញលេញ');
    }
    
    const validStatuses = ['P', 'A', 'E', 'L', 'P_LATE'];
    if (!validStatuses.includes(data.status)) {
      throw new Error(`ស្ថានភាពវត្តមានមិនត្រឹមត្រូវ៖ ${data.status}`);
    }

    const normalizedStatus = data.status === 'P_LATE' ? 'L' : data.status;

    // Resolve class
    const classes = await db.getAll('classes', activeYear);
    const cls = classes.find(c => c.id === data.classId || c.name === data.classId);
    const targetClassId = cls ? cls.id : data.classId;

    if (!cls && !targetClassId) {
      throw new Error('រកមិនឃើញថ្នាក់នេះទេ');
    }

    // Find attendance record by class index or ID
    const classAttendance = await db.getAllFromIndex('attendance', 'class_id', targetClassId, activeYear).catch(() => []);
    let record = classAttendance.find(a => a.date === data.date) || null;
    const attendanceRecordId = record?.id || `${activeYear}_${targetClassId}_${data.date}`;
    
    if (!record) {
      record = await db.get('attendance', attendanceRecordId).catch(() => null);
    }

    if (!record) {
      record = {
        id: attendanceRecordId,
        date: data.date,
        classId: targetClassId,
        class: targetClassId, // For backwards compatibility
        shift: cls?.shift || 'Morning',
        academicYear: activeYear,
        records: {}
      };
    }
    
    // Resolve student document ID in case studentId was given as school code or UUID
    const students = await db.getAllFromIndex('students', 'class', targetClassId, activeYear);
    let matchedStudent = students.find(s => s.id === data.studentId || s.studentId === data.studentId || s.name === data.studentId);
    if (!matchedStudent) {
      const allStudents = await db.getAll('students', activeYear);
      matchedStudent = allStudents.find(s => 
        (s.class === targetClassId || s.alternateClassId === targetClassId) && 
        (s.id === data.studentId || s.studentId === data.studentId || s.name === data.studentId)
      );
    }
    const targetStudentDocId = matchedStudent ? matchedStudent.id : data.studentId;

    // Update the specific student's attendance
    if (!record.records) record.records = {};
    record.records[targetStudentDocId] = normalizedStatus;
    
    await db.put('attendance', record);

    // Book tracking sync:
    // 1. If student is marked Absent (A) or Excused (E), clear their no-book status for that date
    // 2. If data.noBook is explicitly provided, update settings accordingly
    const bookDocId = `attendance_books_${activeYear}_${targetClassId}`;
    try {
      const bookSetting = await db.get('settings', bookDocId);
      const classBooks = (bookSetting?.config && typeof bookSetting.config === 'object') 
        ? { ...(bookSetting.config as Record<string, Record<string, boolean>>) } 
        : {};

      let bookModified = false;
      if (normalizedStatus === 'A' || normalizedStatus === 'E') {
        if (classBooks[data.date] && classBooks[data.date][targetStudentDocId] !== undefined) {
          delete classBooks[data.date][targetStudentDocId];
          bookModified = true;
          if (Object.keys(classBooks[data.date]).length === 0) {
            delete classBooks[data.date];
          }
        }
      } else if (data.noBook === true) {
        if (!classBooks[data.date]) classBooks[data.date] = {};
        classBooks[data.date][targetStudentDocId] = true;
        bookModified = true;
      } else if (data.noBook === false) {
        if (classBooks[data.date] && classBooks[data.date][targetStudentDocId] !== undefined) {
          delete classBooks[data.date][targetStudentDocId];
          bookModified = true;
          if (Object.keys(classBooks[data.date]).length === 0) {
            delete classBooks[data.date];
          }
        }
      }

      if (bookModified) {
        await db.put('settings', { id: bookDocId, config: classBooks });
      }
    } catch (err) {
      console.warn('Failed to sync book tracking in AI action:', err);
    }
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('appDataChanged'));
    }

    return true;
  }

  if (action === 'UPDATE_BOOK_TRACKING') {
    if (!data.classId || !data.studentId || !data.date) {
      throw new Error('ទិន្នន័យមិនពេញលេញ');
    }

    const classes = await db.getAll('classes', activeYear);
    const cls = classes.find(c => c.id === data.classId || c.name === data.classId);
    const targetClassId = cls ? cls.id : data.classId;

    const allStudents = await db.getAll('students', activeYear);
    const matched = allStudents.find(s => 
      (s.class === targetClassId || s.alternateClassId === targetClassId) && 
      (s.id === data.studentId || s.studentId === data.studentId || s.name === data.studentId)
    );
    const targetStudentDocId = matched ? matched.id : data.studentId;

    const bookDocId = `attendance_books_${activeYear}_${targetClassId}`;
    const bookSetting = await db.get('settings', bookDocId);
    const classBooks = (bookSetting?.config && typeof bookSetting.config === 'object') 
      ? { ...(bookSetting.config as Record<string, Record<string, boolean>>) } 
      : {};

    if (!classBooks[data.date]) {
      classBooks[data.date] = {};
    }

    const isNoBook = data.noBook ?? data.hasNoBook ?? true;
    if (isNoBook) {
      classBooks[data.date][targetStudentDocId] = true;
    } else {
      delete classBooks[data.date][targetStudentDocId];
      if (Object.keys(classBooks[data.date]).length === 0) {
        delete classBooks[data.date];
      }
    }

    await db.put('settings', { id: bookDocId, config: classBooks });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('appDataChanged'));
    }

    return true;
  }
  
  return false;
};
