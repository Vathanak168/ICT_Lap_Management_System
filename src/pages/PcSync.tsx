import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, RefreshCw, ShieldAlert, Cpu, Search, Key, Filter, Usb, 
  Settings2, CheckCircle2, AlertTriangle, X, Eye, EyeOff, Laptop,
  Edit2, Trash2, Plus, ListTodo, UserX, Check, Clock
} from 'lucide-react';
import { initDB, queuePcSyncTask } from '../store/db';
import type { Student, ClassRecord, PcSyncTask, PCIssue } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { getSetupScript, getResetScript, getGlobalSyncScript, getInteractiveCommandLauncher, getSyncRunnerScript } from '../lib/scripts/labScripts';
import { supabase } from '../lib/supabase';
import { compareKhmer, compareStudentsByKhmerName } from '../utils/khmerSort';
import { buildSyncPlan, matchesSyncScope, normalizePcNumber, receiptTaskIds } from '../lib/pcSyncPlan';
export { normalizePcNumber } from '../lib/pcSyncPlan';

// Helper to encode string to Base64 using UTF-8
function utf8ToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

interface LabSyncSettings {
  labId: string;
  labName: string;
  usbLabel: string;
  syncToken: string;
  autoDelete: boolean;
  blockBrowserGames: boolean;
}

