import { useState, useEffect, useRef } from 'react';
import { Save, Download, Upload, Lock, Unlock, Edit, X } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, GradeRecord, SettingRecord } from '../store/db';
import { useLanguage } from '../contexts/LanguageContext';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Settings } from 'lucide-react';
import './Gradebook.css';

interface StudentRow extends Student {
  practice: number | null;
  book: number | null;
  exam: number | null;
  adjustment: number | null;
  adjustmentNote: string;
  pointsBalance: number;
  originalPointsBalance: number;
  effectiveBank: number;
  total: number;
  rank: number;
}

const Gradebook = () => {
  const [allScopeStudents, setAllScopeStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { language } = useLanguage();
  const { activeYear } = useAcademicYear();
  
  const loadClassRequestRef = useRef(0);
  const loadDataRequestRef = useRef(0);
  
  const MONTHS = ['តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'ឆមាសទី១', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'ឆមាសទី២'];
  
  const [currentMonth, setCurrentMonth] = useState('តុលា');
  const currentGradeType = 'Monthly';
  
  const [showPractice, setShowPractice] = useState(true);
  const [showBook, setShowBook] = useState(true);
  const [showExam, setShowExam] = useState(true);
  const [showAdjustment, setShowAdjustment] = useState(false);

  // Grade Config
  const [gradeConfig, setGradeConfig] = useState({ practice: 10, book: 10, exam: 30 });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempConfig, setTempConfig] = useState({ practice: 10, book: 10, exam: 30 });
  const totalMax = (gradeConfig.practice || 0) + (gradeConfig.book || 0) + (gradeConfig.exam || 0);

  // Modal State for Points Bank
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankStudentId, setBankStudentId] = useState('');
  const [bankPoints, setBankPoints] = useState('');
  const [bankNote, setBankNote] = useState('');

  const calculateRanks = (rows: StudentRow[]): StudentRow[] => {
    // Shallow clone to sort independently
    const sorted = rows.map(r => ({ ...r })).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return (b.exam || 0) - (a.exam || 0);
    });

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].total === sorted[i-1].total && sorted[i].exam === sorted[i-1].exam) {
        sorted[i].rank = sorted[i-1].rank;
      } else {
        sorted[i].rank = i + 1;
      }
    }

    return sorted.sort((a, b) => a.studentId.localeCompare(b.studentId));
  };

  const recalculateRow = (s: StudentRow, config: { practice: number, book: number, exam: number }): StudentRow => {
    const updated = { ...s };
    const hasAnyScore = updated.practice !== null || updated.book !== null || updated.exam !== null;
    
    const actualPractice = config.practice > 0 ? (updated.practice || 0) : 0;
    const actualBook = config.book > 0 ? (updated.book || 0) : 0;
    const actualExam = config.exam > 0 ? (updated.exam || 0) : 0;
    const rawBase = actualPractice + actualBook + actualExam;
    const currentMax = (config.practice || 0) + (config.book || 0) + (config.exam || 0);
    
    let autoAdj = 0;
    if (hasAnyScore) {
       const lostPractice = (config.practice > 0 && updated.practice !== null) ? Math.max(0, config.practice - updated.practice) : 0;
       const lostBook = (config.book > 0 && updated.book !== null) ? Math.max(0, config.book - updated.book) : 0;
       const lostExam = (config.exam > 0 && updated.exam !== null) ? Math.max(0, config.exam - updated.exam) : 0;
       const needed = lostPractice + lostBook + lostExam;
       
       if (needed > 0 && updated.effectiveBank > 0) {
          autoAdj = Math.min(needed, updated.effectiveBank);
       } else if (updated.effectiveBank < 0) {
          autoAdj = Math.max(-rawBase, updated.effectiveBank);
       }
    }
    
    updated.adjustment = autoAdj === 0 ? null : autoAdj;
    updated.pointsBalance = updated.effectiveBank - autoAdj;
    if (autoAdj !== 0 && (!updated.adjustmentNote || updated.adjustmentNote === 'ទាញពីស្តុក')) {
       // @ts-ignore - pointsNote exists on Student
       updated.adjustmentNote = updated.pointsNote ? `ទាញពីស្តុក៖ ${updated.pointsNote}` : 'ទាញពីស្តុក';
    } else if (autoAdj === 0 && updated.adjustmentNote.includes('ទាញពីស្តុក')) {
       updated.adjustmentNote = '';
    }
    updated.total = Math.min(currentMax, Math.max(0, rawBase + autoAdj));
    return updated;
  };

  useEffect(() => {
    if (!activeYear) {
      setClasses([]);
      setSelectedClass('');
      setAllScopeStudents([]);
      return;
    }

    const requestId = ++loadClassRequestRef.current;
    
    const loadClasses = async () => {
      try {
        const db = await initDB();
        const allClasses = await db.getAll<ClassRecord>('classes', activeYear);
        
        if (requestId !== loadClassRequestRef.current) return;
        
        setClasses(allClasses);
        const selectedExists = allClasses.some(c => c.id === selectedClass);
        if (allClasses.length > 0 && (!selectedClass || !selectedExists)) {
          setSelectedClass(prev => {
            // Keep the selected class if it's still valid, otherwise pick the first
            return allClasses.some(c => c.id === prev) ? prev : allClasses[0].id;
          });
        } else if (allClasses.length === 0) {
          setSelectedClass('');
          setAllScopeStudents([]);
        }
      } catch (error) {
        if (requestId === loadClassRequestRef.current) {
          console.error('Failed to load classes:', error);
        }
      }
    };
    void loadClasses();
  }, [activeYear]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const db = await initDB();
        const setting = await db.get<SettingRecord>('settings', 'gradeConfig');
        if (setting?.config) {
           setGradeConfig(setting.config as any);
           setTempConfig(setting.config as any);
        }
      } catch (e) {
        console.error('Failed to load grade config:', e);
      }
    };
    void loadConfig();
  }, []);

  useEffect(() => {
    if (!activeYear || !selectedClass) {
      setAllScopeStudents([]);
      return;
    }

    const requestId = ++loadDataRequestRef.current;
    setIsLoading(true);
    
    const loadData = async () => {
      try {
        const db = await initDB();
        const allClasses = await db.getAll<ClassRecord>('classes', activeYear);
        const targetClass = selectedClass;
        const currentClassObj = allClasses.find(c => c.id === targetClass);
        
        let classesToFetch = [targetClass];
        if (currentClassObj && currentClassObj.linkedClassIds && currentClassObj.linkedClassIds.length > 0) {
          classesToFetch = Array.from(new Set([targetClass, ...currentClassObj.linkedClassIds]));
        }

        // Load students concurrently. FIXED: use 'class' index instead of 'class_id' for students table
        const studentGroups = await Promise.all(
          classesToFetch.map(cid => db.getAllFromIndex<Student>('students', 'class', cid, activeYear))
        );
        const studentsToFetch = studentGroups.flat().filter(s => s.status === 'Active');

        // Load grades concurrently
        const gradeRecords = await Promise.all(
          classesToFetch.map(cid => db.getAllFromIndex<GradeRecord>('grades', 'class_id', cid, activeYear))
        );
        const allGrades = gradeRecords.flat().filter(g => g.month === currentMonth && g.type === currentGradeType);

        if (requestId !== loadDataRequestRef.current) return;

        // Build a lookup dictionary for fast access
        const scoresLookup: Record<string, {
          practice?: number | null;
          book?: number | null;
          exam?: number | null;
          adjustment?: number | null;
          adjustmentNote?: string;
        }> = {};
        allGrades.forEach(g => {
          Object.assign(scoresLookup, g.scores);
        });

        const rows: StudentRow[] = studentsToFetch.map((s) => {
          const sScores = scoresLookup[s.id] || {};
          const adjustment = sScores.adjustment ?? null;
          const adjustmentNote = sScores.adjustmentNote ?? '';
          
          
          const practice = sScores.practice ?? null;
          const book = sScores.book ?? null;
          const exam = sScores.exam ?? null;
          
            const row: StudentRow = {
              ...s,
              practice,
              book,
              exam,
              adjustment,
              adjustmentNote,
              pointsBalance: s.pointsBalance || 0,
              originalPointsBalance: s.pointsBalance || 0,
              effectiveBank: (s.pointsBalance || 0) + (adjustment || 0),
              total: 0,
              rank: 0
            };
            return recalculateRow(row, gradeConfig);
          });
        
        setAllScopeStudents(calculateRanks(rows));
      } catch (error) {
        if (requestId === loadDataRequestRef.current) {
          console.error('Failed to load gradebook:', error);
        }
      } finally {
        if (requestId === loadDataRequestRef.current) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

  }, [selectedClass, activeYear, currentMonth, currentGradeType, gradeConfig]);

  const handleGradeChange = (studentId: string, field: 'practice' | 'book' | 'exam', value: string) => {
    const numValue = value === '' ? null : Number(value);
    
    // Validate bounds
    let finalValue = numValue;
    if (finalValue !== null && !Number.isNaN(finalValue)) {
      if (field === 'practice') {
        if (finalValue < 0) finalValue = 0;
        if (finalValue > gradeConfig.practice) finalValue = gradeConfig.practice;
      } else if (field === 'book') {
        if (finalValue < 0) finalValue = 0;
        if (finalValue > gradeConfig.book) finalValue = gradeConfig.book;
      } else if (field === 'exam') {
        if (finalValue < 0) finalValue = 0;
        if (finalValue > gradeConfig.exam) finalValue = gradeConfig.exam;
      }
    } else {
      finalValue = null;
    }

    setAllScopeStudents(prev => {
      const newArray = prev.map(s => {
        if (s.id === studentId) {
          const updated = { ...s, [field]: finalValue };
          return recalculateRow(updated, gradeConfig);
        }
        return s;
      });
      // Calculate ranks dynamically on every stroke so UI is always updated
      return calculateRanks(newArray);
    });
  };

  const handleSave = async () => {
    if (!activeYear || !selectedClass || isLoading) return;
    
    // Lock the context of the save operation
    const targetYear = activeYear;
    const targetClass = selectedClass;
    
    setIsSaving(true);
    try {
      const db = await initDB();

      // Group scores by classId to save one GradeRecord per class
      const scoresByClass: Record<string, Record<string, {
        practice: number | null;
        book: number | null;
        exam: number | null;
        adjustment: number | null;
        adjustmentNote: string;
      }>> = {};
      
      allScopeStudents.forEach(s => {
        if (!scoresByClass[s.class]) {
          scoresByClass[s.class] = {};
        }
        // Preserve nulls (empty boxes) instead of casting to 0!
        scoresByClass[s.class][s.id] = {
          practice: s.practice,
          book: s.book,
          exam: s.exam,
          adjustment: s.adjustment,
          adjustmentNote: s.adjustmentNote
        };
      });

      const classIdsToSave = Object.keys(scoresByClass);

      // Fetch the latest grades from the database to perform a client-side JSON merge
      const latestGrades = await Promise.all(
        classIdsToSave.map(cid => 
          db.get<GradeRecord>('grades', `${targetYear}-${cid}-${currentMonth}-${currentGradeType}`)
        )
      );

      const recordsToSave: GradeRecord[] = classIdsToSave.map((cid, index) => {
        const existingRecord = latestGrades[index];
        const existingScores = existingRecord?.scores || {};
        const newScoresForClass = scoresByClass[cid];
        
        // Merge the new scores into the existing scores to avoid overwriting absent students
        const mergedScores = { ...existingScores, ...newScoresForClass };
        
        return {
          id: `${targetYear}-${cid}-${currentMonth}-${currentGradeType}`, 
          classId: cid,
          shift: classes.find(c => c.id === cid)?.shift || 'Morning',
          academicYear: targetYear,
          month: currentMonth,
          type: currentGradeType as 'Final',
          scores: mergedScores as any
        };
      });

      // Confirm that the user hasn't switched year/class during the async operation
      if (activeYear !== targetYear || selectedClass !== targetClass) {
        console.warn('Year or class changed during save operation, but saving correct target context.');
      }

      await db.putMany('grades', recordsToSave);
      
      // Also update student point balances in the students table
      const studentsToUpdate = allScopeStudents.filter(s => s.pointsBalance !== s.originalPointsBalance);
      if (studentsToUpdate.length > 0) {
        for (const s of studentsToUpdate) {
          await db.update('students', s.id, { pointsBalance: s.pointsBalance });
        }
        // Update original balance so we don't save twice if they click save again
        setAllScopeStudents(prev => prev.map(p => ({...p, originalPointsBalance: p.pointsBalance})));
      }
      
      alert(language === 'KH' ? 'រក្សាទុកជោគជ័យ!' : 'Saved successfully!');
    } catch (error) {
      console.error('Failed to save grades:', error);
      alert(language === 'KH' ? 'មានបញ្ហាក្នុងការរក្សាទុក!' : 'Failed to save!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBank = async () => {
    if (!bankStudentId || !bankPoints) return;
    try {
      setIsSaving(true);
      const db = await initDB();
      const student = allScopeStudents.find(s => s.id === bankStudentId);
      if (!student) return;
      
      const newBalance = (student.pointsBalance || 0) + Number(bankPoints);
      
      await db.update('students', student.id, { 
        pointsBalance: newBalance,
        pointsNote: bankNote
      });
      
      setShowBankModal(false);
      setBankPoints('');
      setBankNote('');
      
      // Update local state
      setAllScopeStudents(prev => {
        const newArray = prev.map(s => {
          if (s.id === bankStudentId) {
            const updated: StudentRow = { 
              ...s, 
              pointsBalance: newBalance, 
              originalPointsBalance: newBalance,
              pointsNote: bankNote,
              effectiveBank: newBalance + (s.adjustment || 0) 
            };
            return recalculateRow(updated, gradeConfig);
          }
          return s;
        });
        return calculateRanks(newArray);
      });
      
      alert(language === 'KH' ? 'បញ្ចូលពិន្ទុទៅធនាគារជោគជ័យ!' : 'Added to Bank successfully!');
    } catch(err) {
      console.error(err);
      alert(language === 'KH' ? 'មានបញ្ហាពេលរក្សាទុក!' : 'Failed to save to Bank!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    const sum = (tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0);
    if (sum !== 50) {
      alert(language === 'KH' ? 'ពិន្ទុសរុបអតិបរមាត្រូវតែស្មើ ៥០ គត់!' : 'Total max score must be exactly 50!');
      return;
    }
    
    try {
      setIsSaving(true);
      const db = await initDB();
      await db.put('settings', { id: 'gradeConfig', config: tempConfig });
      setGradeConfig(tempConfig);
      
      // Recalculate all displayed students with new config
      setAllScopeStudents(prev => calculateRanks(prev.map(s => recalculateRow(s, tempConfig))));
      
      setShowSettingsModal(false);
      alert(language === 'KH' ? 'រក្សាទុកការកំណត់ជោគជ័យ!' : 'Settings saved!');
    } catch(err) {
      console.error(err);
      alert(language === 'KH' ? 'មានបញ្ហាពេលរក្សាទុកការកំណត់!' : 'Failed to save settings!');
    } finally {
      setIsSaving(false);
    }
  };

  const displayedStudents = allScopeStudents.filter(s => s.class === (selectedClass || classes[0]?.id));

  return (
    <>
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>
      <div className="gradebook-container flex flex-col w-full pb-10 print:p-0 relative">
        
      <div className="bg-white border border-gray-300 mb-6 print:hidden relative z-10">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm">
          កំណត់លក្ខខណ្ឌ
        </div>
        <div className="p-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ថ្នាក់រៀន<span className="text-red-500 ml-0.5">*</span></label>
              <select 
                className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors disabled:opacity-50"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={isLoading || isSaving}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
                {classes.length === 0 && <option value="">មិនមានថ្នាក់</option>}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ខែ</label>
              <select 
                className="w-full min-w-[150px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors disabled:opacity-50"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                disabled={isLoading || isSaving}
              >
                {MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ឆ្នាំសិក្សា</label>
              <div className="w-full min-w-[200px] bg-gray-100 border border-gray-300 text-gray-600 font-medium text-sm rounded-sm px-3 py-2">
                {activeYear || 'គ្មានឆ្នាំសិក្សា'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
            <div className="flex items-center gap-4 mr-4 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
              <span className="text-xs font-bold text-gray-600">បង្ហាញព័ត៌មាន៖</span>
              {gradeConfig.practice > 0 && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={showPractice} onChange={(e) => setShowPractice(e.target.checked)} className="cursor-pointer" /> លំហាត់
                </label>
              )}
              {gradeConfig.book > 0 && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={showBook} onChange={(e) => setShowBook(e.target.checked)} className="cursor-pointer" /> សៀវភៅ
                </label>
              )}
              {gradeConfig.exam > 0 && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={showExam} onChange={(e) => setShowExam(e.target.checked)} className="cursor-pointer" /> ប្រឡង
                </label>
              )}
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={showAdjustment} onChange={(e) => setShowAdjustment(e.target.checked)} className="cursor-pointer" /> ពិន្ទុបន្ថែម
              </label>
            </div>
            <button 
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50" 
              onClick={() => {
                setTempConfig(gradeConfig);
                setShowSettingsModal(true);
              }}
              disabled={isLoading || isSaving}
            >
              <Settings size={16} />
              <span>កំណត់ពិន្ទុ</span>
            </button>
            <button 
              className="bg-white border border-[#2a5298] text-[#2a5298] hover:bg-blue-50 px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50" 
              onClick={() => {
                if (displayedStudents.length > 0) {
                  setBankStudentId(displayedStudents[0].id);
                  setBankPoints('');
                  setBankNote('');
                  setShowBankModal(true);
                }
              }}
              disabled={isLoading || isSaving || displayedStudents.length === 0}
            >
              <Edit size={16} />
              <span>ពិន្ទុបន្ថែម</span>
            </button>
            <button
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50" 
              onClick={() => setIsLocked(!isLocked)}
              disabled={isLoading || isSaving || displayedStudents.length === 0}
            >
              {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
              <span>{isLocked ? 'បើកកែពិន្ទុ' : 'បិទបញ្ជីពិន្ទុ'}</span>
            </button>
            <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50" disabled>
              <Upload size={16} />
              <span>Import</span>
            </button>
            <button 
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50" 
              onClick={() => window.print()}
              disabled={isLoading || displayedStudents.length === 0}
            >
              <Download size={16} />
              <span>Export A4</span>
            </button>
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isLocked || isSaving || isLoading || !selectedClass}
              onClick={() => void handleSave()}
            >
              <Save size={16} /> {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
            </button>
          </div>
        </div>
      </div>

      <div className={`bg-white border border-gray-200 shadow-sm rounded-sm print:border-none print:bg-transparent ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm print:hidden">
          បញ្ជីពិន្ទុសិស្ស (List of Student Grades)
        </div>
        
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-12 text-secondary-text print:hidden">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
          <div className="p-0 print:p-0">
            <div className="hidden print:block w-full font-khmer mb-6">
              <div className="flex justify-center mb-6">
                <img src="/beltei-header.png" alt="BELTEI Header" className="w-full h-auto max-h-[120px] object-contain object-top" />
              </div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1.5 font-bold italic text-[15px]" style={{ fontFamily: '"Khmer OS Battambang", "Noto Sans Khmer", sans-serif' }}>
                  <div>សាលាប៊ែលធីអន្តរជាតិទី ២៥</div>
                  <div>ថ្នាក់ទី៖ <span className="font-bold italic">{selectedClass ? classes.find(c => c.id === selectedClass)?.name : ''}</span></div>
                  <div>មុខវិជ្ជា៖ <span className="font-bold italic">កុំព្យូទ័រ</span></div>
                  <div>ឈ្មោះគ្រូ៖ <span className="font-bold italic">ឆាយ សិរីវឌ្ឍនៈ</span></div>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <h2 className="text-[28px] font-bold" style={{ fontFamily: 'Moul, serif' }}>បញ្ជីស្រង់ពិន្ទុលម្អិត</h2>
                  <div className="font-bold text-[15px]" style={{ fontFamily: '"Khmer OS Battambang", "Noto Sans Khmer", sans-serif' }}>សម្រាប់ឆ្នាំសិក្សា {activeYear}</div>
                </div>
                <div className="w-40"></div>
              </div>
            </div>

            <table className="w-full text-left border-collapse print:text-[14px] print:border-2 print:border-black border-t-0 table-fixed">
                <thead className="bg-[#f8f9fa] print:bg-white text-gray-800 print:text-black">
                <tr>
                  <th rowSpan={2} className="border-b border-r border-border print:border-black px-2 py-3 print:py-2 font-semibold print:font-bold text-center w-[5%] text-xs print:text-sm uppercase tracking-wider">ល.រ</th>
                  <th rowSpan={2} className="border-b border-r border-border print:border-black px-4 py-3 print:py-2 font-semibold print:font-bold text-left w-[32%] text-xs print:text-sm uppercase tracking-wider">គោតនាម-នាមសិស្ស</th>
                  <th rowSpan={2} className="border-b border-r border-border print:border-black px-2 py-3 print:py-2 font-semibold print:font-bold text-center w-[5%] text-xs print:text-sm uppercase tracking-wider">ភេទ</th>
                  <th colSpan={(showPractice && gradeConfig.practice > 0 ? 1 : 0) + (showBook && gradeConfig.book > 0 ? 1 : 0) + (showExam && gradeConfig.exam > 0 ? 1 : 0) + 2} className="border-b border-r border-border print:border-black px-2 py-3 print:py-2 font-semibold print:font-bold text-center text-xs print:text-sm uppercase tracking-wider">{currentMonth}</th>
                </tr>
                <tr>
                  {showPractice && gradeConfig.practice > 0 && <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1.5 font-semibold print:font-bold text-center w-[12%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-sm">លំហាត់({gradeConfig.practice})</th>}
                  {showBook && gradeConfig.book > 0 && <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1.5 font-semibold print:font-bold text-center w-[12%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-sm">សៀវភៅ({gradeConfig.book})</th>}
                  {showExam && gradeConfig.exam > 0 && <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1.5 font-semibold print:font-bold text-center w-[12%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-sm">ប្រឡង({gradeConfig.exam})</th>}
                  <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1.5 font-semibold print:font-bold text-center w-[12%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-sm">សរុប({totalMax})</th>
                  <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1.5 font-semibold print:font-bold text-center w-[10%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-sm">ចំណាត់ថ្នាក់</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((student, index) => (
                  <tr key={student.id} className="hover:bg-background-selected/50 transition-colors print:break-inside-avoid">
                    <td className="border-b border-r border-border print:border-black px-2 py-2 print:py-1 text-center text-secondary-text print:text-black">{index + 1}</td>
                    <td className="border-b border-r border-border print:border-black px-4 py-2 print:py-1 font-medium print:font-semibold">
                      {language === 'KH' ? student.name : (student.englishName || student.name)}
                      {showAdjustment && student.adjustment !== null && student.adjustment !== 0 && (
                        <span className="text-blue-500 font-bold ml-2 text-xs">
                          ({student.adjustment > 0 ? `+${student.adjustment}` : student.adjustment})
                        </span>
                      )}
                    </td>
                    <td className="border-b border-r border-border print:border-black px-2 py-2 print:py-1 text-center text-secondary-text print:text-black">
                      {student.gender === 'F' ? 'ស' : 'ប'}
                    </td>
                    {showPractice && gradeConfig.practice > 0 && <td className="border-b border-r border-border print:border-black p-0 relative">
                      <input 
                        type="number" 
                        className="w-full h-full min-h-[40px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[30px] font-khmer text-sm print:text-base print:font-medium" 
                        value={student.practice ?? ''} 
                        onChange={(e) => handleGradeChange(student.id, 'practice', e.target.value)}
                        disabled={isLocked || isLoading}
                        min="0" max={gradeConfig.practice}
                      />
                    </td>}
                    {showBook && gradeConfig.book > 0 && <td className="border-b border-r border-border print:border-black p-0 relative">
                      <input 
                        type="number" 
                        className="w-full h-full min-h-[40px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[30px] font-khmer text-sm print:text-base print:font-medium" 
                        value={student.book ?? ''} 
                        onChange={(e) => handleGradeChange(student.id, 'book', e.target.value)}
                        disabled={isLocked || isLoading}
                        min="0" max={gradeConfig.book}
                      />
                    </td>}
                    {showExam && gradeConfig.exam > 0 && <td className="border-b border-r border-border print:border-black p-0 relative">
                      <input 
                        type="number" 
                        className="w-full h-full min-h-[40px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[30px] font-khmer text-sm print:text-base print:font-medium" 
                        value={student.exam ?? ''} 
                        onChange={(e) => handleGradeChange(student.id, 'exam', e.target.value)}
                        disabled={isLocked || isLoading}
                        min="0" max={gradeConfig.exam}
                      />
                    </td>}
                    <td className="border-b border-r border-border print:border-black px-2 py-2 text-center font-khmer print:py-1 font-medium print:text-base">{student.total}</td>
                    <td className="border-b border-r border-border print:border-black px-2 py-2 text-center font-khmer font-bold text-primary print:text-black print:py-1 print:text-base">
                      {student.total > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/5 text-primary print:bg-transparent">
                          {student.rank}
                        </span>
                      ) : ''}
                    </td>
                  </tr>
                ))}
                {displayedStudents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-secondary-text border-b border-border">មិនមានសិស្សទេ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      
      {/* Points Bank Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3 font-khmer">
                <Edit size={18} className="text-[#2a5298]" /> គ្រប់គ្រងពិន្ទុបន្ថែម (Bonus Points)
              </h3>
              <button onClick={() => setShowBankModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row overflow-hidden flex-1">
              {/* Ledger List */}
              <div className="flex-1 border-r border-gray-200 overflow-y-auto bg-gray-50/30 p-4">
                <h3 className="font-bold text-sm text-gray-700 mb-3 border-b pb-2">បញ្ជីសិស្សមានពិន្ទុក្នុងស្តុក</h3>
                <div className="bg-white border border-gray-200 rounded text-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 border-b text-gray-600 font-semibold w-1/2">ឈ្មោះសិស្ស</th>
                        <th className="px-3 py-2 border-b text-center text-gray-600 font-semibold">ស្តុក</th>
                        <th className="px-3 py-2 border-b text-gray-600 font-semibold">សម្គាល់</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedStudents.filter(s => s.pointsBalance !== 0).map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border-b font-medium text-gray-800">{language === 'KH' ? s.name : (s.englishName || s.name)}</td>
                          <td className="px-3 py-2 border-b text-center font-bold text-green-600">{s.pointsBalance > 0 ? `+${s.pointsBalance}` : s.pointsBalance}</td>
                          <td className="px-3 py-2 border-b text-gray-500 text-xs">{s.pointsNote || ''}</td>
                        </tr>
                      ))}
                      {displayedStudents.filter(s => s.pointsBalance !== 0).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-gray-400 italic">មិនទាន់មានសិស្សមានស្តុកពិន្ទុទេ</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Area */}
              <div className="w-full md:w-[300px] p-4 flex flex-col gap-4 overflow-y-auto">
                <h3 className="font-bold text-sm text-gray-700 mb-1 border-b pb-2">បន្ថែម ឬ ដកពិន្ទុ</h3>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">ឈ្មោះសិស្ស (Student Name)<span className="text-red-500">*</span></label>
                  <select 
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                    value={bankStudentId}
                    onChange={(e) => setBankStudentId(e.target.value)}
                  >
                    {displayedStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {language === 'KH' ? s.name : (s.englishName || s.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">ចំនួនពិន្ទុបូកថែមទៅក្នុងស្តុក <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                    placeholder="ឧទាហរណ៍: 5 ឬ -2"
                    value={bankPoints}
                    onChange={(e) => setBankPoints(e.target.value)}
                  />
                  <span className="text-[11px] text-gray-500 leading-tight mt-1">ពិន្ទុនេះនឹងរក្សាទុកក្នុងស្តុក រង់ចាំទាញយកមកបូកនៅពេលក្រោយ</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">មូលហេតុ/សម្គាល់ (Note) <span className="text-red-500">*</span></label>
                  <textarea 
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors min-h-[70px]"
                    placeholder="ឧទាហរណ៍: ឈ្នះការប្រកួត, សកម្មភាពល្អ..."
                    value={bankNote}
                    onChange={(e) => setBankNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 mt-auto">
              <button 
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
                onClick={() => setShowBankModal(false)}
                disabled={isSaving}
              >
                បោះបង់ (Cancel)
              </button>
              <button 
                className="px-4 py-2 bg-[#2a5298] text-white rounded text-sm font-bold hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                onClick={() => void handleSaveBank()}
                disabled={!bankStudentId || !bankPoints || isSaving}
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'បញ្ជូលស្តុក (Save)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 font-khmer flex items-center gap-2">
                <Settings size={18} className="text-[#2a5298]" /> ការកំណត់ពិន្ទុអតិបរមា
              </h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="text-sm text-gray-600 mb-2 font-khmer">
                កំណត់ពិន្ទុអតិបរមា (Max Score) សម្រាប់មុខវិជ្ជានីមួយៗ។ ប្រសិនបើដាក់ ០ ជួរឈរនោះនឹងត្រូវលាក់។
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700">ពិន្ទុលំហាត់អតិបរមា (Max Practice Score)</label>
                <input 
                  type="number" 
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                  value={tempConfig.practice}
                  onChange={(e) => setTempConfig(prev => ({...prev, practice: Number(e.target.value)}))}
                  min="0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700">ពិន្ទុសៀវភៅអតិបរមា (Max Book Score)</label>
                <input 
                  type="number" 
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                  value={tempConfig.book}
                  onChange={(e) => setTempConfig(prev => ({...prev, book: Number(e.target.value)}))}
                  min="0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700">ពិន្ទុប្រឡងអតិបរមា (Max Exam Score)</label>
                <input 
                  type="number" 
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                  value={tempConfig.exam}
                  onChange={(e) => setTempConfig(prev => ({...prev, exam: Number(e.target.value)}))}
                  min="0"
                />
              </div>

              <div className={`mt-2 p-3 border rounded text-center ${(tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0) !== 50 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-100'}`}>
                <span className={`text-sm font-bold ${(tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0) !== 50 ? 'text-red-700' : 'text-blue-800'}`}>
                  ពិន្ទុសរុបអតិបរមា (Total Max): {(tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0)} 
                  {((tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0) !== 50) && ' (ត្រូវតែស្មើ ៥០ គត់)'}
                </span>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 mt-auto">
              <button 
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
                onClick={() => setShowSettingsModal(false)}
                disabled={isSaving}
              >
                បោះបង់ (Cancel)
              </button>
              <button 
                className="px-4 py-2 bg-[#2a5298] text-white rounded text-sm font-bold hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                onClick={() => void handleSaveConfig()}
                disabled={isSaving || (tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0) !== 50}
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកំណត់'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Gradebook;
