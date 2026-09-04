import { useState, useEffect, useMemo } from 'react';
import { 
  Download, RefreshCw, ShieldAlert, Cpu, Search, Key, Filter, Usb, 
  Settings2, CheckCircle2, AlertTriangle, X, Eye, EyeOff, Laptop
} from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, PcSyncTask, PCIssue } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { getSetupScript, getResetScript, getGlobalSyncScript, getInteractiveCommandLauncher, getSyncRunnerScript } from '../lib/scripts/labScripts';
import { supabase } from '../lib/supabase';

// Helper to encode string to Base64 using UTF-8
function utf8ToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export const normalizePcNumber = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim().toUpperCase();
  const match = trimmed.match(/^PC[-_ ]?(\d+)$/i);
  if (match) {
    return `PC-${match[1].padStart(2, '0')}`;
  }
  if (/^\d+$/.test(trimmed)) {
    return `PC-${trimmed.padStart(2, '0')}`;
  }
  return trimmed;
};

interface LabSyncSettings {
  labId: string;
  labName: string;
  usbLabel: string;
  syncToken: string;
  autoDelete: boolean;
  blockBrowserGames: boolean;
}

type SyncPreparationMode = 'FULL' | 'SELECTED' | 'PENDING';

interface SyncTarget {
  pcNumber: string;
  accounts: Array<{ studentId: string; password: string; studentName: string }>;
  removeStudentIds: string[];
}

const SETTINGS_KEY = 'ictlab_pc_sync_settings_v2';
export const DEFAULT_SYNC_TOKEN = 'ICT-SECURE-TOKEN-2026';

const createSyncSettings = (): LabSyncSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<LabSyncSettings>;
      if (parsed.labId) {
        return {
          labId: parsed.labId,
          labName: parsed.labName || 'ICT Lab',
          usbLabel: parsed.usbLabel || 'ICTADMIN',
          syncToken: parsed.syncToken || DEFAULT_SYNC_TOKEN,
          autoDelete: parsed.autoDelete ?? false,
          blockBrowserGames: parsed.blockBrowserGames ?? true,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load PC Sync settings:', error);
  }

  return {
    labId: 'ict-lab-shared',
    labName: 'ICT Lab',
    usbLabel: 'ICTADMIN',
    syncToken: DEFAULT_SYNC_TOKEN,
    autoDelete: false,
    blockBrowserGames: true,
  };
};

