import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, CheckCircle2, Sparkles, Edit, Trash2, Calendar, FileText } from 'lucide-react';
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
  
  // Single request ref to manage load overlap
  const loadRequestRef = useRef(0);
  
  const { language } = useLanguage();
  const { activeYear } = useAcademicYear();

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
        const allClasses = await db.getAll<ClassRecord>('classes', activeYear);
        
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

    void fetchPlans(selectedClass, activeYear);
  }, [selectedClass, activeYear]);

  const fetchPlans = async (targetClass: string, targetYear: string) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    try {
      const db = await initDB();
      const plans = await db.getAllFromIndex<LessonPlanTrack>('lessonPlans', 'class_id', targetClass, targetYear);
      
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
    // Generate an ID that will be exactly the same if the exact same lesson plan details are re-uploaded
    const rawString = `${year}_${classId}_${plan.month}_${plan.week}_${plan.lessonTitle}`;
    // very simple hash since we don't have crypto.subtle in sync
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `plan_${Math.abs(hash)}_${Date.now().toString().slice(-4)}`; // append short timestamp just in case
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass || !activeYear) return;

    // Validate file
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      setUploadError(language === 'KH' ? 'អនុញ្ញាតតែឯកសាររូបភាព (JPEG, PNG, WEBP) ប៉ុណ្ណោះ។' : 'Only image files (JPEG, PNG, WEBP) are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(language === 'KH' ? 'ទំហំរូបភាពត្រូវតូចជាង ៥ មេហ្គាបៃ (5MB)។' : 'Image size must be less than 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Capture context
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
            if (typeof reader.result !== 'string') {
              reject(new Error('Invalid file result.'));
            } else {
              resolve(reader.result);
            }
          };
          reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
          reader.onabort = () => reject(new Error('File reading was cancelled.'));
          reader.readAsDataURL(file);
        });

      const dataUrl = await readAsDataURL(file);
      const base64String = dataUrl.split(',')[1];
      
      const { extractLessonPlanFromImage } = await import('../lib/aiService');
      const extractedPlans = await extractLessonPlanFromImage(base64String, file.type);
      
      if (!Array.isArray(extractedPlans) || extractedPlans.length === 0) {
        throw new Error('No lesson plans found in the image.');
      }

      const db = await initDB();
      const newPlans: LessonPlanTrack[] = extractedPlans.map(plan => {
        // Basic schema validation / sanitization
        const safeMonth = String(plan.month || 'Unknown').trim();
        const safeWeek = String(plan.week || 'Unknown').trim();
        const safeTitle = String(plan.lessonTitle || 'Untitled').trim();
        
        // Generate deterministic ID so re-uploads don't spam infinite duplicates
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
      
      setSuccessMessage(language === 'KH' ? `បានទាញយក និងរក្សាទុកមេរៀនចំនួន ${newPlans.length} ដោយជោគជ័យ!` : `Successfully extracted and saved ${newPlans.length} lessons!`);
      
      // If the user hasn't switched classes during upload, refresh
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
    const currentClass = selectedClass;
    const currentYear = activeYear;

    try {
      const db = await initDB();
      const newStatus = plan.status === 'Planned' ? 'Completed' : 'Planned';
      
      await db.update('lessonPlans', plan.id, {
        status: newStatus,
        completedDate: newStatus === 'Completed' ? new Date().toISOString() : null
      });
      
      if (selectedClass === currentClass && activeYear === currentYear) {
         await fetchPlans(currentClass, currentYear);
      }
    } catch (error) {
      console.error('Failed to toggle status:', error);
      alert('មានបញ្ហាក្នុងការអាប់ដេត!');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedClass || !activeYear) return;
    if (!window.confirm(language === 'KH' ? 'តើអ្នកពិតជាចង់លុបមែនទេ?' : 'Are you sure you want to delete this?')) return;
    
    setIsUpdating(true);
    const currentClass = selectedClass;
    const currentYear = activeYear;

    try {
      const db = await initDB();
      await db.delete('lessonPlans', id);
      
      if (selectedClass === currentClass && activeYear === currentYear) {
         await fetchPlans(currentClass, currentYear);
      }
    } catch (error) {
      console.error('Failed to delete lesson plan:', error);
      alert('មានបញ្ហាក្នុងការលុបទិន្នន័យ!');
    } finally {
      setIsUpdating(false);
    }
  };

  const groupedPlans = useMemo(() => {
    return lessonPlans.reduce<Record<string, LessonPlanTrack[]>>((groups, plan) => {
      (groups[plan.month] ??= []).push(plan);
      return groups;
    }, {});
  }, [lessonPlans]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#2a5298]">
            <BookOpen className="text-[#2a5298]" size={28} />
            {language === 'KH' ? 'គ្រប់គ្រងមេរៀន (Lesson Plan)' : 'Lesson Plan Management'}
          </h1>
          <p className="text-gray-500 mt-1">
            {language === 'KH' ? 'គ្រប់គ្រងកាលវិភាគមេរៀន និងតាមដានការបង្រៀនប្រចាំសប្តាហ៍' : 'Manage lesson schedules and track weekly progress'}
          </p>
        </div>
        <div className="flex gap-3">
             <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={(e) => void handleFileUpload(e)} 
             />
             <Button 
                variant="primary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isUpdating || isLoading || !selectedClass || !activeYear}
                icon={Sparkles}
             >
                {isUploading ? (language === 'KH' ? 'កំពុងអានរូបភាព...' : 'Parsing Image...') : (language === 'KH' ? 'ទាញទិន្នន័យពីរូបភាព (AI)' : 'Extract from Image (AI)')}
             </Button>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm ${isLoading || isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'KH' ? 'ជ្រើសរើសថ្នាក់៖' : 'Select Class:'}</label>
          <select 
            className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#2a5298] disabled:opacity-50"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={isUploading || isUpdating || isLoading}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? (language === 'KH' ? 'ព្រឹក' : 'Morning') : c.shift === 'Afternoon' ? (language === 'KH' ? 'រសៀល' : 'Afternoon') : (language === 'KH' ? 'យប់' : 'Evening')})</option>
            ))}
            {classes.length === 0 && <option value="">{language === 'KH' ? 'មិនមានថ្នាក់' : 'No Classes'}</option>}
          </select>
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {uploadError}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg border border-green-200 flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-800 font-bold">&times;</button>
        </div>
      )}

      {isLoading && !isUpdating ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
           <p className="text-gray-500">{language === 'KH' ? 'កំពុងទាញយកកាលវិភាគបង្រៀន...' : 'Loading lesson plans...'}</p>
        </div>
      ) : lessonPlans.length === 0 && !isUploading ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{language === 'KH' ? 'មិនទាន់មានមេរៀនទេ' : 'No Lesson Plans Found'}</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {language === 'KH' 
              ? 'សូមចុចប៊ូតុង "ទាញទិន្នន័យពីរូបភាព (AI)" ដើម្បី Upload រូបថតកាលវិភាគបង្រៀនរបស់អ្នក ហើយប្រព័ន្ធនឹងរៀបចំវាដោយស្វ័យប្រវត្តិ។' 
              : 'Click "Extract from Image (AI)" to upload a photo of your syllabus, and the system will organize it automatically.'}
          </p>
        </div>
      ) : (
        <div className={`space-y-8 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
          {Object.entries(groupedPlans).map(([month, plans]) => (
            <div key={month} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-[#2a5298] px-6 py-3 text-white font-bold text-lg flex items-center gap-2">
                <Calendar size={20} />
                {language === 'KH' ? `ខែ៖ ${month}` : `Month: ${month}`}
              </div>
              <div className="p-6">
                <div className="relative border-l-2 border-blue-100 ml-4 space-y-8">
                  {plans.map((plan) => (
                    <div key={plan.id} className="relative pl-6">
                      <div className={`absolute -left-2.5 mt-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${plan.status === 'Completed' ? 'bg-green-500 border-green-500' : 'bg-white border-blue-300'}`}
                      >
                        {plan.status === 'Completed' && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:shadow-md transition-shadow">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                              {plan.week}
                            </span>
                            <h4 className="font-bold text-gray-800 text-lg">{plan.lessonTitle}</h4>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <p className="flex items-start gap-2">
                              <FileText size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                              <span><strong className="text-gray-700">{language === 'KH' ? 'ចំណុចសំខាន់ៗ៖' : 'Topics:'}</strong> {plan.topics}</span>
                            </p>
                            {plan.exercises && (
                              <p className="flex items-start gap-2">
                                <Edit size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-gray-700">{language === 'KH' ? 'លំហាត់៖' : 'Exercises:'}</strong> <span className="text-orange-700">{plan.exercises}</span></span>
                              </p>
                            )}
                          </div>
                          
                          {plan.status === 'Completed' && plan.completedDate && (
                            <p className="text-xs text-green-600 font-medium">
                              {language === 'KH' ? 'បានបង្រៀនរួចនៅ៖ ' : 'Completed on: '} 
                              {new Date(plan.completedDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-row md:flex-col gap-2">
                          <button 
                            onClick={() => void toggleStatus(plan)}
                            disabled={isUpdating}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50
                              ${plan.status === 'Completed' 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}
                          >
                            <CheckCircle2 size={16} /> 
                            {plan.status === 'Completed' ? (language === 'KH' ? 'បង្រៀនរួច' : 'Completed') : (language === 'KH' ? 'សម្គាល់ថាបានបង្រៀន' : 'Mark Complete')}
                          </button>
                          
                          <button 
                            onClick={() => void handleDelete(plan.id)}
                            disabled={isUpdating}
                            className="px-3 py-1.5 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 border border-transparent disabled:opacity-50"
                          >
                            <Trash2 size={16} /> {language === 'KH' ? 'លុប' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonPlanPage;
