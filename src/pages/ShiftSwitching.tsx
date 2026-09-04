import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  ArrowLeftRight, 
  UserPlus, 
  Users, 
  Trash2, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  Sun,
  Sunset,
  Sparkles
} from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const ShiftSwitching = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedAlternateClassId, setSelectedAlternateClassId] = useState('');
  const [filterClassId, setFilterClassId] = useState('All');
  
  const { activeYear } = useAcademicYear();
  const loadRequestRef = useRef(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Auto-reset selectedAlternateClassId when student changes
  useEffect(() => {
    setSelectedAlternateClassId('');
  }, [selectedStudentId]);

  useEffect(() => {
    if (activeYear) {
      void loadData(activeYear);
    } else {
      setStudents([]);
      setClasses([]);
      setSelectedStudentId('');
      setSelectedAlternateClassId('');
    }
  }, [activeYear]);

  useEffect(() => {
    const handleDataChange = () => {
      if (activeYear) {
        void loadData(activeYear);
      }
    };
    window.addEventListener('appDataChanged', handleDataChange);
    return () => window.removeEventListener('appDataChanged', handleDataChange);
  }, [activeYear]);

  const loadData = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      const [allStudents, allClasses] = await Promise.all([
        db.getAll('students', targetYear),
        db.getAll('classes', targetYear)
      ]);
      
      if (requestId !== loadRequestRef.current) return;
      
      allStudents.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      setStudents(allStudents);
      setClasses(allClasses);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load shift switching data:', error);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  const getGrade = (className: string) => {
    const match = className.match(/^(\d+)/);
    return match ? match[1] : '';
  };

  const handleRegister = async () => {
    if (!selectedStudentId || !selectedAlternateClassId) {
      showToast('error', 'សូមជ្រើសរើសសិស្ស និងថ្នាក់បម្រុង');
      return;
    }
    
    if (!activeYear) return;

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const targetClass = classes.find(c => c.id === selectedAlternateClassId);
    if (!targetClass) {
      showToast('error', 'រកមិនឃើញថ្នាក់បម្រុងនេះទេ!');
      return;
    }

    const currentClassObj = classes.find(c => c.id === student.class);

    // Strict Validation
    if (student.class === selectedAlternateClassId) {
      showToast('error', 'ថ្នាក់បម្រុងមិនអាចដូចគ្នានឹងថ្នាក់បច្ចុប្បន្នទេ!');
      return;
    }
    
    if (targetClass.academicYear !== activeYear) {
      showToast('error', 'ថ្នាក់បម្រុងមិនស្ថិតក្នុងឆ្នាំសិក្សាបច្ចុប្បន្នទេ!');
      return;
    }
    
    if (currentClassObj && getGrade(targetClass.name) !== getGrade(currentClassObj.name)) {
      showToast('error', 'ថ្នាក់បម្រុងត្រូវតែមានកម្រិតថ្នាក់ដូចគ្នា!');
      return;
    }
    
    if (currentClassObj && targetClass.shift === currentClassObj.shift) {
      showToast('error', 'សិស្សប្តូរវេន ត្រូវតែជ្រើសរើសវេនសិក្សាថ្មីដែលខុសពីវេនចាស់!');
      return;
    }

    if (window.confirm(`តើអ្នកពិតជាចង់កំណត់សិស្ស "${student.name}" ជាសិស្សប្តូរវេនមែនទេ?`)) {
      setIsSaving(true);
      const targetYear = activeYear;
      try {
        const db = await initDB();
        
        // Partial update to avoid full record overwrite
        await db.update('students', student.id, {
          isShiftSwitching: true,
          alternateClassId: selectedAlternateClassId
        });
        
        setSelectedStudentId('');
        setSelectedAlternateClassId('');
        showToast('success', `បានចុះឈ្មោះសិស្ស "${student.name}" ជាសិស្សប្តូរវេនជោគជ័យ!`);
        await loadData(targetYear);
      } catch (error: any) {
        showToast('error', 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ៖ ' + (error.message || ''));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSwitchShift = async (student: Student) => {
    if (!student.alternateClassId) return;

    const targetClass = classes.find(c => c.id === student.alternateClassId);
    if (!targetClass) {
      showToast('error', 'រកមិនឃើញថ្នាក់បម្រុងទេ!');
      return;
    }
    
    if (!activeYear) return;

    if (window.confirm(`តើអ្នកចង់ប្តូរសិស្ស "${student.name}" ទៅកាន់ថ្នាក់ "${targetClass.name}" មែនទេ?`)) {
      setIsSaving(true);
      const targetYear = activeYear;
      try {
        const db = await initDB();
        
        const oldClass = student.class;
        
        // Partial update
        await db.update('students', student.id, {
          class: student.alternateClassId,
          alternateClassId: oldClass,
          shift: targetClass.shift // Update shift to match new class
        });
        
        showToast('success', `បានផ្លាស់ប្តូរសិស្ស "${student.name}" ទៅថ្នាក់ "${targetClass.name}" (${getShiftName(targetClass.shift)}) ជោគជ័យ!`);
        await loadData(targetYear);
      } catch (error: any) {
         showToast('error', 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ៖ ' + (error.message || ''));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleRemoveStatus = async (student: Student) => {
    if (!activeYear) return;
    
    if (window.confirm(`តើអ្នកចង់ដកសិស្ស "${student.name}" ពីបញ្ជីសិស្សប្តូរវេនមែនទេ?`)) {
      setIsSaving(true);
      const targetYear = activeYear;
      try {
        const db = await initDB();
        
        // Partial update
        await db.update('students', student.id, {
          isShiftSwitching: false,
          alternateClassId: '' // clear it
        });
        
        showToast('success', `បានដកសិស្ស "${student.name}" ចេញពីបញ្ជីប្តូរវេនជោគជ័យ!`);
        await loadData(targetYear);
      } catch (error: any) {
         showToast('error', 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ៖ ' + (error.message || ''));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const getClassName = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : 'Unknown';
  };

  const getShiftName = (shift?: string) => {
    if (shift === 'Morning') return 'ព្រឹក';
    if (shift === 'Afternoon') return 'រសៀល';
    if (shift === 'Evening') return 'យប់';
    return shift || 'Unknown';
  };

  // Only show Active students who are shift switchers
  const shiftSwitchers = useMemo(() => {
    return students.filter(s => s.isShiftSwitching && s.status === 'Active');
  }, [students]);
  
  // Filter for search
  const filteredSwitchers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return shiftSwitchers.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.studentId.toLowerCase().includes(term)
    );
  }, [shiftSwitchers, searchTerm]);

  // Metrics
  const totalSwitchersCount = shiftSwitchers.length;
  const femaleSwitchersCount = useMemo(() => shiftSwitchers.filter(s => s.gender === 'F').length, [shiftSwitchers]);
  const maleSwitchersCount = useMemo(() => shiftSwitchers.filter(s => s.gender === 'M').length, [shiftSwitchers]);
  const involvedClassesCount = useMemo(() => {
    const set = new Set<string>();
    shiftSwitchers.forEach(s => {
      if (s.class) set.add(s.class);
      if (s.alternateClassId) set.add(s.alternateClassId);
    });
    return set.size;
  }, [shiftSwitchers]);

  // Eligible students for the dropdown (not already a switcher, and active)
  const eligibleStudents = useMemo(() => {
    return students.filter(s => {
      if (s.isShiftSwitching || s.status !== 'Active') return false;
      if (filterClassId && filterClassId !== 'All' && s.class !== filterClassId) return false;
      return true;
    });
  }, [students, filterClassId]);

  // Determine eligible alternate classes based on selected student
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const selectedStudentClassObj = useMemo(() => {
    return selectedStudent ? classes.find(cl => cl.id === selectedStudent.class) : null;
  }, [selectedStudent, classes]);

  const selectedStudentGrade = useMemo(() => {
    return selectedStudentClassObj ? getGrade(selectedStudentClassObj.name) : null;
  }, [selectedStudentClassObj]);

  const eligibleAlternateClasses = useMemo(() => {
    return classes.filter(c => {
      if (!selectedStudent) return true;
      if (c.id === selectedStudent.class) return false;
      if (!selectedStudentGrade) return false;
      return getGrade(c.name) === selectedStudentGrade;
    });
  }, [classes, selectedStudent, selectedStudentGrade]);

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

      {/* Header Banner - Clean & Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 rounded-2xl text-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <ArrowLeftRight size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">សិស្សប្តូរវេន</h1>
            <p className="text-xs text-blue-100/80 mt-0.5">
              គ្រប់គ្រង និងតាមដានសិស្សផ្លាស់ប្តូរវេនសិក្សា ({totalSwitchersCount} នាក់)
            </p>
          </div>
        </div>
        {activeYear && (
          <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 rounded-full bg-white/15 text-white shadow-2xs">
            ឆ្នាំសិក្សា {activeYear}
          </span>
        )}
      </div>

      {/* Metrics Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Switchers */}
        <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">សិស្សប្តូរវេនសរុប</span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-main-text">{totalSwitchersCount}</strong>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">នាក់</span>
          </div>
        </div>

        {/* Involved Classes */}
        <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={14} className="text-indigo-600" /> ថ្នាក់ពាក់ព័ន្ធ
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-indigo-700">{involvedClassesCount}</strong>
            <span className="text-xs font-semibold text-indigo-700/80 bg-indigo-100/60 px-2 py-0.5 rounded-md">ថ្នាក់</span>
          </div>
        </div>

        {/* Female Switchers */}
        <div className="bg-pink-50/70 rounded-2xl border border-pink-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-pink-800 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} className="text-pink-600" /> សិស្សស្រី
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-pink-700">{femaleSwitchersCount}</strong>
            <span className="text-xs font-semibold text-pink-700/80 bg-pink-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>

        {/* Male Switchers */}
        <div className="bg-sky-50/70 rounded-2xl border border-sky-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} className="text-sky-600" /> សិស្សប្រុស
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-sky-700">{maleSwitchersCount}</strong>
            <span className="text-xs font-semibold text-sky-700/80 bg-sky-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>
      </section>

      {/* Registration Card (ចុះឈ្មោះសិស្សប្តូរវេន) */}
      <div className={`bg-surface rounded-2xl border border-border/80 shadow-xs p-5 sm:p-6 transition-all ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/70">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shadow-2xs">
            <Sparkles size={18} />
          </div>
          <h2 className="text-sm font-bold text-main-text">ចុះឈ្មោះសិស្សប្តូរវេន</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          {/* Current Class */}
          <div>
            <label className="text-xs font-bold text-secondary-text uppercase tracking-wider block mb-1.5">
              ថ្នាក់បច្ចុប្បន្ន
            </label>
            <select 
              className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setSelectedStudentId('');
              }}
              disabled={isSaving || isLoading}
            >
              <option value="All">-- គ្រប់ថ្នាក់ទាំងអស់ --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({getShiftName(c.shift)})
                </option>
              ))}
            </select>
          </div>

          {/* Student */}
          <div>
            <label className="text-xs font-bold text-secondary-text uppercase tracking-wider block mb-1.5">
              សិស្ស *
            </label>
            <select 
              className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={isSaving || isLoading}
            >
              <option value="">-- ជ្រើសរើសសិស្ស ({eligibleStudents.length} នាក់) --</option>
              {eligibleStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.studentId} - {s.name} ({getClassName(s.class)})
                </option>
              ))}
            </select>
          </div>

          {/* Alternate Class */}
          <div>
            <label className="text-xs font-bold text-secondary-text uppercase tracking-wider block mb-1.5">
              ថ្នាក់បម្រុង *
            </label>
            <select 
              className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              value={selectedAlternateClassId}
              onChange={(e) => setSelectedAlternateClassId(e.target.value)}
              disabled={!selectedStudentId || isSaving || isLoading}
            >
              <option value="">-- ជ្រើសរើសថ្នាក់បម្រុង --</option>
              {eligibleAlternateClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({getShiftName(c.shift)})
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <div>
            <button 
              type="button"
              onClick={() => void handleRegister()}
              disabled={isSaving || isLoading || !selectedStudentId || !selectedAlternateClassId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2.5 px-5 shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <UserPlus size={16} />
              <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'ចុះឈ្មោះ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Switchers List Card */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        {/* Table Search Header Bar */}
        <div className="p-4 sm:p-5 border-b border-border/80 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-surface">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-main-text">បញ្ជីសិស្សប្តូរវេន</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 rounded-full">
              {filteredSwitchers.length} នាក់
            </span>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text" />
            <input 
              type="text"
              placeholder="ស្វែងរក..."
              className="w-full pl-9.5 pr-8 py-2 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
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
        </div>

        {/* Table Content */}
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-16 text-secondary-text gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">កំពុងទាញយកទិន្នន័យ...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider w-24">អត្តលេខ</th>
                  <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                  <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-20">ភេទ</th>
                  <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ថ្នាក់បច្ចុប្បន្ន</th>
                  <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center">ថ្នាក់បម្រុង</th>
                  <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-right w-36">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSwitchers.map(s => (
                  <tr key={s.id} className="hover:bg-surface-hover/50 transition-colors group">
                    {/* Student ID */}
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-secondary-text">
                      <span className="bg-background px-2.5 py-1 rounded-lg border border-border/60">
                        {s.studentId}
                      </span>
                    </td>

                    {/* Student Name */}
                    <td className="px-5 py-3 min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0 ${
                          s.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main-text group-hover:text-primary transition-colors">
                            {s.name}
                          </span>
                          {s.englishName && (
                            <span className="text-[11px] text-secondary-text font-sans">
                              {s.englishName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Gender */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        s.gender === 'F' 
                          ? 'bg-pink-50 text-pink-700 border border-pink-200/70' 
                          : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                      }`}>
                        {s.gender === 'F' ? 'ស្រី' : 'ប្រុស'}
                      </span>
                    </td>

                    {/* Current Class */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-800 text-xs px-2.5 py-1 rounded-lg font-bold border border-blue-200/70 shadow-2xs">
                          {getClassName(s.class)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-text bg-background px-2 py-0.5 rounded-md border border-border/60">
                          {s.shift === 'Morning' ? <Sun size={11} className="text-amber-500" /> : <Sunset size={11} className="text-sky-500" />}
                          <span>វេន{getShiftName(s.shift)}</span>
                        </span>
                      </div>
                    </td>

                    {/* Alternate Class */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex items-center gap-2 bg-amber-50/70 text-amber-900 border border-amber-200/70 text-xs px-3 py-1 rounded-xl font-bold shadow-2xs">
                        <ArrowLeftRight size={13} className="text-amber-600" />
                        <span>{getClassName(s.alternateClassId!)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          type="button"
                          onClick={() => void handleSwitchShift(s)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-2xs disabled:opacity-50 cursor-pointer"
                          title="ផ្លាស់ប្តូរទៅថ្នាក់បម្រុង"
                        >
                          <ArrowLeftRight size={13} />
                          <span>ប្តូរវេន</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => void handleRemoveStatus(s)}
                          disabled={isSaving}
                          className="p-1.5 text-secondary-text hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-2xs border border-transparent hover:border-rose-100 active:scale-95 disabled:opacity-50 cursor-pointer"
                          title="ដកចេញពីបញ្ជីប្តូរវេន"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredSwitchers.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center p-14 text-secondary-text text-center">
                        <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-3 shadow-2xs border border-border">
                          <ArrowLeftRight size={24} className="text-secondary-text opacity-60" />
                        </div>
                        <p className="text-xs text-secondary-text font-medium">
                          {searchTerm ? 'រកមិនឃើញសិស្សប្តូរវេនទេ' : 'មិនទាន់មានទិន្នន័យទេ'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftSwitching;