const PcSync = () => {
  const [activeTab, setActiveTab] = useState<'SYNC' | 'SETUP'>('SYNC');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedDesk, setSelectedDesk] = useState<string>('ALL');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PcSyncTask[]>([]);
  const [pcIssues, setPcIssues] = useState<PCIssue[]>([]);
  const [syncSettings, setSyncSettings] = useState<LabSyncSettings>(createSyncSettings);
  const { activeYear } = useAcademicYear();

  useEffect(() => {
    const loadSettingsFromDb = async () => {
      try {
        const db = await initDB();
        const record = await db.get('settings', SETTINGS_KEY);
        if (record && record.config && typeof record.config === 'object' && !Array.isArray(record.config)) {
          const cfg = record.config as Record<string, any>;
          if (cfg.labId) {
            setSyncSettings(prev => ({
              ...prev,
              labId: cfg.labId,
              labName: cfg.labName || prev.labName,
              usbLabel: cfg.usbLabel || prev.usbLabel,
              syncToken: cfg.syncToken || prev.syncToken || DEFAULT_SYNC_TOKEN,
              autoDelete: cfg.autoDelete ?? prev.autoDelete,
              blockBrowserGames: cfg.blockBrowserGames ?? prev.blockBrowserGames,
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to load PC sync settings from IndexedDB:', err);
      }
    };
    loadSettingsFromDb();
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(syncSettings));
    const persistSettings = async () => {
      try {
        const db = await initDB();
        await db.put('settings', { id: SETTINGS_KEY, config: syncSettings as any });
      } catch (err) {
        console.warn('Failed to persist PC sync settings to IndexedDB:', err);
      }
    };
    persistSettings();
  }, [syncSettings]);

  const fetchData = async () => {
    if (!activeYear) return;
    setIsLoading(true);

    try {
      const db = await initDB();
      const [studentsData, classesData, taskData, issuesData] = await Promise.all([
        db.getAll('students', activeYear),
        db.getAll('classes', activeYear),
        db.getAll('pcSyncTasks', activeYear).catch(error => {
          console.error('Failed to load pending PC Sync tasks:', error);
          return [] as PcSyncTask[];
        }),
        db.getAll('pcIssues', activeYear).catch(error => {
          console.error('Failed to load PC issues:', error);
          return [] as PCIssue[];
        }),
      ]);

      const activeStudents = studentsData.filter(student => student.status === 'Active');
      const passwordById = new Map<string, string>();
      activeStudents.forEach(student => {
        if (student.password) passwordById.set(student.id, student.password);
      });

      try {
        const { data: credentialRows, error: credentialError } = await supabase
          .from('students')
          .select('id,password')
          .eq('academic_year', activeYear)
          .eq('status', 'Active');

        if (credentialError) {
          console.warn('Failed to load PC Sync credentials from Supabase (offline?):', credentialError);
        } else if (credentialRows) {
          credentialRows.forEach((row: { id: string; password: string | null }) => {
            if (row.password) passwordById.set(row.id, row.password);
          });
        }
      } catch (credentialError) {
        console.warn('Supabase credential fetch exception:', credentialError);
      }

      setAllStudents(activeStudents.map(student => ({
        ...student,
        password: passwordById.get(student.id),
      })));
      setClasses(classesData);
      setPendingTasks(taskData.filter(task => task.status === 'PENDING'));
      setPcIssues(issuesData || []);
      setSelectedStudentIds(previous => new Set(
        [...previous].filter(id => activeStudents.some(student => student.id === id))
      ));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeYear]);

  const deskOptions = useMemo(() => Array.from(new Set(
    [
      ...allStudents.map(student => normalizePcNumber(student.pcNumber)),
      ...pendingTasks.map(task => normalizePcNumber(task.pcNumber)),
    ].filter(Boolean) as string[]
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [allStudents, pendingTasks]);

  const classNameById = useMemo(
    () => new Map(classes.map(classItem => [classItem.id, classItem.name])),
    [classes]
  );

  const filteredStudents = useMemo(() => {
    return allStudents.filter(s => {
      const normDesk = normalizePcNumber(s.pcNumber);
      const matchClass = selectedClass === 'ALL' || s.class === selectedClass;
      const matchDesk = selectedDesk === 'ALL'
        || (selectedDesk === 'UNASSIGNED' ? !normDesk : normDesk === selectedDesk);
      if (!matchClass || !matchDesk) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.englishName && s.englishName.toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      return a.studentId.localeCompare(b.studentId, undefined, { numeric: true });
    });
  }, [allStudents, searchQuery, selectedClass, selectedDesk]);

  const missingPasswordStudents = useMemo(
    () => allStudents.filter(student => !student.password),
    [allStudents]
  );

  const invalidUsernameStudents = useMemo(
    () => allStudents.filter(student => {
      const id = student.studentId.trim();
      return !id || id.length > 20 || /["/\\[\]:;|=,+*?<>@]/.test(id);
    }),
    [allStudents]
  );

  const unassignedStudents = useMemo(
    () => allStudents.filter(student => !normalizePcNumber(student.pcNumber)),
    [allStudents]
  );

  const notReadyStudentIds = useMemo(
    () => new Set([
      ...missingPasswordStudents.map(student => student.id),
      ...invalidUsernameStudents.map(student => student.id),
      ...unassignedStudents.map(student => student.id),
    ]),
    [missingPasswordStudents, invalidUsernameStudents, unassignedStudents]
  );

  const selectedStudents = useMemo(
    () => allStudents.filter(student => selectedStudentIds.has(student.id)),
    [allStudents, selectedStudentIds]
  );

  const selectableVisibleStudents = filteredStudents.filter(student => !notReadyStudentIds.has(student.id));
  const allVisibleSelected = selectableVisibleStudents.length > 0
    && selectableVisibleStudents.every(student => selectedStudentIds.has(student.id));

  const brokenPcs = useMemo(() => {
    return Array.from(new Set(
      pcIssues
        .filter(issue => issue.status !== 'Good')
        .map(issue => normalizePcNumber(issue.pcNumber))
        .filter(Boolean) as string[]
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [pcIssues]);

  const getInstallerConfig = (assignmentBatchId?: string) => ({
    version: 3,
    labId: syncSettings.labId,
    labName: syncSettings.labName.trim(),
    usbLabel: syncSettings.usbLabel.trim(),
    syncToken: syncSettings.syncToken,
    syncFolderName: 'ICTLabSync',
    brokenPcs,
    ...(assignmentBatchId ? { assignmentBatchId } : {}),
    policies: {
      blockBrowserGames: syncSettings.blockBrowserGames,
    },
  });

  const downloadTextFile = (content: string, fileName: string) => {
    const isPs1 = fileName.toLowerCase().endsWith('.ps1');
    const blobParts = isPs1 ? ['\uFEFF', content] : [content];
    const blob = new Blob(blobParts, {
      type: fileName.toLowerCase().endsWith('.cmd') ? 'application/octet-stream' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadGlobalScript = (type: 'SETUP' | 'RESET') => {
    let scriptContent = '';
    let fileName = '';

    if (type === 'SETUP') {
      if (!syncSettings.labName.trim() || !syncSettings.usbLabel.trim()) {
        alert('សូមកំណត់ឈ្មោះ Lab និងឈ្មោះ USB មុនទាញយក Installer។');
        return;
      }
      const assignmentBatchId = crypto.randomUUID();
      const setupPowerShell = getSetupScript(utf8ToBase64(JSON.stringify(getInstallerConfig(assignmentBatchId))));
      scriptContent = getInteractiveCommandLauncher(setupPowerShell, 'ICT Lab Auto PC Installer');
      fileName = '1_Install_Lab_PC_AUTO.cmd';
    } else {
      scriptContent = getInteractiveCommandLauncher(getResetScript(), 'ICT Lab Factory Reset');
      fileName = 'ResetLab_PC.cmd';
    }

    downloadTextFile(scriptContent, fileName);
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(previous => {
      const next = new Set(previous);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleVisibleStudents = () => {
    setSelectedStudentIds(previous => {
      const next = new Set(previous);
      selectableVisibleStudents.forEach(student => {
        if (allVisibleSelected) next.delete(student.id);
        else next.add(student.id);
      });
      return next;
    });
  };

  const handlePrepareSyncUsb = async (mode: SyncPreparationMode = 'FULL', isDownloadOnly = false) => {
    try {
      setIsProcessing(true);
      if (!syncSettings.labName.trim() || !syncSettings.usbLabel.trim()) {
        alert('សូមកំណត់ឈ្មោះ Lab និងឈ្មោះ USB ជាមុន។');
        return;
      }

      if (mode === 'SELECTED' && selectedStudents.length === 0) {
        alert('សូមធីកជ្រើសសិស្សយ៉ាងហោចណាស់ម្នាក់។');
        return;
      }

      if (mode === 'FULL' && selectedDesk === 'UNASSIGNED') {
        alert('សិស្សដែលមិនទាន់មានតុ មិនអាច Sync ទៅ PC បានទេ។');
        return;
      }

      // Always sync all students with an assigned PC to ensure every lab PC has full roster
      const assignedStudents = allStudents.filter(student => !!normalizePcNumber(student.pcNumber));
      const accountStudents = mode === 'SELECTED' ? selectedStudents : assignedStudents;
      const isTargetedSync = mode === 'SELECTED';

      const scopedTasks = mode === 'PENDING'
        ? pendingTasks
        : mode === 'FULL'
          ? pendingTasks.filter(task => task.action === 'REMOVE')
          : [];
      scopedTasks.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

      if (accountStudents.length === 0 && scopedTasks.length === 0) {
        alert('មិនមានទិន្នន័យសិស្សដែលមានលេខតុ/កុំព្យូទ័រសម្រាប់ Sync ទេ។');
        return;
      }

      const targetMap = new Map<string, { accounts: Map<string, SyncTarget['accounts'][number]>; removeIds: Set<string> }>();
      const getTarget = (pcNumber: string) => {
        if (!targetMap.has(pcNumber)) {
          targetMap.set(pcNumber, { accounts: new Map(), removeIds: new Set() });
        }
        return targetMap.get(pcNumber)!;
      };

      const addStudentAccount = (student: Student, overridePcNumber?: string, overridePassword?: string | null) => {
        const rawPcNumber = (overridePcNumber || student.pcNumber || '').trim();
        const pcNumber = normalizePcNumber(rawPcNumber);
        const password = overridePassword || student.password || '';
        const studentId = student.studentId.trim();
        const englishName = (student.englishName || '').trim();
        const khmerName = (student.name || '').trim();
        const displayName = englishName || khmerName || studentId;

        if (!pcNumber) throw new Error(`${displayName} មិនទាន់មានលេខតុ/PC។`);
        if (!password) throw new Error(`${displayName} មិនទាន់មាន Password។`);
        if (!studentId || studentId.length > 20 || /["/\\[\]:;|=,+*?<>@\s]/.test(studentId)) {
          throw new Error(`Student ID "${studentId}" មិនអាចប្រើជា Windows Username បាន។ ហាមមានដកឃ្លា និងសញ្ញាពិសេស។`);
        }
        const target = getTarget(pcNumber);
        target.removeIds.delete(studentId);
        target.accounts.set(studentId, {
          studentId,
          password,
          studentName: displayName,
        });
      };

      scopedTasks.forEach(task => {
        const normPcNumber = normalizePcNumber(task.pcNumber);
        const target = getTarget(normPcNumber);
        if (task.action === 'REMOVE') {
          target.removeIds.add(task.studentId.trim());
          target.accounts.delete(task.studentId.trim());
          return;
        }

        const currentStudent = allStudents.find(student => student.studentId === task.studentId);
        if (currentStudent) {
          addStudentAccount(currentStudent, normPcNumber, task.password);
        } else if (task.password) {
          const studentId = task.studentId.trim();
          if (!studentId || studentId.length > 20 || /["/\\[\]:;|=,+*?<>@\s]/.test(studentId)) {
            throw new Error(`Student ID "${studentId}" មិនអាចប្រើជា Windows Username បានទេ។ ហាមមានដកឃ្លា និងសញ្ញាពិសេស។`);
          }
          target.accounts.set(studentId, {
            studentId,
            password: task.password,
            studentName: (task.studentName || studentId).trim(),
          });
        }
      });

      accountStudents.forEach(student => addStudentAccount(student));

      const targets: SyncTarget[] = [...targetMap.entries()]
        .map(([pcNumber, target]) => ({
          pcNumber,
          accounts: [...target.accounts.values()],
          removeStudentIds: [...target.removeIds],
        }))
        .filter(target => target.accounts.length > 0 || target.removeStudentIds.length > 0)
        .sort((a, b) => a.pcNumber.localeCompare(b.pcNumber, undefined, { numeric: true }));

      if (targets.length === 0) {
        alert('មិនមានទិន្នន័យត្រឹមត្រូវសម្រាប់បង្កើត USB Sync ទេ។');
        return;
      }

      const payload = {
        version: 3,
        payloadId: crypto.randomUUID(),
        labId: syncSettings.labId,
        academicYear: activeYear,
        generatedAt: new Date().toISOString(),
        mode: isTargetedSync ? 'DELTA' : 'FULL',
        deleteMissingUsers: !isTargetedSync && syncSettings.autoDelete,
        targets,
      };

      const syncScript = getGlobalSyncScript(
        utf8ToBase64(JSON.stringify(payload)),
        syncSettings.syncToken
      );

      // Direct download or browser picker
      if (isDownloadOnly || !('showDirectoryPicker' in window)) {
        downloadTextFile(syncScript, 'GlobalSync.ps1');
        downloadTextFile(getSyncRunnerScript(), '2_Sync_PC_Now.cmd');
        if (scopedTasks.length > 0) {
          const db = await initDB();
          for (const task of scopedTasks) {
            await db.delete('pcSyncTasks', task.id);
          }
          setPendingTasks(prev => prev.filter(t => !scopedTasks.find(s => s.id === t.id)));
        }
        alert(
          (isTargetedSync 
            ? `ទាញយកឯកសារ Sync សម្រាប់សិស្ស ${accountStudents.length} នាក់ជោគជ័យ!\n\n` 
            : `ទាញយកឯកសារ Sync គ្រប់ថ្នាក់ទាំងអស់ (${accountStudents.length} នាក់) ជោគជ័យ!\n\n`) +
          '• សូមចម្លង GlobalSync.ps1 ដាក់ក្នុង Folder "ICTLabSync" លើ USB\n' +
          '• សូមចម្លង 2_Sync_PC_Now.cmd ដាក់នៅខាងក្រៅ USB (Root) ដើម្បីងាយស្រួល Double-click មើលដំណើរការលើ PC!'
        );
        return;
      }

      // 1. Pick USB Root Directory
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      
      // 2. Write File directly to ICTLabSync folder
      let folderHandle = dirHandle;
      if (dirHandle.name !== 'ICTLabSync') {
        folderHandle = await dirHandle.getDirectoryHandle('ICTLabSync', { create: true });
      }
      const fileHandle = await folderHandle.getFileHandle('GlobalSync.ps1', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write('\uFEFF' + syncScript);
      await writable.close();

      // 3. Write 2_Sync_PC_Now.cmd to USB root
      if (dirHandle.name !== 'ICTLabSync') {
        try {
          const runnerHandle = await dirHandle.getFileHandle('2_Sync_PC_Now.cmd', { create: true });
          const runnerWritable = await runnerHandle.createWritable();
          await runnerWritable.write(getSyncRunnerScript());
          await runnerWritable.close();
        } catch (runnerErr) {
          console.warn('Could not write 2_Sync_PC_Now.cmd to USB root:', runnerErr);
        }
      }

      // 4. Clear pending tasks
      if (scopedTasks.length > 0) {
        const db = await initDB();
        for (const task of scopedTasks) {
          await db.delete('pcSyncTasks', task.id);
        }
        setPendingTasks(prev => prev.filter(t => !scopedTasks.find(s => s.id === t.id)));
      }

      const summarySuccess = isTargetedSync
        ? `បញ្ជូនទិន្នន័យចូល USB ដោយជោគជ័យ! (សិស្ស ${accountStudents.length} នាក់ លើកុំព្យូទ័រ ${targets.map(t => t.pcNumber).join(', ')})`
        : `បញ្ជូនទិន្នន័យសិស្សគ្រប់ថ្នាក់ (${accountStudents.length} នាក់) ចូល USB ដោយជោគជ័យ!`;
      alert(summarySuccess);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('USB preparation failed:', error);
      alert(error?.message || 'មានបញ្ហាក្នុងការបង្កើត Auto Sync USB');
    } finally {
      setIsProcessing(false);
    }
  };

  const queuePasswordSync = async (db: any, student: Student, password: string) => {
    const normPc = normalizePcNumber(student.pcNumber);
    if (!normPc || !activeYear) return;
    const task: PcSyncTask = {
      id: crypto.randomUUID(),
      pcNumber: normPc,
      studentId: student.studentId,
      studentName: (student.englishName?.trim() || student.name?.trim() || student.studentId).trim(),
      action: 'UPDATE_PASSWORD',
      password,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      academicYear: activeYear,
    };
    try {
      await db.put('pcSyncTasks', task);
    } catch (error) {
      console.warn('Failed to queue password sync:', error);
    }
  };

  const handleGenerateMissingPasswords = async () => {
    if (missingPasswordStudents.length === 0) return;
    if (!window.confirm(`បង្កើត Password ស្វ័យប្រវត្តិសម្រាប់សិស្សទាំង ${missingPasswordStudents.length} នាក់?`)) return;

    try {
      setIsProcessing(true);
      const db = await initDB();
      const existing = new Set(allStudents.map(student => student.password).filter(Boolean));
      const updates: Student[] = [];

      for (const student of missingPasswordStudents) {
        let password = '';
        let attempts = 0;
        do {
          const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
          password = String(100 + (randomValue % 900));
          attempts++;
          if (attempts > 2000) break;
        } while (existing.has(password));
        existing.add(password);
        updates.push({ ...student, password });
      }

      await db.putMany('students', updates);
      await Promise.all(updates.map(student => queuePasswordSync(db, student, student.password!)));
      const passwordById = new Map(updates.map(student => [student.id, student.password]));
      setAllStudents(previous => previous.map(student => (
        passwordById.has(student.id) ? { ...student, password: passwordById.get(student.id) } : student
      )));
      await fetchData();
      alert(`បង្កើតលេខសម្ងាត់ជូនសិស្សចំនួន ${updates.length} នាក់ជោគជ័យ!`);
    } catch (error) {
      console.error('Bulk password generation failed:', error);
      alert('បរាជ័យក្នុងការបង្កើតលេខសម្ងាត់');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 font-sans animate-in fade-in duration-200">
      
      {/* 1. Top Header Banner - Clean Ribbon */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <Usb size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight font-khmer">
                ធ្វើសមកាលកម្ម PC និង USB
              </h1>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white/15 text-blue-100">
                USB: {syncSettings.usbLabel}
              </span>
            </div>
            <p className="text-xs text-blue-100/80 font-khmer mt-0.5">
              គ្រប់គ្រងគណនី និងធ្វើសមកាលកម្ម Windows PC ក្នុងបន្ទប់ Lab
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-2xs backdrop-blur-xs cursor-pointer font-khmer"
          >
            <Settings2 size={15} />
            <span>ការកំណត់ USB</span>
          </button>
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="ទាញយកទិន្នន័យឡើងវិញ"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin text-blue-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Metric Summary Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-khmer">កុំព្យូទ័រ / តុសរុប</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-slate-800 font-mono">{deskOptions.length}</strong>
            <span className="text-xs font-medium text-slate-500 font-khmer">គ្រឿង</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-khmer">គណនីរួចរាល់</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-emerald-600 font-mono">
              {allStudents.length - notReadyStudentIds.size}
            </strong>
            <span className="text-xs font-medium text-slate-500 font-khmer">នាក់</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-khmer">រង់ចាំ Sync ទៅ PC</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <RefreshCw size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-indigo-600 font-mono">{pendingTasks.length}</strong>
            <span className="text-xs font-medium text-slate-500 font-khmer">ការផ្លាស់ប្តូរ</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
          missingPasswordStudents.length > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider font-khmer ${
              missingPasswordStudents.length > 0 ? 'text-amber-800' : 'text-slate-500'
            }`}>ខ្វះលេខសម្ងាត់</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              missingPasswordStudents.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Key size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className={`text-2xl font-bold font-mono ${
              missingPasswordStudents.length > 0 ? 'text-amber-700' : 'text-slate-400'
            }`}>
              {missingPasswordStudents.length}
            </strong>
            <span className="text-xs font-medium text-slate-500 font-khmer">នាក់</span>
          </div>
        </div>
      </section>

      {/* 3. Modern Workflow Tabs */}
      <div className="flex p-1 bg-slate-100/90 rounded-xl w-fit border border-slate-200/80">
        <button
          type="button"
          onClick={() => setActiveTab('SYNC')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-khmer transition-all cursor-pointer ${
            activeTab === 'SYNC'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Usb size={15} />
          <span>ធ្វើបច្ចុប្បន្នភាព USB (ប្រើប្រចាំថ្ងៃ)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SETUP')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-khmer transition-all cursor-pointer ${
            activeTab === 'SETUP'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Laptop size={15} />
          <span>ដំឡើងម៉ាស៊ីន PC លើកដំបូង</span>
        </button>
      </div>

      {/* 4. TAB 1: SYNC USB (CLEAN ACTION CARD - NO NOTES/TUTORIAL CARDS) */}
      {activeTab === 'SYNC' && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Usb size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 font-khmer">
                  Sync ទិន្នន័យចូល USB
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 font-khmer">
                  <CheckCircle2 size={12} /> {allStudents.length - notReadyStudentIds.size} នាក់រួចរាល់
                </span>
              </div>
              <p className="text-xs text-slate-500 font-khmer mt-0.5">
                ទាញយកទិន្នន័យគណនីសិស្សទាំងអស់ដាក់ក្នុង USB សម្រាប់ធ្វើបច្ចុប្បន្នភាពលើកុំព្យូទ័រ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handlePrepareSyncUsb('FULL', false)}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer font-khmer"
            >
              <Usb size={16} />
              <span>
                {isProcessing 
                  ? 'កំពុងដំណើរការ...' 
                  : `ទាញយកដាក់ USB (${allStudents.filter(s => !!normalizePcNumber(s.pcNumber)).length} នាក់)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handlePrepareSyncUsb('FULL', true)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer font-khmer"
              title="ទាញយក file GlobalSync.ps1 & 2_Sync_PC_Now.cmd សម្រាប់ចម្លងដោយដៃ"
            >
              <Download size={14} />
              <span>ទាញយក File Sync</span>
            </button>
          </div>
        </section>
      )}

      {/* 5. TAB 2: SETUP PC (CLEAN SETUP CARD - NO LONG TUTORIAL NOTES) */}
      {activeTab === 'SETUP' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Laptop size={18} />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 font-khmer">
                    ដំឡើងប្រព័ន្ធលើ PC លើកដំបូង (Auto Setup)
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200 font-khmer">
                  អនុវត្តម្តងគត់
                </span>
              </div>

              {brokenPcs.length > 0 && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium font-khmer">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <span>ប្រព័ន្ធនឹងរំលង PC ខូចស្វ័យប្រវត្តិ៖ <strong>{brokenPcs.join(', ')}</strong></span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleDownloadGlobalScript('SETUP')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-[0.98] cursor-pointer font-khmer"
              >
                <Download size={15} />
                <span>ទាញយក Installer (1_Install_Lab_PC_AUTO.cmd)</span>
              </button>
            </div>
          </div>

          <div className="bg-rose-50/40 rounded-2xl border border-rose-200/80 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm mb-1 font-khmer">
                <ShieldAlert size={18} />
                <span>Factory Reset ម៉ាស៊ីន</span>
              </div>
              <p className="text-xs text-rose-700/80 font-khmer">
                ដក Scheduled Tasks និងគណនីសិស្សទាំងអស់ចេញពី PC វិញ
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadGlobalScript('RESET')}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs shadow-xs transition active:scale-[0.98] cursor-pointer font-khmer"
            >
              <Download size={14} />
              <span>ទាញយក ResetLab_PC.cmd</span>
            </button>
          </div>
        </section>
      )}

      {/* 6. Roster Table Section */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Toolbar Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-800 font-khmer">
              បញ្ជីគណនីសិស្សតាមកុំព្យូទ័រ
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold font-mono">
              {filteredStudents.length} នាក់
            </span>
          </div>

          <div className="flex items-center gap-2">
            {missingPasswordStudents.length > 0 && (
              <button
                type="button"
                onClick={handleGenerateMissingPasswords}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition cursor-pointer font-khmer disabled:opacity-50"
              >
                <Key size={13} />
                <span>បង្កើត Password ស្វ័យប្រវត្តិ ({missingPasswordStudents.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer font-khmer"
            >
              {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showPasswords ? 'លាក់លេខសម្ងាត់' : 'បង្ហាញលេខសម្ងាត់'}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="ស្វែងរកតាមឈ្មោះ ឬ Student ID..."
              className="w-full bg-white rounded-xl border border-slate-200 py-2 pl-9 pr-8 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-khmer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Cpu size={15} />
            </div>
            <select
              value={selectedDesk}
              onChange={(e) => {
                setSelectedDesk(e.target.value);
                setSelectedStudentIds(new Set());
              }}
              className="w-full bg-white appearance-none rounded-xl border border-slate-200 py-2 pl-9 pr-8 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition cursor-pointer font-khmer"
            >
              <option value="ALL">គ្រប់តុ / គ្រប់ PC</option>
              {deskOptions.map(pc => (
                <option key={pc} value={pc}>{pc}</option>
              ))}
              <option value="UNASSIGNED">មិនទាន់កំណត់តុ ({unassignedStudents.length})</option>
            </select>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Filter size={15} />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white appearance-none rounded-xl border border-slate-200 py-2 pl-9 pr-8 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition cursor-pointer font-khmer"
            >
              <option value="ALL">គ្រប់ថ្នាក់ទាំងអស់</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-select Action Bar */}
        {selectedStudentIds.size > 0 && (
          <div className="px-5 py-2.5 bg-blue-50/90 border-b border-blue-100 flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 font-khmer">
              បានជ្រើសរើសសិស្សចំនួន {selectedStudentIds.size} នាក់
            </span>
            <button
              type="button"
              onClick={() => handlePrepareSyncUsb('SELECTED')}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs cursor-pointer font-khmer"
            >
              Sync តែសិស្សដែលបានជ្រើស ({selectedStudentIds.size})
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleStudents}
                    className="rounded border-slate-300 cursor-pointer text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 font-khmer">កុំព្យូទ័រ (PC)</th>
                <th className="px-4 py-3 font-khmer">អត្តលេខ (Windows Username)</th>
                <th className="px-4 py-3 font-khmer">ឈ្មោះសិស្ស</th>
                <th className="px-4 py-3 font-khmer">ភេទ</th>
                <th className="px-4 py-3 font-khmer">ថ្នាក់រៀន</th>
                <th className="px-4 py-3 font-khmer">លេខសម្ងាត់</th>
                <th className="px-4 py-3 font-khmer text-right">ស្ថានភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.map((student) => {
                const normDesk = normalizePcNumber(student.pcNumber);
                const isSelected = selectedStudentIds.has(student.id);
                const isReady = !notReadyStudentIds.has(student.id);

                return (
                  <tr 
                    key={student.id} 
                    className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStudentSelection(student.id)}
                        disabled={!isReady}
                        className="rounded border-slate-300 cursor-pointer text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                      />
                    </td>

                    <td className="px-4 py-3 font-mono">
                      {normDesk ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 text-xs">
                          {normDesk}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-khmer text-[11px]">មិនទាន់មានតុ</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {student.studentId}
                    </td>

                    <td className="px-4 py-3 min-w-[180px]">
                      <div className="font-bold text-slate-800 font-khmer text-sm leading-normal">
                        {student.name}
                      </div>
                      {student.englishName && (
                        <div className="text-[11px] text-indigo-600 font-sans font-medium leading-tight">
                          {student.englishName}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600 font-khmer">
                      {student.gender === 'F' ? 'ស្រី' : 'ប្រុស'}
                    </td>

                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {classNameById.get(student.class) || student.class}
                    </td>

                    <td className="px-4 py-3 font-mono">
                      {student.password ? (
                        showPasswords ? (
                          <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded">
                            {student.password}
                          </span>
                        ) : (
                          <span className="text-slate-400 tracking-widest font-mono">
                            ••••••••
                          </span>
                        )
                      ) : (
                        <span className="text-amber-600 font-bold text-[11px] font-khmer">ខ្វះលេខសម្ងាត់</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isReady ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 font-khmer">
                          <CheckCircle2 size={11} /> រួចរាល់
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200 font-khmer">
                          <AlertTriangle size={11} /> ត្រូវកែសម្រួល
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-khmer text-sm">
                    មិនមានទិន្នន័យសិស្សត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ។
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Advanced Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Settings2 size={18} className="text-blue-600" />
                <span className="font-khmer">ការកំណត់ USB & បន្ទប់ Lab</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  ឈ្មោះបន្ទប់ Lab
                </label>
                <input
                  type="text"
                  value={syncSettings.labName}
                  onChange={(e) => setSyncSettings(prev => ({ ...prev, labName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="ICT Lab"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  ឈ្មោះសម្គាល់ USB (អតិបរមា ១១ តួ)
                </label>
                <input
                  type="text"
                  value={syncSettings.usbLabel}
                  onChange={(e) => setSyncSettings(prev => ({ 
                    ...prev, 
                    usbLabel: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 11) 
                  }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="ICTADMIN"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  Security Token សម្ងាត់របស់ Lab
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={syncSettings.syncToken}
                    onChange={(e) => setSyncSettings(prev => ({ ...prev, syncToken: e.target.value.trim() }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="ICT-SECURE-TOKEN-2026"
                  />
                  <button
                    type="button"
                    onClick={() => setSyncSettings(prev => ({ ...prev, syncToken: DEFAULT_SYNC_TOKEN }))}
                    className="px-3 py-2 text-xs font-bold font-khmer rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer"
                    title="កំណត់មកកាន់តម្លៃលំនាំដើម"
                  >
                    Default
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={syncSettings.blockBrowserGames}
                    onChange={(e) => setSyncSettings(prev => ({ ...prev, blockBrowserGames: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 font-khmer">
                      បិទហ្គេម Offline លើ PC (Windows Games & Browser Games)
                    </span>
                    <span className="block text-[11px] text-slate-500 font-khmer mt-0.5">
                      លុប និងចាក់សោរបិទហ្គេមបៀរ Windows និងហ្គេម Offline មិនឱ្យសិស្សលួចលេងក្នុងម៉ោងរៀន។
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={syncSettings.autoDelete}
                    onChange={(e) => setSyncSettings(prev => ({ ...prev, autoDelete: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 font-khmer">
                      លុបគណនីសិស្សដែលឈប់ដោយស្វ័យប្រវត្តិ
                    </span>
                    <span className="block text-[11px] text-slate-500 font-khmer mt-0.5">
                      លុបតែគណនីសិស្សដែលលែងមានឈ្មោះក្នុងប្រព័ន្ធប៉ុណ្ណោះ។
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs font-khmer cursor-pointer"
              >
                រួចរាល់
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcSync;

