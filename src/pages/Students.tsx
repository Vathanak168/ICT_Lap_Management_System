import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  KeyRound, 
  Download, 
  Eye, 
  User, 
  Users, 
  ArrowLeftRight, 
  Globe, 
  Languages,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { translateKhmerToEnglish, translateKhmerNamesBatch } from '../utils/khmerTranslator';
import { useLanguage } from '../contexts/LanguageContext';

const addPcSyncTask = async (
  db: any,
  pcNumber: string,
  studentId: string,
  studentName: string,
  action: 'ADD' | 'REMOVE' | 'UPDATE_PASSWORD',
  password?: string | null,
  academicYear?: string
) => {
  const newTask = {
    id: crypto.randomUUID(),
    pcNumber,
    studentId,
    studentName,
    action,
    password: password || null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    academicYear: academicYear || '2026-2027'
  };
  try {
    await db.put('pcSyncTasks', newTask);
  } catch (error) {
    console.error('Failed to create PC Sync Task. Did you run the SQL migration?', error);
  }
};

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [filterClass, setFilterClass] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const { language, toggleLanguage } = useLanguage();
  
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailStudent, setSelectedDetailStudent] = useState<Student | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [currentStudent, setCurrentStudent] = useState<Partial<Student>>({
    studentId: '', name: '', englishName: '', gender: 'M', class: '', shift: 'Morning', status: 'Active'
  });

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { activeYear } = useAcademicYear();
  
  const loadRequestRef = useRef(0);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    if (!activeYear) {
      setStudents([]);
      setClasses([]);
      setFilterClass('All');
      setShowModal(false);
      setActiveMenuId(null);
      return;
    }
    
    setFilterClass('All');
    setShowModal(false);
    setActiveMenuId(null);

    const load = () => {
      if (activeYear) void fetchData(activeYear);
    };
    load();
    
    window.addEventListener('appDataChanged', load);
    
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('appDataChanged', load);
    };
  }, [activeYear]);

  const fetchData = async (targetYear: string) => {
    if (!targetYear) return;
    
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      const [allStudents, allClasses] = await Promise.all([
        db.getAll('students', targetYear),
        db.getAll('classes', targetYear)
      ]);

      if (requestId !== loadRequestRef.current) return;
      
      allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      allStudents.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      setClasses(allClasses);
      setStudents(allStudents);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load students:', error);
      }
    }
  };

  const handleSave = async () => {
    if (!currentStudent.name?.trim() || !currentStudent.studentId?.trim() || !currentStudent.class) {
      showToast('error', 'សូមបំពេញព័ត៌មានចាំបាច់ (អត្តលេខ, ឈ្មោះ, ថ្នាក់)');
      return;
    }
    
    if (!activeYear) return;
    const targetYear = activeYear;
    
    const db = await initDB();
    const allStudentsForYear = await db.getAll('students', targetYear);
    const isDuplicate = allStudentsForYear.some(
      s => s.studentId.trim().toLowerCase() === currentStudent.studentId?.trim().toLowerCase() && 
      s.id !== currentStudent.id
    );
    
    if (isDuplicate) {
      showToast('error', `អត្តលេខ ${currentStudent.studentId} មានរួចហើយនៅក្នុងឆ្នាំសិក្សានេះ!`);
      return;
    }

    setIsSaving(true);
    try {
      if (currentStudent.id) {
        // Edit mode: Use partial update to prevent overwriting PC, Password, etc.
        await db.update('students', currentStudent.id, {
          studentId: currentStudent.studentId.trim(),
          name: currentStudent.name.trim(),
          englishName: (currentStudent.englishName || '').trim(),
          gender: currentStudent.gender,
          class: currentStudent.class,
          shift: currentStudent.shift,
          status: currentStudent.status
        });
        showToast('success', `បានកែប្រែទិន្នន័យសិស្ស ${currentStudent.name} ជោគជ័យ!`);
      } else {
        // Add mode: Use full put
        const newStudent: Student = {
          ...(currentStudent as Student),
          id: crypto.randomUUID(),
          academicYear: targetYear,
          studentId: currentStudent.studentId.trim(),
          name: currentStudent.name.trim(),
          englishName: (currentStudent.englishName || '').trim(),
          pcNumber: undefined,
          password: undefined,
          isShiftSwitching: false,
          alternateClassId: ''
        };
        await db.put('students', newStudent);
        showToast('success', `បានបន្ថែមសិស្ស ${newStudent.name} ដោយជោគជ័យ!`);
      }
      
      setShowModal(false);
      await fetchData(targetYear);
    } catch (error: any) {
      console.error('Failed to save student:', error);
      showToast('error', 'មានកំហុសក្នុងការរក្សាទុក៖ ' + (error.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, studentName: string) => {
    if (!activeYear) return;
    const targetYear = activeYear;

    if (window.confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យសិស្ស "${studentName}" មែនទេ? \n\n(ទិន្នន័យសិស្ស កន្លែងអង្គុយ វត្តមាន និងពិន្ទុទាំងអស់នឹងត្រូវលុបចោលទាំងស្រុង)`)) {
      setIsSaving(true);
      try {
        const db = await initDB();

        // Cascade: clean student references from attendance records
        const allAttendance = await db.getAll('attendance', targetYear);
        for (const att of allAttendance) {
          if (att.records && att.records[id] !== undefined) {
            const { [id]: _, ...cleanRecords } = att.records;
            await db.update('attendance', att.id, { records: cleanRecords });
          }
        }

        // Cascade: clean student references from seating plans
        const allSeating = await db.getAll('seatingPlans', targetYear);
        for (const seat of allSeating) {
          const newGrid = seat.gridLayout.map((row: Array<string | null>) =>
            row.map((cell: string | null) => cell === id ? null : cell)
          );
          if (JSON.stringify(newGrid) !== JSON.stringify(seat.gridLayout)) {
            await db.update('seatingPlans', seat.id, { gridLayout: newGrid });
          }
        }

        // Cascade: clean student references from grades
        const allGrades = await db.getAll('grades', targetYear);
        for (const grade of allGrades) {
          if (grade.scores && grade.scores[id] !== undefined) {
            const { [id]: _, ...cleanScores } = grade.scores;
            await db.update('grades', grade.id, { scores: cleanScores });
          }
        }
        
        const studentToDelete = students.find(s => s.id === id);
        if (studentToDelete && studentToDelete.pcNumber) {
          await addPcSyncTask(db, studentToDelete.pcNumber, studentToDelete.studentId, studentToDelete.name, 'REMOVE', null, targetYear);
        }

        await db.delete('students', id);
        showToast('success', `បានលុបសិស្ស "${studentName}" និងទិន្នន័យពាក់ព័ន្ធជោគជ័យ!`);
        await fetchData(targetYear);
      } catch (error) {
        console.error('Failed to delete student:', error);
        showToast('error', 'បរាជ័យក្នុងការលុបសិស្ស');
      } finally {
        setIsSaving(false);
      }
    }
  };
  
  const handleResetPassword = async (student: Student) => {
    if (!activeYear) return;
    const targetYear = activeYear;

    if (window.confirm(`តើអ្នកចង់ Reset Password របស់សិស្ស "${student.name}" មែនទេ?`)) {
      setIsSaving(true);
      try {
        const db = await initDB();
        await db.update('students', student.id, { 
          status: 'ResetRequired', 
          password: null as any
        });
        
        if (student.pcNumber) {
          await addPcSyncTask(db, student.pcNumber, student.studentId, student.name, 'REMOVE', null, targetYear);
        }
        
        showToast('success', `បាន Reset Password របស់សិស្ស "${student.name}" ជោគជ័យ!`);
        await fetchData(targetYear);
      } catch (error) {
        console.error('Failed to reset password:', error);
        showToast('error', 'បរាជ័យក្នុងការ Reset Password');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const openEditModal = (student: Student) => {
    setCurrentStudent({ ...student });
    setShowModal(true);
  };

  const openDetailModal = (student: Student) => {
    setSelectedDetailStudent(student);
    setShowDetailModal(true);
  };

  const classNameMap = useMemo(() => {
    return new Map(classes.map(c => [c.id, c.name]));
  }, [classes]);
  
  const getClassName = (classId: string) => {
    return classNameMap.get(classId) || classId;
  };
  
  const translateShift = (shift: string) => {
    switch(shift) {
      case 'Morning': return 'ព្រឹក';
      case 'Afternoon': return 'រសៀល';
      case 'Evening': return 'យប់';
      default: return shift;
    }
  };

  // Metrics computation
  const totalStudentsCount = students.length;
  const activeStudentsCount = useMemo(() => students.filter(s => s.status === 'Active').length, [students]);
  const femaleStudentsCount = useMemo(() => students.filter(s => s.gender === 'F').length, [students]);
  const maleStudentsCount = useMemo(() => students.filter(s => s.gender === 'M').length, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return students.filter(s => {
      const matchClass = filterClass === 'All' || s.class === filterClass;
      if (!matchClass) return false;
      
      if (term) {
        const matchName = s.name.toLowerCase().includes(term);
        const matchEn = (s.englishName || '').toLowerCase().includes(term);
        const matchId = s.studentId.toLowerCase().includes(term);
        if (!matchName && !matchEn && !matchId) return false;
      }

      return true;
    });
  }, [students, filterClass, searchTerm]);

  return (
    <div className="flex flex-col w-full pb-16 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium transition-all animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-rose-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header Ribbon */}
      <section className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white shadow-xs transition-all flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <Users size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight">
                បញ្ជីឈ្មោះសិស្សសរុប
              </h1>
              {activeYear && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-blue-100 shadow-2xs">
                  ឆ្នាំសិក្សា {activeYear}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-100/80 mt-0.5">
              គ្រប់គ្រង និងតាមដានព័ត៌មានសិស្សទាំងអស់ ({totalStudentsCount} នាក់)
            </p>
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              type="button"
              onClick={() => setShowImportModal(true)}
              disabled={isProcessing || isSaving || !activeYear}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50 cursor-pointer backdrop-blur-xs shadow-2xs"
            >
              <FileSpreadsheet size={15} />
              <span>Import Excel</span>
            </button>
            <button 
              type="button"
              disabled={!activeYear || isProcessing || isSaving || classes.length === 0}
              onClick={() => {
                const initialClass = classes.length > 0 ? classes[0] : null;
                setCurrentStudent({
                  studentId: '', 
                  name: '', 
                  englishName: '', 
                  gender: 'M', 
                  class: initialClass?.id || '', 
                  shift: initialClass?.shift || 'Morning', 
                  status: 'Active'
                });
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-xs font-bold text-blue-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <UserPlus size={16} className="text-primary" />
              <span>បន្ថែមសិស្សថ្មី</span>
            </button>
          </div>
        </section>

      {/* Metrics Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Students */}
        <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">សិស្សសរុប</span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-main-text">{totalStudentsCount}</strong>
            <span className="text-xs font-medium text-secondary-text bg-background px-2 py-0.5 rounded-md border border-border/60">នាក់</span>
          </div>
        </div>

        {/* Active Students */}
        <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" /> សិស្សសកម្ម
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-emerald-700">{activeStudentsCount}</strong>
            <span className="text-xs font-semibold text-emerald-700/80 bg-emerald-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>

        {/* Female Students */}
        <div className="bg-pink-50/70 rounded-2xl border border-pink-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-pink-800 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} className="text-pink-600" /> សិស្សស្រី
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-pink-700">{femaleStudentsCount}</strong>
            <span className="text-xs font-semibold text-pink-700/80 bg-pink-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>

        {/* Male Students */}
        <div className="bg-sky-50/70 rounded-2xl border border-sky-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} className="text-sky-600" /> សិស្សប្រុស
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-sky-700">{maleStudentsCount}</strong>
            <span className="text-xs font-semibold text-sky-700/80 bg-sky-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>
      </section>

      {/* Control Filter Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text" />
            <input 
              type="text"
              placeholder="ស្វែងរក..."
              className="w-full pl-9.5 pr-8 py-2.5 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary-text hover:text-main-text cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Class Filter Dropdown */}
          <div className="min-w-[200px]">
            <select 
              className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="All">ថ្នាក់ទាំងអស់ ({students.length} នាក់)</option>
              {classes.map(c => {
                const countInClass = students.filter(s => s.class === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    ថ្នាក់ {c.name} ({translateShift(c.shift)}) - {countInClass} នាក់
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Translation Tools */}
        <div className="flex flex-wrap items-center gap-2 pt-3 xl:pt-0 border-t xl:border-t-0 border-border">
          {students.some(s => !s.englishName) ? (
            <button 
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
              disabled={isProcessing || isSaving || !activeYear}
              onClick={async () => {
                if (!activeYear) return;
                const targetYear = activeYear;
                if (!window.confirm('តើអ្នកចង់បកប្រែឈ្មោះសិស្សដែលមិនទាន់មានឈ្មោះអង់គ្លេសដោយស្វ័យប្រវត្តិមែនទេ?')) return;
                setIsProcessing(true);
                try {
                  const db = await initDB();
                  const targetStudents = students.filter(s => !s.englishName);
                  const rawNames = targetStudents.map(s => s.name);
                  const translationsMap = await translateKhmerNamesBatch(rawNames);
                  let translatedCount = 0;
                  
                  for (const s of targetStudents) {
                     const enName = translationsMap.get(s.name) || translateKhmerToEnglish(s.name);
                     await db.update('students', s.id, { englishName: enName });
                     translatedCount++;
                  }
                  
                  if (translatedCount > 0) {
                    await fetchData(targetYear);
                    showToast('success', `បានបកប្រែឈ្មោះសិស្សចំនួន ${translatedCount} នាក់ជោគជ័យ!`);
                  }
                } catch (error) {
                  console.error('Translation failed:', error);
                  showToast('error', 'មានកំហុសពេលបកប្រែ');
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              <Globe size={14} />
              <span>{isProcessing ? 'កំពុងដំណើរការ...' : 'បកប្រែទាំងអស់'}</span>
            </button>
          ) : (
            <button 
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
              onClick={toggleLanguage}
              disabled={isProcessing || isSaving || students.length === 0}
            >
              <Languages size={14} />
              <span>{language === 'KH' ? 'បង្ហាញ៖ ខ្មែរ' : 'Language: English'}</span>
            </button>
          )}

          {students.some(s => !!s.englishName) && (
            <button 
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-background border border-border text-secondary-text hover:bg-surface-hover hover:text-main-text transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
              disabled={isProcessing || isSaving || !activeYear}
              title="បកប្រែឈ្មោះសិស្សឡើងវិញដោយស្វ័យប្រវត្តិតាមស្តង់ដារត្រឹមត្រូវ"
              onClick={async () => {
                if (!activeYear) return;
                const targetYear = activeYear;
                if (!window.confirm('តើអ្នកចង់បកប្រែឈ្មោះសិស្សឡើងវិញទាំងអស់តាមស្តង់ដារត្រឹមត្រូវមែនទេ?')) return;
                setIsProcessing(true);
                try {
                  const db = await initDB();
                  const rawNames = students.map(s => s.name);
                  const translationsMap = await translateKhmerNamesBatch(rawNames);
                  let translatedCount = 0;
                  
                  for (const s of students) {
                     const enName = translationsMap.get(s.name) || translateKhmerToEnglish(s.name);
                     if (enName && enName !== s.englishName) {
                       await db.update('students', s.id, { englishName: enName });
                       translatedCount++;
                     }
                  }
                  
                  await fetchData(targetYear);
                  showToast('success', `បានកែសម្រួលការបកប្រែចំនួន ${translatedCount} នាក់ជោគជ័យ!`);
                } catch (error) {
                  console.error('Re-translation failed:', error);
                  showToast('error', 'មានកំហុសពេលបកប្រែ');
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              <Globe size={14} />
              <span>បកប្រែឡើងវិញ</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Students Table */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider w-24">អត្តលេខ</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-20">ភេទ</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ថ្នាក់រៀន</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center">កន្លែងអង្គុយ (PC)</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center">ស្ថានភាព</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-right w-24">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredStudents.map((student, index) => {
                const isNearBottom = index >= filteredStudents.length - 2 && filteredStudents.length > 4;

                return (
                  <tr key={student.id} className="hover:bg-surface-hover/50 transition-colors group">
                    {/* Student ID */}
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-secondary-text">
                      <span className="bg-background px-2.5 py-1 rounded-lg border border-border/60">
                        {student.studentId}
                      </span>
                    </td>

                    {/* Student Name */}
                    <td className="px-5 py-3 min-w-[220px]">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0 ${
                          student.gender === 'F' 
                            ? 'bg-pink-100 text-pink-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main-text group-hover:text-primary transition-colors">
                            {language === 'KH' ? student.name : (student.englishName || student.name)}
                          </span>
                          {student.englishName && language === 'KH' && (
                            <span className="text-[11px] font-normal text-indigo-600 font-sans tracking-wide">
                              {student.englishName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Gender */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        student.gender === 'F' 
                          ? 'bg-pink-50 text-pink-700 border border-pink-200/70' 
                          : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                      }`}>
                        {student.gender === 'F' ? 'ស្រី' : 'ប្រុស'}
                      </span>
                    </td>

                    {/* Class & Shift */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-background text-main-text text-xs px-2.5 py-1 rounded-lg font-bold border border-border/70 shadow-2xs">
                          {getClassName(student.class)}
                        </span>
                        <span className="text-[10px] text-secondary-text font-medium">
                          ({translateShift(student.shift)})
                        </span>
                        {student.isShiftSwitching && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200/70 text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 font-semibold" title="សិស្សប្តូរវេន">
                            <ArrowLeftRight size={10} /> ប្តូរវេន
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PC Number */}
                    <td className="px-5 py-3.5 text-center">
                      {student.pcNumber ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-primary border border-blue-200/70 shadow-2xs">
                          <Monitor size={12} />
                          <span>{student.pcNumber}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-secondary-text/50">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      {student.status === 'Active' && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs">
                          សកម្ម
                        </span>
                      )}
                      {student.status === 'Inactive' && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200/70 text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs">
                          អសកម្ម
                        </span>
                      )}
                      {student.status === 'ResetRequired' && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200/70 text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs">
                          ត្រូវដូរលេខកូដ
                        </span>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="px-5 py-3.5 text-right relative">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === student.id ? null : student.id);
                        }}
                        className="p-1.5 text-secondary-text hover:text-main-text hover:bg-surface-hover rounded-xl transition-all shadow-2xs border border-transparent hover:border-border cursor-pointer"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuId === student.id && (
                        <div className={`absolute right-6 ${isNearBottom ? 'bottom-8' : 'top-10'} w-48 bg-surface border border-border rounded-2xl shadow-xl py-1.5 z-[99] text-left animate-in fade-in zoom-in-95`}>
                          <button 
                            type="button"
                            className="w-full text-left px-4 py-2 text-xs font-bold text-main-text hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer"
                            onClick={() => { setActiveMenuId(null); openDetailModal(student); }}
                          >
                            <Eye size={14} className="text-primary" />
                            <span>ព័ត៌មានលម្អិត</span>
                          </button>
                          <button 
                            type="button"
                            className="w-full text-left px-4 py-2 text-xs font-bold text-main-text hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer"
                            onClick={() => { setActiveMenuId(null); openEditModal(student); }}
                          >
                            <Edit2 size={14} className="text-blue-600" />
                            <span>កែប្រែព័ត៌មាន</span>
                          </button>
                          <button 
                            type="button"
                            className="w-full text-left px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                            onClick={() => { setActiveMenuId(null); void handleResetPassword(student); }}
                          >
                            <KeyRound size={14} className="text-amber-600" />
                            <span>Reset Password</span>
                          </button>
                          <div className="h-px bg-border my-1" />
                          <button 
                            type="button"
                            className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                            onClick={() => { setActiveMenuId(null); void handleDelete(student.id, student.name); }}
                          >
                            <Trash2 size={14} className="text-rose-600" />
                            <span>លុបសិស្ស</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center p-14 text-secondary-text text-center">
                      <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-3 shadow-2xs border border-border">
                        <Users size={24} className="text-secondary-text opacity-60" />
                      </div>
                      <p className="text-xs text-secondary-text font-medium">
                        {searchTerm ? 'រកមិនឃើញសិស្សទេ' : 'មិនទាន់មានទិន្នន័យសិស្សទេ'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add / Edit Student Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={currentStudent.id ? 'កែប្រែព័ត៌មានសិស្ស' : 'បន្ថែមសិស្សថ្មី'}
      >
        <div className="space-y-4 pt-2">
          {/* Student ID */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              អត្តលេខសិស្ស (Student ID) *
            </label>
            <Input 
              value={currentStudent.studentId || ''} 
              onChange={(e) => setCurrentStudent({...currentStudent, studentId: e.target.value})}
              disabled={isSaving}
              placeholder="ឧ. 0012345"
              className="rounded-xl font-mono"
            />
          </div>

          {/* Student Khmer Name */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ឈ្មោះពេញជាភាសាខ្មែរ *
            </label>
            <Input 
              value={currentStudent.name || ''} 
              onChange={(e) => setCurrentStudent({...currentStudent, name: e.target.value})}
              disabled={isSaving}
              placeholder="ឧ. សុខ ចាន់ដារ៉ា"
              className="rounded-xl"
            />
          </div>

          {/* English Name with Auto-translate */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider">
                ឈ្មោះជាអក្សរឡាតាំង (English)
              </label>
              {currentStudent.name && (
                <button
                  type="button"
                  onClick={() => {
                    const trans = translateKhmerToEnglish(currentStudent.name || '');
                    setCurrentStudent({ ...currentStudent, englishName: trans });
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Globe size={13} />
                  <span>បកប្រែស្វ័យប្រវត្តិ</span>
                </button>
              )}
            </div>
            <Input 
              value={currentStudent.englishName || ''} 
              onChange={(e) => setCurrentStudent({...currentStudent, englishName: e.target.value})}
              placeholder="Ex: Sok Chandara"
              disabled={isSaving}
              className="rounded-xl font-sans"
            />
          </div>

          {/* Gender Select */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ភេទ *
            </label>
            <select 
              className="block w-full rounded-xl border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm py-2.5 px-3 font-medium transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              value={currentStudent.gender || 'M'}
              onChange={(e) => setCurrentStudent({...currentStudent, gender: e.target.value as 'M'|'F'})}
              disabled={isSaving}
            >
              <option value="M">ប្រុស (Male)</option>
              <option value="F">ស្រី (Female)</option>
            </select>
          </div>

          {/* Class Select */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ថ្នាក់រៀន *
            </label>
            <select 
              className="block w-full rounded-xl border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm py-2.5 px-3 font-medium transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              value={currentStudent.class || ''}
              onChange={(e) => {
                const cls = classes.find(c => c.id === e.target.value);
                setCurrentStudent({...currentStudent, class: e.target.value, shift: cls ? cls.shift : 'Morning'});
              }}
              disabled={isSaving}
            >
              <option value="">ជ្រើសរើសថ្នាក់...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({translateShift(c.shift)})</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ស្ថានភាពគណនី *
            </label>
            <select 
              className="block w-full rounded-xl border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm py-2.5 px-3 font-medium transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              value={currentStudent.status || 'Active'}
              onChange={(e) => setCurrentStudent({...currentStudent, status: e.target.value as Student['status']})}
              disabled={isSaving}
            >
              <option value="Active">សកម្ម (Active)</option>
              <option value="Inactive">អសកម្ម (Inactive)</option>
              <option value="ResetRequired">ត្រូវប្តូរលេខកូដ (Reset Required)</option>
            </select>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isSaving} className="rounded-xl">
              បោះបង់
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving} className="rounded-xl bg-primary text-white font-bold">
              {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="ព័ត៌មានលម្អិតសិស្ស"
      >
        {selectedDetailStudent && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border/80 shadow-2xs">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-2xs ${
                selectedDetailStudent.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {selectedDetailStudent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-main-text">{selectedDetailStudent.name}</h3>
                <p className="text-xs text-indigo-600 font-sans font-medium">{selectedDetailStudent.englishName || 'គ្មានឈ្មោះអង់គ្លេស'}</p>
                <p className="text-[11px] text-secondary-text font-mono mt-0.5">អត្តលេខ៖ {selectedDetailStudent.studentId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-background border border-border/70">
                <span className="text-secondary-text block mb-1">ភេទ</span>
                <strong className="text-main-text">{selectedDetailStudent.gender === 'F' ? 'ស្រី' : 'ប្រុស'}</strong>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border/70">
                <span className="text-secondary-text block mb-1">ថ្នាក់ & វេន</span>
                <strong className="text-main-text">{getClassName(selectedDetailStudent.class)} ({translateShift(selectedDetailStudent.shift)})</strong>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border/70">
                <span className="text-secondary-text block mb-1">កុំព្យូទ័រអង្គុយ</span>
                <strong className="text-main-text">{selectedDetailStudent.pcNumber || 'មិនទាន់មានតុ'}</strong>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border/70">
                <span className="text-secondary-text block mb-1">ស្ថានភាពគណនី</span>
                <strong className="text-main-text">{selectedDetailStudent.status}</strong>
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-border mt-4">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)} className="rounded-xl">
                បិទ
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import Modal */}
      <Modal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        title="Import ពី Excel"
      >
        <div className="space-y-4 pt-2">
          <div className="bg-blue-50/80 border border-blue-200/80 p-4 rounded-2xl text-xs text-blue-900 leading-relaxed">
            សូមទាញយកទម្រង់គំរូ ដើម្បីរៀបចំទិន្នន័យឲ្យបានត្រឹមត្រូវ មុននឹងបញ្ជូលទៅក្នុងប្រព័ន្ធ។
          </div>
          
          <Button variant="secondary" className="w-full justify-center rounded-xl text-xs font-bold py-2.5">
            <Download size={14} />
            <span>ទាញយកទម្រង់គំរូ (.xlsx)</span>
          </Button>
          
          <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-secondary-text bg-background hover:bg-surface-hover transition-colors cursor-pointer mt-3">
            <FileSpreadsheet size={36} className="mb-2 text-primary opacity-70" />
            <p className="font-bold text-xs text-main-text">ចុចទីនេះ ដើម្បីជ្រើសរើសឯកសារ</p>
            <p className="text-[11px] text-secondary-text mt-1">គាំទ្រតែឯកសារ .xlsx និង .xls ប៉ុណ្ណោះ</p>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowImportModal(false)} className="rounded-xl">
              បោះបង់
            </Button>
            <Button variant="primary" disabled className="rounded-xl opacity-50">
              បញ្ជាក់ការបញ្ចូល
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Students;
