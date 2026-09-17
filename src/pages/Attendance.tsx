import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Save, 
  Calendar, 
  CalendarDays, 
  CalendarRange, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Search, 
  RotateCcw, 
  CheckCheck, 
  UserX, 
  TrendingUp, 
  BookX, 
  BarChart3, 
  Eye, 
  X, 
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, AttendanceRecord } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { compareKhmer, compareStudentsByKhmerName } from '../utils/khmerSort';
import { exportToExcel } from '../utils/excel';

type AttendanceStatus = 'P' | 'A' | 'E' | 'L' | null;

interface StudentAttendanceSummary {
  student: Student;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  lateCount: number;
  totalAbsent: number;
  noBookCount: number;
  attendanceRate: number;
  history: Array<{
    date: string;
    attendance: AttendanceStatus;
    noBook: boolean;
  }>;
}

const getLocalDate = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const getWeekRange = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  const day = cur.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(cur);
  mon.setDate(cur.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { 
    start: fmt(mon), 
    end: fmt(sun),
    label: `${formatDateDisplay(fmt(mon))} ដល់ ${formatDateDisplay(fmt(sun))}`
  };
};

const CAMBODIAN_MONTHS = [
  { id: '10', name: 'តុលា (Oct)', short: 'តុលា', sem: 'SEM_1' },
  { id: '11', name: 'វិច្ឆិកា (Nov)', short: 'វិច្ឆិកា', sem: 'SEM_1' },
  { id: '12', name: 'ធ្នូ (Dec)', short: 'ធ្នូ', sem: 'SEM_1' },
  { id: '01', name: 'មករា (Jan)', short: 'មករា', sem: 'SEM_1' },
  { id: '02', name: 'កុម្ភៈ (Feb)', short: 'កុម្ភៈ', sem: 'SEM_2' },
  { id: '03', name: 'មីនា (Mar)', short: 'មីនា', sem: 'SEM_2' },
  { id: '04', name: 'មេសា (Apr)', short: 'មេសា', sem: 'SEM_2' },
  { id: '05', name: 'ឧសភា (May)', short: 'ឧសភា', sem: 'SEM_2' },
  { id: '06', name: 'មិថុនា (Jun)', short: 'មិថុនា', sem: 'SEM_2' },
  { id: '07', name: 'កក្កដា (Jul)', short: 'កក្កដា', sem: 'SEM_2' },
  { id: '08', name: 'សីហា (Aug)', short: 'សីហា', sem: 'SEM_2' },
  { id: '09', name: 'កញ្ញា (Sep)', short: 'កញ្ញា', sem: 'SEM_2' },
];