type SyncPreparationMode = 'FULL' | 'SELECTED' | 'PENDING';

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
  const [activeTab, setActiveTab] = useState<'SYNC' | 'TASKS' | 'SETUP'>('SYNC');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedDesk, setSelectedDesk] = useState<string>('ALL');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [allTasks, setAllTasks] = useState<PcSyncTask[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PcSyncTask[]>([]);
  const [pcIssues, setPcIssues] = useState<PCIssue[]>([]);
  const [syncSettings, setSyncSettings] = useState<LabSyncSettings>(createSyncSettings);
  const { activeYear } = useAcademicYear();

  // Modern Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Tasks CRUD Filter, Multi-select Batch & Modal States
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [taskActionFilter, setTaskActionFilter] = useState<'ALL' | 'ADD' | 'REMOVE' | 'UPDATE_PASSWORD'>('ALL');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PcSyncTask | null>(null);
  const [taskForm, setTaskForm] = useState<{
    pcNumber: string;
    studentId: string;
    studentName: string;
    action: 'ADD' | 'REMOVE' | 'UPDATE_PASSWORD';
    password: string;
    status: 'PENDING' | 'COMPLETED';
  }>({
    pcNumber: 'PC-01',
    studentId: '',
    studentName: '',
    action: 'ADD',
    password: '',
    status: 'PENDING',
  });

  // Student PC Assignment & Password Modal State (CRUD)
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editPcNumber, setEditPcNumber] = useState('');
  const [editPassword, setEditPassword] = useState('');

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

      setRosterStudents(studentsData);
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
      setClasses([...classesData].sort((a, b) => compareKhmer(a.name, b.name) || compareKhmer(a.shift, b.shift)));
      setAllTasks(taskData || []);
      setPendingTasks((taskData || []).filter(task => task.status === 'PENDING'));
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

  const standardPcs = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => `PC-${String(i + 1).padStart(2, '0')}`);
  }, []);

  const deskOptions = useMemo(() => Array.from(new Set(
    [
      ...allStudents.map(student => normalizePcNumber(student.pcNumber)),
      ...allTasks.map(task => normalizePcNumber(task.pcNumber)),
    ].filter(Boolean) as string[]
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [allStudents, allTasks]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      if (taskStatusFilter !== 'ALL' && task.status !== taskStatusFilter) return false;
      if (taskActionFilter !== 'ALL' && task.action !== taskActionFilter) return false;
      if (taskSearchQuery.trim()) {
        const q = taskSearchQuery.trim().toLowerCase();
        const matchPc = (task.pcNumber || '').toLowerCase().includes(q);
        const matchStudent = (task.studentId || '').toLowerCase().includes(q) || (task.studentName || '').toLowerCase().includes(q);
        if (!matchPc && !matchStudent) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allTasks, taskStatusFilter, taskActionFilter, taskSearchQuery]);

  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setTaskForm({
      pcNumber: deskOptions[0] || 'PC-01',
      studentId: '',
      studentName: '',
      action: 'ADD',
      password: '',
      status: 'PENDING',
    });
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: PcSyncTask) => {
    setEditingTask(task);
    setTaskForm({
      pcNumber: task.pcNumber,
      studentId: task.studentId,
      studentName: task.studentName,
      action: task.action,
      password: task.password || '',
      status: task.status,
    });
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYear) return;
    if (!taskForm.pcNumber.trim() || !taskForm.studentId.trim() || !taskForm.studentName.trim()) {
      showToast('error', 'សូមបំពេញលេខ PC, អត្តលេខសិស្ស និងឈ្មោះសិស្សឱ្យបានពេញលេញ។');
      return;
    }
    try {
      setIsProcessing(true);
      const db = await initDB();
      const normPc = normalizePcNumber(taskForm.pcNumber.trim());
      const studentIdTrimmed = taskForm.studentId.trim();
      const studentNameTrimmed = taskForm.studentName.trim();
      const passwordTrimmed = taskForm.password.trim();

      const taskRecord: PcSyncTask = {
        id: editingTask ? editingTask.id : crypto.randomUUID(),
        pcNumber: normPc,
        studentId: studentIdTrimmed,
        studentName: studentNameTrimmed,
        action: taskForm.action,
        password: passwordTrimmed || null,
        status: taskForm.status,
        createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
        academicYear: activeYear,
      };
      await db.put('pcSyncTasks', taskRecord);

      // Auto-sync with Student record if studentId matches
      const matchedStudent = allStudents.find(
        s => s.studentId.trim().toLowerCase() === studentIdTrimmed.toLowerCase()
      );
      if (matchedStudent) {
        let studentChanged = false;
        const updatedStudent = { ...matchedStudent };
        if (taskForm.action === 'ADD' && updatedStudent.pcNumber !== normPc) {
          updatedStudent.pcNumber = normPc;
          if (passwordTrimmed) updatedStudent.password = passwordTrimmed;
          studentChanged = true;
        } else if (taskForm.action === 'UPDATE_PASSWORD' && passwordTrimmed && updatedStudent.password !== passwordTrimmed) {
          updatedStudent.password = passwordTrimmed;
          studentChanged = true;
        } else if (taskForm.action === 'REMOVE' && updatedStudent.pcNumber === normPc) {
          updatedStudent.pcNumber = undefined;
          studentChanged = true;
        }

        if (studentChanged) {
          await db.put('students', updatedStudent);
        }
      }

      setIsTaskModalOpen(false);
      setEditingTask(null);
      await fetchData();
      showToast('success', editingTask ? 'បានកែសម្រួលភារកិច្ច Sync ជោគជ័យ' : 'បានបង្កើតភារកិច្ច Sync ថ្មីជោគជ័យ');
    } catch (err: any) {
      console.error('Failed to save task:', err);
      showToast('error', 'បរាជ័យក្នុងការរក្សាទុក Task: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('តើអ្នកប្រាកដជាចង់លុបភារកិច្ច Sync នេះមែនទេ?')) return;
    try {
      setIsProcessing(true);
      const db = await initDB();
      await db.delete('pcSyncTasks', taskId);
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      await fetchData();
      showToast('success', 'បានលុបភារកិច្ច Sync ដោយជោគជ័យ');
    } catch (err: any) {
      console.error('Failed to delete task:', err);
      showToast('error', 'បរាជ័យក្នុងការលុប Task: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleTaskStatus = async (task: PcSyncTask) => {
    try {
      setIsProcessing(true);
      const db = await initDB();
      const nextStatus = task.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
      await db.put('pcSyncTasks', { ...task, status: nextStatus });
      await fetchData();
      showToast('success', nextStatus === 'COMPLETED' ? 'បានប្តូរស្ថានភាពជា "បានជោគជ័យ"' : 'បានប្តូរស្ថានភាពជា "រង់ចាំ Sync"');
    } catch (err: any) {
      console.error('Failed to update task status:', err);
      showToast('error', 'បរាជ័យក្នុងការកែប្រែស្ថានភាព Task');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearCompletedTasks = async () => {
    const completed = allTasks.filter(t => t.status === 'COMPLETED');
    if (completed.length === 0) {
      showToast('info', 'មិនមាន Task ដែលរួចរាល់ (Completed) សម្រាប់សម្អាតទេ។');
      return;
    }
    if (!window.confirm(`តើអ្នកចង់សម្អាត Task ដែលបានរួចរាល់ទាំង ${completed.length} នេះចេញពីប្រព័ន្ធមែនទេ?`)) return;
    try {
      setIsProcessing(true);
      const db = await initDB();
      await db.deleteMany('pcSyncTasks', completed.map(t => t.id));
      setSelectedTaskIds(new Set());
      await fetchData();
      showToast('success', `បានសម្អាត Tasks រួចរាល់ចំនួន ${completed.length} ជោគជ័យ`);
    } catch (err: any) {
      console.error('Failed to clear completed tasks:', err);
      showToast('error', 'បរាជ័យក្នុងការសម្អាត Tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch Task Actions
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAllFilteredTasks = () => {
    if (selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleBatchSetStatus = async (status: 'PENDING' | 'COMPLETED') => {
    if (selectedTaskIds.size === 0) return;
    try {
      setIsProcessing(true);
      const db = await initDB();
      const tasksToUpdate = allTasks.filter(t => selectedTaskIds.has(t.id));
      const updated = tasksToUpdate.map(t => ({ ...t, status }));
      await db.putMany('pcSyncTasks', updated);
      setSelectedTaskIds(new Set());
      await fetchData();
      showToast('success', `បានកែប្រែស្ថានភាព ${updated.length} Tasks ទៅជា ${status === 'COMPLETED' ? 'បានជោគជ័យ' : 'រង់ចាំ Sync'}`);
    } catch (err: any) {
      console.error('Batch status update failed:', err);
      showToast('error', 'បរាជ័យក្នុងការកែប្រែស្ថានភាព Tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchDeleteTasks = async () => {
    if (selectedTaskIds.size === 0) return;
    if (!window.confirm(`តើអ្នកប្រាកដជាចង់លុប Tasks ទាំង ${selectedTaskIds.size} ដែលបានជ្រើសរើសមែនទេ?`)) return;
    try {
      setIsProcessing(true);
      const db = await initDB();
      await db.deleteMany('pcSyncTasks', Array.from(selectedTaskIds));
      setSelectedTaskIds(new Set());
      await fetchData();
      showToast('success', `បានលុប Tasks ចំនួន ${selectedTaskIds.size} ជោគជ័យ`);
    } catch (err: any) {
      console.error('Batch delete failed:', err);
      showToast('error', 'បរាជ័យក្នុងការលុប Tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditStudent = (student: Student) => {
    setStudentToEdit(student);
    setEditPcNumber(normalizePcNumber(student.pcNumber) || '');
    setEditPassword(student.password || '');
  };

  const handleSaveStudentPcAndPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEdit || !activeYear) return;
    const oldPc = normalizePcNumber(studentToEdit.pcNumber);
    const newPc = editPcNumber.trim() ? normalizePcNumber(editPcNumber.trim()) : '';
    const newPass = editPassword.trim();

    try {
      setIsProcessing(true);
      const db = await initDB();
      const updatedStudent: Student = {
        ...studentToEdit,
        pcNumber: newPc || undefined,
        password: newPass || undefined,
      };

      await db.put('students', updatedStudent);

      // Automated Sync Queueing
      if (oldPc !== newPc) {
        if (oldPc) {
          await queuePcSyncTask(db, studentToEdit, oldPc, 'REMOVE', activeYear, null);
        }
        if (newPc) {
          await queuePcSyncTask(db, updatedStudent, newPc, 'ADD', activeYear, newPass || null);
        }
      } else if (newPc && newPass && newPass !== studentToEdit.password) {
        await queuePcSyncTask(db, updatedStudent, newPc, 'UPDATE_PASSWORD', activeYear, newPass);
      }

      setStudentToEdit(null);
      await fetchData();
      showToast('success', 'បានរក្សាទុកតុ PC និងលេខសម្ងាត់សិស្សជោគជ័យ');
    } catch (err: any) {
      console.error('Failed to update student PC/password:', err);
      showToast('error', 'បរាជ័យក្នុងការរក្សាទុកទិន្នន័យ៖ ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnassignStudent = async (student: Student) => {
    const normPc = normalizePcNumber(student.pcNumber);
    if (!normPc || !activeYear) return;
    if (!window.confirm(`តើអ្នកប្រាកដជាចង់ដកសិស្ស "${student.name}" ចេញពី ${normPc} មែនទេ?\n(ប្រព័ន្ធនឹងបង្កើត Task ដើម្បីលុបគណនីចេញពី ${normPc} ដោយស្វ័យប្រវត្តិ)`)) {
      return;
    }

    try {
      setIsProcessing(true);
      const db = await initDB();
      const updatedStudent: Student = {
        ...student,
        pcNumber: undefined,
      };
      await db.put('students', updatedStudent);
      await queuePcSyncTask(db, student, normPc, 'REMOVE', activeYear, null);
      await fetchData();
      showToast('success', `បានដកសិស្ស ${student.name} ចេញពី ${normPc} ជោគជ័យ`);
    } catch (err: any) {
      console.error('Failed to unassign student:', err);
      showToast('error', 'បរាជ័យក្នុងការដកតុសិស្ស៖ ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTaskDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString('km-KH')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoStr;
    }
  };

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => compareKhmer(a.name, b.name) || compareKhmer(a.shift, b.shift));
  }, [classes]);

  const classNameById = useMemo(
    () => new Map(sortedClasses.map(classItem => [classItem.id, classItem.name])),
    [sortedClasses]
  );

  const filteredStudents = useMemo(() => {
    return allStudents.filter(student => matchesSyncScope(student, { selectedClass, selectedDesk, searchQuery }))
      .sort(compareStudentsByKhmerName);
  }, [allStudents, searchQuery, selectedClass, selectedDesk]);

  const scopedMissingPasswords = filteredStudents.filter(student => !student.password);
  const scopedAssignedCount = filteredStudents.filter(student => normalizePcNumber(student.pcNumber)).length;
  useEffect(() => { setSelectedStudentIds(new Set()); }, [selectedClass, selectedDesk, searchQuery, activeYear]);

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
    () => filteredStudents.filter(student => selectedStudentIds.has(student.id)),
    [filteredStudents, selectedStudentIds]
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
      if (!syncSettings.labName.trim() || !syncSettings.usbLabel.trim() || !syncSettings.syncToken.trim() || /[\r\n]/.test(syncSettings.syncToken)) {
        showToast('error', 'សូមកំណត់ឈ្មោះ Lab និងឈ្មោះ USB មុនទាញយក Installer។');
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
        showToast('error', 'សូមកំណត់ឈ្មោះ Lab និងឈ្មោះ USB ជាមុន។');
        return;
      }

      if (mode === 'SELECTED' && selectedStudents.length === 0) {
        showToast('error', 'សូមធីកជ្រើសសិស្សយ៉ាងហោចណាស់ម្នាក់។');
        return;
      }

      if (mode === 'FULL' && selectedDesk === 'UNASSIGNED') {
        showToast('error', 'សិស្សដែលមិនទាន់មានតុ មិនអាច Sync ទៅ PC បានទេ។');
        return;
      }

      if (isLoading || !activeYear) throw new Error('សូមរង់ចាំទិន្នន័យផ្ទុករួចសិន។');
      if (!syncSettings.syncToken.trim() || /[\r\n]/.test(syncSettings.syncToken)) throw new Error('សូមកំណត់ Sync Token មិនទទេ និងមានតែមួយបន្ទាត់។');
      const currentRoster = rosterStudents.map(student => allStudents.find(active => active.id === student.id) || student);
      const plan = buildSyncPlan(currentRoster, pendingTasks, { selectedClass, selectedDesk, searchQuery }, mode, selectedStudentIds, syncSettings.autoDelete);
      const { targets } = plan;
      if (!targets.length) throw new Error('មិនមានទិន្នន័យក្នុង Filter នេះសម្រាប់ Sync ទេ។');
      const accountCount = targets.reduce((total, target) => total + target.accounts.length, 0);
      const removeCount = targets.reduce((total, target) => total + target.removeStudentIds.length, 0);
      const summary = 'គណនី: ' + accountCount + ' | លុប: ' + removeCount + ' | PC: ' + targets.map(target => target.pcNumber).join(', ');
      const payload = {
        version: 3, payloadId: crypto.randomUUID(), labId: syncSettings.labId,
        academicYear: activeYear, generatedAt: new Date().toISOString(),
        mode: plan.mode, deleteMissingUsers: plan.deleteMissingUsers, targets,
      };

      const syncScript = getGlobalSyncScript(
        utf8ToBase64(JSON.stringify(payload)),
        syncSettings.syncToken
      );

      // Direct download or browser picker
      if (isDownloadOnly || !('showDirectoryPicker' in window)) {
        downloadTextFile(syncScript, 'GlobalSync.ps1');
        downloadTextFile(getSyncRunnerScript(), '2_Sync_PC_Now.cmd');
        showToast('success', `${summary} | រួចរាល់! សូមដាក់ GlobalSync.ps1 ក្នុង ICTLabSync និង 2_Sync_PC_Now.cmd នៅ USB Root`);
        return;
      }

      // 1. Pick USB Root Directory
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      if (dirHandle.name === 'ICTLabSync') throw new Error('សូមជ្រើស USB Root នៅខាងក្រៅ Folder ICTLabSync ដើម្បីសរសេរ File ទាំងពីរ។');
      
      // 2. Write File directly to ICTLabSync folder
      const folderHandle = await dirHandle.getDirectoryHandle('ICTLabSync', { create: true });
      const fileHandle = await folderHandle.getFileHandle('GlobalSync.ps1', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write('\uFEFF' + syncScript);
      await writable.close();

      // 3. Write 2_Sync_PC_Now.cmd to USB root
      const runnerHandle = await dirHandle.getFileHandle('2_Sync_PC_Now.cmd', { create: true });
      const runnerWritable = await runnerHandle.createWritable();
      await runnerWritable.write(getSyncRunnerScript());
      await runnerWritable.close();

      showToast('success', 'បានសរសេរ USB រួច៖ ' + summary);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('USB preparation failed:', error);
      showToast('error', error?.message || 'មានបញ្ហាក្នុងការបង្កើត Auto Sync USB');
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
    if (scopedMissingPasswords.length === 0) return;
    if (!window.confirm(`បង្កើត Password ស្វ័យប្រវត្តិសម្រាប់សិស្សទាំង ${scopedMissingPasswords.length} នាក់?`)) return;

    try {
      setIsProcessing(true);
      const db = await initDB();
      const existing = new Set(allStudents.map(student => student.password).filter(Boolean));
      const updates: Student[] = [];

      for (const student of scopedMissingPasswords) {
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
      showToast('success', `បង្កើតលេខសម្ងាត់ជូនសិស្សចំនួន ${updates.length} នាក់ជោគជ័យ!`);
    } catch (error) {
      console.error('Bulk password generation failed:', error);
      showToast('error', 'បរាជ័យក្នុងការបង្កើតលេខសម្ងាត់');
    } finally {
      setIsProcessing(false);
    }
  };

  const importSyncReceipts = async (files: File[]) => {
    setIsProcessing(true);
    try {
      if (!activeYear) return;
      const db = await initDB();
      const currentTasks = await db.getAll('pcSyncTasks', activeYear);
      const completed = new Set<string>();
      for (const file of files) {
        const receipt = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
        receiptTaskIds(receipt, currentTasks, syncSettings.labId, activeYear).forEach(id => completed.add(id));
      }
      const completedIds = Array.from(completed);
      if (completedIds.length > 0) {
        const updatedTasks = currentTasks
          .filter(t => completed.has(t.id))
          .map(t => ({ ...t, status: 'COMPLETED' as const }));
        await db.putMany('pcSyncTasks', updatedTasks);
      }
      await fetchData();
      showToast('success', `បានបញ្ជាក់ Sync ជោគជ័យចំនួន ${completed.size} Tasks (បានផ្លាស់ប្តូរទៅស្ថានភាព COMPLETED)`);
    } catch (error) {
      await fetchData();
      showToast('error', 'មិនអាចនាំចូលលទ្ធផលបាន៖ ' + (error instanceof Error ? error.message : String(error)));
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 font-sans animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed top-5 right-5 z-[9999] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium transition-all animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-600 text-white border border-emerald-500 shadow-emerald-500/20' 
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border border-rose-500 shadow-rose-500/20'
              : 'bg-blue-600 text-white border border-blue-500 shadow-blue-500/20'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : toastMessage.type === 'error' ? (
            <AlertTriangle size={18} />
          ) : (
            <RefreshCw size={18} />
          )}
          <span className="font-khmer">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}
      
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

        <div 
          onClick={() => setActiveTab('TASKS')}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group"
          title="ចុចដើម្បីមើល និងគ្រប់គ្រងបញ្ជី Tasks ទាំងអស់"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-khmer group-hover:text-indigo-600 transition-colors">រង់ចាំ Sync ទៅ PC</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
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
      <div className="flex p-1 bg-slate-100/90 rounded-xl w-fit border border-slate-200/80 gap-1 flex-wrap">
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
          onClick={() => setActiveTab('TASKS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-khmer transition-all cursor-pointer ${
            activeTab === 'TASKS'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ListTodo size={15} />
          <span>គ្រប់គ្រងភារកិច្ច Sync (Tasks CRUD)</span>
          {pendingTasks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700">
              {pendingTasks.length}
            </span>
          )}
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
                  <CheckCircle2 size={12} /> {selectableVisibleStudents.length} នាក់រួចរាល់ក្នុង Filter
                </span>
              </div>
              <p className="text-xs text-slate-500 font-khmer mt-0.5">
                Sync តាម Filter ថ្នាក់ តុ និងការស្វែងរកខាងក្រោម។ ការជ្រើសថ្នាក់/សិស្សរក្សាគណនីផ្សេងលើ PC ដដែល។
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handlePrepareSyncUsb('FULL', false)}
              disabled={isProcessing || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer font-khmer"
            >
              <Usb size={16} />
              <span>
                {isProcessing 
                  ? 'កំពុងដំណើរការ...' 
                  : `ទាញយកដាក់ USB (${scopedAssignedCount} នាក់)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handlePrepareSyncUsb('FULL', true)}
              disabled={isProcessing || isLoading}
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
                <span>Reset ប្រព័ន្ធម៉ាស៊ីន (Clean System)</span>
              </div>
              <p className="text-xs text-rose-700/80 font-khmer">
                សម្អាត Files, Services និងគណនីសិស្សចេញពី System ទាំងអស់ (រក្សាបម្រាមហ្គេមទុកជាអចិន្ត្រៃយ៍)
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

      {/* 6. Roster Table Section (Only in SYNC tab) */}
      {activeTab === 'SYNC' && (
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
              {scopedMissingPasswords.length > 0 && (
                <button
                  type="button"
                  onClick={handleGenerateMissingPasswords}
                  disabled={isProcessing || isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition cursor-pointer font-khmer disabled:opacity-50"
                >
                  <Key size={13} />
                  <span>បង្កើត Password ស្វ័យប្រវត្តិ ({scopedMissingPasswords.length})</span>
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
                {sortedClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-5 py-3 text-xs font-khmer text-slate-600 bg-blue-50 flex flex-wrap items-center gap-3">
            <span>CRUD ក្នុង Filter៖ {scopedAssignedCount} នាក់។ Pending មិនត្រូវបានលុបនៅពេលទាញយកទេ។</span>
            {selectedClass !== 'ALL' && <span>បញ្ជាលុបសិស្សដែលលុបចេញពីបញ្ជីរួច ហើយគ្មានព័ត៌មានថ្នាក់ ត្រូវប្រើ Filter តុ + គ្រប់ថ្នាក់។</span>}
            <label className="cursor-pointer text-blue-700 font-bold">
              នាំចូលលទ្ធផលពី USB / ICTLabSync / Receipts
              <input type="file" accept=".json" multiple className="hidden" disabled={isProcessing || isLoading}
                onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) void importSyncReceipts(files); }} />
            </label>
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
                disabled={isProcessing || isLoading}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs cursor-pointer font-khmer"
              >
                Sync តែសិស្សដែលបានជ្រើស ({selectedStudentIds.size})
              </button>
            </div>
          )}

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
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
                  <th className="px-4 py-3 font-khmer text-center">សកម្មភាព</th>
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

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStudent(student)}
                            title="កែសម្រួល PC & លេខសម្ងាត់"
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          {normDesk ? (
                            <button
                              type="button"
                              onClick={() => handleUnassignStudent(student)}
                              title={`ដកចេញពី ${normDesk}`}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                            >
                              <UserX size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudent(student)}
                              title="កំណត់តុ/PC"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                            >
                              <Plus size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-khmer text-sm">
                      មិនមានទិន្នន័យសិស្សត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ។
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7. TAB 2: TASKS CRUD (PC SYNC TASKS MANAGEMENT) */}
      {activeTab === 'TASKS' && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <ListTodo size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-800 font-khmer">
                    បញ្ជីភារកិច្ចសមកាលកម្ម PC (PC Sync Tasks)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
                    {filteredTasks.length} Tasks
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-khmer mt-0.5">
                  គ្រប់គ្រង CRUD: បង្កើត (Create), មើល (Read), កែប្រែ (Update) និងលុប (Delete) ភារកិច្ចដែលត្រូវរៀបចំលើ Client PC
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreateTask}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition active:scale-[0.98] cursor-pointer font-khmer"
              >
                <Plus size={14} />
                <span>បង្កើត Task ថ្មី</span>
              </button>

              {allTasks.some(t => t.status === 'COMPLETED') && (
                <button
                  type="button"
                  onClick={handleClearCompletedTasks}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold transition cursor-pointer font-khmer disabled:opacity-50"
                  title="លុប Tasks ដែលបាន Sync រួចរាល់"
                >
                  <Trash2 size={13} />
                  <span>សម្អាត Tasks រួចរាល់</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="ស្វែងរកតាម PC, Student ID ឬឈ្មោះ..."
                className="w-full bg-white rounded-xl border border-slate-200 py-2 pl-9 pr-8 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-khmer"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
              />
              {taskSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTaskSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value as any)}
                className="w-full bg-white rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition cursor-pointer font-khmer"
              >
                <option value="ALL">គ្រប់ស្ថានភាព (All Statuses)</option>
                <option value="PENDING">រង់ចាំ Sync (PENDING)</option>
                <option value="COMPLETED">បានជោគជ័យ (COMPLETED)</option>
              </select>
            </div>

            <div className="relative">
              <select
                value={taskActionFilter}
                onChange={(e) => setTaskActionFilter(e.target.value as any)}
                className="w-full bg-white rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition cursor-pointer font-khmer"
              >
                <option value="ALL">គ្រប់សកម្មភាព (All Actions)</option>
                <option value="ADD">+ បន្ថែមគណនី (ADD)</option>
                <option value="UPDATE_PASSWORD">🔑 កែពាក្យសម្ងាត់ (UPDATE_PASSWORD)</option>
                <option value="REMOVE">- លុបគណនី (REMOVE)</option>
              </select>
            </div>
          </div>

          {/* Multi-select Action Bar for Tasks */}
          {selectedTaskIds.size > 0 && (
            <div className="px-5 py-2.5 bg-indigo-50/90 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-900 font-khmer">
                  បានជ្រើសរើស {selectedTaskIds.size} ភារកិច្ច (Tasks)
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTaskIds(new Set())}
                  className="text-[11px] text-indigo-600 hover:underline font-khmer cursor-pointer"
                >
                  (ដោះការជ្រើសរើស)
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBatchSetStatus('COMPLETED')}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer font-khmer disabled:opacity-50"
                >
                  <CheckCircle2 size={13} />
                  <span>កំណត់ថាបានជោគជ័យ ({selectedTaskIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchSetStatus('PENDING')}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer font-khmer disabled:opacity-50"
                >
                  <Clock size={13} />
                  <span>កំណត់ថារង់ចាំ Sync ({selectedTaskIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchDeleteTasks}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer font-khmer disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  <span>លុប Tasks ដែលបានជ្រើស ({selectedTaskIds.size})</span>
                </button>
              </div>
            </div>
          )}

          {/* Tasks Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length}
                      onChange={toggleAllFilteredTasks}
                      className="rounded border-slate-300 cursor-pointer text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-khmer">កុំព្យូទ័រ (PC)</th>
                  <th className="px-4 py-3 font-khmer">សកម្មភាព (Action)</th>
                  <th className="px-4 py-3 font-khmer">អត្តលេខ (Student ID)</th>
                  <th className="px-4 py-3 font-khmer">ឈ្មោះសិស្ស</th>
                  <th className="px-4 py-3 font-khmer">លេខសម្ងាត់</th>
                  <th className="px-4 py-3 font-khmer">ស្ថានភាព (Status)</th>
                  <th className="px-4 py-3 font-khmer">កាលបរិច្ឆេទ</th>
                  <th className="px-4 py-3 font-khmer text-center">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTasks.map((task) => {
                  const isPending = task.status === 'PENDING';
                  const isSelected = selectedTaskIds.has(task.id);
                  return (
                    <tr 
                      key={task.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="rounded border-slate-300 cursor-pointer text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      <td className="px-4 py-3 font-mono">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 text-xs">
                          {task.pcNumber}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {task.action === 'ADD' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 font-khmer">
                            <Plus size={11} /> បន្ថែមគណនី
                          </span>
                        )}
                        {task.action === 'REMOVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200 font-khmer">
                            <Trash2 size={11} /> លុបគណនី
                          </span>
                        )}
                        {task.action === 'UPDATE_PASSWORD' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200 font-khmer">
                            <Key size={11} /> កែពាក្យសម្ងាត់
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {task.studentId}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-800 font-khmer">
                        {task.studentName}
                      </td>

                      <td className="px-4 py-3 font-mono">
                        {task.password ? (
                          <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded">
                            {task.password}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic font-khmer">- គ្មាន -</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-200 font-khmer">
                            <Clock size={11} /> រង់ចាំ Sync
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 font-khmer">
                            <Check size={11} /> ជោគជ័យ
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {formatTaskDate(task.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTask(task)}
                            title="កែសម្រួល Task"
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(task)}
                            title={isPending ? "កំណត់ថាបានជោគជ័យ (Mark Completed)" : "កំណត់ថារង់ចាំ (Mark Pending)"}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isPending 
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            title="លុប Task នេះ"
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-khmer text-sm">
                      មិនមានភារកិច្ច Sync ត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ។
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                      អនុវត្តតែពេលជ្រើសគ្រប់ថ្នាក់ និងគ្មានការស្វែងរក លើតុដែលបានជ្រើស។ Filter ថ្នាក់/សិស្សមិនលុបគណនីផ្សេងនៅលើ PC ទេ។
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

      {/* 8. Task Create / Edit Modal (CRUD) */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <ListTodo size={18} className="text-blue-600" />
                <span className="font-khmer">
                  {editingTask ? 'កែសម្រួលភារកិច្ច Sync' : 'បង្កើតភារកិច្ច Sync ថ្មី'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  កុំព្យូទ័រគោលដៅ (Target PC) *
                </label>
                <select
                  value={taskForm.pcNumber}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, pcNumber: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {standardPcs.map(pc => (
                    <option key={pc} value={pc}>{pc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  សកម្មភាព (Action) *
                </label>
                <select
                  value={taskForm.action}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, action: e.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-khmer"
                >
                  <option value="ADD">+ បន្ថែមគណនីទៅ PC (ADD)</option>
                  <option value="UPDATE_PASSWORD">🔑 កែប្រែលេខសម្ងាត់លើ PC (UPDATE_PASSWORD)</option>
                  <option value="REMOVE">- លុបគណនីចេញពី PC (REMOVE)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  ជ្រើសរើសសិស្ស ឬបញ្ចូលដោយដៃ
                </label>
                <select
                  onChange={(e) => {
                    const st = allStudents.find(s => s.id === e.target.value);
                    if (st) {
                      setTaskForm(prev => ({
                        ...prev,
                        studentId: st.studentId,
                        studentName: (st.englishName?.trim() || st.name?.trim() || st.studentId).trim(),
                        password: st.password || prev.password,
                      }));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 outline-none mb-2 cursor-pointer font-khmer"
                >
                  <option value="">-- ជ្រើសរើសសិស្សពីបញ្ជី (ជម្រើសងាយស្រួល) --</option>
                  {allStudents.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.studentId} - {st.name} ({st.class})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 font-khmer mb-0.5">
                      អត្តលេខ (Username) *
                    </label>
                    <input
                      type="text"
                      value={taskForm.studentId}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, studentId: e.target.value.trim() }))}
                      placeholder="B00123"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 font-khmer mb-0.5">
                      ឈ្មោះសិស្ស *
                    </label>
                    <input
                      type="text"
                      value={taskForm.studentName}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, studentName: e.target.value }))}
                      placeholder="ឈ្មោះសិស្ស"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-khmer outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {taskForm.action !== 'REMOVE' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 font-khmer">
                      លេខសម្ងាត់ Windows (3 ខ្ទង់)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const rand = Math.floor(100 + Math.random() * 900);
                        setTaskForm(prev => ({ ...prev, password: String(rand) }));
                      }}
                      className="text-[11px] text-blue-600 hover:underline font-khmer font-bold cursor-pointer"
                    >
                      បង្កើតចៃដន្យ
                    </button>
                  </div>
                  <input
                    type="text"
                    value={taskForm.password}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="123"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  ស្ថានភាព (Status)
                </label>
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-khmer"
                >
                  <option value="PENDING">រង់ចាំ Sync (PENDING)</option>
                  <option value="COMPLETED">បានជោគជ័យ (COMPLETED)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer font-khmer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs font-khmer cursor-pointer disabled:opacity-50"
                >
                  {editingTask ? 'រក្សាទុកការកែប្រែ' : 'បង្កើត Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Student PC & Password Quick Edit Modal (CRUD) */}
      {studentToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Edit2 size={18} className="text-blue-600" />
                <span className="font-khmer">ចាត់ចែងតុ PC & លេខសម្ងាត់សិស្ស</span>
              </div>
              <button
                type="button"
                onClick={() => setStudentToEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStudentPcAndPass} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 font-khmer text-sm">{studentToEdit.name}</span>
                  <span className="font-mono font-bold text-blue-700">{studentToEdit.studentId}</span>
                </div>
                <div className="text-slate-500 font-khmer flex gap-2">
                  <span>ថ្នាក់៖ <strong>{classNameById.get(studentToEdit.class) || studentToEdit.class}</strong></span>
                  <span>•</span>
                  <span>វេន៖ <strong>{studentToEdit.shift}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer mb-1">
                  ជ្រើសរើសកុំព្យូទ័រ / តុ (Assigned PC)
                </label>
                <select
                  value={editPcNumber}
                  onChange={(e) => setEditPcNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- មិនទាន់កំណត់តុ (UNASSIGNED) --</option>
                  {standardPcs.map(pc => {
                    const isBroken = brokenPcs.includes(pc);
                    return (
                      <option key={pc} value={pc}>
                        {pc} {isBroken ? '⚠️ (ម៉ាស៊ីនខូច - Broken)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 font-khmer mt-1">
                  ប្រសិនបើផ្លាស់ប្តូរតុ ប្រព័ន្ធនឹងបង្កើត Task ដើម្បីលុបគណនីពីតុចាស់ និងបង្កើតលើតុថ្មីដោយស្វ័យប្រវត្តិ។
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 font-khmer">
                    លេខសម្ងាត់ចូល Windows (3 ខ្ទង់)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(100 + Math.random() * 900);
                      setEditPassword(String(rand));
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-khmer font-bold cursor-pointer"
                  >
                    បង្កើតចៃដន្យ
                  </button>
                </div>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="ឧ. 123"
                  maxLength={10}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStudentToEdit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer font-khmer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-xs font-khmer cursor-pointer disabled:opacity-50"
                >
                  រក្សាទុក
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcSync;
