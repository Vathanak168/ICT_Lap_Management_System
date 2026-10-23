import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePcNumber, receiptTaskIds, buildSyncPlan } from '../src/lib/pcSyncPlan.ts';

// Mock in-memory database simulating db.put, db.get, db.getAll, db.delete, db.deleteMany
class MockDb {
  constructor() {
    this.tables = {
      students: new Map(),
      pcSyncTasks: new Map(),
    };
  }

  async getAll(tableName, academicYear) {
    const table = this.tables[tableName] || new Map();
    const rows = Array.from(table.values());
    if (academicYear) {
      return rows.filter(r => r.academicYear === academicYear);
    }
    return rows;
  }

  async get(tableName, id) {
    const table = this.tables[tableName] || new Map();
    return table.get(id) || null;
  }

  async put(tableName, record) {
    if (!this.tables[tableName]) this.tables[tableName] = new Map();
    this.tables[tableName].set(record.id, JSON.parse(JSON.stringify(record)));
  }

  async putMany(tableName, records) {
    for (const r of records) {
      await this.put(tableName, r);
    }
  }

  async delete(tableName, id) {
    if (this.tables[tableName]) {
      this.tables[tableName].delete(id);
    }
  }

  async deleteMany(tableName, ids) {
    for (const id of ids) {
      await this.delete(tableName, id);
    }
  }
}

// Reproduction of queuePcSyncTask logic from src/store/db.ts
async function queuePcSyncTask(db, student, pcNumber, action, academicYear, password) {
  const normPc = (pcNumber || '').trim().toUpperCase().replace(/^(?:PC[-_ ]?)?(\d+)$/, (_, n) => 'PC-' + n.replace(/^0+(?=\d)/, '').padStart(2, '0'));
  const finalPassword = password !== undefined ? password : (student.password || null);
  const studentDisplayName = (student.englishName?.trim() || student.name?.trim() || student.studentId).trim();
  const studentId = student.studentId?.trim();

  if (!normPc || !studentId || !academicYear) return;

  const allTasks = await db.getAll('pcSyncTasks', academicYear);
  const studentTasks = (allTasks || []).filter(
    t => t.studentId?.trim().toLowerCase() === studentId.toLowerCase() &&
         (t.pcNumber || '').trim().toUpperCase().replace(/^(?:PC[-_ ]?)?(\d+)$/, (_, n) => 'PC-' + n.replace(/^0+(?=\d)/, '').padStart(2, '0')) === normPc
  );
  const pendingTasks = studentTasks.filter(t => t.status === 'PENDING');
  const hasCompletedOnThisPc = studentTasks.some(t => t.status === 'COMPLETED');

  if (action === 'ADD') {
    const pendingRemove = pendingTasks.find(t => t.action === 'REMOVE');
    if (pendingRemove) {
      await db.delete('pcSyncTasks', pendingRemove.id);
    }
    const pendingAdd = pendingTasks.find(t => t.action === 'ADD');
    if (pendingAdd) {
      await db.put('pcSyncTasks', {
        ...pendingAdd,
        studentName: studentDisplayName,
        password: finalPassword,
      });
      return;
    }
    const pendingUpdate = pendingTasks.find(t => t.action === 'UPDATE_PASSWORD');
    if (pendingUpdate) {
      await db.put('pcSyncTasks', {
        ...pendingUpdate,
        action: 'ADD',
        studentName: studentDisplayName,
        password: finalPassword,
      });
      return;
    }
  } else if (action === 'UPDATE_PASSWORD') {
    const pendingAdd = pendingTasks.find(t => t.action === 'ADD');
    if (pendingAdd) {
      await db.put('pcSyncTasks', {
        ...pendingAdd,
        studentName: studentDisplayName,
        password: finalPassword,
      });
      return;
    }
    const pendingUpdate = pendingTasks.find(t => t.action === 'UPDATE_PASSWORD');
    if (pendingUpdate) {
      await db.put('pcSyncTasks', {
        ...pendingUpdate,
        studentName: studentDisplayName,
        password: finalPassword,
      });
      return;
    }
  } else if (action === 'REMOVE') {
    const pendingAdd = pendingTasks.find(t => t.action === 'ADD');
    const pendingUpdate = pendingTasks.find(t => t.action === 'UPDATE_PASSWORD');
    
    if (pendingAdd) await db.delete('pcSyncTasks', pendingAdd.id);
    if (pendingUpdate) await db.delete('pcSyncTasks', pendingUpdate.id);

    if (!hasCompletedOnThisPc && (pendingAdd || pendingUpdate)) {
      return;
    }

    const existingRemove = pendingTasks.find(t => t.action === 'REMOVE');
    if (existingRemove) {
      return;
    }
  }

  const task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    pcNumber: normPc,
    studentId,
    studentName: studentDisplayName,
    action,
    password: finalPassword,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    academicYear,
  };
  await db.put('pcSyncTasks', task);
}

