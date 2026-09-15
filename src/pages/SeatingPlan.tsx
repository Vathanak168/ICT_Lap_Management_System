import React, { useState, useEffect, useRef } from 'react';
import { Monitor, UserMinus, Key, Zap, RefreshCw, AlertTriangle, MonitorPlay, Eye, EyeOff, Printer, Trash2, CheckCircle2, Keyboard, AlertCircle, Grid, RotateCw, RotateCcw, HelpCircle } from 'lucide-react';
import { initDB, isPcIssueActive, queuePcSyncTask } from '../store/db';
import type { Student, ClassRecord, PCIssue, SeatingPlan as SeatingPlanType } from '../store/db';

type ExtendedSeatingPlan = SeatingPlanType & { deskRotations?: Record<string, number> };

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
}
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

import { useLanguage } from '../contexts/LanguageContext';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { useAuth } from '../contexts/AuthContext';
import { compareKhmer, compareStudentsByKhmerName } from '../utils/khmerSort';

interface Desk {
  id: string;
  pcNumber: string;
  studentIds: string[]; // Can hold multiple students in case of conflict
  status: 'Good' | 'Issue';
}

const isValidUUID = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};



const SeatingPlan = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [pcIssues, setPcIssues] = useState<PCIssue[]>([]);
  
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // For Drag and Drop
  const [draggedDeskId, setDraggedDeskId] = useState<string | null>(null);
  const [dragOverPc, setDragOverPc] = useState<string | null>(null);
  const [draggedStudentData, setDraggedStudentData] = useState<{
    studentId: string;
    studentName: string;
    sourcePc?: string;
  } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);
  const [isDragOverUnassign, setIsDragOverUnassign] = useState(false);

  // Auto dismiss feedback banner after 4.5 seconds
  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  // For Issue Reporting
  const [issueDescription, setIssueDescription] = useState('');
  const [isReportingIssue, setIsReportingIssue] = useState(false);

  // For Layout Builder
  const [currentLayout, setCurrentLayout] = useState<ExtendedSeatingPlan | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [builderRows, setBuilderRows] = useState<number>(6);
  const [builderCols, setBuilderCols] = useState<number>(9);

  // For Universal Confirmation Dialog (Provides explicit OK and Cancel buttons)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const openConfirm = ({
    title,
    message,
    confirmText = 'យល់ព្រម',
    cancelText = 'បោះបង់',
    variant = 'primary',
    onConfirm,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary' | 'warning';
    onConfirm: () => void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      variant,
      onConfirm: () => {
        setConfirmDialog(null);
        onConfirm();
      },
    });
  };


  const { language } = useLanguage();
  const { activeYear } = useAcademicYear();
  const { user } = useAuth();
  
  const loadClassRequestRef = useRef(0);
  const loadDataRequestRef = useRef(0);
  const saveInProgressRef = useRef(false);

  useEffect(() => {
    if (!activeYear) {
      setClasses([]);
      setSelectedClass('');
      return;
    }

    const requestId = ++loadClassRequestRef.current;

    const loadClasses = async () => {
      try {
        const db = await initDB();
        const result = await db.getAll('classes', activeYear);

        if (requestId !== loadClassRequestRef.current) return;
        result.sort((a, b) => compareKhmer(a.name, b.name));
        setClasses(result);
        setSelectedClass(previous =>
          result.some(item => item.id === previous) ? previous : result[0]?.id ?? ''
        );
      } catch (error) {
        if (requestId === loadClassRequestRef.current) {
          console.error('Failed to load classes:', error);
        }
      }
    };

    void loadClasses();
  }, [activeYear]);

  const loadData = async (targetYear: string, targetClass: string, targetShift: string, isForceReload: boolean = false) => {
    if (!targetYear || !targetClass || !targetShift) return;
    
    if (!isForceReload) setIsLoading(true);
    const requestId = ++loadDataRequestRef.current;

    try {
      const db = await initDB();

      const [allYearStudents, issueRows, planRows] = await Promise.all([
        db.getAll('students', targetYear),
        db.getAll('pcIssues', targetYear),
        db.getAllFromIndex('seatingPlans', 'class_id', targetClass, targetYear)
      ]);

      if (requestId !== loadDataRequestRef.current) return;

      // Incoming shift-switching students attending this class
      const incomingShiftStudents = allYearStudents.filter(
        s => s.alternateClassId === targetClass && s.isShiftSwitching && s.class !== targetClass && s.status !== 'Inactive'
      );
      // Active class students (excluding those who switched out to another class)
      const activeClassStudents = allYearStudents.filter(
        s => s.class === targetClass && s.status !== 'Inactive' && !(s.isShiftSwitching && s.alternateClassId && s.alternateClassId !== targetClass)
      );
      const activeStudents = [...activeClassStudents, ...incomingShiftStudents];
      const shift = targetShift;
      
      let plan = planRows.find(p => p.shift === shift && p.academicYear === targetYear);
      if (!plan && planRows.length > 0) {
        plan = planRows.find(p => p.academicYear === targetYear);
      }
      
      let deskRotations = {};
      if (plan) {
        try {
          const rotationSetting = await db.get('settings', `rotations_${plan.id}`);
          if (rotationSetting && rotationSetting.config) {
            deskRotations = rotationSetting.config as Record<string, number>;
          }
        } catch (e) {
          console.warn('Failed to load desk rotations:', e);
        }
      }

      if (requestId !== loadDataRequestRef.current) return;
      
      if (plan) {
        setCurrentLayout({ ...plan, deskRotations });
        if (plan.gridLayout) {
          setBuilderRows(plan.gridLayout.length || 6);
          setBuilderCols(plan.gridLayout[0]?.length || 9);
        }
      } else {
        const layoutToUse: ExtendedSeatingPlan = { 
          id: crypto.randomUUID(),
          classId: targetClass,
          shift: shift,
          academicYear: targetYear,
          gridLayout: generateDefaultGrid(),
          deskRotations: {},
          createdAt: new Date().toISOString()
        };
        setCurrentLayout(layoutToUse);
        setBuilderRows(6);
        setBuilderCols(9);
      }
      
      let pcNumbersList: string[] = [];
      const layoutToUse = plan || { gridLayout: generateDefaultGrid() };
      
      if (layoutToUse && layoutToUse.gridLayout) {
        layoutToUse.gridLayout.forEach(row => {
          row.forEach(cell => {
            if (cell && !pcNumbersList.includes(cell)) {
              pcNumbersList.push(cell);
            }
          });
        });
      }

      // Auto-heal any students assigned to desks that no longer exist in this room layout
      const gridPcSet = new Set(pcNumbersList);
      const orphanedStudents = activeStudents.filter(s => s.pcNumber && !gridPcSet.has(s.pcNumber));
      if (orphanedStudents.length > 0) {
        db.putMany('students', orphanedStudents.map(s => ({ ...s, pcNumber: null }))).catch(err => {
          console.warn('Failed to auto-heal orphaned students:', err);
        });
        activeStudents.forEach(s => {
          if (s.pcNumber && !gridPcSet.has(s.pcNumber)) {
            s.pcNumber = undefined;
          }
        });
      }

      const issuePcNumbers = new Set(
        issueRows
          .filter(issue => isPcIssueActive(issue.status))
          .map(issue => issue.pcNumber)
      );

      // Auto-heal / unassign any active student assigned to a broken PC in the ICT lab
      const brokenAssignedStudents = activeStudents.filter(s => s.pcNumber && issuePcNumbers.has(s.pcNumber));
      if (brokenAssignedStudents.length > 0) {
        const studentUpdates: any[] = [];
        const syncPromises: Promise<any>[] = [];
        for (const s of brokenAssignedStudents) {
          syncPromises.push(queuePcSyncTask(db, s, s.pcNumber!, 'REMOVE', targetYear));
          studentUpdates.push({ ...s, pcNumber: null });
        }
        db.putMany('students', studentUpdates).catch(err => console.warn('Failed to unassign students on broken PCs:', err));
        Promise.all(syncPromises).catch(err => console.warn('Failed sync task:', err));
        activeStudents.forEach(s => {
          if (s.pcNumber && issuePcNumbers.has(s.pcNumber)) {
            s.pcNumber = undefined;
          }
        });
      }

      setStudents(activeStudents);
      setPcIssues(issueRows);

      // Support detecting multiple students on the same PC
      const studentByPc = new Map<string, string[]>();
      activeStudents.forEach(student => {
        if (student.pcNumber) {
          if (!studentByPc.has(student.pcNumber)) {
            studentByPc.set(student.pcNumber, []);
          }
          studentByPc.get(student.pcNumber)!.push(student.id);
        }
      });

      const initialDesks = pcNumbersList.map((pcNumber, index) => {
        return {
          id: `desk-${index}-${pcNumber}`,
          pcNumber,
          status: issuePcNumbers.has(pcNumber) ? 'Issue' as const : 'Good' as const,
          studentIds: studentByPc.get(pcNumber) || []
        };
      });
      
      setDesks(initialDesks);
      
      setSelectedDesk(prev => {
        if (!prev) return null;
        return initialDesks.find(d => d.pcNumber === prev.pcNumber) || null;
      });

    } catch (error) {
      if (requestId === loadDataRequestRef.current) {
        console.error('Failed to load seating plan:', error);
      }
    } finally {
      if (requestId === loadDataRequestRef.current && !isForceReload) {
        setIsLoading(false);
      }
    }
  };

  const generateDefaultGrid = () => {
    const grid: Array<Array<string | null>> = [];
    grid.push(['Teacher PC', null, null, null, null, null, null, null, null]);
    for (let r = 0; r < 4; r++) {
      const row: Array<string | null> = [];
      for (let c = 0; c < 4; c++) row.push(`PC-${String(1 + r * 4 + c).padStart(2, '0')}`);
      row.push(null);
      for (let c = 0; c < 4; c++) row.push(`PC-${String(21 + r * 4 + c).padStart(2, '0')}`);
      grid.push(row);
    }
    const lastRow: Array<string | null> = [];
    for (let c = 0; c < 4; c++) lastRow.push(`PC-${String(17 + c).padStart(2, '0')}`);
    lastRow.push(null);
    for (let c = 0; c < 4; c++) lastRow.push(null);
    grid.push(lastRow);
    return grid;
  };

  const handleUpdateGridSize = (newRows: number, newCols: number) => {
    if (!currentLayout) return;
    const clampedRows = Math.min(20, Math.max(1, newRows));
    const clampedCols = Math.min(20, Math.max(1, newCols));
    let grid = [...currentLayout.gridLayout];
    
    if (clampedRows > grid.length) {
      for (let i = grid.length; i < clampedRows; i++) {
        grid.push(Array(clampedCols).fill(null));
      }
    } else if (clampedRows < grid.length) {
      grid = grid.slice(0, clampedRows);
    }
    
    grid = grid.map(row => {
      let newRow = [...row];
      if (clampedCols > newRow.length) {
        newRow = newRow.concat(Array(clampedCols - newRow.length).fill(null));
      } else if (clampedCols < newRow.length) {
        newRow = newRow.slice(0, clampedCols);
      }
      return newRow;
    });

    setCurrentLayout({ ...currentLayout, gridLayout: grid });
    setBuilderRows(clampedRows);
    setBuilderCols(clampedCols);
  };

  const handleCellClickInEditMode = (rIdx: number, cIdx: number) => {
    if (!currentLayout) return;
    const newGrid = currentLayout.gridLayout.map(r => [...r]);
    const newRow = newGrid[rIdx];
    
    if (newRow[cIdx] === null) {
       // If Teacher PC is not anywhere in the room, place Teacher PC first
       if (!newGrid.flat().includes('Teacher PC')) {
         newRow[cIdx] = 'Teacher PC';
       } else {
         const existingMax = Math.max(0, ...newGrid.flat().map(c => {
           if (c && c.startsWith('PC-')) return parseInt(c.replace('PC-', '')) || 0;
           return 0;
         }));
         const newPcNumber = `PC-${String(existingMax + 1).padStart(2, '0')}`;
         newRow[cIdx] = newPcNumber;
         
         // Add to desks if not exists
         if (!desks.find(d => d.pcNumber === newPcNumber)) {
           setDesks(prev => [...prev, {
             id: `desk-new-${Date.now()}`,
             pcNumber: newPcNumber,
             status: 'Good',
             studentIds: []
           }]);
         }
       }
    } else {
       newRow[cIdx] = null;
    }
    newGrid[rIdx] = newRow;
    setCurrentLayout({ ...currentLayout, gridLayout: newGrid });
  };

  const handleRemoveDeskFromGrid = (pcNumber: string) => {
    if (!currentLayout) return;
    const desk = desks.find(d => d.pcNumber === pcNumber);

    const doRemove = () => {
      const newGrid = currentLayout.gridLayout.map(row =>
        row.map(cell => (cell === pcNumber ? null : cell))
      );
      setCurrentLayout({ ...currentLayout, gridLayout: newGrid });
      setDesks(prev => prev.filter(d => d.pcNumber !== pcNumber));
    };

    if (desk && desk.studentIds.length > 0) {
      openConfirm({
        title: 'បញ្ជាក់ការលុបតុចេញពីប្លង់',
        message: `តុ ${pcNumber} មានសិស្សកំពុងអង្គុយ។ តើអ្នកពិតជាចង់លុបតុនេះចេញពីប្លង់មែនទេ?`,
        confirmText: 'លុបតុ',
        cancelText: 'បោះបង់',
        variant: 'danger',
        onConfirm: doRemove,
      });
    } else {
      doRemove();
    }
  };

  const handleSaveLayout = async () => {
    if (saveInProgressRef.current) return;
    
    if (!activeYear || !selectedClass || !currentLayout) {
       alert("សូមជ្រើសរើសថ្នាក់ជាមុនសិន");
       return;
    }
    
    saveInProgressRef.current = true;
    setIsSaving(true);
    
    try {
      const currentClassObj = classes.find(c => c.id === selectedClass);
      const shift = currentClassObj?.shift || 'Morning';
      
      const db = await initDB();
      let layoutId = currentLayout.id;
      let isMigratingUUID = false;
      let oldLayoutId: string | null = null;
      
      // Ensure layout ID is a valid UUID
      if (!isValidUUID(layoutId)) {
        isMigratingUUID = true;
        oldLayoutId = layoutId;
        layoutId = crypto.randomUUID();
      }
      
      const newPlan: SeatingPlanType = {
        id: layoutId,
        classId: selectedClass,
        shift,
        academicYear: activeYear,
        gridLayout: currentLayout.gridLayout,
        createdAt: currentLayout.createdAt || new Date().toISOString()
      };
      
      // Step 1: Write new records
      await db.put('seatingPlans', newPlan);
      
      if (currentLayout.deskRotations) {
        await db.put('settings', {
          id: `rotations_${layoutId}`,
          config: currentLayout.deskRotations
        });
      }
      
      // Step 2: Delete old records only after successful write
      if (isMigratingUUID && oldLayoutId) {
        try {
          await db.delete('seatingPlans', oldLayoutId);
          await db.delete('settings', `rotations_${oldLayoutId}`);
        } catch (e) {
          console.warn('Could not delete old layout format during migration:', e);
        }
      }

      // Step 3: Prevent ghost students by unassigning students whose desks were removed from grid
      const gridPcSet = new Set<string>();
      currentLayout.gridLayout.forEach(row => {
        row.forEach(cell => {
          if (cell && cell !== 'Teacher PC') {
            gridPcSet.add(cell);
          }
        });
      });

      const orphanedStudents = students.filter(s => s.pcNumber && !gridPcSet.has(s.pcNumber));
      if (orphanedStudents.length > 0) {
        const studentUpdates: any[] = [];
        const syncPromises: Promise<any>[] = [];

        for (const s of orphanedStudents) {
          syncPromises.push(queuePcSyncTask(db, s, s.pcNumber!, 'REMOVE', activeYear));
          studentUpdates.push({ ...s, pcNumber: null });
        }

        await Promise.all([
          db.putMany('students', studentUpdates),
          ...syncPromises
        ]);

        setStudents(prev => prev.map(s => {
          const isOrphaned = orphanedStudents.some(o => o.id === s.id);
          return isOrphaned ? { ...s, pcNumber: undefined } : s;
        }));
      }
      
      // Immediately update local UI reference
      setCurrentLayout(prev => prev ? { ...prev, id: layoutId } : null);
      
      await loadData(activeYear, selectedClass, shift, true);
      setIsEditMode(false);
    } catch (e) {
      console.error(e);
      alert('បរាជ័យក្នុងការរក្សាទុកប្លង់');
    } finally {
      saveInProgressRef.current = false;
      setIsSaving(false);
    }
  };

  const handleResetLayoutToDefault = () => {
    if (saveInProgressRef.current || isSaving) return;
    if (!activeYear || !selectedClass) {
      alert('សូមជ្រើសរើសថ្នាក់ជាមុនសិន');
      return;
    }

    openConfirm({
      title: 'បញ្ជាក់ការ Reset ប្លង់តុ',
      message: 'តើអ្នកពិតជាចង់ Reset ប្លង់តុ និងរៀបចំឈ្មោះ PC តាមលំនាំដើមវិញមែនទេ? (ឈ្មោះ PC នឹងត្រឡប់ទៅជា PC-01 ដល់ PC-35 តាមលំដាប់លំដោយស្តង់ដារ)',
      confirmText: 'Reset ប្លង់តុ',
      cancelText: 'បោះបង់',
      variant: 'danger',
      onConfirm: async () => {
        saveInProgressRef.current = true;
        setIsSaving(true);

        try {
          const defaultGrid = generateDefaultGrid();
          const currentClassObj = classes.find(c => c.id === selectedClass);
          const shift = currentClassObj?.shift || 'Morning';

          const db = await initDB();
          let layoutId = currentLayout?.id || crypto.randomUUID();
          if (!isValidUUID(layoutId)) {
            layoutId = crypto.randomUUID();
          }

          const resetPlan: SeatingPlanType = {
            id: layoutId,
            classId: selectedClass,
            shift,
            academicYear: activeYear,
            gridLayout: defaultGrid,
            createdAt: new Date().toISOString(),
          };

          await db.put('seatingPlans', resetPlan);

          try {
            await db.delete('settings', `rotations_${layoutId}`);
          } catch (err) {
            // ignore
          }

          // Detect any students assigned to desks not in default grid
          const gridPcSet = new Set<string>();
          defaultGrid.forEach(row => {
            row.forEach(cell => {
              if (cell && cell !== 'Teacher PC') {
                gridPcSet.add(cell);
              }
            });
          });

          const orphanedStudents = students.filter(s => s.pcNumber && !gridPcSet.has(s.pcNumber));
          if (orphanedStudents.length > 0) {
            const studentUpdates: any[] = [];
            const syncPromises: Promise<any>[] = [];

            for (const s of orphanedStudents) {
              syncPromises.push(queuePcSyncTask(db, s, s.pcNumber!, 'REMOVE', activeYear));
              studentUpdates.push({ ...s, pcNumber: null });
            }

            await Promise.all([
              db.putMany('students', studentUpdates),
              ...syncPromises
            ]);

            setStudents(prev => prev.map(s => {
              const isOrphaned = orphanedStudents.some(o => o.id === s.id);
              return isOrphaned ? { ...s, pcNumber: undefined } : s;
            }));
          }

          setBuilderRows(6);
          setBuilderCols(9);
          setCurrentLayout({
            ...resetPlan,
            deskRotations: {},
          });

          await loadData(activeYear, selectedClass, shift, true);
          setFeedbackMessage({
            type: 'success',
            text: 'បាន Reset ប្លង់តុ និងរៀបចំឈ្មោះ PC តាមលំនាំដើមជោគជ័យ!',
          });
        } catch (e) {
          console.error('Failed to reset layout:', e);
          alert('បរាជ័យក្នុងការ Reset ប្លង់តុ');
        } finally {
          saveInProgressRef.current = false;
          setIsSaving(false);
        }
      },
    });
  };

  useEffect(() => {
    const requestId = ++loadDataRequestRef.current;
    
    if (!activeYear || !selectedClass) return;
    
    const currentClassObj = classes.find(c => c.id === selectedClass);
    if (currentClassObj) {
      void loadData(activeYear, selectedClass, currentClassObj.shift);
    }
    
    return () => {
      if (loadDataRequestRef.current === requestId) {
        loadDataRequestRef.current++;
      }
    };
  }, [selectedClass, activeYear, classes]);

  // Real-time synchronization across pages and tabs when PC issues or assignments change
  useEffect(() => {
    const handleAppDataChanged = () => {
      if (!activeYear || !selectedClass) return;
      const currentClassObj = classes.find(c => c.id === selectedClass);
      if (currentClassObj) {
        void loadData(activeYear, selectedClass, currentClassObj.shift, true);
      }
    };

    window.addEventListener('appDataChanged', handleAppDataChanged);
    return () => {
      window.removeEventListener('appDataChanged', handleAppDataChanged);
    };
  }, [selectedClass, activeYear, classes]);


  const handleDeskClick = (desk: Desk) => {
    setSelectedDesk(desk);
    setIsReportingIssue(false);
    setIssueDescription('');
    setIsModalOpen(true);
  };

  // -------------------------------------------------------------
  // Drag and Drop Logic
  // -------------------------------------------------------------
  const handleRotateDesk = (e: React.MouseEvent, pcNumber: string) => {
    e.stopPropagation();
    setCurrentLayout(prev => {
      if (!prev) return prev;
      const currentRot = prev.deskRotations?.[pcNumber] || 0;
      const newRot = (currentRot + 90) % 360;
      return {
        ...prev,
        deskRotations: {
          ...prev.deskRotations,
          [pcNumber]: newRot
        }
      };
    });
  };

  const handleDragStart = (e: React.DragEvent, desk: Desk) => {
    if (desk.studentIds.length === 0 || desk.studentIds.length > 1) {
      e.preventDefault();
      return;
    }
    const student = getStudentForDesk(desk.studentIds[0]);
    if (!student) {
      e.preventDefault();
      return;
    }

    const payload = {
      type: 'desk-student',
      studentId: student.id,
      studentName: student.name,
      sourcePc: desk.pcNumber
    };

    setDraggedDeskId(desk.pcNumber);
    setDraggedStudentData(payload);

    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';

    // Custom drag image showing student name only (PC name does not move)
    try {
      const ghost = document.createElement('div');
      ghost.style.position = 'fixed';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.padding = '6px 14px';
      ghost.style.background = '#2563eb';
      ghost.style.color = '#ffffff';
      ghost.style.borderRadius = '20px';
      ghost.style.fontWeight = 'bold';
      ghost.style.fontSize = '12px';
      ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      ghost.style.zIndex = '99999';
      ghost.style.pointerEvents = 'none';
      ghost.innerText = `👤 ${student.name} (ផ្លាស់ប្តូរតុ)`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 100);
    } catch (err) {}
  };

  const handleDragStartUnassigned = (e: React.DragEvent, student: Student) => {
    const payload = {
      type: 'unassigned-student',
      studentId: student.id,
      studentName: student.name
    };

    setDraggedDeskId('unassigned');
    setDraggedStudentData(payload);

    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';

    try {
      const ghost = document.createElement('div');
      ghost.style.position = 'fixed';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.padding = '6px 14px';
      ghost.style.background = '#059669';
      ghost.style.color = '#ffffff';
      ghost.style.borderRadius = '20px';
      ghost.style.fontWeight = 'bold';
      ghost.style.fontSize = '12px';
      ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      ghost.style.zIndex = '99999';
      ghost.style.pointerEvents = 'none';
      ghost.innerText = `👤 ${student.name} (ដាក់លើតុ)`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 100);
    } catch (err) {}
  };

  const handleDragOver = (e: React.DragEvent, targetPc: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPc !== targetPc) {
      setDragOverPc(targetPc);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, targetPc: string) => {
    if (dragOverPc === targetPc) {
      setDragOverPc(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedDeskId(null);
    setDragOverPc(null);
    setDraggedStudentData(null);
    setIsDragOverUnassign(false);
  };

  const handleDrop = async (e: React.DragEvent, targetDesk: Desk) => {
    e.preventDefault();
    setDragOverPc(null);
    setIsDragOverUnassign(false);

    if (targetDesk.pcNumber === 'Teacher PC') {
      alert('មិនអាចដាក់សិស្សលើតុគ្រូបានទេ!');
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }
    if (targetDesk.status === 'Issue') {
      alert('មិនអាចដាក់សិស្សលើកុំព្យូទ័រខូចបានទេ!');
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }
    if (targetDesk.studentIds.length > 1) {
      alert('តុនេះមានបញ្ហាជាន់គ្នា សូមដកសិស្សចេញជាមុនសិន!');
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }

    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) {
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }

    let payload: { type?: string; studentId?: string; studentName?: string; sourcePc?: string } = {};
    try {
      payload = JSON.parse(rawData);
    } catch {
      payload = { sourcePc: rawData };
    }

    // Dropped on the exact same desk
    if (payload.sourcePc === targetDesk.pcNumber) {
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }

    if (!activeYear || !selectedClass) return;
    const currentYear = activeYear;
    const currentClass = selectedClass;

    const sourceStudentId = payload.studentId || (payload.sourcePc ? desks.find(d => d.pcNumber === payload.sourcePc)?.studentIds[0] : null);
    if (!sourceStudentId) {
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }

    const targetStudentId = targetDesk.studentIds.length === 1 ? targetDesk.studentIds[0] : null;
    const sourceStudent = students.find(s => s.id === sourceStudentId);
    if (!sourceStudent) {
      setDraggedDeskId(null);
      setDraggedStudentData(null);
      return;
    }

    const sourcePc = payload.sourcePc || sourceStudent.pcNumber;

    // 1. INSTANT OPTIMISTIC UI UPDATE (0ms visual delay)
    setStudents(prev => prev.map(s => {
      if (s.id === sourceStudentId) {
        return { ...s, pcNumber: targetDesk.pcNumber };
      }
      if (targetStudentId && s.id === targetStudentId) {
        return { ...s, pcNumber: sourcePc || undefined };
      }
      return s;
    }));

    setDesks(prev => prev.map(d => {
      if (d.pcNumber === targetDesk.pcNumber) {
        return { ...d, studentIds: [sourceStudentId] };
      }
      if (sourcePc && d.pcNumber === sourcePc) {
        return { ...d, studentIds: targetStudentId ? [targetStudentId] : [] };
      }
      return d;
    }));

    // Reset drag UI state immediately
    setDraggedDeskId(null);
    setDraggedStudentData(null);
    setDragOverPc(null);
    setIsDragOverUnassign(false);

    // Instant user feedback
    if (sourcePc && targetStudentId) {
      const targetStudent = students.find(s => s.id === targetStudentId);
      setFeedbackMessage({
        type: 'success',
        text: `បានប្តូរកន្លែងអង្គុយរវាង ${sourceStudent.name} (${targetDesk.pcNumber}) និង ${targetStudent?.name || ''} (${sourcePc}) ដោយជោគជ័យ!`
      });
    } else if (sourcePc) {
      setFeedbackMessage({
        type: 'success',
        text: `បានផ្លាស់ប្តូរ ${sourceStudent.name} ទៅតុ ${targetDesk.pcNumber} ដោយជោគជ័យ!`
      });
    } else {
      setFeedbackMessage({
        type: 'success',
        text: `បានដាក់សិស្ស ${sourceStudent.name} ឲ្យអង្គុយតុ ${targetDesk.pcNumber} ដោយជោគជ័យ!`
      });
    }

    // 2. BACKGROUND PERSISTENCE (Runs asynchronously without blocking UI)
    (async () => {
      try {
        const db = await initDB();
        const studentsToUpdate: Student[] = [];
        const syncPromises: Promise<any>[] = [];

        if (sourcePc) {
          let sourcePwd = sourceStudent.password;
          if (!sourcePwd || !/^\d{3}$/.test(sourcePwd)) {
            const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
            sourcePwd = generateUniquePassword(existingPasswords);
          }

          syncPromises.push(queuePcSyncTask(db, sourceStudent, sourcePc, 'REMOVE', currentYear));
          syncPromises.push(queuePcSyncTask(db, sourceStudent, targetDesk.pcNumber, 'ADD', currentYear, sourcePwd));
          studentsToUpdate.push({ ...sourceStudent, pcNumber: targetDesk.pcNumber, password: sourcePwd });

          if (targetStudentId) {
            const targetStudent = students.find(s => s.id === targetStudentId);
            if (targetStudent) {
              let targetPwd = targetStudent.password;
              if (!targetPwd || !/^\d{3}$/.test(targetPwd)) {
                const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
                existingPasswords.add(sourcePwd);
                targetPwd = generateUniquePassword(existingPasswords);
              }
              syncPromises.push(queuePcSyncTask(db, targetStudent, targetDesk.pcNumber, 'REMOVE', currentYear));
              syncPromises.push(queuePcSyncTask(db, targetStudent, sourcePc, 'ADD', currentYear, targetPwd));
              studentsToUpdate.push({ ...targetStudent, pcNumber: sourcePc, password: targetPwd });
            }
          }
        } else {
          let pwd = sourceStudent.password;
          if (!pwd || !/^\d{3}$/.test(pwd)) {
            const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
            pwd = generateUniquePassword(existingPasswords);
          }

          syncPromises.push(queuePcSyncTask(db, sourceStudent, targetDesk.pcNumber, 'ADD', currentYear, pwd));
          studentsToUpdate.push({ ...sourceStudent, pcNumber: targetDesk.pcNumber, password: pwd });

          if (targetStudentId) {
            const targetStudent = students.find(s => s.id === targetStudentId);
            if (targetStudent) {
              syncPromises.push(queuePcSyncTask(db, targetStudent, targetDesk.pcNumber, 'REMOVE', currentYear));
              studentsToUpdate.push({ ...targetStudent, pcNumber: null as any });
            }
          }
        }

        await Promise.all([
          db.putMany('students', studentsToUpdate),
          ...syncPromises
        ]);

        setStudents(prev => prev.map(s => {
          const updated = studentsToUpdate.find(u => u.id === s.id);
          return updated ? { ...s, ...updated } : s;
        }));
      } catch (error) {
        console.error('Failed to persist drag drop changes:', error);
        const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
        await loadData(currentYear, currentClass, shift, true);
      }
    })();
  };

  const handleDropToUnassign = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverUnassign(false);
    setDragOverPc(null);

    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;

    let payload: { studentId?: string; sourcePc?: string } = {};
    try {
      payload = JSON.parse(rawData);
    } catch {
      payload = { sourcePc: rawData };
    }

    const studentId = payload.studentId || (payload.sourcePc ? desks.find(d => d.pcNumber === payload.sourcePc)?.studentIds[0] : null);
    if (!studentId || !activeYear || !selectedClass) return;

    const student = students.find(s => s.id === studentId);
    if (!student || !student.pcNumber) return;

    const sourcePc = student.pcNumber;

    // 1. INSTANT OPTIMISTIC UPDATE
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, pcNumber: undefined } : s));
    setDesks(prev => prev.map(d => d.pcNumber === sourcePc ? { ...d, studentIds: [] } : d));
    setFeedbackMessage({
      type: 'info',
      text: `បានដកសិស្ស ${student.name} ចេញពីតុ ${sourcePc} រួចរាល់!`
    });

    setDraggedDeskId(null);
    setDraggedStudentData(null);
    setDragOverPc(null);
    setIsDragOverUnassign(false);

    // 2. BACKGROUND PERSISTENCE
    (async () => {
      try {
        const db = await initDB();
        await Promise.all([
          queuePcSyncTask(db, student, sourcePc, 'REMOVE', activeYear),
          db.update('students', student.id, { pcNumber: null })
        ]);
      } catch (err: any) {
        console.error('Failed to unassign student:', err);
        const shift = classes.find(c => c.id === selectedClass)?.shift || 'Morning';
        await loadData(activeYear, selectedClass, shift, true);
      }
    })();
  };

  // -------------------------------------------------------------
  // Password & Assignment Logic
  // -------------------------------------------------------------
  const generateUniquePassword = (existingPasswords: Set<string>): string => {
    let newPassword = '';
    let attempts = 0;
    do {
      const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
      // 3 digits: 100 to 999
      newPassword = String(100 + (randomValue % 900));
      attempts++;
      if (attempts > 2000) break;
    } while (existingPasswords.has(newPassword));
    return newPassword;
  };

  /**
   * Fetch existing passwords directly from Supabase (bypasses omitFromSelect
   * in the DB adapter) so that we can avoid generating duplicates.
   * Scoped to user's branch to prevent cross-branch data leakage.
   */
  const fetchExistingPasswords = async (targetClass: string, targetYear: string): Promise<Set<string>> => {
    // Resolve the user's branch first to scope the query
    let userBranch: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('branch')
        .eq('id', user.id)
        .single();
      userBranch = profile?.branch ?? null;
    }

    let query = supabase
      .from('students')
      .select('password')
      .eq('class', targetClass)
      .eq('academic_year', targetYear)
      .eq('status', 'Active')
      .not('password', 'is', null);

    if (userBranch) {
      query = query.eq('branch', userBranch);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch existing passwords:', error);
      return new Set();
    }

    return new Set(
      (data ?? []).map((row: { password: string | null }) => row.password).filter(Boolean) as string[]
    );
  };

  const generatePasswordForStudent = async (studentId: string) => {
    if (!activeYear || !selectedClass) return;
    const currentYear = activeYear;
    const currentClass = selectedClass;

    try {
      const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
      const newPassword = generateUniquePassword(existingPasswords);
      
      const db = await initDB();
      // Partial update to avoid overwriting concurrent changes
      await db.update('students', studentId, { password: newPassword });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, password: newPassword } : s));
      
      const student = getStudentForDesk(studentId);
      if (student && student.pcNumber) {
        await queuePcSyncTask(db, student, student.pcNumber, 'UPDATE_PASSWORD', currentYear, newPassword);
      }
      
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('បរាជ័យក្នុងការបង្កើត Password');
    }
  };

  const handleManualSetPassword = async (studentId: string, currentPassword?: string) => {
    if (!activeYear || !selectedClass) return;
    const input = window.prompt('សូមបញ្ចូល Password ថ្មី (៣ ខ្ទង់គត់ ឧ. 123):', currentPassword || '');
    if (input === null) return;
    const cleanPwd = input.trim();
    if (!/^\d{3}$/.test(cleanPwd)) {
      alert('Password ត្រូវតែជាលេខ ៣ ខ្ទង់គត់ (ឧ. 123 ឬ 888)!');
      return;
    }

    const applyPassword = async () => {
      const currentYear = activeYear;
      const currentClass = selectedClass;
      try {
        setIsSaving(true);
        const db = await initDB();
        await db.update('students', studentId, { password: cleanPwd });
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, password: cleanPwd } : s));
        const student = getStudentForDesk(studentId);
        if (student && student.pcNumber) {
          await queuePcSyncTask(db, student, student.pcNumber, 'UPDATE_PASSWORD', currentYear, cleanPwd);
        }
        const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
        await loadData(currentYear, currentClass, shift, true);
        setFeedbackMessage({
          type: 'success',
          text: `បានកំណត់ Password "${cleanPwd}" ជោគជ័យ!`,
        });
      } catch (error: any) {
        console.error(error);
        alert('មានបញ្ហាក្នុងការកំណត់ Password: ' + error.message);
      } finally {
        setIsSaving(false);
      }
    };

    const duplicateStudent = students.find(s => s.id !== studentId && s.password === cleanPwd);
    if (duplicateStudent) {
      openConfirm({
        title: 'លេខសម្ងាត់ជាន់គ្នា',
        message: `លេខសម្ងាត់ "${cleanPwd}" ត្រូវបានប្រើប្រាស់ដោយសិស្ស ${duplicateStudent.name} រួចហើយ។ តើអ្នកពិតជាចង់កំណត់លេខជាន់គ្នានេះមែនទេ?`,
        confirmText: 'កំណត់ជាន់គ្នា',
        cancelText: 'បោះបង់',
        variant: 'warning',
        onConfirm: applyPassword,
      });
      return;
    }

    await applyPassword();
  };

  const generatePasswordsForClass = () => {
    if (!selectedClass || students.length === 0 || !activeYear) return;
    
    openConfirm({
      title: 'បង្កើត Password រួមសម្រាប់ថ្នាក់',
      message: 'តើអ្នកពិតជាចង់បង្កើត Password ថ្មីសម្រាប់សិស្សទាំងអស់ក្នុងថ្នាក់នេះមែនទេ? (Password ចាស់នឹងត្រូវបាត់បង់)',
      confirmText: 'បង្កើតថ្មី',
      cancelText: 'បោះបង់',
      variant: 'primary',
      onConfirm: async () => {
        setIsSaving(true);
        const currentYear = activeYear;
        const currentClass = selectedClass;

        try {
          const usedPasswords = new Set<string>();
          const db = await initDB();
          const studentsToUpdate = [];
          const syncPromises: Promise<any>[] = [];

          for (let i = 0; i < students.length; i++) {
            const newPassword = generateUniquePassword(usedPasswords);
            usedPasswords.add(newPassword);
            const updatedStudent = { ...students[i], password: newPassword };
            studentsToUpdate.push(updatedStudent);
            
            if (students[i].pcNumber) {
              syncPromises.push(queuePcSyncTask(db, students[i], students[i].pcNumber!, 'UPDATE_PASSWORD', currentYear, newPassword));
            }
          }
          
          await Promise.all([
            db.putMany('students', studentsToUpdate),
            ...syncPromises
          ]);
          setStudents(studentsToUpdate);
          setFeedbackMessage({
            type: 'success',
            text: 'បង្កើត Password រួមបានជោគជ័យ!',
          });
          const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
          await loadData(currentYear, currentClass, shift, true);
        } catch (error: any) {
          alert('មានបញ្ហាក្នុងការបង្កើត Password: ' + error.message);
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const getStudentForDesk = (studentId?: string) => {
    return students.find(s => s.id === studentId);
  };

  const handleAssignStudent = async (studentId: string) => {
    if (!selectedDesk || !activeYear || !selectedClass) return;
    if (selectedDesk.status === 'Issue' || selectedDesk.pcNumber === 'Teacher PC') {
      alert(`មិនអាចកំណត់តុ ${selectedDesk.pcNumber} បានទេ ព្រោះកុំព្យូទ័រនេះខូច/មិនអាចប្រើប្រាស់បាន!`);
      return;
    }
    const currentYear = activeYear;
    const currentClass = selectedClass;

    setIsSaving(true);
    try {
      const db = await initDB();
      const student = getStudentForDesk(studentId);
      
      // Check seat conflicts against all students attending this class (including shift switching)
      const allStudents = await db.getAll('students', currentYear);
      const attendingStudents = allStudents.filter(s =>
        s.status !== 'Inactive' && (
          (s.class === currentClass && !(s.isShiftSwitching && s.alternateClassId && s.alternateClassId !== currentClass)) ||
          (s.alternateClassId === currentClass && s.isShiftSwitching && s.class !== currentClass)
        )
      );
      const conflict = attendingStudents.find(
        s => s.id !== studentId && s.pcNumber === selectedDesk.pcNumber
      );

      if (conflict) {
        alert(`មិនអាចកំណត់តុ ${selectedDesk.pcNumber} បានទេ ព្រោះ ${conflict.name} អង្គុយរួចហើយ។ ប្លង់នឹង Refresh ឥឡូវនេះ។`);
        const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
        await loadData(currentYear, currentClass, shift, true);
        return;
      }

      if (student) {
        if (student.pcNumber && student.pcNumber !== selectedDesk.pcNumber) {
          await queuePcSyncTask(db, student, student.pcNumber, 'REMOVE', currentYear);
        }
        let pwd = student.password;
        if (!pwd || !/^\d{3}$/.test(pwd)) {
          const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
          pwd = generateUniquePassword(existingPasswords);
        }
        await queuePcSyncTask(db, student, selectedDesk.pcNumber, 'ADD', currentYear, pwd);
        await db.update('students', studentId, { pcNumber: selectedDesk.pcNumber, password: pwd });
      } else {
        await db.update('students', studentId, { pcNumber: selectedDesk.pcNumber });
      }
      
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('បរាជ័យក្នុងការចាត់តាំងតុ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveStudentToDesk = async (studentId: string, fromPc: string, toPc: string) => {
    if (!activeYear || !selectedClass || !fromPc || !toPc || fromPc === toPc) return;
    const currentYear = activeYear;
    const currentClass = selectedClass;

    const targetDesk = desks.find(d => d.pcNumber === toPc);
    if (!targetDesk || targetDesk.status === 'Issue' || targetDesk.pcNumber === 'Teacher PC') {
      alert(`មិនអាចប្តូរទៅតុ ${toPc} បានទេ ព្រោះកុំព្យូទ័រនេះខូច/មិនអាចប្រើប្រាស់បាន!`);
      return;
    }

    const sourceStudent = students.find(s => s.id === studentId);
    if (!sourceStudent) return;

    // Check if target desk has an occupant
    const targetStudentId = targetDesk.studentIds.length > 0 ? targetDesk.studentIds[0] : null;
    const targetStudent = targetStudentId ? students.find(s => s.id === targetStudentId) : null;

    setIsSaving(true);
    try {
      const db = await initDB();
      const studentsToUpdate: Student[] = [];

      let sourcePwd = sourceStudent.password;
      if (!sourcePwd || !/^\d{3}$/.test(sourcePwd)) {
        const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
        sourcePwd = generateUniquePassword(existingPasswords);
      }

      // 1. Move source student to toPc
      await queuePcSyncTask(db, sourceStudent, fromPc, 'REMOVE', currentYear);
      await queuePcSyncTask(db, sourceStudent, toPc, 'ADD', currentYear, sourcePwd);
      studentsToUpdate.push({ ...sourceStudent, pcNumber: toPc, password: sourcePwd });

      // 2. If target had a student, move them to fromPc (swap)
      if (targetStudent) {
        let targetPwd = targetStudent.password;
        if (!targetPwd || !/^\d{3}$/.test(targetPwd)) {
          const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
          existingPasswords.add(sourcePwd);
          targetPwd = generateUniquePassword(existingPasswords);
        }
        await queuePcSyncTask(db, targetStudent, toPc, 'REMOVE', currentYear);
        await queuePcSyncTask(db, targetStudent, fromPc, 'ADD', currentYear, targetPwd);
        studentsToUpdate.push({ ...targetStudent, pcNumber: fromPc, password: targetPwd });
      }

      await db.putMany('students', studentsToUpdate);
      setStudents(prev => prev.map(s => {
        const found = studentsToUpdate.find(u => u.id === s.id);
        return found ? found : s;
      }));

      setSelectedDesk(null);

      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);

      if (targetStudent) {
        alert(`បានប្តូរកន្លែងអង្គុយរវាង ${sourceStudent.name} (${toPc}) និង ${targetStudent.name} (${fromPc}) ដោយជោគជ័យ!`);
      } else {
        alert(`បានផ្លាស់ប្តូរសិស្ស ${sourceStudent.name} ទៅកាន់តុ ${toPc} ដោយជោគជ័យ!`);
      }
    } catch (error: any) {
      console.error(error);
      alert('មានបញ្ហាក្នុងការផ្លាស់ប្តូរតុ៖ ' + (error.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassignStudent = (studentId: string) => {
    if (!selectedDesk || !activeYear || !selectedClass) return;
    const student = getStudentForDesk(studentId);
    openConfirm({
      title: 'បញ្ជាក់ការដកសិស្សចេញពីតុ',
      message: `តើអ្នកពិតជាចង់ដកសិស្ស ${student?.name || ''} ចេញពីតុ ${selectedDesk.pcNumber} មែនទេ?`,
      confirmText: 'ដកចេញ',
      cancelText: 'បោះបង់',
      variant: 'danger',
      onConfirm: async () => {
        const currentYear = activeYear;
        const currentClass = selectedClass;

        setIsSaving(true);
        try {
          const db = await initDB();
          // Partial update to safely clear pcNumber and password
          if (student && student.pcNumber) {
            await queuePcSyncTask(db, student, student.pcNumber, 'REMOVE', currentYear);
          }
          // Partial update to safely clear pcNumber while preserving password
          await db.update('students', studentId, { pcNumber: null });
          
          setFeedbackMessage({
            type: 'success',
            text: `បានដកសិស្ស ${student?.name || ''} ចេញពីតុ ${selectedDesk.pcNumber} ជោគជ័យ!`,
          });
          const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
          await loadData(currentYear, currentClass, shift, true);
        } catch (error) {
          console.error(error);
          alert('បរាជ័យក្នុងការដកសិស្សចេញពីតុ');
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleClearAllAssignments = () => {
    if (!selectedClass || students.length === 0 || !activeYear) return;
    
    openConfirm({
      title: 'បញ្ជាក់ការលុបទិន្នន័យតុទាំងអស់',
      message: 'តើអ្នកពិតជាចង់ដកសិស្សទាំងអស់ចេញពីតុ និងលុប Password ចោលមែនទេ?',
      confirmText: 'លុបទិន្នន័យ',
      cancelText: 'បោះបង់',
      variant: 'danger',
      onConfirm: async () => {
        setIsSaving(true);
        const currentYear = activeYear;
        const currentClass = selectedClass;

        try {
          const db = await initDB();
          const studentsToUpdate = [];
          const syncPromises: Promise<any>[] = [];

          for (let i = 0; i < students.length; i++) {
            if (students[i].pcNumber || students[i].password) {
              if (students[i].pcNumber) {
                syncPromises.push(queuePcSyncTask(db, students[i], students[i].pcNumber!, 'REMOVE', currentYear));
              }
              const updatedStudent = { ...students[i], pcNumber: null, password: null };
              studentsToUpdate.push(updatedStudent);
            }
          }
          
          await Promise.all([
            db.putMany('students', studentsToUpdate),
            ...syncPromises
          ]);
          setFeedbackMessage({
            type: 'success',
            text: 'លុបទិន្នន័យតុបានជោគជ័យ!',
          });
          const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
          await loadData(currentYear, currentClass, shift, true);
        } catch (error: any) {
          alert('មានបញ្ហាក្នុងការលុបទិន្នន័យតុ: ' + error.message);
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleAutoAssign = async () => {
    if (!selectedClass || !activeYear) return;
    
    const gridPcSet = new Set(desks.map(d => d.pcNumber));

    // Sort unassigned students by Khmer name (including any with invalid/stale desk numbers)
    const unassignedStudents = students
      .filter(s => !s.pcNumber || !gridPcSet.has(s.pcNumber))
      .sort(compareStudentsByKhmerName);

    if (unassignedStudents.length === 0) {
      alert('មិនមានសិស្សទំនេរដែលត្រូវរៀបចំទេ។');
      return;
    }

    // Get available desks sorted in natural numerical order (PC-01, PC-02, ..., PC-35)
    const availableDesks = desks
      .filter(d => d.pcNumber !== 'Teacher PC' && d.status === 'Good' && d.studentIds.length === 0)
      .sort((a, b) => a.pcNumber.localeCompare(b.pcNumber, undefined, { numeric: true, sensitivity: 'base' }));
    
    if (availableDesks.length === 0) {
      alert('មិនមានកុំព្យូទ័រទំនេរ និងល្អគ្រប់គ្រាន់ទេ។');
      return;
    }

    const assignableCount = Math.min(unassignedStudents.length, availableDesks.length);
    openConfirm({
      title: 'បញ្ជាក់ការរៀបចំកន្លែងអង្គុយស្វ័យប្រវត្តិ',
      message: `តើអ្នកពិតជាចង់រៀបចំកន្លែងអង្គុយដោយស្វ័យប្រវត្តិចំនួន ${assignableCount} នាក់មែនទេ?`,
      confirmText: 'រៀបចំ',
      cancelText: 'បោះបង់',
      variant: 'primary',
      onConfirm: async () => {
        setIsSaving(true);
        const currentYear = activeYear;
        const currentClass = selectedClass;

        try {
          const db = await initDB();
          const studentsToUpdate: any[] = [];
          const existingPasswords = await fetchExistingPasswords(currentClass, currentYear);
          const usedPasswords = new Set<string>([
            ...existingPasswords,
            ...students.map(s => s.password).filter(Boolean) as string[]
          ]);

          const syncPromises: Promise<any>[] = [];
          let assignedCount = 0;
          for (let i = 0; i < unassignedStudents.length; i++) {
            if (i < availableDesks.length) {
              let pwd = unassignedStudents[i].password;
              if (!pwd || !/^\d{3}$/.test(pwd)) {
                pwd = generateUniquePassword(usedPasswords);
                usedPasswords.add(pwd);
              }
              const student = { ...unassignedStudents[i], pcNumber: availableDesks[i].pcNumber, password: pwd };
              studentsToUpdate.push(student);
              syncPromises.push(queuePcSyncTask(db, student, availableDesks[i].pcNumber, 'ADD', currentYear, pwd));
              assignedCount++;
            }
          }
          
          await Promise.all([
            db.putMany('students', studentsToUpdate),
            ...syncPromises
          ]);
          setFeedbackMessage({
            type: 'success',
            text: `បានរៀបចំកន្លែងអង្គុយដោយស្វ័យប្រវត្តិជូនសិស្សចំនួន ${assignedCount} នាក់ជោគជ័យ!`,
          });
          const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
          await loadData(currentYear, currentClass, shift, true);
        } catch (error: any) {
          alert('មានបញ្ហាក្នុងការរៀបចំកន្លែងអង្គុយដោយស្វ័យប្រវត្តិ: ' + error.message);
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  // -------------------------------------------------------------
  // Issue Reporting Logic
  // -------------------------------------------------------------
  const handleReportIssue = async () => {
    if (!selectedDesk || !activeYear || !selectedClass || !issueDescription.trim()) return;
    
    const currentYear = activeYear;
    const currentClass = selectedClass;
    const targetPc = selectedDesk.pcNumber;

    const alreadyActive = pcIssues.some(
      issue => issue.pcNumber === targetPc && issue.academicYear === currentYear && isPcIssueActive(issue.status)
    );
    
    if (alreadyActive) {
      alert('កុំព្យូទ័រនេះត្រូវបានរាយការណ៍រួចហើយ។');
      return;
    }

    setIsSaving(true);
    try {
      const db = await initDB();
      const today = new Date().toISOString().split('T')[0];
      const desc = issueDescription.trim();
      const newIssue: PCIssue = {
        id: crypto.randomUUID(),
        pcNumber: targetPc,
        seatNumber: targetPc,
        status: 'Issue',
        description: desc,
        currentIssue: desc,
        reportedBy: (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || user?.email || 'គ្រូបង្រៀន',
        reportedDate: today,
        dateFound: today,
        academicYear: currentYear
      };
      
      await db.put('pcIssues', newIssue);

      // Lab-wide auto-unassign: remove any student assigned to this PC across all classes in the ICT Lab
      const allStudentsInYear = await db.getAll('students', currentYear);
      const affectedStudents = allStudentsInYear.filter(s => s.pcNumber === targetPc);
      if (affectedStudents.length > 0) {
        const studentUpdates: any[] = [];
        const syncPromises: Promise<any>[] = [];
        for (const s of affectedStudents) {
          syncPromises.push(queuePcSyncTask(db, s, targetPc, 'REMOVE', currentYear));
          studentUpdates.push({ ...s, pcNumber: null });
        }
        await Promise.all([
          db.putMany('students', studentUpdates),
          ...syncPromises
        ]);
      }

      setIsReportingIssue(false);
      setIssueDescription('');
      
      window.dispatchEvent(new CustomEvent('appDataChanged'));

      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('បរាជ័យក្នុងការរាយការណ៍បញ្ហា');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedDesk || !activeYear || !selectedClass) return;
    
    const currentYear = activeYear;
    const currentClass = selectedClass;
    const targetPc = selectedDesk.pcNumber;

    // Find all active issues for this PC in this year (in case duplicates were created concurrently)
    const activeIssues = pcIssues.filter(issue => issue.pcNumber === targetPc && issue.academicYear === currentYear && isPcIssueActive(issue.status));
    
    if (activeIssues.length > 0) {
      setIsSaving(true);
      try {
        const db = await initDB();
        const today = new Date().toISOString().split('T')[0];
        const issuesToUpdate = activeIssues.map(issue => ({
          ...issue,
          status: 'Good' as const,
          resolvedDate: today,
          dateResolved: today,
          resolution: issue.resolution || 'ជួសជុលរួចរាល់'
        }));
        await db.putMany('pcIssues', issuesToUpdate);
        
        window.dispatchEvent(new CustomEvent('appDataChanged'));

        const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
        await loadData(currentYear, currentClass, shift, true);
      } catch (error) {
        console.error(error);
        alert('បរាជ័យក្នុងការដោះស្រាយបញ្ហា');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const deskPcSet = new Set(desks.map(d => d.pcNumber));
  const unassignedStudentsList = students
    .filter(s => !s.pcNumber || !deskPcSet.has(s.pcNumber))
    .sort(compareStudentsByKhmerName);

  const renderDesk = (desk: Desk) => {
    const isTeacher = desk.pcNumber === 'Teacher PC';
    const isConflict = desk.studentIds.length > 1;
    const student = desk.studentIds.length === 1 ? getStudentForDesk(desk.studentIds[0]) : null;

    let borderClass = 'border-border/80';
    let bgClass = 'bg-surface hover:bg-surface-hover/60';
    let iconColor = 'text-primary';

    if (isTeacher) {
      borderClass = 'border-emerald-300';
      bgClass = 'bg-emerald-50/70 hover:bg-emerald-100/70';
      iconColor = 'text-emerald-600';
    } else if (desk.status === 'Issue') {
      borderClass = 'border-rose-300';
      bgClass = 'bg-rose-50/80 hover:bg-rose-100/80';
      iconColor = 'text-rose-600';
    } else if (isConflict) {
      borderClass = 'border-amber-400 ring-2 ring-amber-400/60';
      bgClass = 'bg-amber-50/80 hover:bg-amber-100/80';
      iconColor = 'text-amber-600';
    } else if (student) {
      borderClass = 'border-blue-200/90';
      bgClass = 'bg-blue-50/40 hover:bg-blue-50/80';
    }
    
    const isDragging = draggedDeskId === desk.pcNumber;
    const isDropTarget = dragOverPc === desk.pcNumber && !isTeacher && desk.status !== 'Issue' && isEditMode;
    const rotation = currentLayout?.deskRotations?.[desk.pcNumber] || 0;

    return (
      <div 
        key={desk.id} 
        draggable={isEditMode && !isTeacher && desk.studentIds.length === 1 && !!student}
        onDragStart={(e) => isEditMode && handleDragStart(e, desk)}
        onDragOver={(e) => isEditMode && handleDragOver(e, desk.pcNumber)}
        onDragLeave={(e) => isEditMode && handleDragLeave(e, desk.pcNumber)}
        onDrop={(e) => isEditMode && handleDrop(e, desk)}
        onDragEnd={handleDragEnd}
        className={`flex flex-col h-full min-h-[126px] border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md relative
          ${borderClass} ${bgClass} 
          ${isDragging ? 'opacity-40 scale-95 border-dashed border-2 border-blue-400' : ''}
          ${isDropTarget ? 'ring-4 ring-blue-500 ring-offset-2 border-blue-500 bg-blue-50/90 scale-[1.03] shadow-lg z-10' : ''}
          ${!isTeacher && desk.status !== 'Issue' && !isEditMode ? 'active:scale-95' : ''}
          ${isEditMode && !!student ? 'cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md' : ''}
        `}
        onClick={() => handleDeskClick(desk)}
      >
        {/* Drop target overlay */}
        {isDropTarget && (
          <div className="absolute inset-0 bg-blue-600/10 border-2 border-dashed border-blue-600 rounded-xl flex flex-col items-center justify-center p-2 z-20 backdrop-blur-[1px] animate-pulse pointer-events-none">
            <div className="bg-blue-600 text-white px-2.5 py-1 rounded-full shadow-md text-[11px] font-bold flex items-center gap-1">
              {desk.studentIds.length === 0 ? (
                <span>📥 ដាក់លើតុ {desk.pcNumber}</span>
              ) : (
                <span>🔄 ប្តូរកន្លែងជាមួយ {student?.name || desk.pcNumber}</span>
              )}
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
            <button 
              type="button"
              className="p-1 bg-white border border-gray-200 hover:border-rose-300 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 shadow-2xs transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveDeskFromGrid(desk.pcNumber);
              }}
              title="លុបតុនេះចេញពីប្លង់"
            >
              <Trash2 size={13} />
            </button>
            <button 
              type="button"
              className="p-1 bg-white border border-gray-200 hover:border-blue-300 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 shadow-2xs transition-colors cursor-pointer"
              onClick={(e) => handleRotateDesk(e, desk.pcNumber)}
              title="បង្វិលតុ"
            >
              <RotateCw size={13} />
            </button>
          </div>
        )}
        <div className={`px-2.5 py-1.5 print:py-1 flex items-center justify-between border-b ${borderClass} bg-surface/70`}>
          <div className="flex items-center gap-1.5 pointer-events-none">
            <Monitor size={13} className={`${iconColor} transition-transform duration-300`} style={{ transform: `rotate(${rotation}deg)` }} />
            <span className={`text-[11px] print:text-[10px] font-bold ${isTeacher ? 'text-emerald-800' : 'text-main-text'}`}>
              {desk.pcNumber}
            </span>
          </div>
          {!isTeacher && desk.status === 'Issue' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              ខូច
            </span>
          )}
          {!isTeacher && isConflict && (
            <AlertCircle size={13} className="text-amber-500 animate-pulse" />
          )}
        </div>
        <div className="px-2 py-2 print:p-1 flex-1 flex flex-col min-h-[90px] print:min-h-[60px] pointer-events-none justify-between overflow-visible">
          {isTeacher ? (
            <div className="text-center font-bold text-emerald-800 h-full flex items-center justify-center">តុគ្រូ</div>
          ) : isConflict ? (
            <div className="flex flex-col items-center justify-center text-amber-700 h-full">
              <AlertTriangle size={18} className="mb-1 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">ជាន់គ្នា<br/>{desk.studentIds.length} នាក់</span>
            </div>
          ) : desk.status === 'Issue' ? (
            <div className="flex flex-col items-center justify-center text-rose-600 h-full py-1">
              <AlertTriangle size={22} className="mb-1 text-rose-500 animate-pulse" />
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider text-center leading-tight">
                កុំព្យូទ័រខូច
              </span>
              <span className="text-[10px] text-rose-500/80 font-medium mt-0.5">
                (មិនអាចប្រើប្រាស់)
              </span>
            </div>
          ) : student ? (
            (() => {
              const displayName = language === 'KH' ? student.name : (student.englishName || student.name);
              const nameLen = (displayName || '').length;
              const fontStyleClass = nameLen > 20 
                ? 'text-[11px] leading-[1.7]' 
                : nameLen > 14 
                  ? 'text-xs leading-[1.75]' 
                  : 'text-[13px] leading-[1.75]';

              return (
                <div className="flex flex-col h-full justify-between gap-1 overflow-visible">
                  <div className="flex-1 flex flex-col justify-center py-1 overflow-visible">
                    <div className={`font-bold text-primary text-center transition-all duration-200 break-words overflow-visible ${fontStyleClass}`}>
                      {displayName}
                    </div>
                    {student.isShiftSwitching && (
                      <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-100/70 px-1 py-0.2 rounded mx-auto mt-0.5" title="សិស្សប្តូរវេន">
                        ប្តូរវេន
                      </span>
                    )}
                  </div>
                  {showPasswords && student.password && (
                    <div className="mt-auto flex items-center justify-center gap-1 px-2 py-0.5 print:py-0.5 bg-surface rounded-md text-[11px] print:text-[10px] font-mono font-bold text-primary border border-border/70 mx-auto min-w-[55px] shadow-2xs">
                      <Key size={11} className="text-secondary-text shrink-0" />
                      <span>{student.password}</span>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center text-secondary-text/50 h-full">
              <Keyboard size={18} className="mb-0.5 opacity-60" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-text/60">ទំនេរ</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeStudentCount = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.studentIds.length > 0).length;
  const emptyDeskCount = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.studentIds.length === 0 && d.status !== 'Issue').length;
  const issueDeskCount = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.status === 'Issue').length;
  const conflictDeskCount = desks.filter(d => d.studentIds.length > 1).length;

  return (
    <div className="flex flex-col w-full pb-16 print:pb-0 space-y-5">
      
      {/* Header Banner - Clean & Modern Ribbon */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <Grid size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">ប្លង់តុសិក្សា</h1>
            <p className="text-xs text-blue-100/80">
              {(() => {
                const selectedClassObj = classes.find(c => c.id === selectedClass);
                return selectedClassObj 
                  ? `ថ្នាក់៖ ${selectedClassObj.name} (${selectedClassObj.shift === 'Morning' ? 'វេនព្រឹក' : selectedClassObj.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'})` 
                  : 'រៀបចំ និងតាមដានកន្លែងអង្គុយសិស្ស';
              })()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {activeYear && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/15 text-white shadow-2xs">
              ឆ្នាំសិក្សា {activeYear}
            </span>
          )}
          <button 
            type="button"
            onClick={handlePrint}
            disabled={isLoading || !selectedClass}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Printer size={15} />
            <span>បោះពុម្ព</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        {/* Active Students on Desks */}
        <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">សិស្សមានកន្លែងអង្គុយ</span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-main-text">{activeStudentCount}</strong>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">នាក់</span>
          </div>
        </div>

        {/* Empty Desks */}
        <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">តុទំនេរ</span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-indigo-700">{emptyDeskCount}</strong>
            <span className="text-xs font-semibold text-indigo-700/80 bg-indigo-100/60 px-2 py-0.5 rounded-md">តុ</span>
          </div>
        </div>

        {/* Issue Desks or Conflicts */}
        <div className="bg-rose-50/70 rounded-2xl border border-rose-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={13} className="text-rose-600" />
            <span>{conflictDeskCount > 0 ? 'ជាន់កន្លែងគ្នា' : 'កុំព្យូទ័រមានបញ្ហា'}</span>
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-rose-700">
              {conflictDeskCount > 0 ? conflictDeskCount : issueDeskCount}
            </strong>
            <span className="text-xs font-semibold text-rose-700/80 bg-rose-100/60 px-2 py-0.5 rounded-md">
              {conflictDeskCount > 0 ? 'តុ' : 'គ្រឿង'}
            </span>
          </div>
        </div>

        {/* Total Students in Class */}
        <div className="bg-sky-50/70 rounded-2xl border border-sky-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">សិស្សសរុបក្នុងថ្នាក់</span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-sky-700">{students.length}</strong>
            <span className="text-xs font-semibold text-sky-700/80 bg-sky-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>
      </section>

      {/* Control & Action Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs print:hidden">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center">
          {/* Class Select & Password Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px]">
              <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider block mb-1.5">
                ថ្នាក់រៀន
              </label>
              <select 
                className="w-full bg-background border border-border text-main-text text-sm rounded-xl px-3.5 py-2 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={isSaving || isLoading}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    ថ្នាក់ {c.name} ({c.shift === 'Morning' ? 'វេនព្រឹក' : c.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'})
                  </option>
                ))}
                {classes.length === 0 && <option value="">មិនមានថ្នាក់</option>}
              </select>
            </div>

            <div className="self-end">
              <button 
                type="button"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-2xs active:scale-95 cursor-pointer ${
                  showPasswords 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                    : 'bg-background hover:bg-surface-hover text-secondary-text border-border'
                }`}
                onClick={() => setShowPasswords(!showPasswords)}
              >
                {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>Password</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-end xl:self-center">
            {!isEditMode ? (
              <>
                <button 
                  type="button"
                  onClick={handleAutoAssign}
                  disabled={isSaving || isLoading || !selectedClass}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/80 px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Zap size={15} />
                  <span>រៀបចំស្វ័យប្រវត្តិ</span>
                </button>

                <button 
                  type="button"
                  onClick={generatePasswordsForClass}
                  disabled={isSaving || isLoading || !selectedClass}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-background hover:bg-surface-hover text-secondary-text hover:text-main-text border border-border px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RefreshCw size={15} />
                  <span>Password រួម</span>
                </button>

                <button 
                  type="button"
                  onClick={handleClearAllAssignments}
                  disabled={isSaving || isLoading || !selectedClass}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200/80 px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>លុបទិន្នន័យតុ</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  disabled={isSaving || isLoading || !selectedClass}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Grid size={15} />
                  <span>កែប្លង់បន្ទប់</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-900">
                  <span>ជួរដេក៖</span>
                  <input 
                    type="number" 
                    className="w-14 px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs font-bold text-center outline-hidden"
                    value={builderRows}
                    min={1} max={20}
                    onChange={(e) => handleUpdateGridSize(parseInt(e.target.value) || 1, builderCols)}
                  />
                  <span className="ml-1">ជួរឈរ៖</span>
                  <input 
                    type="number" 
                    className="w-14 px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs font-bold text-center outline-hidden"
                    value={builderCols}
                    min={1} max={20}
                    onChange={(e) => handleUpdateGridSize(builderRows, parseInt(e.target.value) || 1)}
                  />
                </div>

                {/* Reset Layout Button */}
                <button
                  type="button"
                  onClick={handleResetLayoutToDefault}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Reset ប្លង់តុ និងរៀបចំឈ្មោះ PC តាមលំនាំដើម (PC-01 ដល់ PC-35)"
                >
                  <RotateCcw size={14} />
                  <span>Reset ប្លង់តុ</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setIsEditMode(false);
                    if (!activeYear) return;
                    const shift = classes.find(c => c.id === selectedClass)?.shift || 'Morning';
                    loadData(activeYear, selectedClass, shift, true);
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-background hover:bg-surface-hover text-secondary-text border border-border px-3.5 py-2 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  បោះបង់
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setIsEditMode(false);
                    handleSaveLayout();
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>រក្សាទុកប្លង់ថ្មី</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feedback banner for drag & drop or actions */}
      {feedbackMessage && (
        <div className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top-2 print:hidden ${
          feedbackMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          feedbackMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className={feedbackMessage.type === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
            <span>{feedbackMessage.text}</span>
          </div>
          <button 
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-secondary-text hover:text-main-text text-xs px-2 py-0.5 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Unassigned Students Section */}
      {unassignedStudentsList.length > 0 && (
        <div className="bg-amber-50/30 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-xs print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h3 className="text-xs font-bold text-main-text uppercase tracking-wider">
                សិស្សមិនទាន់មានតុ ({unassignedStudentsList.length} នាក់)
              </h3>
            </div>
            {isEditMode && draggedStudentData && draggedStudentData.sourcePc && (
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragOverUnassign(true); }}
                onDragLeave={() => setIsDragOverUnassign(false)}
                onDrop={handleDropToUnassign}
                className={`px-3 py-1.5 rounded-xl border-2 border-dashed transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  isDragOverUnassign ? 'border-rose-500 bg-rose-100 text-rose-700 scale-105' : 'border-rose-300 bg-rose-50 text-rose-600'
                }`}
              >
                <Trash2 size={14} /> <span>ទម្លាក់ទីនេះដើម្បីដកសិស្សចេញពីតុ</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
            {unassignedStudentsList.map(s => (
              <div 
                key={s.id}
                draggable={isEditMode}
                onDragStart={(e) => isEditMode && handleDragStartUnassigned(e, s)}
                onDragEnd={handleDragEnd}
                className={`bg-surface hover:bg-blue-50 border border-border hover:border-blue-300 text-main-text px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-2 text-xs font-medium transition-all select-none ${
                  isEditMode ? 'cursor-grab active:cursor-grabbing hover:scale-102' : 'cursor-default'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                  {s.name.charAt(0)}
                </div>
                <span className="font-bold text-xs">{s.name}</span>
                <span className="text-[10px] text-secondary-text font-mono">({s.studentId})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blueprint Grid Card */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs mb-6 print:border-none print:shadow-none print:bg-transparent overflow-hidden">
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-16 text-secondary-text gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">កំពុងទាញយកទិន្នន័យប្លង់តុ...</span>
          </div>
        ) : (
          <div className="p-4 sm:p-6 print:p-0">

          {/* Edit Mode Notification */}
          {isEditMode && (
            <div className="mb-4 w-full bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs print:hidden">
              <RefreshCw size={15} className="text-blue-600 animate-spin" />
              <span>ទម្រង់កែប្លង់បន្ទប់ (អូសឈ្មោះសិស្សដើម្បីប្តូរកន្លែង)</span>
            </div>
          )}

          {/* Print-only Official Header */}
          <div className="hidden print:flex flex-col items-center justify-center w-full mb-3 pb-2 border-b-2 border-gray-800 text-center">
            <h2 className="text-base font-bold text-gray-900 tracking-wide mb-1">
              ប្លង់តុសិក្សាកុំព្យូទ័រ (Computer Lab Seating Plan)
            </h2>
            <div className="flex items-center justify-center gap-6 text-xs font-semibold text-gray-700">
              <span>
                ថ្នាក់៖ <strong>{classes.find(c => c.id === selectedClass)?.name || selectedClass}</strong>
              </span>
              <span>
                វេន៖ <strong>{(() => {
                  const shift = classes.find(c => c.id === selectedClass)?.shift;
                  return shift === 'Morning' ? 'ព្រឹក' : shift === 'Afternoon' ? 'រសៀល' : 'យប់';
                })()}</strong>
              </span>
              <span>
                ឆ្នាំសិក្សា៖ <strong>{activeYear}</strong>
              </span>
              <span>
                សិស្សសរុប៖ <strong>{students.length} នាក់</strong>
              </span>
            </div>
          </div>

          {currentLayout && (
             <div className="flex flex-col items-center justify-center bg-background rounded-xl p-8 border border-border/50 print:bg-white print:border-none print:p-0 print:w-full w-full overflow-x-auto print:overflow-visible">
               <div 
                 className={`grid gap-3 sm:gap-4 print:gap-1 w-full max-w-7xl print:max-w-none ${isEditMode ? 'p-4 border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-xl' : ''}`}
                 style={{ 
                   gridTemplateColumns: (() => {
                     const cols = currentLayout.gridLayout[0]?.length || 1;
                     if (isEditMode) return `repeat(${cols}, minmax(0, 1fr))`;
                     
                     const rows = currentLayout.gridLayout.length;
                     let template = '';
                     for (let c = 0; c < cols; c++) {
                       let isEmpty = true;
                       for (let r = 0; r < rows; r++) {
                         if (currentLayout.gridLayout[r][c] !== null && currentLayout.gridLayout[r][c] !== '') {
                           isEmpty = false; break;
                         }
                       }
                       template += isEmpty ? ' 4rem' : ' minmax(0, 1fr)';
                     }
                     return template.trim();
                   })()
                 }}
               >
                  {currentLayout.gridLayout.map((row, rIdx) => (
                    row.map((cell, cIdx) => {
                      const isTeacher = cell === 'Teacher PC';
                      const cols = currentLayout.gridLayout[0]?.length || 1;
                      
                      const prevCell = cIdx > 0 ? row[cIdx - 1] : null;
                      // In view mode, if this cell is empty and previous was Teacher PC, skip so Teacher PC spans 2 columns
                      if (prevCell === 'Teacher PC' && !cell && !isEditMode) {
                        return null;
                      }
                      
                      // Teacher PC spans 2 columns only in view mode if next cell is empty
                      const shouldSpanTwo = !isEditMode && isTeacher && cIdx < cols - 1 && !row[cIdx + 1];

                      return (
                        <div 
                          key={`cell-${rIdx}-${cIdx}`} 
                          className={`flex justify-center w-full min-w-[95px] sm:min-w-[110px] md:min-w-[120px] print:min-w-0 ${shouldSpanTwo ? 'col-span-2' : ''}`}
                        >
                           {cell ? (
                             <div className="w-full h-full">
                               {renderDesk(desks.find(d => d.pcNumber === cell) || { id: `temp-${cell}`, pcNumber: cell, studentIds: [], status: 'Good' })}
                             </div>
                           ) : (
                             <div 
                               className={`w-full flex items-center justify-center min-h-[120px] h-full print:h-[75px] ${isEditMode ? 'border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors text-blue-400 font-medium text-xs' : ''}`}
                               onClick={isEditMode ? () => handleCellClickInEditMode(rIdx, cIdx) : undefined}
                             >
                               {isEditMode ? '+ ដាក់តុទីនេះ' : ''}
                             </div>
                           )}
                        </div>
                      );
                    })
                  ))}
               </div>
             </div>
          )}

          {/* Print-only Official Footer */}
          <div className="hidden print:flex items-center justify-between w-full mt-4 pt-2 border-t border-gray-300 text-[11px] text-gray-600">
            <span>កាលបរិច្ឆេទបោះពុម្ព៖ {new Date().toLocaleDateString('km-KH')}</span>
            <span className="font-bold">ហត្ថលេខាគ្រូបង្រៀន</span>
          </div>
        </div>
        )}
      </div>

      {/* Desk Details Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={`ព័ត៌មានតុ ${selectedDesk?.pcNumber}`}
      >
        {selectedDesk && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/80">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${selectedDesk.status === 'Issue' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {selectedDesk.status === 'Issue' ? <MonitorPlay size={22} /> : <Monitor size={22} />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-secondary-text mb-0.5">ស្ថានភាពកុំព្យូទ័រ</p>
                  <p className={`font-bold text-sm ${selectedDesk.status === 'Issue' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {selectedDesk.status === 'Issue' ? 'កុំព្យូទ័រខូច (មានបញ្ហា)' : 'ដំណើរការល្អ'}
                  </p>
                </div>
              </div>
              {selectedDesk.pcNumber !== 'Teacher PC' && (
                <div>
                  {selectedDesk.status === 'Issue' ? (
                     <Button variant="primary" size="sm" onClick={handleMarkResolved} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 size={16} className="mr-1" /> ដោះស្រាយរួចរាល់
                     </Button>
                  ) : (
                     <Button variant="danger" size="sm" onClick={() => setIsReportingIssue(!isReportingIssue)}>
                        <AlertTriangle size={16} className="mr-1" /> រាយការណ៍បញ្ហា
                     </Button>
                  )}
                </div>
              )}
            </div>

            {selectedDesk.status === 'Issue' && (
              (() => {
                const activeIssue = pcIssues.find(i => i.pcNumber === selectedDesk.pcNumber && i.academicYear === activeYear && isPcIssueActive(i.status));
                return activeIssue ? (
                  <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs flex items-start gap-2.5 text-rose-900 animate-in fade-in">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-800">បញ្ហាដែលបានរាយការណ៍៖</p>
                      <p className="text-rose-700 mt-0.5 font-medium">{activeIssue.description || activeIssue.currentIssue || 'មានបញ្ហាមិនអាចប្រើប្រាស់បាន'}</p>
                      {activeIssue.reportedBy && (
                        <p className="text-[10px] text-rose-500/90 mt-1">រាយការណ៍ដោយ៖ {activeIssue.reportedBy} {activeIssue.reportedDate ? `(${activeIssue.reportedDate})` : ''}</p>
                      )}
                    </div>
                  </div>
                ) : null;
              })()
            )}

            {isReportingIssue && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in fade-in slide-in-from-top-4">
                <h4 className="text-xs font-bold text-rose-700 mb-2">រាយការណ៍បញ្ហាកុំព្យូទ័រនេះ</h4>
                <div className="flex gap-2">
                  <Input 
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="បញ្ចូលបញ្ហា (ឧ. ខូច Mouse, បើកមិនចេញ)..."
                    disabled={isSaving}
                  />
                  <Button variant="danger" disabled={isSaving} onClick={handleReportIssue}>រាយការណ៍</Button>
                </div>
              </div>
            )}

            <div className="border-t border-border/80 pt-5">
              <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider mb-3">សិស្សអង្គុយតុនេះ</h3>
              
              {selectedDesk.studentIds.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {selectedDesk.studentIds.length > 1 && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-2xl flex gap-2 items-start text-xs font-medium">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                      <p><strong>បញ្ហាជាន់កន្លែងគ្នា៖</strong> មានសិស្សច្រើនជាងម្នាក់ត្រូវបានចាត់តាំងឲ្យអង្គុយតុនេះ។</p>
                    </div>
                  )}

                  {selectedDesk.studentIds.map(studentId => {
                    const stu = getStudentForDesk(studentId);
                    if (!stu) return null;
                    return (
                      <div key={studentId} className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between p-4 border border-blue-200/80 bg-blue-50/50 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-700 text-sm shadow-2xs">
                              {stu.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-main-text text-sm">{stu.name}</h4>
                              <p className="text-xs text-secondary-text font-mono">អត្តលេខ៖ {stu.studentId}</p>
                            </div>
                          </div>
                          <Button variant="danger" size="sm" onClick={() => handleUnassignStudent(stu.id)} disabled={isSaving}>
                            ដកចេញ
                          </Button>
                        </div>

                        {/* Move / Swap Student to another Desk */}
                        <div className="bg-surface border border-border/80 p-3.5 rounded-2xl shadow-2xs">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-bold text-secondary-text whitespace-nowrap">
                              {selectedDesk.studentIds.length > 1 ? 'រំកិលទៅតុទំនេរ៖' : 'ផ្លាស់ប្តូរទៅតុផ្សេង៖'}
                            </label>
                            <select
                              className="text-xs border rounded-xl px-3 py-1.5 bg-background border-border focus:ring-primary focus:border-primary font-bold max-w-[200px]"
                              value=""
                              onChange={(e) => {
                                const targetPc = e.target.value;
                                if (targetPc) void handleMoveStudentToDesk(stu.id, selectedDesk.pcNumber, targetPc);
                              }}
                              disabled={isSaving}
                            >
                              <option value="" disabled>ជ្រើសរើសតុដើម្បីប្តូរ...</option>
                              {desks
                                .filter(d => {
                                  if (d.pcNumber === 'Teacher PC' || d.pcNumber === selectedDesk.pcNumber || d.status === 'Issue') return false;
                                  if (selectedDesk.studentIds.length > 1) return d.studentIds.length === 0;
                                  return true;
                                })
                                .sort((a, b) => a.pcNumber.localeCompare(b.pcNumber, undefined, { numeric: true }))
                                .map(d => {
                                  const occupant = d.studentIds.length > 0 ? getStudentForDesk(d.studentIds[0]) : null;
                                  return (
                                    <option key={d.pcNumber} value={d.pcNumber}>
                                      {d.pcNumber} {occupant ? `(ប្តូរជាមួយ: ${occupant.name})` : '(តុទំនេរ)'}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>
                        </div>
                        
                        <div className="bg-surface border border-border/80 p-4 rounded-2xl shadow-2xs">
                          <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-2.5">លេខកូដសម្ងាត់</label>
                          <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-border">
                            <div className="flex items-center gap-2.5">
                              <Key size={16} className="text-secondary-text" />
                              <span className="font-mono text-base font-bold tracking-wider text-primary">
                                {stu.password || '---'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => generatePasswordForStudent(stu.id)} disabled={isSaving}>
                                បង្កើតថ្មី
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleManualSetPassword(stu.id, stu.password)} disabled={isSaving}>
                                កែប្រែ
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center justify-center p-8 bg-background border border-dashed border-border/80 rounded-2xl text-center">
                    <UserMinus size={32} className="text-secondary-text/60 mb-2.5" />
                    <p className="text-xs font-bold text-secondary-text mb-3">មិនទាន់មានសិស្សអង្គុយទេ</p>
                    
                    <select 
                      className="block w-full max-w-xs rounded-xl border-border focus:border-primary focus:ring-primary text-xs font-bold py-2 px-3.5 border bg-surface shadow-2xs disabled:opacity-50"
                      value=""
                      onChange={(e) => handleAssignStudent(e.target.value)}
                      disabled={selectedDesk.status === 'Issue' || selectedDesk.pcNumber === 'Teacher PC' || isSaving}
                    >
                      <option value="" disabled>ជ្រើសរើសសិស្ស...</option>
                      {unassignedStudentsList.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.studentId})</option>
                      ))}
                      {unassignedStudentsList.length === 0 && <option value="" disabled>គ្មានសិស្សទំនេរទេ</option>}
                    </select>
                    {selectedDesk.status === 'Issue' && (
                      <p className="text-xs text-rose-600 font-medium mt-3">មិនអាចចាត់តាំងសិស្សឲ្យអង្គុយកុំព្យូទ័រខូចបានទេ</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Universal Confirmation Modal with explicit Cancel and OK buttons */}
      {confirmDialog && (
        <Modal
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          title={confirmDialog.title}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-full shrink-0 ${
                confirmDialog.variant === 'danger' 
                  ? 'bg-rose-100 text-rose-600' 
                  : confirmDialog.variant === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-indigo-100 text-indigo-600'
              }`}>
                {confirmDialog.variant === 'danger' ? (
                  <Trash2 size={22} />
                ) : confirmDialog.variant === 'warning' ? (
                  <AlertTriangle size={22} />
                ) : (
                  <HelpCircle size={22} />
                )}
              </div>
              <p className="text-sm font-medium text-main-text leading-relaxed mt-1">
                {confirmDialog.message}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmDialog(null)}
              >
                {confirmDialog.cancelText || 'បោះបង់'}
              </Button>
              <Button
                type="button"
                variant={confirmDialog.variant === 'danger' ? 'danger' : 'primary'}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmText || 'យល់ព្រម'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default SeatingPlan;
