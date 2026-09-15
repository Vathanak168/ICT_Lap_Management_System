import type { Student, PcSyncTask } from '../store/db';

export const normalizePcNumber = (value?: string | null): string => {
  const text = (value || '').trim().toUpperCase();
  const match = text.match(/^(?:PC[-_ ]?)?(\d+)$/);
  return match ? `PC-${match[1].replace(/^0+(?=\d)/, '').padStart(2, '0')}` : text;
};

export interface SyncScope {
  selectedClass: string;
  selectedDesk: string;
  searchQuery: string;
}

export function matchesSyncScope(student: Student, scope: SyncScope) {
  const pc = normalizePcNumber(student.pcNumber);
  const query = scope.searchQuery.trim().toLowerCase();
  return (scope.selectedClass === 'ALL' || student.class === scope.selectedClass)
    && (scope.selectedDesk === 'ALL' || (scope.selectedDesk === 'UNASSIGNED' ? !pc : pc === scope.selectedDesk))
    && (!query || [student.name, student.englishName, student.studentId].some(value => value?.toLowerCase().includes(query)));
}

export interface SyncTarget {
  pcNumber: string;
  accounts: Array<{ studentId: string; password: string; studentName: string }>;
  removeStudentIds: string[];
  taskIds: string[];
}

// Build the actual USB payload from the same scope as the table. The current
// roster wins over old queued passwords/assignments; stale ADDs never resurrect users.
export function buildSyncPlan(students: Student[], tasks: PcSyncTask[], scope: SyncScope,
  preparation: 'FULL' | 'SELECTED' | 'PENDING', selectedIds: Set<string>, autoDelete: boolean) {
  const active = students.filter(student => student.status === 'Active');
  const visible = active.filter(student => matchesSyncScope(student, scope));
  const accounts = visible.filter(student => normalizePcNumber(student.pcNumber)
    && (preparation !== 'SELECTED' || selectedIds.has(student.id)));
  const byStudentId = new Map(students.map(student => [student.studentId.trim(), student]));
  const selectedStudentIds = new Set(accounts.map(student => student.studentId.trim()));
  let unknownClassTasks = 0;
  const scopedTasks = tasks.filter(task => {
    if (task.status !== 'PENDING' || scope.selectedDesk === 'UNASSIGNED') return false;
    if (scope.selectedDesk !== 'ALL' && normalizePcNumber(task.pcNumber) !== scope.selectedDesk) return false;
    const student = byStudentId.get(task.studentId.trim());
    if (scope.selectedClass !== 'ALL') {
      if (!student) { unknownClassTasks++; return false; }
      if (student.class !== scope.selectedClass) return false;
    }
    const query = scope.searchQuery.trim().toLowerCase();
    if (query && ![task.studentId, task.studentName, student?.name, student?.englishName].some(value => value?.toLowerCase().includes(query))) return false;
    return preparation !== 'SELECTED' || selectedStudentIds.has(task.studentId.trim());
  });
  const targets = new Map<string, SyncTarget>();
  const targetFor = (pc: string) => {
    if (!/^PC-\d{2,3}$/.test(pc) || Number(pc.slice(3)) < 1) throw new Error(`លេខ PC មិនត្រឹមត្រូវ៖ ${pc}`);
    if (!targets.has(pc)) targets.set(pc, { pcNumber: pc, accounts: [], removeStudentIds: [], taskIds: [] });
    return targets.get(pc)!;
  };
  for (const task of scopedTasks) {
    const pc = normalizePcNumber(task.pcNumber);
    const target = targetFor(pc);
    const id = task.studentId.trim();
    const student = byStudentId.get(id);
    target.taskIds.push(task.id);
    // Reconcile old operations to the present assignment, including cancelled moves.
    if (!student || student.status !== 'Active' || normalizePcNumber(student.pcNumber) !== pc) {
      if (!target.removeStudentIds.includes(id)) target.removeStudentIds.push(id);
    }
  }
  for (const student of accounts) {
    if (preparation === 'PENDING' && !scopedTasks.some(task => task.studentId.trim() === student.studentId.trim()
      && normalizePcNumber(task.pcNumber) === normalizePcNumber(student.pcNumber))) continue;
    const id = student.studentId.trim();
    if (!id || id.length > 20 || /["/\\[\]:;|=,+*?<>@\s]/.test(id)) throw new Error(`Windows Username មិនត្រឹមត្រូវ៖ ${id}`);
    if (!student.password) throw new Error(`${student.name || id} មិនទាន់មាន Password។`);
    const target = targetFor(normalizePcNumber(student.pcNumber));
    if (target.accounts.some(account => account.studentId === id)) throw new Error(`Student ID ស្ទួននៅលើ ${target.pcNumber}៖ ${id}`);
    target.accounts.push({ studentId: id, password: student.password, studentName: (student.englishName || student.name || id).trim() });
    target.removeStudentIds = target.removeStudentIds.filter(removeId => removeId !== id);
  }
  // A class/search/checkbox subset must never prune other accounts on that PC.
  const fullRoster = preparation === 'FULL' && scope.selectedClass === 'ALL' && !scope.searchQuery.trim();
  return {
    targets: [...targets.values()].filter(target => target.accounts.length || target.removeStudentIds.length)
      .sort((a, b) => a.pcNumber.localeCompare(b.pcNumber, undefined, { numeric: true })),
    mode: fullRoster ? 'FULL' as const : 'DELTA' as const,
    deleteMissingUsers: fullRoster && autoDelete,
    unknownClassTasks,
  };
}

export function receiptTaskIds(receipt: any, tasks: PcSyncTask[], labId: string, academicYear: string): string[] {
  if (receipt?.version !== 1 || receipt.status !== 'SUCCESS' || receipt.labId !== labId
    || receipt.academicYear !== academicYear || typeof receipt.payloadId !== 'string'
    || !Array.isArray(receipt.taskIds) || typeof receipt.pcNumber !== 'string') return [];
  const ids = new Set(receipt.taskIds.filter((id: unknown) => typeof id === 'string'));
  return tasks.filter(task => task.status === 'PENDING' && task.academicYear === academicYear
    && ids.has(task.id) && normalizePcNumber(task.pcNumber) === normalizePcNumber(receipt.pcNumber)).map(task => task.id);
}
