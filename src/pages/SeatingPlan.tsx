import React, { useState, useEffect, useRef } from 'react';
import { Monitor, User, UserMinus, Key, Zap, RefreshCw, AlertTriangle, MonitorPlay, Eye, EyeOff, Printer, Trash2, CheckCircle2, Keyboard, AlertCircle } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, PCIssue } from '../store/db';
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

  const { language } = useLanguage();
  const { activeYear } = useAcademicYear();
  const { user } = useAuth();
  
  const loadClassRequestRef = useRef(0);
  const loadDataRequestRef = useRef(0);

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
        const result = await db.getAll<ClassRecord>('classes', activeYear);

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

  const loadData = async (targetYear: string, targetClass: string, isForceReload: boolean = false) => {
    if (!targetYear || !targetClass) return;
    
    if (!isForceReload) setIsLoading(true);
    const requestId = ++loadDataRequestRef.current;

    try {
      const db = await initDB();

      const [studentRows, issueRows] = await Promise.all([
        db.getAllFromIndex<Student>('students', 'class', targetClass, targetYear),
        db.getAll<PCIssue>('pcIssues', targetYear)
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

      const initialDesks = Array.from({ length: 37 }, (_, index) => {
        const pcNumber = index === 0 ? 'Teacher PC' : `PC-${index.toString().padStart(2, '0')}`;
        return {
          id: `desk-${index}`,
          pcNumber,
          status: issuePcNumbers.has(pcNumber) ? 'Issue' as const : 'Good' as const,
          studentIds: studentByPc.get(pcNumber) || []
        };
      });
      
      setDesks(initialDesks);
      
      setSelectedDesk(prev => {
        if (!prev) return null;
        return initialDesks.find(d => d.id === prev.id) || null;
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

  useEffect(() => {
    if (activeYear) {
      void loadData(activeYear, selectedClass);
    }
  }, [selectedClass, activeYear]);


  const handleDeskClick = (desk: Desk) => {
    setSelectedDesk(desk);
    setIsReportingIssue(false);
    setIssueDescription('');
    setIsModalOpen(true);
  };

  // -------------------------------------------------------------
  // Drag and Drop Logic
  // -------------------------------------------------------------
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
      
      const sourceStudent = await db.get<Student>('students', sourceStudentId);
      if (sourceStudent) {
        studentsToUpdate.push({ ...sourceStudent, pcNumber: targetDesk.pcNumber });
      }

      if (targetStudentId) {
        const targetStudent = await db.get<Student>('students', targetStudentId);
        if (targetStudent) {
          studentsToUpdate.push({ ...targetStudent, pcNumber: sourceDesk.pcNumber });
        }
      }

      await db.putMany('students', studentsToUpdate);
      setDraggedDeskId(null);
      await loadData(currentYear, currentClass, true);
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
      
      await loadData(currentYear, currentClass, true);
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
      await loadData(currentYear, currentClass, true);
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
      await loadData(currentYear, currentClass, true);
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
      await loadData(currentYear, currentClass, true);
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
      await loadData(currentYear, currentClass, true);
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
      await loadData(currentYear, currentClass, true);
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
      await loadData(currentYear, currentClass, true);
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
        await loadData(currentYear, currentClass, true);
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

    return (
      <div 
        key={desk.id} 
        draggable={!isTeacher && desk.status !== 'Issue' && !isConflict && !!student}
        onDragStart={(e) => handleDragStart(e, desk)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, desk)}
        onDragEnd={handleDragEnd}
        className={`flex flex-col border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md 
          ${borderClass} ${bgClass} 
          ${isDragging ? 'opacity-50 scale-95 border-dashed border-2' : ''}
          ${!isTeacher && desk.status !== 'Issue' ? 'active:scale-95' : ''}
        `}
        onClick={() => handleDeskClick(desk)}
      >
        <div className={`px-3 py-2 print:py-1 flex items-center justify-between border-b ${borderClass} bg-white/50`}>
          <div className="flex items-center gap-2 pointer-events-none">
            <Monitor size={14} className={iconColor} />
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
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50"
              onClick={handlePrint}
              disabled={isLoading || !selectedClass}
            >
              <Printer size={16} /> បោះពុម្ពប្លង់តុ
            </button>
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

          {/* Print Header */}
          <div className="hidden print:block text-center w-full mb-8">
            <h1 className="text-2xl font-bold uppercase text-gray-900">ប្រព័ន្ធគ្រប់គ្រងបន្ទប់កុំព្យូទ័រ (ICT Lab Management System)</h1>
            <h2 className="text-xl mt-2 font-semibold text-gray-700">
              ប្លង់តុសិស្ស - ថ្នាក់៖ {classes.find(c => c.id === selectedClass)?.name || ''}
            </h2>
          </div>

          {/* Full width lab layout */}
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 justify-center bg-background rounded-xl p-8 border border-border/50 print:bg-white print:border-none print:p-0 print:gap-8 print:flex-row print:w-[100vw] print:max-w-none print:items-start">
            
            {/* Left Column */}
            <div className="flex-1 max-w-[500px] flex flex-col gap-6">
              {/* Teacher Desk Box */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 lg:col-span-2 print:col-span-2">
                  {desks[0] && renderDesk(desks[0])}
                </div>
              </div>
              
              {/* Student Desks 1-20 (5 groups of 4) */}
              {[0, 1, 2, 3, 4].map(rowIndex => (
                <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 print:gap-2" key={`left-row-${rowIndex}`}>
                  {desks.slice(1 + rowIndex * 4, 1 + rowIndex * 4 + 4).map(renderDesk)}
                </div>
              ))}
            </div>

            {/* Right Column / Board */}
            <div className="flex-1 max-w-[500px] flex flex-col gap-6">
              {/* Empty spacer for alignment with teacher desk */}
              <div className="grid grid-cols-4 gap-4 hidden lg:grid print:grid">
                <div className="col-span-2 invisible h-[114px] print:h-[75px]"></div>
              </div>
              
              {/* Student Desks 21-36 (4 groups of 4) */}
              {[0, 1, 2, 3].map(rowIndex => (
                <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 print:gap-2" key={`right-row-${rowIndex}`}>
                  {desks.slice(21 + rowIndex * 4, 21 + rowIndex * 4 + 4).map(renderDesk)}
                </div>
              ))}
            </div>

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
