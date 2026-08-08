import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, CheckCircle2, Sparkles, Edit, Trash2, Star, Target, Check } from 'lucide-react';
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
  const [isUploading, setIsUploading] = useState(false);
  
  const [uploadError, setUploadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const generateDeterministicId = (plan: any, classId: string, year: string) => {
    const rawString = `${year}_${classId}_${plan.month}_${plan.week}_${plan.lessonTitle}`;
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `plan_${Math.abs(hash)}_${Date.now().toString().slice(-4)}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass || !activeYear) return;

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      setUploadError(language === 'KH' ? 'អនុញ្ញាតតែឯកសាររូបភាព (JPEG, PNG, WEBP) ប៉ុណ្ណោះ។' : 'Only image files (JPEG, PNG, WEBP) are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(language === 'KH' ? 'ទំហំរូបភាពត្រូវតូចជាង ៥ មេហ្គាបៃ (5MB)។' : 'Image size must be less than 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const uploadClassId = selectedClass;
    const uploadAcademicYear = activeYear;

    setIsUploading(true);
    setUploadError('');
    setSuccessMessage('');

    try {
      const readAsDataURL = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== 'string') reject(new Error('Invalid file result.'));
            else resolve(reader.result);
          };
          reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
          reader.readAsDataURL(file);
        });

      const dataUrl = await readAsDataURL(file);
      const base64String = dataUrl.split(',')[1];
      
      const { extractLessonPlanFromImage } = await import('../lib/ai/core');
      const extractedPlans = await extractLessonPlanFromImage(base64String, file.type);
      
      if (!Array.isArray(extractedPlans) || extractedPlans.length === 0) {
        throw new Error('No lesson plans found in the image.');
      }

      const db = await initDB();
      const newPlans: LessonPlanTrack[] = extractedPlans.map(plan => {
        const safeMonth = String(plan.month || 'Unknown').trim();
        const safeWeek = String(plan.week || 'Unknown').trim();
        const safeTitle = String(plan.lessonTitle || 'Untitled').trim();
        const deterministicId = generateDeterministicId({ month: safeMonth, week: safeWeek, lessonTitle: safeTitle }, uploadClassId, uploadAcademicYear);

        return {
          id: deterministicId,
          classId: uploadClassId,
          month: safeMonth,
          week: safeWeek,
          lessonTitle: safeTitle,
          topics: String(plan.topics || '').trim(),
          exercises: String(plan.exercises || '').trim(),
          status: 'Planned',
          academicYear: uploadAcademicYear,
          completedDate: null
        };
      });

      await db.putMany('lessonPlans', newPlans);
      setSuccessMessage(language === 'KH' ? `បានរក្សាទុកមេរៀនចំនួន ${newPlans.length} ដោយជោគជ័យ!` : `Saved ${newPlans.length} lessons!`);
      
      if (selectedClass === uploadClassId && activeYear === uploadAcademicYear) {
        await fetchPlans(uploadClassId, uploadAcademicYear);
      }
    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Placeholder weeks generation logic
  const standardWeeks = language === 'KH' 
    ? ['សប្តាហ៍ទី១', 'សប្តាហ៍ទី២', 'សប្តាហ៍ទី៣', 'សប្តាហ៍ទី៤'] 
    : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  const renderedWeeks = useMemo(() => {
    if (monthPlans.length === 0) return [];
    
    // We try to match existing plans to standard weeks or just show them in order.
    // To properly show "Missing Weeks", we need to figure out which weeks are present.
    // For simplicity in Phase 1, we map standard weeks. If a standard week isn't found, we return a placeholder.
    // We also include any non-standard weeks that exist.
    
    const rendered: (LessonPlanTrack | { isMissing: true, week: string })[] = [];
    
    standardWeeks.forEach(stdWeek => {
      const normalizedStd = stdWeek.toLowerCase().replace(/\s/g, '');
      const matchedPlans = monthPlans.filter(p => p.week.toLowerCase().replace(/\s/g, '').includes(normalizedStd) || normalizedStd.includes(p.week.toLowerCase().replace(/\s/g, '')));
      
      if (matchedPlans.length > 0) {
        matchedPlans.forEach(mp => {
          if (!rendered.some(r => 'id' in r && r.id === mp.id)) {
            rendered.push(mp);
          }
        });
      } else {
        rendered.push({ isMissing: true, week: stdWeek });
      }
    });

    // Add any remaining plans that didn't match standard week names
    monthPlans.forEach(mp => {
      if (!rendered.some(r => 'id' in r && r.id === mp.id)) {
        rendered.push(mp);
      }
    });

    return rendered;
  }, [monthPlans, standardWeeks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#2a5298]">
            <BookOpen className="text-[#2a5298]" size={28} />
            {language === 'KH' ? 'កន្លែងធ្វើការបង្រៀនប្រចាំសប្តាហ៍' : 'Weekly Teaching Workspace'}
          </h1>
          <p className="text-gray-500 mt-1">
            {language === 'KH' ? 'រៀបចំផែនការ និងតាមដានដំណើរការបង្រៀន' : 'Plan and track your teaching progress'}
          </p>
        </div>
        <div className="flex gap-3">
             <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => void handleFileUpload(e)} />
             <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isUpdating || isLoading || !selectedClass || !activeYear} icon={Sparkles}>
                {isUploading ? (language === 'KH' ? 'កំពុងអានរូបភាព...' : 'Parsing Image...') : (language === 'KH' ? 'ទាញពីកាលវិភាគរូបថត' : 'Extract from Image')}
             </Button>
        </div>
      </div>

      {/* Top Bar: Class Selector */}
      <div className={`bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-6 ${isLoading || isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="w-full max-w-xs">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{language === 'KH' ? 'ថ្នាក់រៀន' : 'Class'}</label>
          <select 
            className="w-full bg-slate-50 border border-gray-200 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2 outline-none focus:border-[#2a5298]"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.shift})</option>
            ))}
            {classes.length === 0 && <option value="">{language === 'KH' ? 'មិនមានថ្នាក់' : 'No Classes'}</option>}
          </select>
        </div>
      </div>

      {uploadError && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">{uploadError}</div>}
      {successMessage && <div className="bg-green-50 text-green-600 p-4 rounded-lg border border-green-200 flex justify-between items-center"><span>{successMessage}</span><button onClick={() => setSuccessMessage('')}>&times;</button></div>}

      {isLoading && !isUpdating ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
           <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
           <p className="text-gray-500">{language === 'KH' ? 'កំពុងទាញយក...' : 'Loading...'}</p>
        </div>
      ) : lessonPlans.length === 0 && !isUploading ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={40} className="text-[#2a5298]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            {language === 'KH' ? `មិនទាន់មានផែនការបង្រៀនសម្រាប់ថ្នាក់នេះទេ` : 'No Lesson Plans Yet'}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6 text-sm">
            {language === 'KH' 
              ? 'លោកគ្រូអាចទាញយកទិន្នន័យពីកាលវិភាគរូបថត ឬប្រាប់ AI Assistant ឲ្យបង្កើតមេរៀនដោយស្វ័យប្រវត្តិ។' 
              : 'Extract from a syllabus photo, or ask the AI Assistant to generate a lesson plan.'}
          </p>
          <div className="flex gap-4">
             <Button variant="primary" onClick={() => fileInputRef.current?.click()} icon={Sparkles}>
                {language === 'KH' ? 'ទាញពីកាលវិភាគរូបថត (Image)' : 'Import from Image'}
             </Button>
          </div>
        </div>
      ) : (
        <div className={`space-y-6 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
          
          {/* Phase 1: Next Lesson Card */}
          {nextLesson && (
            <div className="bg-gradient-to-r from-[#2a5298] to-[#1e3c72] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Star size={100} />
               </div>
               <div className="relative z-10">
                 <div className="flex items-center gap-2 text-blue-200 font-bold text-sm tracking-wider uppercase mb-3">
                   <Target size={16} /> {language === 'KH' ? 'មេរៀនបន្ទាប់ (Next Lesson)' : 'Next Lesson'}
                 </div>
                 <h2 className="text-2xl md:text-3xl font-bold mb-2">{nextLesson.lessonTitle}</h2>
                 <div className="flex items-center gap-3 text-blue-100 mb-4 text-sm">
                   <span className="bg-white/20 px-2 py-1 rounded">{nextLesson.month}</span>
                   <span className="bg-white/20 px-2 py-1 rounded">{nextLesson.week}</span>
                 </div>
                 <p className="text-blue-50 mb-6 max-w-2xl"><strong className="text-white">Topics:</strong> {nextLesson.topics}</p>
                 <div className="flex gap-3">
                    <button 
                      onClick={() => void toggleStatus(nextLesson)}
                      className="bg-white text-[#2a5298] hover:bg-blue-50 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Check size={18} /> {language === 'KH' ? 'សម្គាល់ថាបានបង្រៀន' : 'Mark Completed'}
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedMonth(nextLesson.month);
                        setEditingPlanId(nextLesson.id);
                        setEditFormData(nextLesson);
                        // scroll to it if needed
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors border border-white/30"
                    >
                      <Edit size={16} /> {language === 'KH' ? 'កែប្រែ' : 'Edit'}
                    </button>
                 </div>
               </div>
            </div>
          )}

          {/* Phase 1: Month Selector & Progress */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex flex-wrap gap-2 mb-6">
                {availableMonths.map(month => (
                  <button 
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={`px-4 py-2 rounded-full font-bold text-sm transition-colors border
                      ${selectedMonth === month 
                        ? 'bg-[#2a5298] text-white border-[#2a5298] shadow-sm' 
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {month}
                  </button>
                ))}
             </div>

             <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <div className="flex justify-between items-end mb-3">
                   <div>
                     <h3 className="font-bold text-gray-800 text-lg">{language === 'KH' ? `ខែ៖ ${selectedMonth}` : `${selectedMonth} Progress`}</h3>
                     <p className="text-sm text-gray-500 mt-1">
                       <span className="font-semibold text-gray-700">{monthPlans.length}</span> Lessons &bull; <span className="font-semibold text-green-600">{completedCount}</span> Completed &bull; <span className="font-semibold text-blue-600">{plannedCount}</span> Planned
                     </p>
                   </div>
                   <div className="text-2xl font-black text-[#2a5298]">{progressPercent}%</div>
                </div>
                <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                   <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
             </div>
          </div>

          {/* Lesson List */}
          <div className="space-y-4">
             {renderedWeeks.map((item, idx) => {
               // 1. Missing Week Placeholder
               if ('isMissing' in item) {
                 return (
                   <div key={`missing-${idx}`} className="bg-white border border-dashed border-gray-300 rounded-xl p-5 flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-sm">
                           {item.week.slice(-1) || '?'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-700">{item.week}</div>
                          <div className="text-sm text-gray-500">{language === 'KH' ? 'មិនទាន់មានមេរៀន' : 'No lesson planned'}</div>
                        </div>
                      </div>
                      <Button variant="secondary" className="text-sm" icon={Sparkles} onClick={() => alert(language === 'KH' ? 'សូមប្រាប់ AI Assistant ដើម្បីបង្កើតមេរៀននេះ!' : 'Ask the AI Assistant to generate this week!')}>
                        {language === 'KH' ? 'បង្កើត (AI)' : 'Generate AI'}
                      </Button>
                   </div>
                 );
               }

               const plan = item as LessonPlanTrack;
               const isEditing = editingPlanId === plan.id;

               // 2. Inline Edit Mode
               if (isEditing) {
                 return (
                   <div key={plan.id} className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow-md">
                      <div className="flex justify-between items-center mb-4">
                        <div className="font-bold text-blue-800 flex items-center gap-2"><Edit size={18}/> {language === 'KH' ? 'កែប្រែមេរៀន' : 'Edit Lesson'}</div>
                        <div className="flex gap-2">
                           <input type="text" className="w-20 px-2 py-1 rounded border border-gray-300 text-sm" value={editFormData.month || ''} onChange={e => setEditFormData({...editFormData, month: e.target.value})} placeholder="Month" />
                           <input type="text" className="w-24 px-2 py-1 rounded border border-gray-300 text-sm" value={editFormData.week || ''} onChange={e => setEditFormData({...editFormData, week: e.target.value})} placeholder="Week" />
                        </div>
                      </div>
                      <div className="space-y-3">
                         <div>
                           <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'ចំណងជើងមេរៀន' : 'Lesson Title'}</label>
                           <input type="text" className="w-full px-3 py-2 rounded-lg border border-gray-300 mt-1" value={editFormData.lessonTitle || ''} onChange={e => setEditFormData({...editFormData, lessonTitle: e.target.value})} />
                         </div>
                         <div>
                           <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'ចំណុចសំខាន់ៗ' : 'Topics'}</label>
                           <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 mt-1" rows={2} value={editFormData.topics || ''} onChange={e => setEditFormData({...editFormData, topics: e.target.value})} />
                         </div>
                         <div>
                           <label className="text-xs font-bold text-gray-500 uppercase">{language === 'KH' ? 'លំហាត់' : 'Exercises'}</label>
                           <input type="text" className="w-full px-3 py-2 rounded-lg border border-gray-300 mt-1" value={editFormData.exercises || ''} onChange={e => setEditFormData({...editFormData, exercises: e.target.value})} />
                         </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-5">
                         <button onClick={() => setEditingPlanId(null)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">{language === 'KH' ? 'បោះបង់' : 'Cancel'}</button>
                         <button onClick={() => void saveInlineEdit(plan.id)} className="px-6 py-2 bg-[#2a5298] text-white font-bold rounded-lg hover:bg-blue-800 transition-colors shadow-sm">{language === 'KH' ? 'រក្សាទុក' : 'Save'}</button>
                      </div>
                   </div>
                 );
               }

               // 3. Normal View Mode
               return (
                 <div key={plan.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row gap-5 hover:border-blue-300 transition-colors shadow-sm group">
                    <div className="md:w-32 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-100 pb-3 md:pb-0 md:pr-4 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-2">
                       <div>
                         <div className="font-black text-gray-800 text-lg">{plan.week}</div>
                         <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{plan.month}</div>
                       </div>
                       <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 mt-0 md:mt-2
                         ${plan.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                         {plan.status === 'Completed' ? <CheckCircle2 size={12}/> : <div className="w-2 h-2 rounded-full bg-amber-500" />}
                         {plan.status === 'Completed' ? (language === 'KH' ? 'បានបង្រៀន' : 'Completed') : (language === 'KH' ? 'គ្រោងទុក' : 'Planned')}
                       </div>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                       <h4 className="font-bold text-gray-900 text-xl">{plan.lessonTitle}</h4>
                       <p className="text-gray-600 text-sm leading-relaxed"><strong className="text-gray-800">{language === 'KH' ? 'ចំណុចសំខាន់ៗ៖' : 'Topics:'}</strong> {plan.topics}</p>
                       {plan.exercises && <p className="text-gray-600 text-sm leading-relaxed"><strong className="text-gray-800">{language === 'KH' ? 'លំហាត់៖' : 'Exercises:'}</strong> {plan.exercises}</p>}
                       {plan.status === 'Completed' && plan.completedDate && (
                         <p className="text-xs text-green-600 font-medium mt-2">
                           {language === 'KH' ? 'បានបង្រៀននៅ៖ ' : 'Completed on: '} {new Date(plan.completedDate).toLocaleDateString()}
                         </p>
                       )}
                    </div>
                    
                    <div className="flex flex-row md:flex-col gap-2 justify-start md:justify-start pt-2 md:pt-0">
                       <button 
                         onClick={() => void toggleStatus(plan)}
                         className={`p-2 rounded-lg transition-colors flex items-center justify-center
                           ${plan.status === 'Completed' ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                         title={plan.status === 'Completed' ? 'Mark Planned' : 'Mark Completed'}
                       >
                         <CheckCircle2 size={20} />
                       </button>
                       <button 
                         onClick={() => {
                           setEditingPlanId(plan.id);
                           setEditFormData(plan);
                         }}
                         className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100"
                         title="Edit"
                       >
                         <Edit size={20} />
                       </button>
                       <button 
                         onClick={() => void handleDelete(plan.id)}
                         className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100"
                         title="Delete"
                       >
                         <Trash2 size={20} />
                       </button>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanPage;
