import { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Calendar, Search } from 'lucide-react';
import { initDB } from '../store/db';
import type { LessonLog as LogType, ClassRecord } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import './LessonLog.css';

const LessonLog = () => {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
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
  const [currentLog, setCurrentLog] = useState<Partial<LogType>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      // Concurrent fetching for performance
      const [allLogs, allClasses] = await Promise.all([
        db.getAll<LogType>('lessonLogs', targetYear),
        db.getAll<ClassRecord>('classes', targetYear)
      ]);
      
      if (requestId !== loadRequestRef.current) return;
      
      setLogs(allLogs);
      setClasses(allClasses);
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

  return (
    <div className="flex flex-col w-full pb-10">
      
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-300 mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់លក្ខខណ្ឌ និងសកម្មភាព (Filters & Actions)</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[250px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input 
                  type="text"
                  placeholder="ស្វែងរកតាមមេរៀន ឬកំណត់សម្គាល់..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ថ្នាក់រៀន (Class Name)</label>
              <select 
                className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
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
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50"
              onClick={openAddModal}
              disabled={isLoading || isSaving || !activeYear}
            >
              <Plus size={16} /> បន្ថែមរឿងហេតុថ្មី
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: List */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់ហេតុបង្រៀន (Lesson Logs)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {filteredLogs.length} កំណត់ហេតុ</span>
        </div>
        
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-12 text-secondary-text">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
          <div className="overflow-x-auto p-6 flex flex-col gap-4 bg-gray-50/30">
            {filteredLogs.map(log => {
              const logClassObj = classes.find(c => c.id === (log.classId || log.class));
              const displayClassName = logClassObj?.name || log.class;
              
              return (
                <div key={log.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1 leading-tight">{log.topic}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} /> {log.date}
                          </span>
                          <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-sm font-medium border border-gray-200">
                            {displayClassName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-start">
                      <button 
                        className="text-sm font-medium text-gray-500 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-sm transition-colors disabled:opacity-50"
                        onClick={() => openEditModal(log)}
                        disabled={isSaving}
                      >
                        កែប្រែ
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50/50 p-4 rounded-sm border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">លំហាត់ដែលបានដាក់</h4>
                      <p className="text-gray-700 text-sm leading-relaxed">{log.exercises || 'មិនមាន'}</p>
                    </div>
                    <div className="bg-yellow-50/30 p-4 rounded-sm border border-yellow-100">
                      <h4 className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-2">កំណត់សម្គាល់ / វាយតម្លៃ</h4>
                      <p className="text-gray-800 text-sm leading-relaxed font-medium">{log.notes || '---'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BookOpen size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-600">មិនទាន់មានកំណត់ហេតុទេ</p>
                <p className="text-sm mt-1">សូមចុចប៊ូតុង "បន្ថែមរឿងហេតុថ្មី" ដើម្បីកត់ត្រា។</p>
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