const Attendance = () => {
  const { language } = useLanguage();
  const { activeYear } = useAcademicYear();
  const [searchParams] = useSearchParams();
  const urlClassId = searchParams.get('classId');

  // Top navigation: DAILY or SUMMARY (Completely detached, static position)
  const [activeTab, setActiveTab] = useState<'DAILY' | 'SUMMARY'>('DAILY');

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate());
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Daily attendance state
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [initialAttendanceData, setInitialAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  
  // Daily "No Book" tracking: { [studentId]: true } means student has NO book on this date
  const [noBookData, setNoBookData] = useState<Record<string, boolean>>({});
  const [initialNoBookData, setInitialNoBookData] = useState<Record<string, boolean>>({});

  const [recordId, setRecordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'P' | 'A' | 'E' | 'L' | 'NO_BOOK' | 'UNMARKED'>('ALL');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Summary / Inspection tab state
  const [periodType, setPeriodType] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'YEAR'>('MONTH');
  const [summaryWeekDate, setSummaryWeekDate] = useState<string>(getLocalDate());
  const [summaryMonth, setSummaryMonth] = useState<string>(() => {
    return String(new Date().getMonth() + 1).padStart(2, '0');
  });
  const [summarySemester, setSummarySemester] = useState<'SEM_1' | 'SEM_2'>('SEM_1');
  const [allClassAttendance, setAllClassAttendance] = useState<AttendanceRecord[]>([]);
  const [allClassBooks, setAllClassBooks] = useState<Record<string, Record<string, boolean>>>({});
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<StudentAttendanceSummary | null>(null);
  const [summarySearchTerm, setSummarySearchTerm] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<'ALL' | 'ABSENT_HIGH' | 'NO_BOOK'>('ALL');
  const [summarySortBy, setSummarySortBy] = useState<'name' | 'absent' | 'noBook' | 'totalAbsent'>('totalAbsent');
  const [summarySortOrder, setSummarySortOrder] = useState<'asc' | 'desc'>('desc');

  // Dedicated Request Refs to prevent race conditions
  const loadClassesRequestRef = useRef(0);
  const loadStudentsRequestRef = useRef(0);
  const loadSummaryRequestRef = useRef(0);
  
  const hasChanges = 
    JSON.stringify(attendanceData) !== JSON.stringify(initialAttendanceData) ||
    JSON.stringify(noBookData) !== JSON.stringify(initialNoBookData);

  // Warn before leaving page or refreshing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);

  // Load classes
  useEffect(() => {
    if (!activeYear) {
      setClasses([]);
      setSelectedClass('');
      setStudents([]);
      setAllStudents([]);
      setAttendanceData({});
      setInitialAttendanceData({});
      setNoBookData({});
      setInitialNoBookData({});
      setRecordId(null);
      return;
    }

    const requestId = ++loadClassesRequestRef.current;
    
    const loadClasses = async () => {
      try {
        const db = await initDB();
        const allClasses = await db.getAll('classes', activeYear);
        if (requestId !== loadClassesRequestRef.current) return;
        allClasses.sort((a, b) => compareKhmer(a.name, b.name));
        setClasses(allClasses);
        if (allClasses.length > 0) {
          setSelectedClass(prev => {
            if (urlClassId && allClasses.some(c => c.id === urlClassId)) {
              return urlClassId;
            }
            const currentClassExists = allClasses.some(c => c.id === prev);
            return currentClassExists ? prev : allClasses[0].id;
          });
        } else {
          setSelectedClass('');
        }
      } catch (error) {
        if (requestId === loadClassesRequestRef.current) console.error(error);
      }
    };
    
    void loadClasses();
  }, [activeYear, urlClassId]);

  useEffect(() => {
    if (urlClassId && classes.some(c => c.id === urlClassId)) {
      setSelectedClass(urlClassId);
    }
  }, [urlClassId, classes]);

  // Load students, daily attendance, and daily "no book" data
  useEffect(() => {
    if (!selectedClass || !activeYear) {
      setStudents([]);
      setAllStudents([]);
      setAttendanceData({});
      setInitialAttendanceData({});
      setNoBookData({});
      setInitialNoBookData({});
      setRecordId(null);
      return;
    }

    const requestId = ++loadStudentsRequestRef.current;
    
    const loadStudentsAndAttendance = async () => {
      try {
        const db = await initDB();
        const bookDocId = `attendance_books_${activeYear}_${selectedClass}`;
        
        const [allYearStudents, record, bookSetting] = await Promise.all([
          db.getAll('students', activeYear),
          db.get('attendance', `${activeYear}_${selectedClass}_${selectedDate}`),
          db.get('settings', bookDocId)
        ]);

        if (requestId !== loadStudentsRequestRef.current) return;

        const classStudents = allYearStudents.filter(s => s.class === selectedClass);

        // Keep all related students for Summary View
        setAllStudents(allYearStudents.filter(s => s.class === selectedClass || s.alternateClassId === selectedClass));

        // Active students currently attending this class
        const activeClassStudents = classStudents.filter(s => s.status !== 'Inactive');
        
        // Student list for attendance
        const classAttendanceStudents = [...activeClassStudents];
        classAttendanceStudents.sort(compareStudentsByKhmerName);
        setStudents(classAttendanceStudents);
        
        // Attendance records
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

        // No-book tracking records for the selected date
        const classBooks = (bookSetting?.config as Record<string, Record<string, boolean>>) || {};
        const dateBooks = classBooks[selectedDate] || {};
        setNoBookData({ ...dateBooks });
        setInitialNoBookData({ ...dateBooks });

      } catch (error) {
        if (requestId === loadStudentsRequestRef.current) console.error(error);
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

  // Load all attendance and book records for Summary Tab
  useEffect(() => {
    if (activeTab !== 'SUMMARY' || !selectedClass || !activeYear) return;

    const requestId = ++loadSummaryRequestRef.current;
    setIsLoadingSummary(true);

    const loadSummaryData = async () => {
      try {
        const db = await initDB();
        const bookDocId = `attendance_books_${activeYear}_${selectedClass}`;

        const [allAtt, bookSetting] = await Promise.all([
          db.getAll('attendance', activeYear),
          db.get('settings', bookDocId)
        ]);

        if (requestId !== loadSummaryRequestRef.current) return;

        const classAtt = allAtt.filter(a => a.classId === selectedClass);
        setAllClassAttendance(classAtt);

        const classBooks = (bookSetting?.config as Record<string, Record<string, boolean>>) || {};
        setAllClassBooks(classBooks);
      } catch (error) {
        if (requestId === loadSummaryRequestRef.current) console.error(error);
      } finally {
        if (requestId === loadSummaryRequestRef.current) {
          setIsLoadingSummary(false);
        }
      }
    };

    void loadSummaryData();

    const handleSummaryDataChange = () => {
      void loadSummaryData();
    };
    window.addEventListener('appDataChanged', handleSummaryDataChange);

    return () => {
      window.removeEventListener('appDataChanged', handleSummaryDataChange);
    };
  }, [activeTab, selectedClass, activeYear]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Tab change handler with unsaved changes guard
  const handleTabChange = (newTab: 'DAILY' | 'SUMMARY') => {
    if (activeTab === newTab) return;
    if (activeTab === 'DAILY' && hasChanges) {
      if (!window.confirm('អ្នកមានទិន្នន័យវត្តមានមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់ផ្លាស់ប្តូរផ្ទាំងមែនទេ?')) return;
    }
    setActiveTab(newTab);
  };

  // Status toggle handler
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    const isCurrentlySame = attendanceData[studentId] === status;
    const newStatus = isCurrentlySame ? null : status;

    setAttendanceData(prev => ({
      ...prev,
      [studentId]: newStatus
    }));

    // If student is marked Absent (A) or Leave (E), remove no-book flag
    if (newStatus === 'A' || newStatus === 'E') {
      setNoBookData(prev => {
        if (!prev[studentId]) return prev;
        const updated = { ...prev };
        delete updated[studentId];
        return updated;
      });
    }
  };

  // Toggle "គ្មានសៀវភៅ" (No book) for a student
  const handleToggleNoBook = (studentId: string) => {
    setNoBookData(prev => {
      const updated = { ...prev };
      if (updated[studentId]) {
        delete updated[studentId];
      } else {
        updated[studentId] = true;
      }
      return updated;
    });
  };

  // Quick Bulk Actions (Applies to filtered students if search or filter is active)
  const handleBulkAction = (status: AttendanceStatus) => {
    if (!status) {
      if (!window.confirm('តើអ្នកពិតជាចង់សម្អាតទិន្នន័យវត្តមានទាំងអស់សម្រាប់ថ្ងៃនេះមែនទេ?')) return;
      setAttendanceData({});
      setNoBookData({});
      return;
    }
    const targetStudents = (searchTerm.trim() || statusFilter !== 'ALL') ? filteredStudents : students;
    const newAtt: Record<string, AttendanceStatus> = { ...attendanceData };
    const newNoBooks: Record<string, boolean> = { ...noBookData };

    targetStudents.forEach(s => {
      newAtt[s.id] = status;
      if (status === 'A' || status === 'E') {
        delete newNoBooks[s.id];
      }
    });
    setAttendanceData(newAtt);
    setNoBookData(newNoBooks);
  };

  const handleClearNoBook = () => {
    setNoBookData({});
  };

  // Save both Attendance and No-Book data
  const handleSave = async () => {
    if (!selectedClass || !activeYear) return;
    setIsSaving(true);
    
    try {
      const db = await initDB();
      const id = recordId || `${activeYear}_${selectedClass}_${selectedDate}`;
      const shiftVal = classes.find(c => c.id === selectedClass)?.shift || 'Morning';
      
      const record: AttendanceRecord = {
        id,
        date: selectedDate,
        classId: selectedClass,
        shift: shiftVal,
        academicYear: activeYear,
        records: attendanceData as any
      };
      
      // 1. Save Attendance Record to attendance store
      await db.put('attendance', record);

      // 2. Save No-Book Tracking to settings store under class document
      const bookDocId = `attendance_books_${activeYear}_${selectedClass}`;
      const bookSetting = await db.get('settings', bookDocId);
      const existingBooks = (bookSetting?.config as Record<string, Record<string, boolean>>) || {};
      
      // Clean noBookData so only true values are stored
      const cleanedDateBooks: Record<string, boolean> = {};
      Object.entries(noBookData).forEach(([stId, val]) => {
        if (val === true) {
          cleanedDateBooks[stId] = true;
        }
      });

      const updatedClassBooks = {
        ...existingBooks,
        [selectedDate]: cleanedDateBooks
      };

      await db.put('settings', { id: bookDocId, config: updatedClassBooks });
      
      setInitialAttendanceData({ ...attendanceData });
      setInitialNoBookData({ ...cleanedDateBooks });
      setRecordId(id);
      
      // Dispatch appDataChanged event so all components and tabs stay synchronized
      window.dispatchEvent(new CustomEvent('appDataChanged'));

      showToast('success', language === 'KH' ? 'រក្សាទុកទិន្នន័យវត្តមាន និងសៀវភៅជោគជ័យ!' : 'Attendance & Book data saved successfully!');
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

  const openDatePicker = () => {
    try {
      dateInputRef.current?.showPicker?.();
    } catch {
      dateInputRef.current?.focus();
    }
  };

  const handleDateChange = (newDate: string) => {
    if (hasChanges) {
      if (!window.confirm('អ្នកមានទិន្នន័យមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់បោះបង់វាហើយប្តូរថ្ងៃមែនទេ?')) return;
    }
    setSelectedDate(newDate);
  };

  // Export Daily Attendance to Excel
  const handleExportDailyExcel = () => {
    if (!students.length) {
      showToast('error', 'មិនមានទិន្នន័យសិស្សសម្រាប់ Export ឡើយ');
      return;
    }
    const currentClassObj = classes.find(c => c.id === selectedClass);
    const className = currentClassObj ? currentClassObj.name : selectedClass;

    const dataToExport = filteredStudents.map((s, index) => {
      const status = attendanceData[s.id];
      let statusText = 'មិនទាន់កត់';
      if (status === 'P') statusText = 'វត្តមាន';
      else if (status === 'A') statusText = 'អវត្តមាន';
      else if (status === 'E') statusText = 'សុំច្បាប់';
      else if (status === 'L') statusText = 'មកយឺត';

      const hasNoBook = noBookData[s.id] === true;

      return {
        'ល.រ': index + 1,
        'អត្តលេខ': s.studentId || '',
        'ឈ្មោះសិស្ស': s.name,
        'ឈ្មោះជាឡាតាំង': s.englishName || '',
        'ភេទ': s.gender === 'F' ? 'ស្រី' : 'ប្រុស',
        'ថ្នាក់': className,
        'វេន': currentClassObj?.shift === 'Morning' ? 'ព្រឹក' : currentClassObj?.shift === 'Afternoon' ? 'រសៀល' : 'យប់',
        'កាលបរិច្ឆេទ': formatDateDisplay(selectedDate),
        'ស្ថានភាពវត្តមាន': statusText,
        'ស្ថានភាពសៀវភៅ': hasNoBook ? 'គ្មានសៀវភៅ' : 'មានសៀវភៅ',
        'ចំណាំប្តូរវេន': s.isShiftSwitching ? `សិស្សប្តូរវេន (ថ្នាក់បម្រុង៖ ${classes.find(c => c.id === s.alternateClassId)?.name || 'ថ្នាក់ផ្សេង'})` : ''
      };
    });

    const success = exportToExcel(dataToExport, `វត្តមាន_ថ្នាក់_${className}_${selectedDate}`);
    if (success) {
      showToast('success', 'បានទាញយកឯកសារ Excel ជោគជ័យ!');
    } else {
      showToast('error', 'មានបញ្ហាក្នុងការទាញយក Excel');
    }
  };

  // Daily Counts
  const presentCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'P').length, [attendanceData]);
  const absentCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'A').length, [attendanceData]);
  const excusedCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'E').length, [attendanceData]);
  const lateCount = useMemo(() => Object.values(attendanceData).filter(v => v === 'L').length, [attendanceData]);
  const noBookCount = useMemo(() => Object.values(noBookData).filter(v => v === true).length, [noBookData]);

  const markedCount = presentCount + absentCount + excusedCount + lateCount;
  const unmarkedCount = Math.max(0, students.length - markedCount);
  
  const attendanceRate = markedCount > 0 
    ? Math.round(((presentCount + lateCount) / markedCount) * 100) 
    : 0;

  // Filtered students for daily table
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
      const hasNoBook = noBookData[student.id] === true;
      if (statusFilter === 'P') return status === 'P';
      if (statusFilter === 'A') return status === 'A';
      if (statusFilter === 'E') return status === 'E';
      if (statusFilter === 'L') return status === 'L';
      if (statusFilter === 'NO_BOOK') return hasNoBook;
      if (statusFilter === 'UNMARKED') return !status;

      return true;
    });
  }, [students, searchTerm, statusFilter, attendanceData, noBookData]);

  const selectedClassObj = classes.find(c => c.id === selectedClass);

  // -------------------------------------------------------------
  // Summary & Inspection Calculation Logic
  // -------------------------------------------------------------
  const weekRange = useMemo(() => getWeekRange(summaryWeekDate), [summaryWeekDate]);

  const handlePrevWeek = () => {
    const [y, m, d] = summaryWeekDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 7);
    setSummaryWeekDate(getLocalDate(prev));
  };

  const handleNextWeek = () => {
    const [y, m, d] = summaryWeekDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + 7);
    setSummaryWeekDate(getLocalDate(next));
  };

  const handleCurrentWeek = () => {
    setSummaryWeekDate(getLocalDate());
  };

  // Filter attendance records by selected period (ignoring cleared/empty sessions)
  const filteredPeriodRecords = useMemo(() => {
    return allClassAttendance.filter(r => {
      // Exclude empty cleared sessions
      const hasRecords = r.records && Object.values(r.records).some(v => v !== null && v !== undefined);
      if (!hasRecords) return false;

      if (!r.date) return false;
      const parts = r.date.split('-');
      const m = parts[1] || '';

      if (periodType === 'WEEK') {
        return r.date >= weekRange.start && r.date <= weekRange.end;
      }
      if (periodType === 'MONTH') {
        return m === summaryMonth;
      }
      if (periodType === 'SEMESTER') {
        if (summarySemester === 'SEM_1') {
          return ['10', '11', '12', '01'].includes(m);
        } else {
          // Semester 2 spans from February through September
          return ['02', '03', '04', '05', '06', '07', '08', '09'].includes(m);
        }
      }
      // YEAR
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [allClassAttendance, periodType, weekRange, summaryMonth, summarySemester]);

  // Compute student summary statistics across the selected period
  const studentSummaries: StudentAttendanceSummary[] = useMemo(() => {
    // For summary, combine current active students with any students who have historical records in this period
    const studentMap = new Map<string, Student>();
    students.forEach(s => studentMap.set(s.id, s));
    allStudents.forEach(s => {
      if (!studentMap.has(s.id)) {
        const hasHistory = filteredPeriodRecords.some(r => r.records && r.records[s.id] !== undefined && r.records[s.id] !== null);
        if (hasHistory) {
          studentMap.set(s.id, s);
        }
      }
    });

    return Array.from(studentMap.values()).map(student => {
      let pCount = 0;
      let aCount = 0;
      let eCount = 0;
      let lCount = 0;
      let noBCount = 0;
      const history: StudentAttendanceSummary['history'] = [];

      filteredPeriodRecords.forEach(attRecord => {
        const status = (attRecord.records as Record<string, AttendanceStatus>)?.[student.id] || null;
        const dateBooks = allClassBooks[attRecord.date];
        const isNoBook = dateBooks?.[student.id] === true;

        if (status === 'P') pCount++;
        else if (status === 'A') aCount++;
        else if (status === 'E') eCount++;
        else if (status === 'L') lCount++;

        if (isNoBook) noBCount++;

        if (status || isNoBook) {
          history.push({
            date: attRecord.date,
            attendance: status,
            noBook: isNoBook,
          });
        }
      });

      const totalAbsent = aCount + eCount;
      const marked = pCount + aCount + eCount + lCount;
      const rate = marked > 0 ? Math.round(((pCount + lCount) / marked) * 100) : 0;

      return {
        student,
        presentCount: pCount,
        absentCount: aCount,
        excusedCount: eCount,
        lateCount: lCount,
        totalAbsent,
        noBookCount: noBCount,
        attendanceRate: rate,
        history,
      };
    });
  }, [students, allStudents, filteredPeriodRecords, allClassBooks]);

  // Period class-wide metrics
  const periodTotalSessions = filteredPeriodRecords.length;
  const periodTotalAbsents = useMemo(() => studentSummaries.reduce((acc, s) => acc + s.absentCount, 0), [studentSummaries]);
  const periodTotalExcused = useMemo(() => studentSummaries.reduce((acc, s) => acc + s.excusedCount, 0), [studentSummaries]);
  const periodTotalAbsences = useMemo(() => studentSummaries.reduce((acc, s) => acc + s.totalAbsent, 0), [studentSummaries]);
  const periodTotalNoBook = useMemo(() => studentSummaries.reduce((acc, s) => acc + s.noBookCount, 0), [studentSummaries]);

  // Filter and sort student summaries
  const filteredStudentSummaries = useMemo(() => {
    return studentSummaries.filter(item => {
      if (summarySearchTerm.trim()) {
        const q = summarySearchTerm.toLowerCase();
        const matchesName = item.student.name.toLowerCase().includes(q);
        const matchesEnglish = (item.student.englishName || '').toLowerCase().includes(q);
        const matchesId = (item.student.studentId || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEnglish && !matchesId) return false;
      }

      if (summaryFilter === 'ABSENT_HIGH') {
        return item.totalAbsent >= 3;
      }
      if (summaryFilter === 'NO_BOOK') {
        return item.noBookCount >= 1;
      }

      return true;
    }).sort((a, b) => {
      if (summarySortBy === 'name') {
        const nameComp = compareStudentsByKhmerName(a.student, b.student);
        return summarySortOrder === 'asc' ? nameComp : -nameComp;
      }

      let comparison = 0;
      if (summarySortBy === 'totalAbsent') {
        comparison = b.totalAbsent - a.totalAbsent;
      } else if (summarySortBy === 'absent') {
        comparison = b.absentCount - a.absentCount;
      } else if (summarySortBy === 'noBook') {
        comparison = b.noBookCount - a.noBookCount;
      }
      return summarySortOrder === 'asc' ? -comparison : comparison;
    });
  }, [studentSummaries, summarySearchTerm, summaryFilter, summarySortBy, summarySortOrder]);

  // Export Period Summary to Excel
  const handleExportSummaryExcel = () => {
    if (!studentSummaries.length) {
      showToast('error', 'មិនមានទិន្នន័យស្ថិតិសម្រាប់ Export ឡើយ');
      return;
    }
    const currentClassObj = classes.find(c => c.id === selectedClass);
    const className = currentClassObj ? currentClassObj.name : selectedClass;

    let periodLabel = '';
    if (periodType === 'WEEK') periodLabel = `សប្តាហ៍_${weekRange.start}_ដល់_${weekRange.end}`;
    else if (periodType === 'MONTH') {
      const monthObj = CAMBODIAN_MONTHS.find(m => m.id === summaryMonth);
      periodLabel = `ខែ_${monthObj?.short || summaryMonth}`;
    } else if (periodType === 'SEMESTER') {
      periodLabel = summarySemester === 'SEM_1' ? 'ឆមាសទី១' : 'ឆមាសទី២';
    } else {
      periodLabel = `ឆ្នាំសិក្សា_${activeYear}`;
    }

    const dataToExport = filteredStudentSummaries.map((item, index) => {
      return {
        'ល.រ': index + 1,
        'អត្តលេខ': item.student.studentId || '',
        'ឈ្មោះសិស្ស': item.student.name,
        'ឈ្មោះជាឡាតាំង': item.student.englishName || '',
        'ភេទ': item.student.gender === 'F' ? 'ស្រី' : 'ប្រុស',
        'វត្តមាន (P)': item.presentCount,
        'អវត្តមាន (A)': item.absentCount,
        'សុំច្បាប់ (E)': item.excusedCount,
        'ឈប់សរុប (A+E)': item.totalAbsent,
        'មកយឺត (L)': item.lateCount,
        'គ្មានសៀវភៅ': item.noBookCount,
        'អត្រាវត្តមាន (%)': `${item.attendanceRate}%`,
        'ស្ថានភាពសិស្ស': item.student.status === 'Inactive' ? 'ផ្អាក/ឈប់រៀន' : 'កំពុងរៀន'
      };
    });

    const success = exportToExcel(dataToExport, `ស្ថិតិវត្តមាន_${className}_${periodLabel}`);
    if (success) {
      showToast('success', 'បានទាញយកឯកសារ Excel ជោគជ័យ!');
    } else {
      showToast('error', 'មានបញ្ហាក្នុងការទាញយក Excel');
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 space-y-5">
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

      {/* ========================================================= */}
      {/* 1. DEDICATED TOP NAVIGATION TABS BAR (STABLE & UNMOVING)   */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-2 rounded-2xl border border-border/80 shadow-xs">
        <div className="inline-flex bg-background p-1 rounded-xl border border-border shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('DAILY')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'DAILY'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-secondary-text hover:text-main-text hover:bg-surface-hover'
            }`}
          >
            <Calendar size={15} />
            <span>កត់ត្រាប្រចាំថ្ងៃ</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('SUMMARY')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUMMARY'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-secondary-text hover:text-main-text hover:bg-surface-hover'
            }`}
          >
            <BarChart3 size={15} />
            <span>ត្រួតពិនិត្យ & ស្ថិតិ</span>
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 py-1 text-xs text-secondary-text font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>ឆ្នាំសិក្សា៖ <strong className="text-main-text font-bold">{activeYear}</strong></span>
          </span>
          {activeTab === 'DAILY' && markedCount > 0 && (
            <span className="hidden md:inline-block px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
              អត្រាវត្តមានថ្ងៃនេះ៖ {attendanceRate}%
            </span>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CONTROL PANEL CARD                                     */}
      {/* ========================================================= */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all">
        {/* Header Ribbon */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-inner">
              <CalendarDays size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide">
                {activeTab === 'DAILY' ? 'កត់ត្រាវត្តមាន & សៀវភៅប្រចាំថ្ងៃ' : 'របាយការណ៍ត្រួតពិនិត្យវត្តមាន & សៀវភៅ'}
              </h1>
              <p className="text-xs text-blue-100/80">
                {selectedClassObj ? `ថ្នាក់៖ ${selectedClassObj.name} (${selectedClassObj.shift === 'Morning' ? 'វេនព្រឹក' : selectedClassObj.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'})` : 'សូមជ្រើសរើសថ្នាក់'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'DAILY' && (
              <>
                <button
                  type="button"
                  onClick={handleExportDailyExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-white/15 hover:bg-white/25 text-white active:scale-98 border border-white/20"
                  title="ទាញយកបញ្ជីវត្តមានថ្ងៃនេះជា Excel"
                >
                  <FileSpreadsheet size={15} />
                  <span className="hidden sm:inline">ទាញយក Excel</span>
                </button>

                <button 
                  type="button"
                  onClick={() => void handleSave()} 
                  disabled={!hasChanges || isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 text-white active:scale-98"
                >
                  <Save size={15} />
                  <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ'}</span>
                </button>
              </>
            )}

            {activeTab === 'SUMMARY' && (
              <button
                type="button"
                onClick={handleExportSummaryExcel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white active:scale-98"
                title="ទាញយករបាយការណ៍ស្ថិតិជា Excel"
              >
                <FileSpreadsheet size={15} />
                <span>ទាញយក Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- */}
        {/* VIEW 1: DAILY CONTROLS & METRICS                        */}
        {/* ------------------------------------------------------- */}
        {activeTab === 'DAILY' && (
          <>
            {/* Filter Controls Bar */}
            <div className="p-5 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-surface border-b border-border">
              <div className="flex flex-wrap items-center gap-4">
                {/* Select Class */}
                <div className="flex flex-col gap-1.5 min-w-[200px]">
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
                
                {/* Date Picker Box */}
                <div className="flex flex-col gap-1.5 min-w-[170px]">
                  <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">កាលបរិច្ឆេទ</label>
                  <div 
                    onClick={openDatePicker}
                    className="relative flex items-center justify-between gap-3 px-3.5 py-2.5 border border-border bg-background hover:bg-surface-hover hover:border-primary/50 text-main-text rounded-xl shadow-xs cursor-pointer transition-all group select-none"
                    title="ចុចដើម្បីរើសថ្ងៃ ខែ ឆ្នាំ"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar size={16} className="text-primary group-hover:scale-105 transition-transform shrink-0" />
                      <span className="font-semibold text-main-text text-sm">
                        {formatDateDisplay(selectedDate)}
                      </span>
                    </div>
                    <ChevronDown size={14} className="text-secondary-text group-hover:text-main-text transition-colors shrink-0" />
                    <input 
                      ref={dateInputRef}
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                      tabIndex={-1}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Bulk Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0">
                <span className="text-xs font-semibold text-secondary-text mr-1">
                  {(searchTerm.trim() || statusFilter !== 'ALL') ? `កំណត់រហ័ស (${filteredStudents.length} នាក់)៖` : 'កំណត់រហ័ស៖'}
                </span>
                <button 
                  type="button"
                  onClick={() => handleBulkAction('P')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-2xs cursor-pointer"
                  title={(searchTerm.trim() || statusFilter !== 'ALL') ? "កំណត់សិស្សដែលកំពុងបង្ហាញជាវត្តមាន" : "កំណត់សិស្សទាំងអស់ជាវត្តមាន"}
                >
                  <CheckCheck size={14} />
                  <span>វត្តមានទាំងអស់</span>
                </button>
                <button 
                  type="button"
                  onClick={() => handleBulkAction('A')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-2xs cursor-pointer"
                  title={(searchTerm.trim() || statusFilter !== 'ALL') ? "កំណត់សិស្សដែលកំពុងបង្ហាញជាអវត្តមាន" : "កំណត់សិស្សទាំងអស់ជាអវត្តមាន"}
                >
                  <UserX size={14} />
                  <span>អវត្តមានទាំងអស់</span>
                </button>
                {noBookCount > 0 && (
                  <button 
                    type="button"
                    onClick={handleClearNoBook}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-600 hover:text-white transition-all active:scale-95 shadow-2xs cursor-pointer"
                    title="លុបការកត់ចំណាំគ្មានសៀវភៅសម្រាប់ថ្ងៃនេះ"
                  >
                    <BookX size={13} />
                    <span>សម្អាតចំណាំសៀវភៅ</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => handleBulkAction(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all active:scale-95 shadow-2xs cursor-pointer ml-1"
                  title="សម្អាតទិន្នន័យទាំងអស់"
                >
                  <RotateCcw size={13} />
                  <span>សម្អាត</span>
                </button>
              </div>
            </div>

            {/* Metrics Summary Strip (Daily) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-background/50">
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

              {/* No Book Count */}
              <div className={`p-3 rounded-xl border shadow-2xs flex flex-col justify-between transition-colors ${
                noBookCount > 0 
                  ? 'bg-rose-100/70 border-rose-300' 
                  : 'bg-surface border-border'
              }`}>
                <span className={`text-[11px] font-bold uppercase flex items-center gap-1 ${
                  noBookCount > 0 ? 'text-rose-900' : 'text-secondary-text'
                }`}>
                  <BookX size={13} className={noBookCount > 0 ? 'text-rose-600' : 'text-secondary-text'} /> គ្មានសៀវភៅ
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-2xl font-bold ${noBookCount > 0 ? 'text-rose-700' : 'text-main-text'}`}>
                    {noBookCount}
                  </span>
                  <span className="text-xs text-secondary-text">នាក់</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ------------------------------------------------------- */}
        {/* VIEW 2: SUMMARY & INSPECTION PERIOD CONTROLLER          */}
        {/* ------------------------------------------------------- */}
        {activeTab === 'SUMMARY' && (
          <div className="p-5 flex flex-col gap-4 bg-surface border-b border-border">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              {/* Class & Period Switcher */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Select Class */}
                <div className="flex flex-col gap-1.5 min-w-[200px]">
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

                {/* Period Mode Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">កាលកំណត់ត្រួតពិនិត្យ</label>
                  <div className="inline-flex bg-background p-1 rounded-xl border border-border shadow-2xs gap-1">
                    <button
                      type="button"
                      onClick={() => setPeriodType('WEEK')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        periodType === 'WEEK'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-secondary-text hover:text-main-text hover:bg-surface-hover'
                      }`}
                    >
                      មួយអាទិត្យ (Week)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('MONTH')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        periodType === 'MONTH'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-secondary-text hover:text-main-text hover:bg-surface-hover'
                      }`}
                    >
                      មួយខែ (Month)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('SEMESTER')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        periodType === 'SEMESTER'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-secondary-text hover:text-main-text hover:bg-surface-hover'
                      }`}
                    >
                      មួយឆមាស (Semester)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('YEAR')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        periodType === 'YEAR'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-secondary-text hover:text-main-text hover:bg-surface-hover'
                      }`}
                    >
                      មួយឆ្នាំ (Year)
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Period Controls */}
              <div className="flex items-center gap-3 self-end lg:self-center">
                {periodType === 'WEEK' && (
                  <div className="flex items-center gap-2 bg-background border border-border p-1.5 rounded-xl shadow-xs">
                    <button
                      type="button"
                      onClick={handlePrevWeek}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-secondary-text hover:text-main-text transition-colors cursor-pointer"
                      title="សប្តាហ៍មុន"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-main-text px-2">
                      {weekRange.label}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextWeek}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-secondary-text hover:text-main-text transition-colors cursor-pointer"
                      title="សប្តាហ៍បន្ទាប់"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCurrentWeek}
                      className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer ml-1"
                    >
                      សប្តាហ៍នេះ
                    </button>
                  </div>
                )}

                {periodType === 'MONTH' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-secondary-text">រើសខែ៖</span>
                    <select
                      value={summaryMonth}
                      onChange={(e) => setSummaryMonth(e.target.value)}
                      className="bg-background border border-border text-main-text text-xs rounded-xl px-3 py-2 font-bold outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
                    >
                      {CAMBODIAN_MONTHS.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {periodType === 'SEMESTER' && (
                  <div className="inline-flex bg-background p-1 rounded-xl border border-border shadow-2xs gap-1">
                    <button
                      type="button"
                      onClick={() => setSummarySemester('SEM_1')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        summarySemester === 'SEM_1'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-secondary-text hover:text-main-text'
                      }`}
                    >
                      ឆមាសទី១ (តុលា - មករា)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummarySemester('SEM_2')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        summarySemester === 'SEM_2'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-secondary-text hover:text-main-text'
                      }`}
                    >
                      ឆមាសទី២ (កុម្ភៈ - កក្កដា)
                    </button>
                  </div>
                )}

                {periodType === 'YEAR' && (
                  <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
                    <CalendarRange size={15} />
                    <span>ពេញមួយឆ្នាំសិក្សា ({activeYear})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              <div className="bg-background/80 p-3 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-secondary-text uppercase">ចំនួនថ្ងៃកត់ត្រា</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-main-text">{periodTotalSessions}</span>
                  <span className="text-xs text-secondary-text">ថ្ងៃ</span>
                </div>
              </div>

              <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
                  <XCircle size={13} className="text-rose-600" /> អវត្តមាន (A)
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-rose-700">{periodTotalAbsents}</span>
                  <span className="text-xs text-rose-700/80">ដង</span>
                </div>
              </div>

              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
                  <AlertCircle size={13} className="text-amber-600" /> សុំច្បាប់ (E)
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-amber-700">{periodTotalExcused}</span>
                  <span className="text-xs text-amber-700/80">ដង</span>
                </div>
              </div>

              <div className="bg-red-50/80 p-3 rounded-xl border border-red-300 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-red-900 uppercase flex items-center gap-1">
                  <UserX size={13} className="text-red-700" /> ឈប់សរុប (A+E)
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-red-700">{periodTotalAbsences}</span>
                  <span className="text-xs text-red-700/80">ដង</span>
                </div>
              </div>

              <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
                  <BookX size={13} className="text-rose-600" /> គ្មានសៀវភៅ
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-rose-700">{periodTotalNoBook}</span>
                  <span className="text-xs text-rose-700/80">ដង</span>
                </div>
              </div>

              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-indigo-800 uppercase flex items-center gap-1">
                  <TrendingUp size={13} className="text-indigo-600" /> ស្ថិតិសិស្ស
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-indigo-700">{students.length}</span>
                  <span className="text-xs text-indigo-700/80">នាក់សរុប</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. TAB 1: DAILY STUDENT LIST TABLE                        */}
      {/* ========================================================= */}
      {activeTab === 'DAILY' && (
        <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
          {/* Table Search & Filter Bar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-surface">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'L'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-background hover:bg-surface-hover text-sky-700'
                }`}
              >
                យឺត ({lateCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('NO_BOOK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'NO_BOOK'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-background hover:bg-surface-hover text-rose-700'
                }`}
              >
                គ្មានសៀវភៅ ({noBookCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('UNMARKED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary-text hover:text-main-text cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-14">ល.រ</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider w-24">អត្តលេខ</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-20">ភេទ</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">ស្ថានភាពវត្តមាន & សៀវភៅ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredStudents.map((student, index) => {
                  const currentStatus = attendanceData[student.id];
                  const hasNoBook = noBookData[student.id] === true;
                  const isAbsent = currentStatus === 'A' || currentStatus === 'E';

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
                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-secondary-text">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-secondary-text font-mono">
                        {student.studentId || '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-main-text min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0 ${
                            student.gender === 'F' 
                              ? 'bg-pink-100 text-pink-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {student.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-main-text">
                                {language === 'KH' ? student.name : (student.englishName || student.name)}
                              </span>
                              {student.isShiftSwitching && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  {`សិស្សប្តូរវេន (ថ្នាក់បម្រុង៖ ${classes.find(c => c.id === student.alternateClassId)?.name || 'ថ្នាក់ផ្សេង'})`}
                                </span>
                              )}
                            </div>
                            {student.englishName && language === 'KH' && (
                              <span className="text-[11px] text-secondary-text font-normal">
                                {student.englishName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          student.gender === 'F' 
                            ? 'bg-pink-50 text-pink-700 border border-pink-200/60' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                        }`}>
                          {student.gender === 'F' ? 'ស្រី' : 'ប្រុស'}
                        </span>
                      </td>

                      {/* Unified Action Group: Attendance Status + No Book Button */}
                      <td className="px-4 py-3.5">
                        <div className="flex justify-center">
                          <div className="inline-flex items-center bg-background p-1 rounded-xl border border-border shadow-2xs gap-1">
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

                            {/* Divider Line */}
                            <div className="h-5 w-[1px] bg-border mx-0.5" />

                            {/* No Book Toggle Button (គ្មានសៀវភៅ) */}
                            <button
                              type="button"
                              onClick={() => handleToggleNoBook(student.id)}
                              disabled={isAbsent}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                hasNoBook
                                  ? 'bg-rose-600 text-white shadow-xs font-bold scale-102'
                                  : 'text-secondary-text hover:text-rose-700 hover:bg-rose-50'
                              }`}
                              title={isAbsent ? 'សិស្សឈប់ (មិនអាចកត់សៀវភៅ)' : hasNoBook ? 'សិស្សគ្មានសៀវភៅ (ចុចដើម្បីដកចំណាំចេញ)' : 'ចុចកត់ចំណាំថាសិស្សគ្មានសៀវភៅ'}
                            >
                              <BookX size={15} className={hasNoBook ? 'text-white' : 'text-rose-500'} />
                              <span>គ្មានសៀវភៅ</span>
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
                            className="mt-2 text-xs text-primary underline font-medium cursor-pointer"
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
      )}

      {/* ========================================================= */}
      {/* 4. TAB 2: SUMMARY & INSPECTION TABLE (WEEK/MONTH/SEM/YEAR)*/}
      {/* ========================================================= */}
      {activeTab === 'SUMMARY' && (
        <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
          {/* Summary Search & Sub-Filter Bar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-surface">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSummaryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  summaryFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-background hover:bg-surface-hover text-secondary-text'
                }`}
              >
                សិស្សទាំងអស់ ({students.length})
              </button>

              <button
                type="button"
                onClick={() => setSummaryFilter('ABSENT_HIGH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  summaryFilter === 'ABSENT_HIGH'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-background hover:bg-surface-hover text-rose-700'
                }`}
              >
                ឈប់ញឹកញាប់ (≥ 3 ដង)
              </button>

              <button
                type="button"
                onClick={() => setSummaryFilter('NO_BOOK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  summaryFilter === 'NO_BOOK'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-background hover:bg-surface-hover text-rose-700'
                }`}
              >
                ធ្លាប់គ្មានសៀវភៅ (≥ 1 ដង)
              </button>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-2.5">
              <div className="relative min-w-[220px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text" />
                <input
                  type="text"
                  placeholder="ស្វែងរកសិស្ស..."
                  value={summarySearchTerm}
                  onChange={(e) => setSummarySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 shadow-2xs"
                />
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-1 bg-background border border-border px-2.5 py-1.5 rounded-xl text-xs font-semibold text-secondary-text shadow-2xs">
                <ArrowUpDown size={13} className="text-secondary-text" />
                <select
                  value={summarySortBy}
                  onChange={(e) => setSummarySortBy(e.target.value as any)}
                  className="bg-transparent text-main-text text-xs font-bold outline-hidden cursor-pointer"
                >
                  <option value="totalAbsent">តម្រៀប៖ ឈប់សរុប</option>
                  <option value="absent">តម្រៀប៖ អវត្តមាន</option>
                  <option value="noBook">តម្រៀប៖ គ្មានសៀវភៅ</option>
                  <option value="name">តម្រៀប៖ ឈ្មោះសិស្ស</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSummarySortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-primary font-bold ml-1 hover:underline cursor-pointer"
                  title="ប្តូរលំដាប់ ឡើង/ចុះ"
                >
                  {summarySortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>

          {/* Table of Student Summary Statistics */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border text-xs">
                <tr>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-center w-14">ល.រ</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider w-24">អត្តលេខ</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-16">ភេទ</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-20 text-emerald-700">វត្តមាន</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-20 text-rose-700">អវត្តមាន (A)</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-20 text-amber-700">សុំច្បាប់ (E)</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-24 text-red-700 bg-red-50/40">ឈប់សរុប</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-20 text-sky-700">មកយឺត</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-24 text-rose-700">គ្មានសៀវភៅ</th>
                  <th className="px-3 py-3.5 font-bold uppercase tracking-wider text-center w-20">អត្រា %</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-center w-24">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {isLoadingSummary ? (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-secondary-text">
                      <div className="inline-flex items-center gap-2 font-bold text-sm text-primary">
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>កំពុងទាញយកទិន្នន័យស្ថិតិ...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudentSummaries.map((item, index) => {
                  return (
                    <tr 
                      key={item.student.id} 
                      className={`hover:bg-surface-hover/50 transition-colors ${
                        item.totalAbsent >= 3 ? 'bg-rose-50/15' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 text-center font-semibold text-secondary-text">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-secondary-text font-mono">
                        {item.student.studentId || '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-main-text">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                            item.student.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.student.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-main-text block">
                                {item.student.name}
                              </span>
                              {item.student.status === 'Inactive' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                                  ឈប់រៀន
                                </span>
                              )}
                              {item.student.isShiftSwitching && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ប្តូរវេន
                                </span>
                              )}
                            </div>
                            {item.student.englishName && (
                              <span className="text-[11px] text-secondary-text">
                                {item.student.englishName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.student.gender === 'F' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {item.student.gender === 'F' ? 'ស្រី' : 'ប្រុស'}
                        </span>
                      </td>

                      {/* Present */}
                      <td className="px-3 py-3.5 text-center font-bold text-emerald-700">
                        {item.presentCount}
                      </td>

                      {/* Absent (A) */}
                      <td className="px-3 py-3.5 text-center font-bold text-rose-700">
                        {item.absentCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                            {item.absentCount}
                          </span>
                        ) : '0'}
                      </td>

                      {/* Excused (E) */}
                      <td className="px-3 py-3.5 text-center font-bold text-amber-700">
                        {item.excusedCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            {item.excusedCount}
                          </span>
                        ) : '0'}
                      </td>

                      {/* Total Absent (A + E) */}
                      <td className="px-3 py-3.5 text-center font-bold bg-red-50/40">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-lg text-xs font-extrabold ${
                          item.totalAbsent >= 3 
                            ? 'bg-red-600 text-white shadow-xs animate-pulse' 
                            : item.totalAbsent > 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'text-slate-400 font-normal'
                        }`}>
                          {item.totalAbsent} ដង
                        </span>
                      </td>

                      {/* Late (L) */}
                      <td className="px-3 py-3.5 text-center font-bold text-sky-700">
                        {item.lateCount}
                      </td>

                      {/* No Book Count */}
                      <td className="px-3 py-3.5 text-center font-bold">
                        {item.noBookCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold">
                            <BookX size={12} />
                            {item.noBookCount} ដង
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>

                      {/* Attendance Rate */}
                      <td className="px-3 py-3.5 text-center font-bold">
                        <span className={`text-xs ${item.attendanceRate >= 80 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {item.attendanceRate}%
                        </span>
                      </td>

                      {/* Action: View History Modal */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForModal(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
                          title="មើលប្រវត្តិកាលបរិច្ឆេទឈប់ និងគ្មានសៀវភៅ"
                        >
                          <Eye size={13} />
                          <span>លម្អិត</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!isLoadingSummary && filteredStudentSummaries.length === 0 && (
                  <tr>
                    <td colSpan={12}>
                      <div className="flex flex-col items-center justify-center p-12 text-secondary-text">
                        <User size={36} className="text-secondary-text mb-3 opacity-40" />
                        <p className="text-sm font-semibold text-main-text">
                          មិនមានទិន្នន័យត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. STUDENT DETAIL MODAL (ATTENDANCE & NO-BOOK HISTORY)    */}
      {/* ========================================================= */}
      {selectedStudentForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  {selectedStudentForModal.student.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    ប្រវត្តិវត្តមាន & សៀវភៅ៖ {selectedStudentForModal.student.name}
                  </h3>
                  <p className="text-xs text-blue-100">
                    អត្តលេខ៖ {selectedStudentForModal.student.studentId || '—'} | ថ្នាក់៖ {selectedClassObj?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Summary Badges inside Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-background/50 border-b border-border text-center text-xs">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-rose-800 font-medium block">អវត្តមានឥតច្បាប់ (A)</span>
                <span className="text-xl font-bold text-rose-700">{selectedStudentForModal.absentCount} ដង</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-800 font-medium block">សុំច្បាប់ (E)</span>
                <span className="text-xl font-bold text-amber-700">{selectedStudentForModal.excusedCount} ដង</span>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-300">
                <span className="text-red-900 font-medium block">ឈប់សរុប (A+E)</span>
                <span className="text-xl font-extrabold text-red-700">{selectedStudentForModal.totalAbsent} ដង</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-rose-800 font-medium block">គ្មានសៀវភៅ</span>
                <span className="text-xl font-bold text-rose-700">{selectedStudentForModal.noBookCount} ដង</span>
              </div>
            </div>

            {/* Modal Body: Timeline List of Recorded Dates */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <h4 className="text-xs font-bold text-secondary-text uppercase tracking-wider mb-2">
                បញ្ជីកាលបរិច្ឆេទដែលបានកត់ត្រា ({selectedStudentForModal.history.length} ថ្ងៃ)
              </h4>

              {selectedStudentForModal.history.length === 0 ? (
                <div className="text-center py-8 text-secondary-text text-sm">
                  មិនទាន់មានទិន្នន័យកត់ត្រាក្នុងកំឡុងពេលនេះឡើយ
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudentForModal.history.slice().reverse().map((record, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-surface-hover/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar size={16} className="text-primary shrink-0" />
                        <span className="font-bold text-sm text-main-text font-mono">
                          {formatDateDisplay(record.date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Attendance status badge */}
                        {record.attendance === 'P' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={13} /> វត្តមាន
                          </span>
                        )}
                        {record.attendance === 'A' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800">
                            <XCircle size={13} /> អវត្តមាន
                          </span>
                        )}
                        {record.attendance === 'E' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800">
                            <AlertCircle size={13} /> សុំច្បាប់
                          </span>
                        )}
                        {record.attendance === 'L' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-100 text-sky-800">
                            <Clock size={13} /> មកយឺត
                          </span>
                        )}

                        {/* No-Book status badge */}
                        {record.noBook && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                            <BookX size={13} /> គ្មានសៀវភៅ
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end bg-surface">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedStudentForModal(null)}
                className="px-4 py-2 font-bold text-xs cursor-pointer"
              >
                បិទផ្ទាំង
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. STICKY UNSAVED CHANGES FLOATING BAR (DAILY TAB ONLY)   */}
      {/* ========================================================= */}
      {activeTab === 'DAILY' && hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold text-xs tracking-wide">មានទិន្នន័យវត្តមាន និងសៀវភៅមិនទាន់រក្សាទុក!</span>
          </div>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => void handleSave()} 
            disabled={isSaving} 
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកឥឡូវនេះ'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
