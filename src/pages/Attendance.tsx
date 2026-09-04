import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Save, 
  Calendar, 
  CalendarDays, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Search, 
  RotateCcw,
  CheckCheck,
  UserX,
  TrendingUp
} from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, AttendanceRecord } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';

type AttendanceStatus = 'P' | 'A' | 'E' | 'L' | null;

const getLocalDate = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Attendance = () => {
  const { language } = useLanguage();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate());
  
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [initialAttendanceData, setInitialAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [recordId, setRecordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'P' | 'A' | 'E' | 'L' | 'UNMARKED'>('ALL');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { activeYear } = useAcademicYear();
  const loadRequestRef = useRef(0);
  
  const hasChanges = JSON.stringify(attendanceData) !== JSON.stringify(initialAttendanceData);

  useEffect(() => {
    if (!activeYear) {
      setClasses([]);
      setSelectedClass('');
      setStudents([]);
      setAttendanceData({});
      setInitialAttendanceData({});
      setRecordId(null);
      return;
    }

    const requestId = ++loadRequestRef.current;
    
    const loadClasses = async () => {
      try {
        const db = await initDB();
        const allClasses = await db.getAll('classes', activeYear);
        if (requestId !== loadRequestRef.current) return;
        allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setClasses(allClasses);
        if (allClasses.length > 0) {
          const currentClassExists = allClasses.some(c => c.id === selectedClass);
          if (!currentClassExists) {
            setSelectedClass(allClasses[0].id);
          }
        } else {
          setSelectedClass('');
        }
      } catch (error) {
        if (requestId === loadRequestRef.current) console.error(error);
      }
    };
    
    void loadClasses();
  }, [activeYear, selectedClass]);

  useEffect(() => {
    if (!selectedClass || !activeYear) {
      setStudents([]);
      setAttendanceData({});
      setInitialAttendanceData({});
      setRecordId(null);
      return;
    }

    const requestId = ++loadRequestRef.current;
    
    const loadStudentsAndAttendance = async () => {
      try {
        const db = await initDB();
        
        const [allStudents, record] = await Promise.all([
          db.getAllFromIndex('students', 'class', selectedClass, activeYear),
          db.get('attendance', `${activeYear}_${selectedClass}_${selectedDate}`)
        ]);

        if (requestId !== loadRequestRef.current) return;
        const activeStudents = allStudents.filter(s => s.status !== 'Inactive');
        activeStudents.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setStudents(activeStudents);
        
        if (record) {
          const loadedRecords = { ...(record.records as Record<string, AttendanceStatus>) };
          setAttendanceData(loadedRecords);
          setInitialAttendanceData({ ...loadedRecords });
          setRecordId(record.id);
        } else {
          setAttendanceData({});
          setInitialAttendanceData({});
          setRecordId(null);
        }
      } catch (error) {
        if (requestId === loadRequestRef.current) console.error(error);
      }
    };
    
    void loadStudentsAndAttendance();
    
    const handleDataChange = () => {
      void loadStudentsAndAttendance();
    };
    window.addEventListener('appDataChanged', handleDataChange);
    
    return () => {
      window.removeEventListener('appDataChanged', handleDataChange);
    };
  }, [selectedClass, selectedDate, activeYear]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status
    }));
  };

  const handleBulkAction = (status: AttendanceStatus) => {
    if (!status) {
      setAttendanceData({});
      return;
    }
    const newData: Record<string, AttendanceStatus> = { ...attendanceData };
    students.forEach(s => {
      newData[s.id] = status;
    });
    setAttendanceData(newData);
  };

  const handleSave = async () => {
    if (!selectedClass || !activeYear) return;
    setIsSaving(true);
    
    try {
      const db = await initDB();
      const id = recordId || `${activeYear}_${selectedClass}_${selectedDate}`;
      
      const record: AttendanceRecord = {
        id,
        date: selectedDate,
        classId: selectedClass,
        shift: classes.find(c => c.id === selectedClass)?.shift,
        academicYear: activeYear,
        records: attendanceData as any
      };
      
      await db.put('attendance', record);
      
      setInitialAttendanceData({ ...attendanceData });
      setRecordId(id);
      
      showToast('success', language === 'KH' ? 'រក្សាទុកទិន្នន័យវត្តមានជោគជ័យ!' : 'Attendance saved successfully!');
    } catch (error) {
      console.error('Save failed', error);
      showToast('error', language === 'KH' ? 'មានកំហុសក្នុងការរក្សាទុក' : 'Error saving attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClassChange = (newClass: string) => {
    if (hasChanges) {
      if (!window.confirm('អ្នកមានទិន្នន័យមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់បោះបង់វាហើយប្តូរថ្នាក់មែនទេ?')) return;
    }
    setSelectedClass(newClass);
  };

  const changeDate = (days: number) => {
    if (hasChanges) {
      if (!window.confirm('អ្នកមានទិន្នន័យមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់បោះបង់វាហើយប្តូរថ្ងៃមែនទេ?')) return;
    }
    const dateObj = new Date(selectedDate);
    dateObj.setDate(dateObj.getDate() + days);
    setSelectedDate(getLocalDate(dateObj));
  };
  
  const setToday = () => {
    if (hasChanges) {
      if (!window.confirm('អ្នកមានទិន្នន័យមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់បោះបង់វាហើយប្តូរថ្ងៃមែនទេ?')) return;
    }
    setSelectedDate(getLocalDate());
  };

  const handleDateChange = (newDate: string) => {
    if (hasChanges) {
      if (!window.confirm('អ្នកមានទិន្នន័យមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់បោះបង់វាហើយប្តូរថ្ងៃមែនទេ?')) return;
    }
    setSelectedDate(newDate);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Counts
  const presentCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'P').length, [attendanceData]);
  const absentCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'A').length, [attendanceData]);
  const excusedCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'E').length, [attendanceData]);
  const lateCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'L').length, [attendanceData]);
  
  const markedCount = presentCount + absentCount + excusedCount + lateCount;
  const unmarkedCount = Math.max(0, students.length - markedCount);
  
  // Attendance rate (Present + Late counted as attending)
  const attendanceRate = markedCount > 0 
    ? Math.round(((presentCount + lateCount) / markedCount) * 100) 
    : 0;

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = student.name.toLowerCase().includes(query);
        const matchesEnglish = (student.englishName || '').toLowerCase().includes(query);
        const matchesId = (student.studentId || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEnglish && !matchesId) return false;
      }

      // Status filter
      const status = attendanceData[student.id];
      if (statusFilter === 'P') return status === 'P';
      if (statusFilter === 'A') return status === 'A';
      if (statusFilter === 'E') return status === 'E';
      if (statusFilter === 'L') return status === 'L';
      if (statusFilter === 'UNMARKED') return !status;

      return true;
    });
  }, [students, searchTerm, statusFilter, attendanceData]);

  const selectedClassObj = classes.find(c => c.id === selectedClass);

  return (
    <div className="flex flex-col w-full pb-28 space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div 
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium transition-all animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-rose-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Control Panel Card */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all">
        {/* Header Ribbon */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 backdrop-blur-xs rounded-xl">
              <CalendarDays size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide">កត់ត្រាវត្តមានសិស្ស</h1>
              <p className="text-xs text-blue-100/80">
                {selectedClassObj ? `ថ្នាក់៖ ${selectedClassObj.name} (${selectedClassObj.shift === 'Morning' ? 'វេនព្រឹក' : selectedClassObj.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'})` : 'សូមជ្រើសរើសថ្នាក់'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => void handleSave()} 
              disabled={!hasChanges || isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 text-white active:scale-98"
            >
              <Save size={15} />
              <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-5 flex flex-col lg:flex-row gap-5 items-stretch lg:items-center justify-between bg-surface">
          <div className="flex flex-wrap items-center gap-4">
            {/* Select Class */}
            <div className="flex flex-col gap-1.5 min-w-[220px]">
              <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">ជ្រើសរើសថ្នាក់</label>
              <select 
                className="w-full bg-background border border-border text-main-text text-sm rounded-xl px-3.5 py-2.5 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-xs"
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date Navigator */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">កាលបរិច្ឆេទ</label>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => changeDate(-1)}
                  className="p-2.5 border border-border bg-background rounded-xl hover:bg-surface-hover text-secondary-text transition-colors shadow-xs"
                  title="ថ្ងៃមុន"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="relative group cursor-pointer">
                  <div className="flex items-center gap-2 px-3.5 py-2 border border-border bg-background rounded-xl group-hover:border-primary transition-colors shadow-xs">
                    <Calendar size={15} className="text-primary" />
                    <span className="font-semibold text-main-text text-sm">{formatDateDisplay(selectedDate)}</span>
                  </div>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => changeDate(1)}
                  className="p-2.5 border border-border bg-background rounded-xl hover:bg-surface-hover text-secondary-text transition-colors shadow-xs"
                  title="ថ្ងៃបន្ទាប់"
                >
                  <ChevronRight size={16} />
                </button>
                <button 
                  type="button"
                  onClick={setToday}
                  className="px-3 py-2 bg-surface-hover text-main-text border border-border font-medium rounded-xl hover:bg-border transition-colors text-xs shadow-xs"
                >
                  ថ្ងៃនេះ
                </button>
              </div>
            </div>
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-border">
            <span className="text-xs font-semibold text-secondary-text mr-1">កំណត់រហ័ស៖</span>
            <button 
              type="button"
              onClick={() => handleBulkAction('P')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-2xs"
            >
              <CheckCheck size={14} />
              <span>វត្តមានទាំងអស់</span>
            </button>
            <button 
              type="button"
              onClick={() => handleBulkAction('A')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-2xs"
            >
              <UserX size={14} />
              <span>អវត្តមានទាំងអស់</span>
            </button>
            <button 
              type="button"
              onClick={() => handleBulkAction(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all active:scale-95 shadow-2xs"
            >
              <RotateCcw size={13} />
              <span>សម្អាត (Clear)</span>
            </button>
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-background/50 border-t border-border">
          {/* Total Students */}
          <div className="bg-surface p-3 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-secondary-text uppercase">សិស្សសរុប</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-main-text">{students.length}</span>
              <span className="text-xs text-secondary-text">នាក់</span>
            </div>
          </div>

          {/* Present Count */}
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
              <CheckCircle2 size={13} className="text-emerald-600" /> វត្តមាន
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-emerald-700">{presentCount}</span>
              <span className="text-xs text-emerald-700/80">នាក់</span>
            </div>
          </div>

          {/* Absent Count */}
          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/80 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
              <XCircle size={13} className="text-rose-600" /> អវត្តមាន
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-rose-700">{absentCount}</span>
              <span className="text-xs text-rose-700/80">នាក់</span>
            </div>
          </div>

          {/* Excused Count */}
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
              <AlertCircle size={13} className="text-amber-600" /> សុំច្បាប់
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-amber-700">{excusedCount}</span>
              <span className="text-xs text-amber-700/80">នាក់</span>
            </div>
          </div>

          {/* Late Count */}
          <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-200/80 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-sky-800 uppercase flex items-center gap-1">
              <Clock size={13} className="text-sky-600" /> មកយឺត
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-sky-700">{lateCount}</span>
              <span className="text-xs text-sky-700/80">នាក់</span>
            </div>
          </div>

          {/* Attendance Rate */}
          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/80 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-indigo-800 uppercase flex items-center gap-1">
              <TrendingUp size={13} className="text-indigo-600" /> អត្រាវត្តមាន
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-indigo-700">{attendanceRate}%</span>
              <span className="text-xs text-indigo-700/80">{markedCount}/{students.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Student List Section */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-surface">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-secondary-text'
              }`}
            >
              ទាំងអស់ ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('P')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'P'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-emerald-700'
              }`}
            >
              វត្តមាន ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'A'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-rose-700'
              }`}
            >
              អវត្តមាន ({absentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('E')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'E'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-amber-700'
              }`}
            >
              សុំច្បាប់ ({excusedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('L')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'L'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-sky-700'
              }`}
            >
              យឺត ({lateCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNMARKED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'UNMARKED'
                  ? 'bg-gray-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-secondary-text'
              }`}
            >
              មិនទាន់កត់ ({unmarkedCount})
            </button>
          </div>

          {/* Student Search */}
          <div className="relative min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text" />
            <input
              type="text"
              placeholder="ស្វែងរកតាមឈ្មោះ ឬអត្តលេខ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary-text hover:text-main-text"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-16">ល.រ</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider w-28">អត្តលេខ</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-24">ភេទ</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center">ស្ថានភាពវត្តមាន</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredStudents.map((student, index) => {
                const currentStatus = attendanceData[student.id];

                return (
                  <tr 
                    key={student.id} 
                    className={`hover:bg-surface-hover/50 transition-colors ${
                      currentStatus === 'A' 
                        ? 'bg-rose-50/20' 
                        : currentStatus === 'E' 
                        ? 'bg-amber-50/20' 
                        : currentStatus === 'L' 
                        ? 'bg-sky-50/20' 
                        : ''
                    }`}
                  >
                    <td className="px-5 py-3.5 text-center text-xs font-semibold text-secondary-text">
                      {index + 1}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-secondary-text font-mono">
                      {student.studentId || '—'}
                    </td>
                    <td className="px-5 py-3 font-semibold text-main-text min-w-[220px]">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0 ${
                          student.gender === 'F' 
                            ? 'bg-pink-100 text-pink-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main-text">
                            {language === 'KH' ? student.name : (student.englishName || student.name)}
                          </span>
                          {student.englishName && language === 'KH' && (
                            <span className="text-[11px] text-secondary-text font-normal">
                              {student.englishName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        student.gender === 'F' 
                          ? 'bg-pink-50 text-pink-700 border border-pink-200/60' 
                          : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                      }`}>
                        {student.gender === 'F' ? 'ស្រី' : 'ប្រុស'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-center">
                        <div className="inline-flex bg-background p-1 rounded-xl border border-border shadow-2xs gap-1">
                          {/* Present Button */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'P')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === 'P' 
                                ? 'bg-emerald-600 text-white shadow-xs scale-102' 
                                : 'text-secondary-text hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="វត្តមាន"
                          >
                            <CheckCircle2 size={15} />
                            <span>វត្តមាន</span>
                          </button>
                          
                          {/* Absent Button */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'A')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === 'A' 
                                ? 'bg-rose-600 text-white shadow-xs scale-102' 
                                : 'text-secondary-text hover:text-rose-700 hover:bg-rose-50'
                            }`}
                            title="អវត្តមាន"
                          >
                            <XCircle size={15} />
                            <span>អវត្តមាន</span>
                          </button>
                          
                          {/* Excused Button */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'E')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === 'E' 
                                ? 'bg-amber-600 text-white shadow-xs scale-102' 
                                : 'text-secondary-text hover:text-amber-700 hover:bg-amber-50'
                            }`}
                            title="សុំច្បាប់"
                          >
                            <AlertCircle size={15} />
                            <span>ច្បាប់</span>
                          </button>
                          
                          {/* Late Button */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'L')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === 'L' 
                                ? 'bg-sky-600 text-white shadow-xs scale-102' 
                                : 'text-secondary-text hover:text-sky-700 hover:bg-sky-50'
                            }`}
                            title="មកយឺត"
                          >
                            <Clock size={15} />
                            <span>យឺត</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && selectedClass && (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center p-12 text-secondary-text">
                      <User size={36} className="text-secondary-text mb-3 opacity-40" />
                      <p className="text-sm font-semibold text-main-text">
                        {searchTerm ? 'រកមិនឃើញសិស្សដែលត្រូវនឹងពាក្យស្វែងរកឡើយ' : 'មិនមានសិស្សនៅក្នុងបញ្ជីនេះទេ'}
                      </p>
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="mt-2 text-xs text-primary underline font-medium"
                        >
                          សម្អាតពាក្យស្វែងរក
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Sticky Unsaved Changes Floating Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold text-xs tracking-wide">មានទិន្នន័យវត្តមានមិនទាន់រក្សាទុក!</span>
          </div>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => void handleSave()} 
            disabled={isSaving} 
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកឥឡូវនេះ'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
