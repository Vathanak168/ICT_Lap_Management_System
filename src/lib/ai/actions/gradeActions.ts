import { initDB } from '../../../store/db';

export const handleGradeAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'UPDATE_GRADES') {
    if (!data.classId || !data.studentId || !data.month) {
      throw new Error('ទិន្នន័យមិនពេញលេញ (Missing classId, studentId, or month)');
    }
    
    // We assume the type is 'Final' as that's what's used in the Gradebook by default
    const gradeRecordId = `${activeYear}-${data.classId}-${data.month}-Final`;
    
    // Try to get the existing grade record
    let record = await db.get('grades', gradeRecordId);
    
    if (!record) {
      // If it doesn't exist, we need to create a new one for the class
      // First, get the class to know its shift
      const classes = await db.getAll('classes', activeYear);
      const cls = classes.find(c => c.id === data.classId);
      
      if (!cls) {
        throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
      }
      
      record = {
        id: gradeRecordId,
        classId: data.classId,
        shift: cls.shift || 'Morning',
        academicYear: activeYear,
        month: data.month,
        type: 'Final',
        scores: {}
      };
    }
    
    // Update the specific student's scores
    const existingScoresForStudent = record.scores[data.studentId] || {};
    
    record.scores[data.studentId] = {
      ...existingScoresForStudent,
      practice: data.practice !== undefined ? data.practice : existingScoresForStudent.practice,
      book: data.book !== undefined ? data.book : existingScoresForStudent.book,
      exam: data.exam !== undefined ? data.exam : existingScoresForStudent.exam,
      adjustment: data.adjustment !== undefined ? data.adjustment : existingScoresForStudent.adjustment,
      adjustmentNote: data.adjustmentNote !== undefined ? data.adjustmentNote : existingScoresForStudent.adjustmentNote
    };
    
    // Save back to DB
    // db.put acts as an upsert (insert or replace) in the local DB wrapper
    await db.put('grades', record);
    
    return true;
  }
  
  return false;
};
