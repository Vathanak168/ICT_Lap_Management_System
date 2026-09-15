import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSetupScript, getResetScript, getGlobalSyncScript, getInteractiveCommandLauncher, getSyncRunnerScript } from '../src/lib/scripts/labScripts.ts';

// Refresh an existing exported package without fetching or changing its roster.
// Usage: node scripts/refresh-pc-sync-package.mjs dist_usb_pc1
if (!process.argv[2]) throw new Error('Supply an existing PC Sync package directory.');
const directory = path.resolve(process.argv[2]);
const syncPath = path.join(directory, 'ICTLabSync', 'GlobalSync.ps1');
const installerPath = path.join(directory, '1_Install_Lab_PC_AUTO.cmd');
const oldSync = fs.readFileSync(syncPath, 'utf8');
const oldInstaller = fs.readFileSync(installerPath, 'utf8');
function embeddedJson(text, requiredProperty) {
  for (const match of text.matchAll(/FromBase64String\("([A-Za-z0-9+/=]+)"\)/g)) {
    try { const value = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')); if (value[requiredProperty]) return value; } catch { }
  }
  throw new Error(`Cannot find ${requiredProperty} in the existing package.`);
}
const payload = embeddedJson(oldSync, 'targets');
const config = embeddedJson(oldInstaller, 'labId');
// Preserve legacy installer labId and payload metadata; configured tokens must match.
const token = oldSync.replace(/^\uFEFF/, '').split(/\r?\n/)[0].replace(/^# ICTLAB-AUTH:/, '').trim();
if (token !== config.syncToken) throw new Error('Package installer and sync token differ. Re-export from PC Sync.');
const originalTargets = JSON.stringify(payload.targets);
payload.payloadId = randomUUID();
payload.generatedAt = new Date().toISOString();
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64');
const sync = getGlobalSyncScript(encode(payload), token);
const installer = getInteractiveCommandLauncher(getSetupScript(encode(config)), 'ICT Lab Auto PC Installer');
if (JSON.stringify(embeddedJson(sync, 'targets').targets) !== originalTargets) throw new Error('Roster changed during regeneration.');
fs.writeFileSync(syncPath, '\uFEFF' + sync, 'utf8');
fs.writeFileSync(installerPath, installer, 'utf8');
fs.writeFileSync(path.join(directory, '2_Sync_PC_Now.cmd'), getSyncRunnerScript(), 'utf8');
const resetPath = path.join(directory, 'ResetLab_PC.cmd');
if (fs.existsSync(resetPath)) {
  fs.writeFileSync(resetPath, getInteractiveCommandLauncher(getResetScript(), 'ICT Lab Reset'), 'utf8');
}
const versionPath = path.join(directory, 'ICTLabSync', 'version.json');
if (fs.existsSync(versionPath)) {
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8').replace(/^\uFEFF/, ''));
  fs.writeFileSync(versionPath, JSON.stringify({ ...version, updatedAt: payload.generatedAt, pcCount: payload.targets.length }, null, 2));
}
console.log(`Refreshed ${path.basename(directory)}: ${payload.targets.length} target PCs; roster and installer configuration preserved.`);
