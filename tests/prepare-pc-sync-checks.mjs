import fs from 'node:fs';
import path from 'node:path';
import { getSetupScript, getGlobalSyncScript, getSyncRunnerScript } from '../src/lib/scripts/labScripts.ts';

const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: true });
const encode = object => Buffer.from(JSON.stringify(object)).toString('base64');
const config = { version: 3, labId: 'test-lab', labName: 'Test', syncToken: 'test-token', usbLabel: 'ICTADMIN', syncFolderName: 'ICTLabSync', policies: { blockBrowserGames: false }, brokenPcs: [] };
const setup = getSetupScript(encode(config));
const runner = getSyncRunnerScript();
const embedded = runner.slice(runner.lastIndexOf('#<ICTLAB_POWERSHELL>') + '#<ICTLAB_POWERSHELL>'.length);
const listener = setup.match(/\$ListenerCode = @'\r?\n([\s\S]*?)\r?\n'@/)[1];
for (const [name, script] of Object.entries({ setup, runner: embedded, listener })) fs.writeFileSync(path.join(out, name + '.ps1'), '\uFEFF' + script);
const base = { version: 3, payloadId: '0b157d46-b0b5-42cf-a5fb-695bd3153749', labId: 'test-lab', academicYear: '2026-2027', mode: 'DELTA', deleteMissingUsers: false,
  targets: [{ pcNumber: 'PC-01', accounts: [{ studentId: 'newuser', studentName: 'Test សិស្ស', password: '123' }, { studentId: 'existing', studentName: 'Updated', password: '456' }], removeStudentIds: ['removed'], taskIds: ['task-1'] }] };
const scenarios = {
  success: base,
  noWork: { ...base, targets: [{ ...base.targets[0], pcNumber: 'PC-02' }] },
  wrongLab: { ...base, labId: 'another-lab' },
  wrongToken: base,
  unmanaged: { ...base, targets: [{ ...base.targets[0], accounts: [{ studentId: 'admin', studentName: 'Admin', password: '123' }], removeStudentIds: [] }] },
  removeOnly: { ...base, targets: [{ ...base.targets[0], accounts: [], removeStudentIds: ['removed'] }] },
  full: { ...base, mode: 'FULL', deleteMissingUsers: true },
  memberFailure: base,
};
for (const [name,payload] of Object.entries(scenarios)) fs.writeFileSync(path.join(out, name + '.ps1'), '\uFEFF' + getGlobalSyncScript(encode(payload), name === 'wrongToken' ? 'wrong-token' : 'test-token'));
console.log(`Prepared ${Object.keys(scenarios).length + 3} PowerShell syntax fixtures in ${out}`);
