import { initDB } from '../../../store/db';

export const handlePcIssueAction = async (action: string, data: any, activeYear: string) => {
  const db = await initDB();
  
  if (action === 'ADD_PC_ISSUE') {
    if (!data.pcNumber) throw new Error('បញ្ជាក់លេខកុំព្យូទ័រ (Missing PC Number)');
    const newIssue = {
      id: crypto.randomUUID(),
      pcNumber: data.pcNumber,
      description: data.description || '',
      status: 'Pending',
      reportedBy: data.reportedBy || 'AI Assistant',
      reportedDate: new Date().toISOString(),
      academicYear: data.academicYear || activeYear || '2026-2027'
    };
    await db.put('pcIssues', newIssue);
    return true;
  }
  
  if (action === 'RESOLVE_PC_ISSUE') {
    if (!data.id) throw new Error('បញ្ជាក់លេខកូដបញ្ហា (Missing Issue ID)');
    await db.update('pcIssues', data.id, {
      status: 'Resolved',
      resolution: data.resolution || 'Resolved by AI',
      resolvedDate: new Date().toISOString()
    });
    return true;
  }
  
  return false;
};
