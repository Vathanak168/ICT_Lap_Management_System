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
    const attendanceRecordId = `${activeYear}_${data.classId}_${data.date}`;
    let record = await db.get('attendance', attendanceRecordId);
    
    if (!record) {
      const classes = await db.getAll('classes', activeYear);
      const cls = classes.find(c => c.id === data.classId);
      
      if (!cls) {
        throw new Error('រកមិនឃើញថ្នាក់នេះទេ');
      }
      
      record = {
        id: attendanceRecordId,
        date: data.date,
        classId: data.classId,
        class: data.classId, // For backwards compatibility
        shift: cls.shift || 'Morning',
        academicYear: activeYear,
        records: {}
      };
    }
    
    // Update the specific student's attendance
    record.records[data.studentId] = normalizedStatus;
    
    await db.put('attendance', record);
    
    return true;
  }
  
  return false;
};