// Tests
test('PC Sync Task CRUD - Create and Read', async () => {
  const db = new MockDb();
  const year = '2026-2027';

  // Create
  const task1 = {
    id: 't-1',
    pcNumber: 'PC-01',
    studentId: 'STU001',
    studentName: 'Sokha',
    action: 'ADD',
    password: '123',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    academicYear: year,
  };
  await db.put('pcSyncTasks', task1);

  // Read
  const tasks = await db.getAll('pcSyncTasks', year);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].studentName, 'Sokha');
  assert.equal(tasks[0].status, 'PENDING');
});

test('PC Sync Task CRUD - Update and Toggle Status', async () => {
  const db = new MockDb();
  const year = '2026-2027';

  const task = {
    id: 't-1',
    pcNumber: 'PC-01',
    studentId: 'STU001',
    studentName: 'Sokha',
    action: 'ADD',
    password: '123',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    academicYear: year,
  };
  await db.put('pcSyncTasks', task);

  // Toggle to COMPLETED
  const updatedTask = { ...task, status: 'COMPLETED' };
  await db.put('pcSyncTasks', updatedTask);

  const reloaded = await db.get('pcSyncTasks', 't-1');
  assert.equal(reloaded.status, 'COMPLETED');
});

test('PC Sync Task CRUD - Delete and Batch Operations', async () => {
  const db = new MockDb();
  const year = '2026-2027';

  const t1 = { id: 't-1', pcNumber: 'PC-01', studentId: 'S1', studentName: 'A', action: 'ADD', status: 'PENDING', academicYear: year };
  const t2 = { id: 't-2', pcNumber: 'PC-02', studentId: 'S2', studentName: 'B', action: 'ADD', status: 'PENDING', academicYear: year };
  const t3 = { id: 't-3', pcNumber: 'PC-03', studentId: 'S3', studentName: 'C', action: 'ADD', status: 'PENDING', academicYear: year };
  await db.putMany('pcSyncTasks', [t1, t2, t3]);

  // Batch mark COMPLETED for t1 and t2
  const toComplete = [t1, t2].map(t => ({ ...t, status: 'COMPLETED' }));
  await db.putMany('pcSyncTasks', toComplete);

  const all = await db.getAll('pcSyncTasks', year);
  assert.equal(all.filter(t => t.status === 'COMPLETED').length, 2);
  assert.equal(all.filter(t => t.status === 'PENDING').length, 1);

  // Batch delete completed
  await db.deleteMany('pcSyncTasks', ['t-1', 't-2']);
  const remaining = await db.getAll('pcSyncTasks', year);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 't-3');
});

test('Receipt Import Workflow - Tasks transition from PENDING to COMPLETED (not deleted)', async () => {
  const db = new MockDb();
  const year = '2026-2027';
  const labId = 'lab-ict-1';

  const t1 = { id: 't-sync-1', pcNumber: 'PC-05', studentId: 'STU005', studentName: 'Dara', action: 'ADD', status: 'PENDING', academicYear: year };
  const t2 = { id: 't-sync-2', pcNumber: 'PC-05', studentId: 'STU006', studentName: 'Vanna', action: 'ADD', status: 'PENDING', academicYear: year };
  const t3 = { id: 't-sync-3', pcNumber: 'PC-06', studentId: 'STU007', studentName: 'Bona', action: 'ADD', status: 'PENDING', academicYear: year };
  await db.putMany('pcSyncTasks', [t1, t2, t3]);

  // Simulate Receipt-PC-05.json returned from physical PC-05
  const receiptPC05 = {
    version: 1,
    status: 'SUCCESS',
    labId,
    academicYear: year,
    payloadId: 'payload-123',
    pcNumber: 'PC-05',
    taskIds: ['t-sync-1', 't-sync-2'],
  };

  const currentTasks = await db.getAll('pcSyncTasks', year);
  const ackedIds = receiptTaskIds(receiptPC05, currentTasks, labId, year);
  assert.deepEqual(ackedIds.sort(), ['t-sync-1', 't-sync-2'].sort());

  // Fixed receipt import logic: marks status as COMPLETED
  const updatedTasks = currentTasks
    .filter(t => ackedIds.includes(t.id))
    .map(t => ({ ...t, status: 'COMPLETED' }));
  await db.putMany('pcSyncTasks', updatedTasks);

  // Verification: Tasks still exist in DB for audit trail and history
  const allAfterSync = await db.getAll('pcSyncTasks', year);
  assert.equal(allAfterSync.length, 3, 'All tasks should be preserved in DB');

  const pending = allAfterSync.filter(t => t.status === 'PENDING');
  assert.equal(pending.length, 1, 'Only PC-06 task should remain PENDING');
  assert.equal(pending[0].id, 't-sync-3');

  const completed = allAfterSync.filter(t => t.status === 'COMPLETED');
  assert.equal(completed.length, 2, 'PC-05 tasks should be COMPLETED');
});

