import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Sun, 
  Sunset, 
  Moon, 
  Link2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { initDB } from '../store/db';
import type { ClassRecord } from '../store/db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const Classes = () => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'Morning' | 'Afternoon' | 'Evening'>('ALL');
  const { activeYear } = useAcademicYear();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [currentClass, setCurrentClass] = useState<Partial<ClassRecord>>({
    name: '', shift: 'Morning', academicYear: activeYear || '', notes: '', linkedClassIds: []
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const loadRequestRef = useRef(0);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadClasses = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      const allClasses = await db.getAll('classes', targetYear);
      
      if (requestId !== loadRequestRef.current) return;
      allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setClasses(allClasses);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load classes:', error);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeYear) {
      void loadClasses(activeYear);
    } else {
      setClasses([]);
    }
  }, [activeYear]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!currentClass.name?.trim()) {
      newErrors.name = 'សូមបញ្ចូលឈ្មោះថ្នាក់';
    } else {
      const duplicate = classes.find(c => 
        c.id !== currentClass.id && 
        c.name.trim().toLowerCase() === currentClass.name?.trim().toLowerCase() && 
        c.shift === currentClass.shift
      );
      if (duplicate) {
        newErrors.name = `ថ្នាក់ "${currentClass.name}" វេន${currentClass.shift === 'Morning' ? 'ព្រឹក' : currentClass.shift === 'Afternoon' ? 'រសៀល' : 'យប់'} មានរួចហើយ`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!activeYear) {
      showToast('error', 'សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន');
      return;
    }
    
    // Lock the current year for this save operation
    const targetYear = activeYear;

    setIsSaving(true);
    try {
      const db = await initDB();
      
      const id = currentClass.id || crypto.randomUUID();
      const newClass: ClassRecord = {
        id,
        name: currentClass.name!.trim(),
        shift: currentClass.shift as 'Morning' | 'Afternoon' | 'Evening',
        academicYear: targetYear, 
        notes: currentClass.notes?.trim() || '',
        linkedClassIds: currentClass.linkedClassIds || []
      };

      // Ensure symmetrical links
      // 1. Fetch all classes in this year to see who currently links to us
      const allClasses = await db.getAll('classes', targetYear);
      
      const updatePromises: Promise<void>[] = [];
      
      // Update other classes
      allClasses.forEach(otherClass => {
        if (otherClass.id === id) return;
        
        const otherLinks = otherClass.linkedClassIds || [];
        const isLinkedToUs = otherLinks.includes(id);
        const shouldBeLinked = newClass.linkedClassIds?.includes(otherClass.id) || false;
        
        if (shouldBeLinked && !isLinkedToUs) {
          // Add link symmetrically
          updatePromises.push(
            db.update('classes', otherClass.id, {
              linkedClassIds: [...otherLinks, id]
            })
          );
        } else if (!shouldBeLinked && isLinkedToUs) {
          // Remove link symmetrically
          updatePromises.push(
            db.update('classes', otherClass.id, {
              linkedClassIds: otherLinks.filter(link => link !== id)
            })
          );
        }
      });

      // Save our class
      updatePromises.push(db.put('classes', newClass));

      if (currentClass.id) {
        // If editing existing class, check if shift changed
        const oldClass = classes.find(c => c.id === currentClass.id);
        if (oldClass && oldClass.shift !== newClass.shift) {
          const classStudents = await db.getAll('students', targetYear);
          const affectedStudents = classStudents.filter(s => s.class === currentClass.id);
          for (const student of affectedStudents) {
            updatePromises.push(db.update('students', student.id, { shift: newClass.shift }));
          }

          // Sync shift to other tables that store it
          const [allAttendance, allGrades, allSeating, allLogs] = await Promise.all([
            db.getAll('attendance', targetYear),
            db.getAll('grades', targetYear),
            db.getAll('seatingPlans', targetYear),
            db.getAll('lessonLogs', targetYear)
          ]);

          allAttendance.filter(a => a.classId === currentClass.id).forEach(a => {
            updatePromises.push(db.update('attendance', a.id, { shift: newClass.shift }));
          });
          allGrades.filter(g => g.classId === currentClass.id).forEach(g => {
            updatePromises.push(db.update('grades', g.id, { shift: newClass.shift }));
          });
          allSeating.filter(s => s.classId === currentClass.id).forEach(s => {
            updatePromises.push(db.update('seatingPlans', s.id, { shift: newClass.shift }));
          });
          allLogs.filter(l => l.classId === currentClass.id || l.class === currentClass.id).forEach(l => {
            updatePromises.push(db.update('lessonLogs', l.id, { shift: newClass.shift }));
          });
        }
      }

      // Execute all updates concurrently
      await Promise.all(updatePromises);

      setShowModal(false);
      showToast('success', currentClass.id ? 'កែប្រែព័ត៌មានថ្នាក់ជោគជ័យ!' : 'បង្កើតថ្នាក់ថ្មីជោគជ័យ!');
      await loadClasses(targetYear);
    } catch (error) {
      console.error(error);
      showToast('error', 'មានបញ្ហាក្នុងការរក្សាទុកថ្នាក់');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (classId: string, className: string) => {
    if (!activeYear) return;
    const targetYear = activeYear;

    if (window.confirm(`តើអ្នកពិតជាចង់លុបថ្នាក់ "${className}" មែនទេ? \n\nសិស្ស និងទិន្នន័យពាក់ព័ន្ធទាំងអស់ (វត្តមាន, ពិន្ទុ, ប្លង់តុ, កាលវិភាគ...) នឹងត្រូវលុបចោលទាំងស្រុងដោយមិនអាចទាញមកវិញបានទេ!`)) {
      setIsSaving(true);
      try {
        const db = await initDB();
        
        // 1. Fetch all dependent records
        const [
          allStudents,
          allAttendance,
          allGrades,
          allSeating,
          allLessonLogs,
          allLessonPlans,
          allTeachingSchedules,
          allClasses
        ] = await Promise.all([
          db.getAll('students', targetYear),
          db.getAll('attendance', targetYear),
          db.getAll('grades', targetYear),
          db.getAll('seatingPlans', targetYear),
          db.getAll('lessonLogs', targetYear),
          db.getAll('lessonPlans', targetYear),
          // Keep class deletion working before the optional schedule migration is installed.
          db.getAll('teachingSchedules', targetYear).catch(error => {
            console.warn('Teaching schedules are not available for cleanup:', error);
            return [];
          }),
          db.getAll('classes', targetYear)
        ]);
        
        // Filter those belonging to this class
        const studentIds = allStudents.filter(s => s.class === classId).map(s => s.id);
        const attendanceIds = allAttendance.filter(a => a.classId === classId).map(a => a.id);
        const gradeIds = allGrades.filter(g => g.classId === classId).map(g => g.id);
        const seatingIds = allSeating.filter(s => s.classId === classId).map(s => s.id);
        
        // Note: lessonLog uses classId or class depending on the data structure, check both
        const logIds = allLessonLogs.filter(l => l.classId === classId || l.class === classId).map(l => l.id);
        const planIds = allLessonPlans.filter(p => p.classId === classId).map(p => p.id);
        const scheduleIds = allTeachingSchedules.filter(item => item.classId === classId).map(item => item.id);
        
        // Prepare promises for bulk deletion
        const deletePromises: Promise<void>[] = [];
        
        if (studentIds.length > 0) deletePromises.push(db.deleteMany('students', studentIds));
        if (attendanceIds.length > 0) deletePromises.push(db.deleteMany('attendance', attendanceIds));
        if (gradeIds.length > 0) deletePromises.push(db.deleteMany('grades', gradeIds));
        if (seatingIds.length > 0) deletePromises.push(db.deleteMany('seatingPlans', seatingIds));
        if (logIds.length > 0) deletePromises.push(db.deleteMany('lessonLogs', logIds));
        if (planIds.length > 0) deletePromises.push(db.deleteMany('lessonPlans', planIds));
        if (scheduleIds.length > 0) deletePromises.push(db.deleteMany('teachingSchedules', scheduleIds));
        
        // Clean up linkedClassIds in other classes that reference this deleted class
        allClasses.forEach(c => {
          if (c.id !== classId && c.linkedClassIds?.includes(classId)) {
            const newLinks = c.linkedClassIds.filter(id => id !== classId);
            deletePromises.push(db.update('classes', c.id, { linkedClassIds: newLinks }));
          }
        });
        
        // Finally, delete the class itself
        deletePromises.push(db.delete('classes', classId));

        // Execute all deletes concurrently
        await Promise.all(deletePromises);
        
        showToast('success', `បានលុបថ្នាក់ "${className}" និងទិន្នន័យពាក់ព័ន្ធជោគជ័យ!`);
        await loadClasses(targetYear);
      } catch (error) {
        console.error(error);
        showToast('error', 'បរាជ័យក្នុងការលុបថ្នាក់');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const openEditModal = (c: ClassRecord) => {
    setErrors({});
    setCurrentClass(c);
    setShowModal(true);
  };
  
  const openAddModal = () => {
    setErrors({});
    setCurrentClass({ name: '', shift: 'Morning', academicYear: activeYear || '', notes: '', linkedClassIds: [] });
    setShowModal(true);
  };

  const toggleLinkedClass = (classId: string) => {
    const current = currentClass.linkedClassIds || [];
    if (current.includes(classId)) {
      setCurrentClass({ ...currentClass, linkedClassIds: current.filter(id => id !== classId) });
    } else {
      setCurrentClass({ ...currentClass, linkedClassIds: [...current, classId] });
    }
  };

  // Shift counts
  const morningCount = useMemo(() => classes.filter(c => c.shift === 'Morning').length, [classes]);
  const afternoonCount = useMemo(() => classes.filter(c => c.shift === 'Afternoon').length, [classes]);
  const eveningCount = useMemo(() => classes.filter(c => c.shift === 'Evening').length, [classes]);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // Shift filter
      if (shiftFilter !== 'ALL' && c.shift !== shiftFilter) return false;
      
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesNotes = (c.notes || '').toLowerCase().includes(query);
        if (!matchesName && !matchesNotes) return false;
      }

      return true;
    });
  }, [classes, shiftFilter, searchTerm]);

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
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight">
                គ្រប់គ្រងថ្នាក់រៀន
              </h1>
              {activeYear && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-blue-100 shadow-2xs">
                  ឆ្នាំសិក្សា {activeYear}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-100/80 mt-0.5">
              បញ្ជីថ្នាក់រៀនសរុប ({classes.length} ថ្នាក់) វេនព្រឹក {morningCount} និងវេនរសៀល {afternoonCount}
            </p>
          </div>
        </div>

        <div>
          <button 
            type="button"
            onClick={openAddModal}
            disabled={isLoading || isSaving || !activeYear}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus size={16} className="text-primary" />
            <span>បង្កើតថ្នាក់ថ្មី</span>
          </button>
        </div>
      </section>

      {/* Metrics Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Classes */}
        <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">ថ្នាក់សរុប</span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-main-text">{classes.length}</strong>
            <span className="text-xs font-medium text-secondary-text bg-background px-2 py-0.5 rounded-md border border-border/60">ថ្នាក់</span>
          </div>
        </div>

        {/* Morning Classes */}
        <div className="bg-amber-50/70 rounded-2xl border border-amber-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sun size={14} className="text-amber-600" /> វេនព្រឹក
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-amber-700">{morningCount}</strong>
            <span className="text-xs font-semibold text-amber-700/80 bg-amber-100/60 px-2 py-0.5 rounded-md">ថ្នាក់</span>
          </div>
        </div>

        {/* Afternoon Classes */}
        <div className="bg-sky-50/70 rounded-2xl border border-sky-200/70 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sunset size={14} className="text-sky-600" /> វេនរសៀល
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-sky-700">{afternoonCount}</strong>
            <span className="text-xs font-semibold text-sky-700/80 bg-sky-100/60 px-2 py-0.5 rounded-md">ថ្នាក់</span>
          </div>
        </div>

        {/* Evening Classes */}
        <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Moon size={14} className="text-slate-500" /> វេនយប់
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-slate-700">{eveningCount}</strong>
            <span className="text-xs font-semibold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-md">ថ្នាក់</span>
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-border/80 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-surface">
          {/* Shift Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setShiftFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-secondary-text'
              }`}
            >
              ទាំងអស់ ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter('Morning')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === 'Morning'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-amber-700'
              }`}
            >
              វេនព្រឹក ({morningCount})
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter('Afternoon')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === 'Afternoon'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-sky-700'
              }`}
            >
              វេនរសៀល ({afternoonCount})
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter('Evening')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === 'Evening'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-background hover:bg-surface-hover text-secondary-text'
              }`}
            >
              វេនយប់ ({eveningCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
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
        </div>

        {/* Classes Table */}
        {isLoading && classes.length === 0 && !isSaving ? (
          <div className="flex items-center justify-center p-16 text-secondary-text gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">កំពុងទាញយកទិន្នន័យថ្នាក់...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">ឈ្មោះថ្នាក់</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center">វេនសិក្សា</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-center">ឆ្នាំសិក្សា</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">ថ្នាក់ភ្ជាប់រួម (Rank Link)</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">ចំណាំ</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredClasses.map(c => {
                  const linkedNames = (c.linkedClassIds || [])
                    .map(lid => classes.find(item => item.id === lid)?.name)
                    .filter(Boolean);

                  return (
                    <tr key={c.id} className="hover:bg-surface-hover/50 transition-colors group">
                      {/* Class Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-primary shadow-2xs">
                            <Users size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-main-text group-hover:text-primary transition-colors">
                              {c.name}
                            </span>
                            <span className="text-[11px] text-secondary-text">
                              ថ្នាក់ទី {c.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Shift */}
                      <td className="px-6 py-4 text-center">
                        {c.shift === 'Morning' && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200/70 text-amber-700 text-xs px-3 py-1 rounded-full font-semibold shadow-2xs">
                            <Sun size={12} className="text-amber-500" />
                            <span>វេនព្រឹក</span>
                          </span>
                        )}
                        {c.shift === 'Afternoon' && (
                          <span className="inline-flex items-center gap-1.5 bg-sky-50 border border-sky-200/70 text-sky-700 text-xs px-3 py-1 rounded-full font-semibold shadow-2xs">
                            <Sunset size={12} className="text-sky-500" />
                            <span>វេនរសៀល</span>
                          </span>
                        )}
                        {c.shift === 'Evening' && (
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full font-semibold shadow-2xs">
                            <Moon size={12} className="text-slate-500" />
                            <span>វេនយប់</span>
                          </span>
                        )}
                      </td>

                      {/* Academic Year */}
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono text-xs font-semibold text-secondary-text bg-background px-2.5 py-1 rounded-lg border border-border/60">
                          {c.academicYear}
                        </span>
                      </td>

                      {/* Linked Classes */}
                      <td className="px-6 py-4">
                        {linkedNames.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {linkedNames.map(name => (
                              <span key={name} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[11px] px-2.5 py-0.5 rounded-md font-semibold">
                                <Link2 size={11} />
                                <span>{name}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-secondary-text/60 italic">មិនបានភ្ជាប់</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-4 text-xs text-secondary-text max-w-[200px] truncate">
                        {c.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-2 text-secondary-text hover:text-primary hover:bg-blue-50 rounded-xl transition-all shadow-2xs border border-transparent hover:border-blue-100 active:scale-95 cursor-pointer disabled:opacity-50"
                            title="កែប្រែថ្នាក់"
                            disabled={isSaving}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => void handleDelete(c.id, c.name)}
                            className="p-2 text-secondary-text hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-2xs border border-transparent hover:border-rose-100 active:scale-95 cursor-pointer disabled:opacity-50"
                            title="លុបថ្នាក់"
                            disabled={isSaving}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center p-14 text-secondary-text text-center">
                        <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-3 shadow-2xs border border-border">
                          <BookOpen size={24} className="text-secondary-text opacity-60" />
                        </div>
                        <p className="text-xs text-secondary-text font-medium">
                          {searchTerm ? 'រកមិនឃើញថ្នាក់រៀនទេ' : 'មិនទាន់មានទិន្នន័យថ្នាក់រៀនទេ'}
                        </p>
                        {searchTerm && (
                          <button 
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="mt-3 text-xs text-primary underline font-medium cursor-pointer"
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
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={currentClass.id ? 'កែប្រែព័ត៌មានថ្នាក់រៀន' : 'បង្កើតថ្នាក់រៀនថ្មី'}
      >
        <div className="space-y-4 pt-2">
          {/* Class Name Input */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ឈ្មោះថ្នាក់ (ឧ. 6A, 10A1) *
            </label>
            <Input 
              value={currentClass.name || ''} 
              onChange={(e) => setCurrentClass({...currentClass, name: e.target.value})}
              error={!!errors.name}
              disabled={isSaving}
              placeholder="បញ្ចូលឈ្មោះថ្នាក់..."
              className="rounded-xl"
            />
            {errors.name && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.name}</p>}
          </div>
          
          {/* Shift Select */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              វេនសិក្សា *
            </label>
            <select 
              className="block w-full rounded-xl border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm py-2.5 px-3 font-medium transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              value={currentClass.shift}
              onChange={(e) => setCurrentClass({...currentClass, shift: e.target.value as any})}
              disabled={isSaving}
            >
              <option value="Morning">វេនព្រឹក</option>
              <option value="Afternoon">វេនរសៀល</option>
              <option value="Evening">វេនយប់</option>
            </select>
          </div>
          
          {/* Academic Year (Read-only) */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ឆ្នាំសិក្សា
            </label>
            <Input 
              value={activeYear || ''} 
              disabled={true}
              className="bg-background/80 cursor-not-allowed font-mono text-xs rounded-xl"
            />
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
              ចំណាំ (ស្រេចចិត្ត)
            </label>
            <Input 
              value={currentClass.notes || ''} 
              onChange={(e) => setCurrentClass({...currentClass, notes: e.target.value})}
              placeholder="ព័ត៌មានបន្ថែម..."
              disabled={isSaving}
              className="rounded-xl"
            />
          </div>

          {/* Linked Classes Picker */}
          <div>
            <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>ភ្ជាប់ថ្នាក់សម្រាប់គិតចំណាត់ថ្នាក់រួម</span>
              <span className="text-[10px] text-primary font-normal lowercase">(optional)</span>
            </label>
            <div className="bg-background p-3 rounded-xl max-h-[160px] overflow-y-auto border border-border">
              {(() => {
                const getGrade = (name?: string) => name ? (name.match(/^(\d+)/)?.[1] || '') : '';
                const currentGrade = getGrade(currentClass.name);
                const eligibleClasses = classes.filter(c => c.id !== currentClass.id && (!currentGrade || getGrade(c.name) === currentGrade));
                
                if (eligibleClasses.length === 0) {
                  return (
                    <div className="text-xs text-secondary-text text-center py-3">
                      {currentGrade ? 'មិនមានថ្នាក់កម្រិតនេះផ្សេងទៀតទេ' : 'សូមបញ្ចូលឈ្មោះថ្នាក់សិន ដើម្បីបង្ហាញថ្នាក់កម្រិតដូចគ្នា'}
                    </div>
                  );
                }
                
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {eligibleClasses.map(c => {
                      const isChecked = (currentClass.linkedClassIds || []).includes(c.id);
                      return (
                        <label 
                          key={c.id} 
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isChecked 
                              ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-2xs' 
                              : 'bg-surface hover:bg-surface-hover border-border/70 text-secondary-text'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            className="rounded-md border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                            checked={isChecked}
                            onChange={() => toggleLinkedClass(c.id)}
                            disabled={isSaving}
                          />
                          <span className="text-xs font-bold">{c.name}</span>
                          <span className="text-[10px] text-secondary-text">
                            ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <p className="text-[11px] text-secondary-text mt-1.5">
              ថ្នាក់ដែលបានភ្ជាប់គ្នានឹងត្រូវបានទាញយកសិស្សមកគិតចំណាត់ថ្នាក់ប្រកួតគ្នានៅក្នុងសៀវភៅពិន្ទុ។
            </p>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button 
              variant="secondary" 
              onClick={() => setShowModal(false)} 
              disabled={isSaving}
              className="rounded-xl"
            >
              បោះបង់
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSave} 
              disabled={isSaving}
              className="rounded-xl bg-primary text-white font-bold"
            >
              {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Classes;
