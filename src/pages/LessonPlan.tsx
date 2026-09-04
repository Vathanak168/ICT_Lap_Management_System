import { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, CheckCircle2, Edit, Trash2, Star, Target, Check, Link, ExternalLink, X } from 'lucide-react';
import { initDB } from '../store/db';
import type { ClassRecord, LessonPlanTrack } from '../store/db';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const LessonPlanPage = () => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [lessonPlans, setLessonPlans] = useState<LessonPlanTrack[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const loadRequestRef = useRef(0);
  
  const { language } = useLanguage();
  const { activeYear } = useAcademicYear();

  // New Phase 1 UI States
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<LessonPlanTrack>>({});

  // Load Classes
  useEffect(() => {
    if (!activeYear) {
      setClasses([]);
      setSelectedClass('');
      setLessonPlans([]);
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
        const exists = allClasses.some(c => c.id === selectedClass);
        if (allClasses.length > 0 && (!selectedClass || !exists)) {
          setSelectedClass(prev => {
            return allClasses.some(c => c.id === prev) ? prev : allClasses[0].id;
          });
        } else if (allClasses.length === 0) {
          setSelectedClass('');
          setLessonPlans([]);
        }
      } catch (error) {
        if (requestId === loadRequestRef.current) {
          console.error('Failed to load classes:', error);
        }
      }
    };
    void loadClasses();
  }, [activeYear]);

  // Load Lesson Plans
  useEffect(() => {
    if (!selectedClass || !activeYear) {
      setLessonPlans([]);
      return;
    }

    void fetchPlans(selectedClass, activeYear as string);

    const handleDataChange = () => {
      void fetchPlans(selectedClass, activeYear as string);
    };
    window.addEventListener('appDataChanged', handleDataChange);
    
    return () => {
      window.removeEventListener('appDataChanged', handleDataChange);
    };
  }, [selectedClass, activeYear]);

  const fetchPlans = async (targetClass: string, targetYear: string) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    try {
      const db = await initDB();
      const plans = await db.getAllFromIndex('lessonPlans', 'class_id', targetClass, targetYear);
      
      if (requestId !== loadRequestRef.current) return;
      
      setLessonPlans(plans);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
         console.error('Failed to load lesson plans:', error);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
         setIsLoading(false);
      }
    }
  };



  const toggleStatus = async (plan: LessonPlanTrack) => {
    if (!selectedClass || !activeYear) return;
    setIsUpdating(true);
    try {
      const db = await initDB();
      const newStatus = plan.status === 'Planned' ? 'Completed' : 'Planned';
      await db.update('lessonPlans', plan.id, {
        status: newStatus,
        completedDate: newStatus === 'Completed' ? new Date().toISOString() : null
      });
      await fetchPlans(selectedClass, activeYear as string);
    } catch (error) {
      console.error('Failed to toggle status:', error);
    } finally {
      setIsUpdating(false);
    }
  };


  const handleAddManual = async () => {
    if (!selectedClass || !activeYear) return;
    setIsUpdating(true);
    try {
      const db = await initDB();
      const newPlan: LessonPlanTrack = {
        id: 'plan_manual_' + Date.now(),
        classId: selectedClass,
        month: language === 'KH' ? 'ខែថ្មី' : 'New Month',
        week: language === 'KH' ? 'សប្តាហ៍ថ្មី' : 'New Week',
        lessonTitle: language === 'KH' ? 'មេរៀនថ្មី (ឧទាហរណ៍ Word)' : 'New Lesson (e.g. Word)',
        topics: '-',
        exercises: '-',
        status: 'Planned',
        academicYear: activeYear,
        completedDate: null,
        links: []
      };
      await db.add('lessonPlans', newPlan);
      await fetchPlans(selectedClass, activeYear);
      
      setEditingPlanId(newPlan.id);
      setEditFormData(newPlan);
      setSelectedMonth(newPlan.month);
    } catch (error) {
      console.error('Failed to add manual lesson:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedClass || !activeYear) return;
    if (!window.confirm(language === 'KH' ? 'តើអ្នកពិតជាចង់លុបមែនទេ?' : 'Are you sure you want to delete this?')) return;
    
    setIsUpdating(true);
    try {
      const db = await initDB();
      await db.delete('lessonPlans', id);
      await fetchPlans(selectedClass, activeYear as string);
    } catch (error) {
      console.error('Failed to delete lesson plan:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const saveInlineEdit = async (id: string) => {
    if (!id) return;
    setIsUpdating(true);
    try {
      const db = await initDB();
      const safeData = {
        classId: editFormData.classId,
        month: editFormData.month,
        week: editFormData.week,
        lessonTitle: editFormData.lessonTitle,
        topics: editFormData.topics,
        exercises: editFormData.exercises,
        status: editFormData.status,
        academicYear: editFormData.academicYear,
        completedDate: editFormData.completedDate
      };
      // Clean up undefined properties to not mess up indexedDB updates if they are strictly typed
      Object.keys(safeData).forEach(key => {
        if ((safeData as any)[key] === undefined) {
          delete (safeData as any)[key];
        }
      });
      await db.update('lessonPlans', id, safeData);
      setEditingPlanId(null);
      await fetchPlans(selectedClass, activeYear as string);
    } catch (error) {
      console.error('Failed to update lesson plan:', error);
    } finally {
      setIsUpdating(false);
    }
  };


  const handleAddLink = async (plan: LessonPlanTrack) => {
    const url = window.prompt(language === 'KH' ? 'សូមបញ្ចូលតំណភ្ជាប់' : 'Please enter a URL');
    if (!url) return;
    setIsUpdating(true);
    try {
      const db = await initDB();
      const newLinks = [...(plan.links || []), url];
      await db.update('lessonPlans', plan.id, { links: newLinks });
      await fetchPlans(selectedClass, activeYear as string);
    } catch (error) {
      console.error('Failed to add link:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveLink = async (plan: LessonPlanTrack, urlToRemove: string) => {
    if (!window.confirm(language === 'KH' ? 'តើអ្នកពិតជាចង់លុបតំណភ្ជាប់នេះមែនទេ?' : 'Remove this link?')) return;
    setIsUpdating(true);
    try {
      const db = await initDB();
      const newLinks = (plan.links || []).filter(url => url !== urlToRemove);
      await db.update('lessonPlans', plan.id, { links: newLinks });
      await fetchPlans(selectedClass, activeYear as string);
    } catch (error) {
      console.error('Failed to remove link:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // UI Derived State
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    lessonPlans.forEach(p => months.add(p.month));
    return Array.from(months);
  }, [lessonPlans]);

  useEffect(() => {
    if (availableMonths.length > 0 && (!selectedMonth || !availableMonths.includes(selectedMonth))) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const monthPlans = useMemo(() => {
    return lessonPlans.filter(p => p.month === selectedMonth);
  }, [lessonPlans, selectedMonth]);

  const nextLesson = useMemo(() => {
    return lessonPlans.find(p => p.status === 'Planned');
  }, [lessonPlans]);

  const completedCount = monthPlans.filter(p => p.status === 'Completed').length;
  const plannedCount = monthPlans.length - completedCount;
  const progressPercent = monthPlans.length > 0 ? Math.round((completedCount / monthPlans.length) * 100) : 0;

  const plannedPlans = monthPlans.filter(p => p.status === 'Planned');
  const completedPlans = monthPlans.filter(p => p.status === 'Completed');

  return (
    <div className="space-y-6">
             

      {/* Top Bar: Class Selector */}
      <div className={`bg-surface px-5 py-4 rounded-2xl border border-border/80 shadow-xs flex items-center justify-between gap-6 ${isLoading || isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="w-full max-w-xs">
          <label className="block text-[11px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">{language === 'KH' ? 'ថ្នាក់រៀន' : 'Class'}</label>
          <select 
            className="w-full bg-background border border-border text-main-text text-sm font-medium rounded-xl px-3.5 py-2 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-2xs"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.shift})</option>
            ))}
            {classes.length === 0 && <option value="">{language === 'KH' ? 'មិនមានថ្នាក់' : 'No Classes'}</option>}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void handleAddManual()} disabled={isUpdating || isLoading || !selectedClass || !activeYear} icon={BookOpen}>
            {language === 'KH' ? 'បន្ថែមមេរៀន' : 'Add Lesson'}
          </Button>
        </div>
      </div>

      {isLoading && !isUpdating ? (
        <div className="bg-surface p-12 text-center rounded-2xl border border-border/80 shadow-xs">
           <div className="animate-spin h-7 w-7 border-b-2 border-primary mx-auto mb-3"></div>
           <p className="text-xs text-secondary-text">{language === 'KH' ? 'កំពុងទាញយក...' : 'Loading...'}</p>
        </div>
      ) : lessonPlans.length === 0 ? (
        <div className="bg-surface p-12 text-center rounded-2xl border border-border/80 shadow-xs flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-3 shadow-2xs">
            <BookOpen size={28} className="text-primary" />
          </div>
          <h3 className="text-base font-bold text-main-text mb-1">
            {language === 'KH' ? `មិនទាន់មានផែនការបង្រៀនសម្រាប់ថ្នាក់នេះទេ` : 'No Lesson Plans Yet'}
          </h3>
        </div>
      ) : (
        <div className={`space-y-5 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
          
          {/* Phase 1: Next Lesson Card */}
          {nextLesson && (
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-5 text-white shadow-xs relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                 <Star size={100} />
               </div>
               <div className="relative z-10">
                 <div className="flex items-center gap-2 text-blue-200 font-bold text-[11px] tracking-wider uppercase mb-2">
                   <Target size={15} /> {language === 'KH' ? 'មេរៀនបន្ទាប់' : 'Next Lesson'}
                 </div>
                 <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-1.5">{nextLesson.lessonTitle}</h2>
                 <div className="flex items-center gap-2 text-blue-100 mb-3 text-xs">
                   <span className="bg-white/15 px-2.5 py-0.5 rounded-md font-semibold">{nextLesson.month}</span>
                   <span className="bg-white/15 px-2.5 py-0.5 rounded-md font-semibold">{nextLesson.week}</span>
                 </div>
                 <p className="text-blue-100/90 mb-4 max-w-2xl text-xs sm:text-sm"><strong className="text-white font-semibold">Topics:</strong> {nextLesson.topics}</p>
                 <div className="flex gap-2.5">
                    <button 
                      onClick={() => void toggleStatus(nextLesson)}
                      className="bg-white text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Check size={15} /> {language === 'KH' ? 'សម្គាល់ថាបានបង្រៀន' : 'Mark Completed'}
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedMonth(nextLesson.month);
                        setEditingPlanId(nextLesson.id);
                        setEditFormData(nextLesson);
                      }}
                      className="bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border border-white/20 active:scale-95 cursor-pointer"
                    >
                      <Edit size={14} /> {language === 'KH' ? 'កែប្រែ' : 'Edit'}
                    </button>
                 </div>
               </div>
            </div>
          )}

          {/* Progress Analytics */}
          <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-xs">
             <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="font-bold text-main-text text-sm sm:text-base">{language === 'KH' ? `ខែ៖ ${selectedMonth}` : `${selectedMonth} Progress`}</h3>
                  <p className="text-xs text-secondary-text mt-1">
                    <span className="font-semibold text-main-text">{monthPlans.length}</span> {language === 'KH' ? 'មេរៀនសរុប' : 'Total Lessons'} &bull; <span className="font-semibold text-emerald-600">{completedCount}</span> {language === 'KH' ? 'បញ្ចប់' : 'Completed'} &bull; <span className="font-semibold text-primary">{plannedCount}</span> {language === 'KH' ? 'នៅសល់' : 'Remaining'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{progressPercent}%</div>
                </div>
             </div>
             <div className="w-full bg-background rounded-full h-2.5 border border-border/60 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
             </div>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
             
             {/* Planned Column */}
             <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-4 pb-2 border-b border-blue-200 flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                   {language === 'KH' ? 'គ្រោងបង្រៀន' : 'Planned'}
                   <span className="bg-blue-200 text-blue-800 text-xs py-0.5 px-2 rounded-full ml-auto">{plannedPlans.length}</span>
                </h3>
                
                <div className="space-y-4">
                   {plannedPlans.length === 0 && (
                     <div className="text-center p-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                       {language === 'KH' ? 'គ្មានមេរៀនទេ' : 'No planned lessons'}
                     </div>
                   )}
                   {plannedPlans.map(plan => renderLessonCard(plan))}
                </div>
             </div>

             {/* Completed Column */}
             <div className="bg-green-50/50 p-4 rounded-xl border border-green-100">
                <h3 className="font-bold text-green-800 mb-4 pb-2 border-b border-green-200 flex items-center gap-2">
                   <CheckCircle2 size={16} className="text-green-600" />
                   {language === 'KH' ? 'បង្រៀនរួច' : 'Completed'}
                   <span className="bg-green-200 text-green-800 text-xs py-0.5 px-2 rounded-full ml-auto">{completedPlans.length}</span>
                </h3>
                
                <div className="space-y-4">
                   {completedPlans.length === 0 && (
                     <div className="text-center p-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                       {language === 'KH' ? 'មិនទាន់មានមេរៀនបញ្ចាប់' : 'No completed lessons yet'}
                     </div>
                   )}
                   {completedPlans.map(plan => renderLessonCard(plan))}
                </div>
             </div>

          </div>
        </div>
      )}
    </div>
  );

  function renderLessonCard(plan: LessonPlanTrack) {
    const isEditing = editingPlanId === plan.id;
    if (isEditing) {
      return (
        <div key={plan.id} className="bg-white border-2 border-[#2a5298] rounded-xl p-4 shadow-md">
           <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'ចំណងជើងមេរៀន' : 'Lesson Title'}</label>
                <input type="text" className="w-full px-3 py-2 rounded-lg border border-gray-300 mt-1" value={editFormData.lessonTitle || ''} onChange={e => setEditFormData({...editFormData, lessonTitle: e.target.value})} />
              </div>
              <div className="flex gap-2">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'ខែ' : 'Month'}</label>
                   <input type="text" className="w-full px-3 py-2 rounded border border-gray-300 mt-1 text-sm" value={editFormData.month || ''} onChange={e => setEditFormData({...editFormData, month: e.target.value})} />
                 </div>
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'សប្តាហ៍' : 'Week'}</label>
                   <input type="text" className="w-full px-3 py-2 rounded border border-gray-300 mt-1 text-sm" value={editFormData.week || ''} onChange={e => setEditFormData({...editFormData, week: e.target.value})} />
                 </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'ប្រធានបទ' : 'Topics'}</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 mt-1 text-sm" rows={2} value={editFormData.topics || ''} onChange={e => setEditFormData({...editFormData, topics: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'លំហាត់' : 'Exercises'}</label>
                <input type="text" className="w-full px-3 py-2 rounded-lg border border-gray-300 mt-1 text-sm" value={editFormData.exercises || ''} onChange={e => setEditFormData({...editFormData, exercises: e.target.value})} />
              </div>
           </div>
           <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingPlanId(null)} className="px-3 py-1.5 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-lg">{language === 'KH' ? 'បោះបង់' : 'Cancel'}</button>
              <button onClick={() => void saveInlineEdit(plan.id)} className="px-4 py-1.5 bg-[#2a5298] text-white text-sm font-bold rounded-lg hover:bg-blue-800 shadow-sm">{language === 'KH' ? 'រក្សាទុក' : 'Save'}</button>
           </div>
        </div>
      );
    }

    return (
      <div key={plan.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
         {plan.status === 'Completed' && <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>}
         {plan.status === 'Planned' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>}
         
         <div className="pl-3">
            <div className="flex justify-between items-start mb-2">
               <div>
                  <div className="text-xs font-bold text-gray-500 uppercase bg-gray-100 inline-block px-2 py-0.5 rounded mb-1">{plan.week}</div>
                  <h4 className="font-bold text-gray-900 text-lg leading-tight">{plan.lessonTitle}</h4>
               </div>
               <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingPlanId(plan.id); setEditFormData(plan); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                     <Edit size={14} />
                  </button>
                  <button onClick={() => void handleDelete(plan.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                     <Trash2 size={14} />
                  </button>
               </div>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-3">{plan.topics}</p>
            
            {plan.links && plan.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {plan.links.map((url, i) => (
                  <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 group/link">
                    <ExternalLink size={12} />
                    <a href={url} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-[120px]" title={url}>Link {i + 1}</a>
                    <button onClick={() => void handleRemoveLink(plan, url)} className="ml-1 text-blue-400 hover:text-red-500 opacity-0 group-hover/link:opacity-100"><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
               <button onClick={() => void handleAddLink(plan)} className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1">
                 <Link size={14} /> {language === 'KH' ? 'ភ្ជាប់ឯកសារ' : 'Add Link'}
               </button>

               <button 
                 onClick={() => void toggleStatus(plan)}
                 className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors
                   ${plan.status === 'Completed' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-[#2a5298] text-white hover:bg-blue-800'}`}
               >
                 {plan.status === 'Completed' ? <><Trash2 size={14} className="hidden" /> ប្តូរទៅគ្រោង</> : <><Check size={14} /> បញ្ចប់</>}
               </button>
            </div>
         </div>
      </div>
    );
  }
};

export default LessonPlanPage;