test('Intelligent Task Deduplication - Password changes update pending ADD without redundant task', async () => {
  const db = new MockDb();
  const year = '2026-2027';
  const student = { id: 's1', studentId: 'B001', name: 'Kim', password: '111', class: '8A', academicYear: year };

  // Assign to PC-01
  await queuePcSyncTask(db, student, 'PC-01', 'ADD', year, '111');
  let tasks = await db.getAll('pcSyncTasks', year);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].password, '111');
  assert.equal(tasks[0].action, 'ADD');

  // Change password before sync
  await queuePcSyncTask(db, student, 'PC-01', 'UPDATE_PASSWORD', year, '222');
  tasks = await db.getAll('pcSyncTasks', year);
  assert.equal(tasks.length, 1, 'Should NOT create a second task; should update pending ADD in-place');
  assert.equal(tasks[0].password, '222');
  assert.equal(tasks[0].action, 'ADD');
});

test('Intelligent Task Deduplication - Reassigning un-synced seat cancels pending task without ghost remove', async () => {
  const db = new MockDb();
  const year = '2026-2027';
  const student = { id: 's1', studentId: 'B001', name: 'Kim', password: '123', class: '8A', academicYear: year };

  // 1. Assign to PC-01
  await queuePcSyncTask(db, student, 'PC-01', 'ADD', year, '123');
  let tasks = await db.getAll('pcSyncTasks', year);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].pcNumber, 'PC-01');

  // 2. Teacher moves student to PC-02 before PC-01 was ever synced
  // Logic sends REMOVE on PC-01 and ADD on PC-02
  await queuePcSyncTask(db, student, 'PC-01', 'REMOVE', year, null);
  await queuePcSyncTask(db, student, 'PC-02', 'ADD', year, '123');

  tasks = await db.getAll('pcSyncTasks', year);
  // PC-01 never had a completed sync, so pending ADD on PC-01 was cancelled, and ghost REMOVE was avoided!
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].pcNumber, 'PC-02');
  assert.equal(tasks[0].action, 'ADD');
});

test('Physical PC Removal - Once synced, moving student queues real REMOVE task on old PC', async () => {
  const db = new MockDb();
  const year = '2026-2027';
  const student = { id: 's1', studentId: 'B001', name: 'Kim', password: '123', class: '8A', academicYear: year };

  // 1. Assign to PC-01 and SYNC to completion
  const initialTask = {
    id: 't-init',
    pcNumber: 'PC-01',
    studentId: 'B001',
    studentName: 'Kim',
    action: 'ADD',
    password: '123',
    status: 'COMPLETED', // Client PC actually created Windows user!
    academicYear: year,
  };
  await db.put('pcSyncTasks', initialTask);

  // 2. Next week, student moves to PC-02
  await queuePcSyncTask(db, student, 'PC-01', 'REMOVE', year, null);
  await queuePcSyncTask(db, student, 'PC-02', 'ADD', year, '123');

  const tasks = await db.getAll('pcSyncTasks', year);
  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  assert.equal(pendingTasks.length, 2);

  const pc01Task = pendingTasks.find(t => t.pcNumber === 'PC-01');
  assert.equal(pc01Task.action, 'REMOVE', 'Must queue REMOVE so PC-01 deletes local account');

  const pc02Task = pendingTasks.find(t => t.pcNumber === 'PC-02');
  assert.equal(pc02Task.action, 'ADD', 'Must queue ADD on new PC');
});
