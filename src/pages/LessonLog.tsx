import { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Calendar, Search } from 'lucide-react';
import { initDB } from '../store/db';
import type { LessonLog as LogType, ClassRecord, LessonPlanTrack } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import './LessonLog.css';

const LessonLog = () => {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlanTrack[]>([]);
  const { activeYear } = useAcademicYear();

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('All');

  // Loading and Error State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadRequestRef = useRef(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [currentLog, setCurrentLog] = useState<Partial<LogType> & { lessonPlanId?: string }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      // Concurrent fetching for performance
      const [allLogs, allClasses, allPlans] = await Promise.all([
        db.getAll('lessonLogs', targetYear),
        db.getAll('classes', targetYear),
        db.getAll('lessonPlans', targetYear)
      ]);
      
      if (requestId !== loadRequestRef.current) return;
      
      allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setLogs(allLogs);
      setClasses(allClasses);
      setLessonPlans(allPlans);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load lesson logs:', error);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeYear) {
      void loadData(activeYear);
    } else {
      setLogs([]);
      setClasses([]);
    }

    const handleDataChange = () => {
      if (activeYear) {
        void loadData(activeYear);
      }
    };
    
    window.addEventListener('appDataChanged', handleDataChange);
    return () => window.removeEventListener('appDataChanged', handleDataChange);
  }, [activeYear]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!currentLog.topic) newErrors.topic = 'សូមបញ្ចូលមេរៀន/ប្រធានបទ';
    if (!currentLog.classId) newErrors.classId = 'សូមជ្រើសរើសថ្នាក់រៀន';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!activeYear) {
      alert('សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន');
      return;
    }

    const targetYear = activeYear;
    setIsSaving(true);
    try {
      const db = await initDB();
      const selectedClassObj = classes.find(c => c.id === currentLog.classId);
      
      const logToSave: LogType = {
        id: currentLog.id || crypto.randomUUID(),
        date: currentLog.date || new Date().toISOString().split('T')[0],
        classId: currentLog.classId!,
        class: selectedClassObj?.name || '', // Keep for backwards compatibility
        shift: selectedClassObj?.shift || '',
        topic: currentLog.topic!,
        exercises: currentLog.exercises || '',
        notes: currentLog.notes || '',
        academicYear: targetYear,
        teacherName: currentLog.teacherName || ''
      };

      await db.put('lessonLogs', logToSave);
      
      if (currentLog.lessonPlanId) {
        await db.update('lessonPlans', currentLog.lessonPlanId, {
          status: 'Completed',
          completedDate: new Date().toISOString()
        });
      }

      setShowModal(false);
      await loadData(targetYear);
    } catch (error) {
      console.error(error);
      alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setErrors({});
    setCurrentLog({
      date: new Date().toISOString().split('T')[0],
      academicYear: activeYear || '',
      classId: filterClass !== 'All' ? filterClass : ''
    });
    setShowModal(true);
  };

  const openEditModal = (log: LogType) => {
    setErrors({});
    setCurrentLog(log);
    setShowModal(true);
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Some logs might only have 'class' not 'classId' due to older mock data structure
    const logClassId = log.classId || log.class; 
    const matchClass = filterClass === 'All' || logClassId === filterClass;
    
    return matchSearch && matchClass;
  });

  const availablePlans = lessonPlans.filter(p => p.classId === currentLog.classId && p.status === 'Planned');

  return (
    <div className="flex flex-col w-full pb-10">
      
      {/* Header Banner - Clean Ribbon */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <BookOpen size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">កំណត់ហេតុបង្រៀន</h1>
            <p className="text-xs text-blue-100/80">កត់ត្រា និងតាមដានរឿងហេតុ និងការបង្រៀនជាក់ស្តែង</p>
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
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            onClick={openAddModal}
            disabled={isLoading || isSaving || !activeYear}
          >
            <Plus size={16} />
            <span>បន្ថែមរឿងហេតុថ្មី</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-xs mb-5 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">ស្វែងរក</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text" />
              <input 
                type="text"
                placeholder="ស្វែងរកតាមមេរៀន ឬកំណត់សម្គាល់..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">ថ្នាក់រៀន</label>
            <select 
              className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3 py-2 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="All">ថ្នាក់ទាំងអស់</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="self-end sm:self-center">
          <span className="inline-flex items-center text-xs font-bold text-secondary-text bg-background px-3 py-1.5 rounded-xl border border-border/60">
            សរុប {filteredLogs.length} កំណត់ហេតុ
          </span>
        </div>
      </div>

      {/* Logs List Panel */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden mb-6">
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-12 text-xs font-medium text-secondary-text">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
          <div className="p-4 sm:p-5 flex flex-col gap-3.5">
            {filteredLogs.map(log => {
              const logClassObj = classes.find(c => c.id === (log.classId || log.class));
              const displayClassName = logClassObj?.name || log.class;
              
              return (
                <div key={log.id} className="bg-background/40 hover:bg-surface-hover/50 border border-border/70 rounded-xl p-4 transition-all shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-main-text leading-snug">{log.topic}</h3>
                        <div className="flex items-center gap-2.5 mt-1 text-xs text-secondary-text">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar size={13} className="text-secondary-text" /> {log.date}
                          </span>
                          <span>·</span>
                          <span className="bg-blue-50/70 text-blue-700 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-blue-200/50">
                            ថ្នាក់ {displayClassName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-start">
                      <button 
                        className="text-xs font-semibold text-secondary-text hover:text-main-text bg-surface hover:bg-background border border-border px-3 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                        onClick={() => openEditModal(log)}
                        disabled={isSaving}
                      >
                        កែប្រែ
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div className="bg-surface p-3 rounded-xl border border-border/60">
                      <h4 className="text-[11px] font-bold text-secondary-text uppercase tracking-wider mb-1">លំហាត់ដែលបានដាក់</h4>
                      <p className="text-main-text text-xs leading-relaxed">{log.exercises || 'មិនមាន'}</p>
                    </div>
                    <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-200/50">
                      <h4 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">កំណត់សម្គាល់ / វាយតម្លៃ</h4>
                      <p className="text-amber-900 text-xs leading-relaxed font-medium">{log.notes || '---'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-secondary-text">
                <BookOpen size={36} className="mb-2 opacity-40 text-secondary-text" />
                <p className="text-sm font-bold text-main-text">មិនទាន់មានកំណត់ហេតុទេ</p>
                <p className="text-xs text-secondary-text mt-0.5">សូមចុចប៊ូតុង "បន្ថែមរឿងហេតុថ្មី" ដើម្បីកត់ត្រា។</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={currentLog.id ? 'កែប្រែកំណត់ហេតុ' : 'បន្ថែមរឿងហេតុថ្មី'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">ថ្នាក់រៀន *</label>
              <select 
                className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white disabled:opacity-50"
                value={currentLog.classId || currentLog.class || ''}
                onChange={(e) => setCurrentLog({...currentLog, classId: e.target.value})}
                disabled={isSaving}
              >
                <option value="" disabled>ជ្រើសរើសថ្នាក់...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
              </select>
              {errors.classId && <p className="text-danger text-xs mt-1">{errors.classId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">កាលបរិច្ឆេទ</label>
              <Input 
                type="date"
                value={currentLog.date || ''} 
                onChange={(e) => setCurrentLog({...currentLog, date: e.target.value})}
                disabled={isSaving}
              />
            </div>
          </div>
          
          {currentLog.classId && availablePlans.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <label className="block text-sm font-medium text-blue-800 mb-1">ជ្រើសរើសពីកាលវិភាគ (ស្រេចចិត្ត)</label>
              <select 
                className="block w-full rounded-md border-blue-200 focus:border-blue-400 focus:ring-blue-400 sm:text-sm py-2 px-3 border bg-white disabled:opacity-50"
                value={currentLog.lessonPlanId || ''}
                onChange={(e) => {
                  const planId = e.target.value;
                  const plan = availablePlans.find(p => p.id === planId);
                  setCurrentLog({
                    ...currentLog, 
                    lessonPlanId: planId,
                    topic: plan ? plan.lessonTitle : currentLog.topic,
                    exercises: plan ? plan.exercises : currentLog.exercises
                  });
                }}
                disabled={isSaving}
              >
                <option value="">-- បញ្ចូលមេរៀនថ្មីដោយខ្លួនឯង --</option>
                {availablePlans.map(p => (
                  <option key={p.id} value={p.id}>({p.month}, {p.week}) {p.lessonTitle}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary mb-1">មេរៀន / ប្រធានបទ *</label>
            <Input 
              value={currentLog.topic || ''} 
              onChange={(e) => setCurrentLog({...currentLog, topic: e.target.value})}
              placeholder="ឧ. Microsoft Word - Insert Table..."
              error={!!errors.topic}
              disabled={isSaving}
            />
            {errors.topic && <p className="text-danger text-xs mt-1">{errors.topic}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">លំហាត់ដែលបានដាក់ (ស្រេចចិត្ត)</label>
            <Input 
              value={currentLog.exercises || ''} 
              onChange={(e) => setCurrentLog({...currentLog, exercises: e.target.value})}
              placeholder="ឧ. ឲ្យសិស្សគូរតារាងចំនួន ៣..."
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">កំណត់សម្គាល់ / វាយតម្លៃ (ស្រេចចិត្ត)</label>
            <Input 
              value={currentLog.notes || ''} 
              onChange={(e) => setCurrentLog({...currentLog, notes: e.target.value})}
              placeholder="សិស្សភាគច្រើនយល់..."
              disabled={isSaving}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isSaving}>បោះបង់</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LessonLog;
