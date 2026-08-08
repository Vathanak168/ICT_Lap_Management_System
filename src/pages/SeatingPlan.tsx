import React, { useState, useEffect, useRef } from 'react';
import { Monitor, User, UserMinus, Key, Zap, RefreshCw, AlertTriangle, MonitorPlay, Eye, EyeOff, Printer, Trash2, CheckCircle2, Keyboard, AlertCircle, Grid, RotateCw } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, PCIssue, SeatingPlan as SeatingPlanType } from '../store/db';

type ExtendedSeatingPlan = SeatingPlanType & { deskRotations?: Record<string, number> };
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

import { useLanguage } from '../contexts/LanguageContext';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { useAuth } from '../contexts/AuthContext';

interface Desk {
  id: string;
  pcNumber: string;
  studentIds: string[]; // Can hold multiple students in case of conflict
  status: 'Good' | 'Issue';
}

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

  // For Issue Reporting
  const [issueDescription, setIssueDescription] = useState('');
  const [isReportingIssue, setIsReportingIssue] = useState(false);

  // For Layout Builder
  const [currentLayout, setCurrentLayout] = useState<ExtendedSeatingPlan | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [builderRows, setBuilderRows] = useState<number>(6);
  const [builderCols, setBuilderCols] = useState<number>(9);


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

      const [studentRows, issueRows, planRows] = await Promise.all([
        db.getAllFromIndex('students', 'class', targetClass, targetYear),
        db.getAll('pcIssues', targetYear),
        db.getAllFromIndex('seatingPlans', 'class_id', targetClass, targetYear)
      ]);

      if (requestId !== loadDataRequestRef.current) return;

      const activeStudents = studentRows.filter(student => student.status === 'Active');
      setStudents(activeStudents);
      setPcIssues(issueRows);
      
      const issuePcNumbers = new Set(
        issueRows
          .filter(issue => issue.status !== 'Good')
          .map(issue => issue.pcNumber)
      );

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

      const shift = targetShift;
      
      const plan = planRows.find(p => p.shift === shift && p.academicYear === targetYear);
      
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
          setBuilderRows(plan.gridLayout.length);
          setBuilderCols(plan.gridLayout[0]?.length || 9);
        }
      } else {
        const layoutToUse: ExtendedSeatingPlan = { 
          id: `layout_${targetClass}_${shift}_${Date.now()}`,
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
    let grid = [...currentLayout.gridLayout];
    
    if (newRows > grid.length) {
      for (let i = grid.length; i < newRows; i++) {
        grid.push(Array(newCols).fill(null));
      }
    } else if (newRows < grid.length) {
      grid = grid.slice(0, newRows);
    }
    
    grid = grid.map(row => {
      let newRow = [...row];
      if (newCols > newRow.length) {
        newRow = newRow.concat(Array(newCols - newRow.length).fill(null));
      } else if (newCols < newRow.length) {
        newRow = newRow.slice(0, newCols);
      }
      return newRow;
    });

    setCurrentLayout({ ...currentLayout, gridLayout: grid });
    setBuilderRows(newRows);
    setBuilderCols(newCols);
  };

  const handleCellClickInEditMode = (rIdx: number, cIdx: number) => {
    if (!currentLayout) return;
    const newGrid = [...currentLayout.gridLayout];
    const newRow = [...newGrid[rIdx]];
    
    if (newRow[cIdx] === null) {
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
    } else if (newRow[cIdx] === 'Teacher PC') {
       newRow[cIdx] = null;
    } else {
       if (newRow[cIdx]?.startsWith('PC-') && !newGrid.flat().includes('Teacher PC')) {
         newRow[cIdx] = 'Teacher PC';
       } else {
         newRow[cIdx] = null;
       }
    }
    newGrid[rIdx] = newRow;
    setCurrentLayout({ ...currentLayout, gridLayout: newGrid });
  };

  const handleDragStartLayout = (e: React.DragEvent, cell: string | null) => {
    if (!isEditMode || !cell) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', cell);
    setDraggedDeskId(cell);
  };

  const handleDropLayout = (e: React.DragEvent, targetR: number, targetC: number) => {
    e.preventDefault();
    if (!isEditMode || !currentLayout) return;
    
    const draggedCell = e.dataTransfer.getData('text/plain');
    if (!draggedCell) return;
    
    const newGrid = currentLayout.gridLayout.map(row => [...row]);
    
    // Find where it came from
    let sourceR = -1;
    let sourceC = -1;
    for (let r = 0; r < newGrid.length; r++) {
      for (let c = 0; c < newGrid[r].length; c++) {
        if (newGrid[r][c] === draggedCell) {
          sourceR = r;
          sourceC = c;
        }
      }
    }
    
    if (sourceR !== -1 && sourceC !== -1) {
      // Swap with target
      const targetCell = newGrid[targetR][targetC];
      newGrid[sourceR][sourceC] = targetCell;
      newGrid[targetR][targetC] = draggedCell;
      setCurrentLayout({ ...currentLayout, gridLayout: newGrid });
    }
    setDraggedDeskId(null);
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
      
      // Upgrade old string-based layout IDs to UUID
      if (layoutId.startsWith('layout_')) {
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
    setDraggedDeskId(desk.id);
    e.dataTransfer.setData('text/plain', desk.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDesk: Desk) => {
    e.preventDefault();
    if (targetDesk.pcNumber === 'Teacher PC') return; // Cannot drop on teacher PC
    if (targetDesk.status === 'Issue') return; // Cannot drop on broken PC
    if (targetDesk.studentIds.length > 1) return; // Cannot drop on conflicting desk
    
    const sourceDeskId = e.dataTransfer.getData('text/plain');
    if (sourceDeskId === targetDesk.id) return;
    
    const sourceDesk = desks.find(d => d.id === sourceDeskId);
    if (!sourceDesk || sourceDesk.studentIds.length !== 1) return;

    const sourceStudentId = sourceDesk.studentIds[0];
    const targetStudentId = targetDesk.studentIds.length === 1 ? targetDesk.studentIds[0] : null;
    
    if (!activeYear || !selectedClass) return;
    const currentYear = activeYear;
    const currentClass = selectedClass;

    setIsSaving(true);
    try {
      const db = await initDB();
      const studentsToUpdate = [];
      
      const sourceStudent = await db.get('students', sourceStudentId);
      if (sourceStudent) {
        studentsToUpdate.push({ ...sourceStudent, pcNumber: targetDesk.pcNumber });
      }

      if (targetStudentId) {
        const targetStudent = await db.get('students', targetStudentId);
        if (targetStudent) {
          studentsToUpdate.push({ ...targetStudent, pcNumber: sourceDesk.pcNumber });
        }
      }

      await db.putMany('students', studentsToUpdate);
      setDraggedDeskId(null);
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('មានបញ្ហាក្នុងការផ្លាស់ប្តូរកន្លែងអង្គុយសិស្ស។');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedDeskId(null);
  };

  // -------------------------------------------------------------
  // Password & Assignment Logic
  // -------------------------------------------------------------
  const generateUniquePassword = (existingPasswords: Set<string>): string => {
    if (existingPasswords.size >= 900) throw new Error('No unique 3-digit passwords remain.');
    let newPassword = '';
    do {
      newPassword = Math.floor(100 + Math.random() * 900).toString();
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
      
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('បរាជ័យក្នុងការបង្កើត Password');
    }
  };

  const generatePasswordsForClass = async () => {
    if (!selectedClass || students.length === 0 || !activeYear) return;
    
    if (!window.confirm('តើអ្នកពិតជាចង់បង្កើត Password ថ្មីសម្រាប់សិស្សទាំងអស់ក្នុងថ្នាក់នេះមែនទេ? (Password ចាស់នឹងត្រូវបាត់បង់)')) return;

    setIsSaving(true);
    const currentYear = activeYear;
    const currentClass = selectedClass;

    try {
      const usedPasswords = new Set<string>();
      const db = await initDB();
      const studentsToUpdate = [];

      for (let i = 0; i < students.length; i++) {
        const newPassword = generateUniquePassword(usedPasswords);
        usedPasswords.add(newPassword);
        // We still fetch latest to be absolutely safe, but bulk update is hard if we do that 40 times.
        // It's acceptable to do a full put if it's a bulk operation, or just update the objects.
        const updatedStudent = { ...students[i], password: newPassword };
        studentsToUpdate.push(updatedStudent);
      }
      
      await db.putMany('students', studentsToUpdate);
      alert('បង្កើត Password រួមបានជោគជ័យ!');
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error: any) {
      alert('មានបញ្ហាក្នុងការបង្កើត Password: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getStudentForDesk = (studentId?: string) => {
    return students.find(s => s.id === studentId);
  };

  const handleAssignStudent = async (studentId: string) => {
    if (!selectedDesk || !activeYear || !selectedClass) return;
    const currentYear = activeYear;
    const currentClass = selectedClass;

    setIsSaving(true);
    try {
      const db = await initDB();
      await db.update('students', studentId, { pcNumber: selectedDesk.pcNumber });
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('បរាជ័យក្នុងការចាត់តាំងតុ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassignStudent = async (studentId: string) => {
    if (!selectedDesk || !activeYear || !selectedClass) return;
    const currentYear = activeYear;
    const currentClass = selectedClass;

    setIsSaving(true);
    try {
      const db = await initDB();
      // Partial update to safely clear pcNumber and password
      await db.update('students', studentId, { pcNumber: null, password: null });
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error) {
      console.error(error);
      alert('បរាជ័យក្នុងការដកសិស្សចេញពីតុ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAllAssignments = async () => {
    if (!selectedClass || students.length === 0 || !activeYear) return;
    
    if (!window.confirm('តើអ្នកពិតជាចង់ដកសិស្សទាំងអស់ចេញពីតុ និងលុប Password ចោលមែនទេ?')) return;
    
    setIsSaving(true);
    const currentYear = activeYear;
    const currentClass = selectedClass;

    try {
      const db = await initDB();
      const studentsToUpdate = [];

      for (let i = 0; i < students.length; i++) {
        if (students[i].pcNumber || students[i].password) {
          const updatedStudent = { ...students[i], pcNumber: null, password: null };
          studentsToUpdate.push(updatedStudent);
        }
      }
      
      await db.putMany('students', studentsToUpdate);
      alert('លុបទិន្នន័យតុបានជោគជ័យ!');
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error: any) {
      alert('មានបញ្ហាក្នុងការលុបទិន្នន័យតុ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!selectedClass || !activeYear) return;
    
    // Sort unassigned students by ID
    const unassignedStudents = students
      .filter(s => !s.pcNumber)
      .sort((a, b) => (a.studentId || '').localeCompare(b.studentId || ''));

    if (unassignedStudents.length === 0) {
      alert('មិនមានសិស្សទំនេរដែលត្រូវរៀបចំទេ។');
      return;
    }

    // Get available desks
    const availableDesks = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.status === 'Good' && d.studentIds.length === 0);
    
    if (availableDesks.length === 0) {
      alert('មិនមានកុំព្យូទ័រទំនេរ និងល្អគ្រប់គ្រាន់ទេ។');
      return;
    }

    setIsSaving(true);
    const currentYear = activeYear;
    const currentClass = selectedClass;

    try {
      const db = await initDB();
      const studentsToUpdate = [];

      let assignedCount = 0;
      for (let i = 0; i < unassignedStudents.length; i++) {
        if (i < availableDesks.length) {
          const student = { ...unassignedStudents[i], pcNumber: availableDesks[i].pcNumber };
          studentsToUpdate.push(student);
          assignedCount++;
        }
      }
      
      await db.putMany('students', studentsToUpdate);
      alert(`បានរៀបចំកន្លែងអង្គុយដោយស្វ័យប្រវត្តិជូនសិស្សចំនួន ${assignedCount} នាក់ជោគជ័យ!`);
      const shift = classes.find(c => c.id === currentClass)?.shift || 'Morning';
      await loadData(currentYear, currentClass, shift, true);
    } catch (error: any) {
      alert('មានបញ្ហាក្នុងការរៀបចំកន្លែងអង្គុយដោយស្វ័យប្រវត្តិ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Issue Reporting Logic
  // -------------------------------------------------------------
  const handleReportIssue = async () => {
    if (!selectedDesk || !activeYear || !selectedClass || !issueDescription.trim()) return;
    
    const currentYear = activeYear;
    const currentClass = selectedClass;

    const alreadyActive = pcIssues.some(
      issue => issue.pcNumber === selectedDesk.pcNumber && issue.academicYear === currentYear && issue.status !== 'Good'
    );
    
    if (alreadyActive) {
      alert('កុំព្យូទ័រនេះត្រូវបានរាយការណ៍រួចហើយ។');
      return;
    }

    setIsSaving(true);
    try {
      const db = await initDB();
      const newIssue: PCIssue = {
        id: crypto.randomUUID(),
        pcNumber: selectedDesk.pcNumber,
        seatNumber: selectedDesk.pcNumber,
        status: 'Issue',
        currentIssue: issueDescription.trim(),
        dateFound: new Date().toISOString(),
        academicYear: currentYear
      };
      
      await db.put('pcIssues', newIssue);
      setIsReportingIssue(false);
      setIssueDescription('');
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

    // Find all active issues for this PC in this year (in case duplicates were created concurrently)
    const activeIssues = pcIssues.filter(issue => issue.pcNumber === selectedDesk.pcNumber && issue.academicYear === currentYear && issue.status !== 'Good');
    
    if (activeIssues.length > 0) {
      setIsSaving(true);
      try {
        const db = await initDB();
        const issuesToUpdate = activeIssues.map(issue => ({
          ...issue,
          status: 'Good' as const,
          dateResolved: new Date().toISOString()
        }));
        await db.putMany('pcIssues', issuesToUpdate);
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

  const unassignedStudentsList = students
    .filter(s => !s.pcNumber)
    .sort((a, b) => (a.studentId || '').localeCompare(b.studentId || ''));

  const renderDesk = (desk: Desk) => {
    const isTeacher = desk.pcNumber === 'Teacher PC';
    const isConflict = desk.studentIds.length > 1;
    const student = desk.studentIds.length === 1 ? getStudentForDesk(desk.studentIds[0]) : null;

    let borderClass = 'border-border';
    let bgClass = 'bg-white hover:bg-background-selected';
    let iconColor = 'text-blue-500';

    if (isTeacher) {
      borderClass = 'border-green-300';
      bgClass = 'bg-green-50 hover:bg-green-100';
      iconColor = 'text-green-600';
    } else if (desk.status === 'Issue') {
      borderClass = 'border-red-300';
      bgClass = 'bg-red-50 hover:bg-red-100';
      iconColor = 'text-danger';
    } else if (isConflict) {
      borderClass = 'border-orange-400 border-[3px]';
      bgClass = 'bg-orange-50 hover:bg-orange-100';
      iconColor = 'text-orange-500';
    } else if (student) {
      borderClass = 'border-blue-200';
      bgClass = 'bg-blue-50 hover:bg-blue-100';
    }
    
    const isDragging = draggedDeskId === desk.id;
    const rotation = currentLayout?.deskRotations?.[desk.pcNumber] || 0;

    return (
      <div 
        key={desk.id} 
        draggable={!isTeacher && desk.status !== 'Issue' && !isConflict && !!student && !isEditMode}
        onDragStart={(e) => handleDragStart(e, desk)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, desk)}
        onDragEnd={handleDragEnd}
        className={`flex flex-col border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md relative
          ${borderClass} ${bgClass} 
          ${isDragging ? 'opacity-50 scale-95 border-dashed border-2' : ''}
          ${!isTeacher && desk.status !== 'Issue' && !isEditMode ? 'active:scale-95' : ''}
        `}
        onClick={() => !isEditMode && handleDeskClick(desk)}
      >
        {isEditMode && (
          <button 
            className="absolute top-1 right-1 p-1 bg-white border border-gray-200 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-colors z-10"
            onClick={(e) => handleRotateDesk(e, desk.pcNumber)}
            title="បង្វិលតុ (Rotate)"
          >
            <RotateCw size={14} />
          </button>
        )}
        <div className={`px-3 py-2 print:py-1 flex items-center justify-between border-b ${borderClass} bg-white/50`}>
          <div className="flex items-center gap-2 pointer-events-none">
            <Monitor size={14} className={`${iconColor} transition-transform duration-300`} style={{ transform: `rotate(${rotation}deg)` }} />
            <span className={`text-xs print:text-[10px] font-semibold ${isTeacher ? 'text-green-700' : 'text-secondary-text'}`}>
              {desk.pcNumber}
            </span>
          </div>
          {!isTeacher && desk.status === 'Issue' && (
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
          )}
          {!isTeacher && isConflict && (
            <AlertCircle size={14} className="text-orange-500 animate-pulse" />
          )}
        </div>
        <div className="p-3 print:p-2 flex-1 flex flex-col justify-center min-h-[80px] print:min-h-[60px] pointer-events-none">
          {isTeacher ? (
            <div className="text-center font-bold text-green-700">តុគ្រូ (Teacher)</div>
          ) : isConflict ? (
            <div className="flex flex-col items-center justify-center text-orange-600">
              <AlertTriangle size={20} className="mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">ជាន់គ្នា<br/>{desk.studentIds.length} នាក់</span>
            </div>
          ) : student ? (
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold text-sm print:text-xs line-clamp-2 text-primary leading-tight text-center transition-all duration-300">
                {language === 'KH' ? student.name : (student.englishName || student.name)}
              </div>
              {showPasswords && student.password && (
                <div className="flex items-center justify-center gap-1 px-2 py-1 print:py-0.5 bg-white/80 rounded-md text-xs print:text-[10px] font-mono font-medium text-primary border border-border/50 mx-auto">
                  <Key size={12} className="text-secondary-text" /> 
                  {student.password}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-secondary-text/50">
              <Keyboard size={20} className="mb-1" />
              <span className="text-xs font-medium uppercase tracking-wider">ទំនេរ</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeStudentCount = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.studentIds.length > 0).length;
  const emptyDeskCount = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.studentIds.length === 0).length;

  return (
    <div className="flex flex-col w-full pb-10 print:pb-0">
      
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-300 mb-6 print:hidden">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់លក្ខខណ្ឌ និងសកម្មភាព (Filters & Actions)</span>
        </div>
        <div className="p-4 flex flex-col xl:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5 min-w-[250px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ជ្រើសរើសថ្នាក់ (Class)</label>
              <select 
                className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
                {classes.length === 0 && <option value="">មិនមានថ្នាក់</option>}
              </select>
            </div>
            
            <button 
              className="mt-5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={() => setShowPasswords(!showPasswords)}
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />} បង្ហាញ Password
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0">
            {!isEditMode ? (
              <>
                <button 
                  className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAutoAssign}
                  disabled={isSaving || isLoading || !selectedClass}
                >
                  <Zap size={16} /> រៀបចំកន្លែងស្វ័យប្រវត្តិ
                </button>
                <button 
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={generatePasswordsForClass}
                  disabled={isSaving || isLoading || !selectedClass}
                >
                  <RefreshCw size={16} /> បង្កើត Password រួម
                </button>
                <button 
                  className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleClearAllAssignments}
                  disabled={isSaving || isLoading || !selectedClass}
                >
                  <Trash2 size={16} /> លុបទិន្នន័យតុ
                </button>
                <button 
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setIsEditMode(true)}
                  disabled={isSaving || isLoading || !selectedClass}
                >
                  <Grid size={16} /> រៀបចំប្លង់ថ្នាក់
                </button>
                <button 
                  className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50"
                  onClick={handlePrint}
                  disabled={isLoading || !selectedClass}
                >
                  <Printer size={16} /> បោះពុម្ពប្លង់តុ
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 mr-4">
                  <span className="text-sm font-medium text-blue-800">បន្ថែមជួរដេក៖</span>
                  <input 
                    type="number" 
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm outline-none text-center"
                    value={builderRows}
                    min={1} max={20}
                    onChange={(e) => handleUpdateGridSize(parseInt(e.target.value) || 1, builderCols)}
                  />
                  <span className="text-sm font-medium text-blue-800 ml-2">ជួរឈរ៖</span>
                  <input 
                    type="number" 
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm outline-none text-center"
                    value={builderCols}
                    min={1} max={20}
                    onChange={(e) => handleUpdateGridSize(builderRows, parseInt(e.target.value) || 1)}
                  />
                </div>
                <button 
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                  onClick={() => {
                    setIsEditMode(false);
                    if (!activeYear) return;
                    const shift = classes.find(c => c.id === selectedClass)?.shift || 'Morning';
                    loadData(activeYear, selectedClass, shift, true); // reload to cancel changes
                  }}
                  disabled={isSaving}
                >
                  បោះបង់
                </button>
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                  onClick={() => {
                    setIsEditMode(false);
                    handleSaveLayout();
                  }}
                  disabled={isSaving}
                >
                  <CheckCircle2 size={16} /> រក្សាទុកប្លង់ថ្មី
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panel: Lab Layout */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6 print:border-none print:mb-0">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center print:hidden">
          <span>ប្លង់កុំព្យូទ័រ (Seating Plan)</span>
        </div>
        
        {isLoading && !isSaving ? (
           <div className="flex items-center justify-center p-12 text-secondary-text">
             កំពុងទាញយកទិន្នន័យ...
           </div>
        ) : (
          <div className="p-4 sm:p-6 print:p-0">
            <div className="flex flex-wrap items-center justify-between mb-8 pb-4 border-b border-gray-200 gap-4 print:hidden">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 border border-blue-200"></div>
                  <span className="text-gray-600">មានសិស្សអង្គុយ ({activeStudentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-white border border-gray-300"></div>
                  <span className="text-gray-600">ទំនេរ ({emptyDeskCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-100 border border-red-300"></div>
                  <span className="text-gray-600">កុំព្យូទ័រមានបញ្ហា</span>
                </div>
                {desks.some(d => d.studentIds.length > 1) && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-100 border-2 border-orange-400"></div>
                    <span className="text-orange-600 font-bold">ជាន់កន្លែងគ្នា</span>
                  </div>
                )}
              </div>
              <span className="bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1 rounded-sm border border-gray-300">
                សិស្សសរុប៖ {students.length} នាក់
              </span>
            </div>

          {/* Print Header removed per user request */}          {currentLayout && (
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
                      // If this cell is empty and the previous cell was Teacher PC, skip it so Teacher PC can span 2 columns
                      if (prevCell === 'Teacher PC' && !cell) {
                        return null;
                      }
                      
                      // Teacher PC spans 2 columns if it's not the last column and the next cell is empty
                      const shouldSpanTwo = isTeacher && cIdx < cols - 1 && !row[cIdx + 1];

                      return (
                        <div 
                          key={`cell-${rIdx}-${cIdx}`} 
                          className={`flex justify-center w-full min-w-[80px] sm:min-w-[100px] print:min-w-0 ${shouldSpanTwo ? 'col-span-2' : ''}`}
                          onDragOver={isEditMode ? (e) => e.preventDefault() : undefined}
                          onDrop={isEditMode ? (e) => handleDropLayout(e, rIdx, cIdx) : undefined}
                          onClick={isEditMode ? () => handleCellClickInEditMode(rIdx, cIdx) : undefined}
                        >
                           {cell ? (
                             <div 
                               className={`w-full ${isEditMode ? 'cursor-grab active:cursor-grabbing hover:ring-2 ring-blue-400 rounded-xl transition-all' : ''}`}
                               draggable={isEditMode}
                               onDragStart={(e) => handleDragStartLayout(e, cell)}
                               onClick={isEditMode ? (e) => { e.stopPropagation(); handleCellClickInEditMode(rIdx, cIdx); } : undefined}
                             >
                               {renderDesk(desks.find(d => d.pcNumber === cell) || { id: `temp-${cell}`, pcNumber: cell, studentIds: [], status: 'Good' })}
                             </div>
                           ) : (
                             <div className={`w-full flex items-center justify-center h-[114px] print:h-[75px] ${isEditMode ? 'border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 hover:bg-blue-100 cursor-pointer transition-colors text-blue-400 font-medium text-xs' : ''}`}>
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
            <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedDesk.status === 'Issue' ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}`}>
                  {selectedDesk.status === 'Issue' ? <MonitorPlay size={24} /> : <Monitor size={24} />}
                </div>
                <div>
                  <p className="text-sm text-secondary-text mb-0.5">ស្ថានភាពកុំព្យូទ័រ</p>
                  <p className={`font-semibold ${selectedDesk.status === 'Issue' ? 'text-danger' : 'text-success'}`}>
                    {selectedDesk.status === 'Issue' ? 'មានបញ្ហា (Needs Fix)' : 'ដំណើរការល្អ (Good)'}
                  </p>
                </div>
              </div>
              {selectedDesk.pcNumber !== 'Teacher PC' && (
                <div>
                  {selectedDesk.status === 'Issue' ? (
                     <Button variant="primary" size="sm" onClick={handleMarkResolved} disabled={isSaving} className="bg-success hover:bg-green-600">
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

            {isReportingIssue && (
              <div className="p-4 bg-danger-light border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-4">
                <h4 className="text-sm font-semibold text-danger mb-2">រាយការណ៍បញ្ហាកុំព្យូទ័រនេះ</h4>
                <div className="flex gap-2">
                  <Input 
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="សូមបញ្ចូលបញ្ហា (ឧ. ខូច Mouse, បើកមិនចេញ)..."
                    disabled={isSaving}
                  />
                  <Button variant="danger" disabled={isSaving} onClick={handleReportIssue}>រាយការណ៍</Button>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">សិស្សអង្គុយតុនេះ</h3>
              
              {selectedDesk.studentIds.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {selectedDesk.studentIds.length > 1 && (
                    <div className="bg-orange-100 border border-orange-300 text-orange-800 p-3 rounded-lg flex gap-2 items-start text-sm">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <p><strong>បញ្ហាជាន់កន្លែងគ្នា៖</strong> មានសិស្សច្រើនជាងម្នាក់ត្រូវបានចាត់តាំងឲ្យអង្គុយតុនេះ (ប្រហែលមកពីការចុច Save ព្រមគ្នាពីកុំព្យូទ័រពីរផ្សេងគ្នា)។ សូមដកសិស្សចេញ ដើម្បីជួសជុលបញ្ហានេះ។</p>
                    </div>
                  )}

                  {selectedDesk.studentIds.map(studentId => {
                    const stu = getStudentForDesk(studentId);
                    if (!stu) return null;
                    return (
                      <div key={studentId} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">
                              <User size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-primary text-base">{stu.name}</h4>
                              <p className="text-sm text-secondary-text">អត្តលេខ៖ {stu.studentId}</p>
                            </div>
                          </div>
                          <Button variant="danger" size="sm" onClick={() => handleUnassignStudent(stu.id)} disabled={isSaving}>
                            ដកចេញ
                          </Button>
                        </div>
                        
                        <div className="bg-white border border-border p-4 rounded-xl shadow-sm mb-2">
                          <label className="block text-sm font-medium text-secondary-text mb-3">លេខកូដសម្ងាត់ (Password)</label>
                          <div className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                              <Key size={18} className="text-secondary-text" />
                              <span className="font-mono text-lg font-semibold tracking-wider text-primary">
                                {stu.password || '---'}
                              </span>
                            </div>
                            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => generatePasswordForStudent(stu.id)} disabled={isSaving}>
                              បង្កើតថ្មី
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center justify-center p-8 bg-background border border-dashed border-border rounded-xl text-center">
                    <UserMinus size={32} className="text-secondary-text mb-3" />
                    <p className="text-secondary-text font-medium mb-1">មិនទាន់មានសិស្សអង្គុយ</p>
                    <p className="text-sm text-secondary-text/70 mb-4">សូមជ្រើសរើសសិស្សដើម្បីចាត់តាំងឲ្យអង្គុយតុនេះ</p>
                    
                    <select 
                      className="block w-full max-w-xs rounded-lg border-border focus:border-primary focus:ring-primary text-sm py-2 px-3 border bg-white shadow-sm disabled:opacity-50"
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
                      <p className="text-xs text-danger mt-4">មិនអាចចាត់តាំងសិស្សឲ្យអង្គុយកុំព្យូទ័រខូចបានទេ</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default SeatingPlan;
