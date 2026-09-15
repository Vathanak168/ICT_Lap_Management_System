import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSyncPlan, normalizePcNumber, matchesSyncScope, receiptTaskIds } from '../src/lib/pcSyncPlan.ts';

const scope = { selectedClass: 'ALL', selectedDesk: 'ALL', searchQuery: '' };
const student = (id, klass, pc, extra = {}) => ({ id, studentId: id, name: id, englishName: id,
  class: klass, pcNumber: pc, password: '123', status: 'Active', academicYear: '2026-2027', ...extra });
const roster = [student('alice', '8A', 'PC-01'), student('bob', '8B', 'PC-01'), student('carol', '8A', 'PC-02')];
const task = (id, pc, studentId, action = 'REMOVE') => ({ id, pcNumber: pc, studentId, studentName: studentId,
  action, status: 'PENDING', createdAt: '2026-09-11T00:00:00Z', academicYear: '2026-2027' });
const plan = (filter = {}, tasks = [], mode = 'FULL', ids = [], students = roster) =>
  buildSyncPlan(students, tasks, { ...scope, ...filter }, mode, new Set(ids), true);

test('PC normalization agrees with Windows including leading zeros', () => {
  for (const pc of ['1', 'PC1', 'pc_01', 'PC-001']) assert.equal(normalizePcNumber(pc), 'PC-01');
});
test('class filter on a shared PC cannot prune another class', () => {
  const result = plan({ selectedClass: '8A' });
  assert.deepEqual(result.targets.flatMap(t => t.accounts.map(a => a.studentId)), ['alice', 'carol']);
  assert.equal(result.mode, 'DELTA'); assert.equal(result.deleteMissingUsers, false);
});
test('desk filter exports only that desk with its complete roster', () => {
  const result = plan({ selectedDesk: 'PC-01' });
  assert.equal(result.targets.length, 1);
  assert.deepEqual(result.targets[0].accounts.map(a => a.studentId), ['alice', 'bob']);
  assert.equal(result.deleteMissingUsers, true);
});
test('combined class and desk is intersection', () => {
  assert.deepEqual(plan({ selectedClass: '8A', selectedDesk: 'PC-01' }).targets[0].accounts.map(a => a.studentId), ['alice']);
});
test('search is trimmed and applied to both table and payload', () => {
  assert.equal(matchesSyncScope(roster[0], { ...scope, searchQuery: ' ALI ' }), true);
  const result = plan({ searchQuery: ' ALI ' });
  assert.equal(result.targets[0].accounts.length, 1); assert.equal(result.deleteMissingUsers, false);
});
test('hidden checkbox selections cannot escape the current filter', () => {
  const result = plan({ selectedClass: '8A' }, [], 'SELECTED', ['alice', 'bob']);
  assert.deepEqual(result.targets[0].accounts.map(a => a.studentId), ['alice']);
  assert.equal(result.deleteMissingUsers, false);
});
test('move removes old assignment and adds only current PC with latest password', () => {
  const tasks = [task('old-add', 'PC-01', 'carol', 'ADD'), task('remove', 'PC-01', 'carol'),
    { ...task('new-add', 'PC-02', 'carol', 'ADD'), password: 'stale' }];
  const result = plan({}, tasks);
  assert.deepEqual(result.targets[0].removeStudentIds, ['carol']);
  assert.equal(result.targets[1].accounts[0].password, '123');
});
test('filtered move never touches old PC outside selected desk', () => {
  const result = plan({ selectedDesk: 'PC-02' }, [task('move', 'PC-01', 'carol')]);
  assert.equal(result.targets.length, 1); assert.deepEqual(result.targets[0].removeStudentIds, []);
});
test('deleted students with unknown class are excluded from class filters but removable by desk', () => {
  const tasks = [task('delete', 'PC-01', 'deleted')];
  assert.deepEqual(plan({ selectedClass: '8A' }, tasks).targets[0].removeStudentIds, []);
  assert.equal(plan({ selectedClass: '8A' }, tasks).unknownClassTasks, 1);
  assert.deepEqual(plan({ selectedDesk: 'PC-01' }, tasks).targets[0].removeStudentIds, ['deleted']);
});
test('inactive students remain class-identifiable for removal', () => {
  const students = [...roster, student('inactive', '8A', 'PC-01', { status: 'Inactive' })];
  assert.deepEqual(plan({ selectedClass: '8A' }, [task('delete', 'PC-01', 'inactive')], 'FULL', [], students).targets[0].removeStudentIds, ['inactive']);
});
test('last student removed from a PC still produces a removal-only target', () => {
  const result = plan({ selectedDesk: 'PC-03' }, [task('delete', 'PC-03', 'deleted')]);
  assert.equal(result.targets.length, 1); assert.deepEqual(result.targets[0].accounts, []);
  assert.deepEqual(result.targets[0].removeStudentIds, ['deleted']);
});
test('cancelled removal does not delete an active current assignment', () => {
  const result = plan({}, [task('old-remove', 'PC-01', 'alice')]);
  assert.deepEqual(result.targets[0].removeStudentIds, []);
  assert.deepEqual(result.targets[0].taskIds, ['old-remove']);
});
test('unassigned filter and empty selection produce no CRUD', () => {
  assert.deepEqual(plan({ selectedDesk: 'UNASSIGNED' }, [task('delete', 'PC-01', 'deleted')]).targets, []);
  assert.deepEqual(plan({}, [], 'SELECTED', []).targets, []);
});
test('invalid or incomplete selected accounts fail before exporting', () => {
  assert.throws(() => plan({}, [], 'FULL', [], [student('alice', '8A', 'PC-01', { password: '' })]));
  assert.throws(() => plan({}, [], 'FULL', [], [student('bad name', '8A', 'PC-01')]));
  assert.throws(() => plan({}, [], 'FULL', [], [student('alice', '8A', 'PC-01'), student('alice', '8A', 'PC-01')]));
});
test('unready students outside filter do not block the chosen class', () => {
  const result = plan({ selectedClass: '8A' }, [], 'FULL', [], [...roster, student('bad', '8B', 'PC-01', { password: '' })]);
  assert.equal(result.targets.length, 2);
});
test('receipts acknowledge only exact pending task IDs for correct PC, year and lab', () => {
  const tasks = [task('done', 'PC-01', 'alice'), task('newer', 'PC-01', 'alice'), task('other-pc', 'PC-02', 'carol')];
  const receipt = { version: 1, status: 'SUCCESS', labId: 'lab', academicYear: '2026-2027', payloadId: 'payload', pcNumber: 'PC-01', taskIds: ['done', 'other-pc'] };
  assert.deepEqual(receiptTaskIds(receipt, tasks, 'lab', '2026-2027'), ['done']);
  for (const patch of [{ status: 'FAILED' }, { labId: 'elsewhere' }, { academicYear: '2025' }])
    assert.deepEqual(receiptTaskIds({ ...receipt, ...patch }, tasks, 'lab', '2026-2027'), []);
});
