import { useState, useEffect, useRef } from 'react';
import { Save, Download, Lock, Unlock, Edit, X, Globe, Languages, Settings, Award } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, GradeRecord } from '../store/db';
import { useLanguage } from '../contexts/LanguageContext';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import './Gradebook.css';
import { translateKhmerToEnglish } from '../utils/khmerTranslator';
import { useAuth } from '../contexts/AuthContext';

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
  const [hasChanges, setHasChanges] = useState(false);
  
  const { language, toggleLanguage } = useLanguage();
  const { activeYear } = useAcademicYear();
  const { user } = useAuth();
  const [isTranslating, setIsTranslating] = useState(false);
  
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
        const allClasses = await db.getAll('classes', activeYear);
        
        if (requestId !== loadClassRequestRef.current) return;
        allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
        const setting = await db.get('settings', 'gradeConfig');
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
        const allClasses = await db.getAll('classes', activeYear);
        const targetClass = selectedClass;
        const currentClassObj = allClasses.find(c => c.id === targetClass);
        
        let classesToFetch = [targetClass];
        if (currentClassObj && currentClassObj.linkedClassIds && currentClassObj.linkedClassIds.length > 0) {
          classesToFetch = Array.from(new Set([targetClass, ...currentClassObj.linkedClassIds]));
        }

        // Load students concurrently. FIXED: use 'class' index instead of 'class_id' for students table
        const studentGroups = await Promise.all(
          classesToFetch.map(cid => db.getAllFromIndex('students', 'class', cid, activeYear))
        );
        const studentsToFetch = studentGroups.flat().filter(s => s.status === 'Active');
        studentsToFetch.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        // Load grades concurrently
        const gradeRecords = await Promise.all(
          classesToFetch.map(cid => db.getAllFromIndex('grades', 'class_id', cid, activeYear))
        );
        const allGrades = gradeRecords.flat().filter(g => g.month === currentMonth && g.type === currentGradeType);

        if (requestId !== loadDataRequestRef.current) return;

        // Build a lookup dictionary for fast access — preserve first-seen values per student
        const scoresLookup: Record<string, {
          practice?: number | null;
          book?: number | null;
          exam?: number | null;
          adjustment?: number | null;
          adjustmentNote?: string;
        }> = {};
        allGrades.forEach(g => {
          for (const [studentId, scores] of Object.entries(g.scores || {})) {
            if (!scoresLookup[studentId]) {
              scoresLookup[studentId] = scores as any;
            }
          }
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
              effectiveBank: s.pointsBalance || 0,
              total: 0,
              rank: 0
            };
            return recalculateRow(row, gradeConfig);
          });
        
        setAllScopeStudents(calculateRanks(rows));
        setHasChanges(false);
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
    setHasChanges(true);
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
          db.get('grades', `${targetYear}-${cid}-${currentMonth}-${currentGradeType}`)
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
      setHasChanges(false);
      
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
  const gradedStudentsCount = displayedStudents.filter(s => s.total > 0 || s.practice !== null || s.book !== null || s.exam !== null).length;
  const averageScore = displayedStudents.length > 0 
    ? (displayedStudents.reduce((acc, s) => acc + (s.total || 0), 0) / (displayedStudents.length || 1)).toFixed(1)
    : '0';

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
      <div className="gradebook-container flex flex-col w-full pb-16 print:p-0 relative space-y-3.5">
        
      {/* Header Banner - Clean & Modern Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 rounded-2xl text-white shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <Award size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">បញ្ជីស្រង់ពិន្ទុសិស្ស</h1>
            <p className="text-xs text-blue-100/80 mt-0.5">
              {(() => {
                const curClass = classes.find(c => c.id === selectedClass);
                return curClass ? `ថ្នាក់៖ ${curClass.name} (${curClass.shift === 'Morning' ? 'វេនព្រឹក' : curClass.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'}) · ខែ${currentMonth}` : `ខែ${currentMonth}`;
              })()}
            </p>
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
            onClick={() => window.print()}
            disabled={isLoading || displayedStudents.length === 0}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download size={15} />
            <span>Export A4</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 print:hidden">
        {/* Total Students */}
        <div className="bg-surface rounded-xl border border-border/80 px-3.5 py-2.5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">សិស្សសរុបក្នុងថ្នាក់</span>
          <div className="flex items-baseline justify-between mt-1">
            <strong className="text-2xl font-bold text-main-text">{displayedStudents.length}</strong>
            <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">នាក់</span>
          </div>
        </div>

        {/* Graded Students */}
        <div className="bg-amber-50/70 rounded-xl border border-amber-200/70 px-3.5 py-2.5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">បានបញ្ចូលពិន្ទុ</span>
          <div className="flex items-baseline justify-between mt-1">
            <strong className="text-2xl font-bold text-amber-700">{gradedStudentsCount}</strong>
            <span className="text-xs font-semibold text-amber-700/80 bg-amber-100/60 px-2 py-0.5 rounded-md">នាក់</span>
          </div>
        </div>

        {/* Class Average Score */}
        <div className="bg-indigo-50/70 rounded-xl border border-indigo-200/70 px-3.5 py-2.5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">ពិន្ទុមធ្យមភាគថ្នាក់</span>
          <div className="flex items-baseline justify-between mt-1">
            <strong className="text-2xl font-bold text-indigo-700">{averageScore}</strong>
            <span className="text-xs font-semibold text-indigo-700/80 bg-indigo-100/60 px-2 py-0.5 rounded-md">/{totalMax}</span>
          </div>
        </div>

        {/* Total Max Possible */}
        <div className="bg-emerald-50/70 rounded-xl border border-emerald-200/70 px-3.5 py-2.5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">ពិន្ទុអតិបរមា</span>
          <div className="flex items-baseline justify-between mt-1">
            <strong className="text-2xl font-bold text-emerald-700">{totalMax}</strong>
            <span className="text-xs font-semibold text-emerald-700/80 bg-emerald-100/60 px-2 py-0.5 rounded-md">ពិន្ទុ</span>
          </div>
        </div>
      </section>

      {/* Control & Filter Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 px-4 py-3 shadow-xs print:hidden">
        <div className="flex flex-col xl:flex-row gap-3 justify-between items-stretch xl:items-center">
          {/* Class Select, Month Select */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[190px]">
              <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider block mb-1">
                ថ្នាក់រៀន *
              </label>
              <select 
                className="w-full bg-background border border-border text-main-text text-sm rounded-xl px-3 py-2 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={isLoading || isSaving}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    ថ្នាក់ {c.name} ({c.shift === 'Morning' ? 'វេនព្រឹក' : c.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'})
                  </option>
                ))}
                {classes.length === 0 && <option value="">មិនមានថ្នាក់</option>}
              </select>
            </div>

            <div className="min-w-[120px]">
              <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider block mb-1">
                ខែសិក្សា
              </label>
              <select 
                className="w-full bg-background border border-border text-main-text text-sm rounded-xl px-3 py-2 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                disabled={isLoading || isSaving}
              >
                {MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Column Toggles */}
            <div className="self-end flex flex-wrap items-center gap-1 bg-background p-1 rounded-xl border border-border/80">
              <span className="text-[10px] font-bold text-secondary-text px-1.5">បង្ហាញ៖</span>
              {gradeConfig.practice > 0 && (
                <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold cursor-pointer select-none hover:bg-surface transition-colors">
                  <input type="checkbox" checked={showPractice} onChange={(e) => setShowPractice(e.target.checked)} className="rounded text-primary focus:ring-0 cursor-pointer" />
                  <span>លំហាត់</span>
                </label>
              )}
              {gradeConfig.book > 0 && (
                <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold cursor-pointer select-none hover:bg-surface transition-colors">
                  <input type="checkbox" checked={showBook} onChange={(e) => setShowBook(e.target.checked)} className="rounded text-primary focus:ring-0 cursor-pointer" />
                  <span>សៀវភៅ</span>
                </label>
              )}
              {gradeConfig.exam > 0 && (
                <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold cursor-pointer select-none hover:bg-surface transition-colors">
                  <input type="checkbox" checked={showExam} onChange={(e) => setShowExam(e.target.checked)} className="rounded text-primary focus:ring-0 cursor-pointer" />
                  <span>ប្រឡង</span>
                </label>
              )}
              <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold cursor-pointer select-none hover:bg-surface transition-colors">
                <input type="checkbox" checked={showAdjustment} onChange={(e) => setShowAdjustment(e.target.checked)} className="rounded text-primary focus:ring-0 cursor-pointer" />
                <span>ពិន្ទុបន្ថែម</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-end xl:self-center">
            {/* Language / Translate Button */}
            {displayedStudents.some(s => !s.englishName) ? (
              <button 
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/80 px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
                onClick={async () => {
                  if (!activeYear || !selectedClass) return;
                  setIsTranslating(true);
                  try {
                    const db = await initDB();
                    const targetStudents = displayedStudents.filter(s => !s.englishName);
                    let translatedCount = 0;
                    
                    for (const s of targetStudents) {
                       await db.update('students', s.id, {
                          englishName: translateKhmerToEnglish(s.name)
                       });
                       translatedCount++;
                    }
                    
                    if (translatedCount > 0) {
                      setAllScopeStudents(prev => prev.map(s => {
                        if (targetStudents.some(t => t.id === s.id)) {
                          return { ...s, englishName: translateKhmerToEnglish(s.name) };
                        }
                        return s;
                      }));
                      alert(language === 'KH' ? `បានបកប្រែឈ្មោះសិស្សចំនួន ${translatedCount} នាក់ជោគជ័យ!` : `Translated ${translatedCount} students successfully!`);
                    }
                  } catch (error) {
                    console.error('Translation failed:', error);
                    alert(language === 'KH' ? 'មានកំហុសពេលបកប្រែ' : 'Error translating');
                  } finally {
                    setIsTranslating(false);
                  }
                }}
                disabled={isTranslating || isLoading || displayedStudents.length === 0}
              >
                <Globe size={14} />
                <span>{isTranslating ? 'កំពុងបកប្រែ...' : 'Translate'}</span>
              </button>
            ) : (
              <button 
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200/80 px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
                onClick={toggleLanguage}
                disabled={isLoading || displayedStudents.length === 0}
              >
                <Languages size={14} />
                <span>{language === 'KH' ? 'ប្តូរភាសា' : 'Language'}</span>
              </button>
            )}

            <button 
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-background hover:bg-surface-hover text-secondary-text hover:text-main-text border border-border px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
              onClick={() => {
                setTempConfig(gradeConfig);
                setShowSettingsModal(true);
              }}
              disabled={isLoading || isSaving}
            >
              <Settings size={14} />
              <span>កំណត់ពិន្ទុ</span>
            </button>

            <button 
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200/80 px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
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
              <Edit size={14} />
              <span>ពិន្ទុបន្ថែម</span>
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-background hover:bg-surface-hover text-secondary-text hover:text-main-text border border-border px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer" 
              onClick={() => setIsLocked(!isLocked)}
              disabled={isLoading || isSaving || displayedStudents.length === 0}
            >
              {isLocked ? <Lock size={14} className="text-amber-600" /> : <Unlock size={14} />}
              <span>{isLocked ? 'បើកកែពិន្ទុ' : 'បិទបញ្ជី'}</span>
            </button>

            <button 
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-5 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" 
              disabled={isLocked || isSaving || isLoading || !selectedClass}
              onClick={() => void handleSave()}
            >
              <Save size={15} />
              <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Table Card */}
      <div className={`bg-surface rounded-2xl border border-border/80 shadow-xs shrink-0 overflow-hidden print:border-none print:shadow-none print:bg-transparent print:overflow-visible print:h-auto print:block ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-16 text-secondary-text gap-3 print:hidden">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">កំពុងទាញយកទិន្នន័យពិន្ទុ...</span>
          </div>
        ) : (
          <div className="p-0 overflow-x-auto print:p-0 print:overflow-visible print:w-full">
            <div className="hidden print:block w-full font-khmer mb-6 print:overflow-visible">
              <div className="flex justify-center mb-6">
                <img src="/beltei-header.png" alt="BELTEI Header" className="w-full h-auto max-h-[120px] object-contain object-top" />
              </div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1.5 font-bold italic text-[15px] w-[250px]" style={{ fontFamily: '"Khmer OS Battambang", "Noto Sans Khmer", sans-serif' }}>
                  <div>សាលាប៊ែលធីអន្តរជាតិទី ២៥</div>
                  <div>ថ្នាក់ទី៖ <span className="font-bold italic">{selectedClass ? classes.find(c => c.id === selectedClass)?.name : ''}</span></div>
                  <div>មុខវិជ្ជា៖ <span className="font-bold italic">កុំព្យូទ័រ</span></div>
                  <div>ឈ្មោះគ្រូ៖ <span className="font-bold italic">{user?.user_metadata?.full_name || 'គ្មានឈ្មោះ'}</span></div>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <h2 className="text-[28px] font-bold whitespace-nowrap" style={{ fontFamily: 'Moul, serif' }}>បញ្ជីស្រង់ពិន្ទុលម្អិត</h2>
                  <div className="font-bold text-[15px]" style={{ fontFamily: '"Khmer OS Battambang", "Noto Sans Khmer", sans-serif' }}>សម្រាប់ឆ្នាំសិក្សា {activeYear}</div>
                </div>
                <div className="w-[250px]"></div>
              </div>
            </div>

            <table className="w-full text-left border-collapse print:text-[15px] print:border-2 print:border-black border-t-0 table-fixed">
                <thead className="sticky top-0 bg-[#f8f9fa] print:bg-white text-gray-800 print:text-black z-10 shadow-2xs">
                <tr>
                  <th rowSpan={2} className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-2 font-semibold print:font-bold text-center w-[5%] text-xs print:text-[15px] uppercase tracking-wider bg-[#f8f9fa] print:bg-white">ល.រ</th>
                  <th rowSpan={2} className="border-b border-r border-border print:border-black px-3.5 py-2.5 print:py-2 font-semibold print:font-bold text-left w-[32%] print:w-[24%] text-xs print:text-[15px] uppercase tracking-wider bg-[#f8f9fa] print:bg-white">គោតនាម-នាមសិស្ស</th>
                  <th rowSpan={2} className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-2 font-semibold print:font-bold text-center w-[5%] text-xs print:text-[15px] uppercase tracking-wider bg-[#f8f9fa] print:bg-white">ភេទ</th>
                  <th colSpan={(showPractice && gradeConfig.practice > 0 ? 1 : 0) + (showBook && gradeConfig.book > 0 ? 1 : 0) + (showExam && gradeConfig.exam > 0 ? 1 : 0) + 2} className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-2 font-semibold print:font-bold text-center text-xs print:text-[15px] uppercase tracking-wider bg-[#f8f9fa] print:bg-white">{currentMonth}</th>
                </tr>
                <tr>
                  {showPractice && gradeConfig.practice > 0 && <th className="border-b border-r border-border print:border-black px-2 py-2 print:py-1.5 font-semibold print:font-bold text-center w-[12%] print:w-[14%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-[15px]">លំហាត់({gradeConfig.practice})</th>}
                  {showBook && gradeConfig.book > 0 && <th className="border-b border-r border-border print:border-black px-2 py-2 print:py-1.5 font-semibold print:font-bold text-center w-[12%] print:w-[14%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-[15px]">សៀវភៅ({gradeConfig.book})</th>}
                  {showExam && gradeConfig.exam > 0 && <th className="border-b border-r border-border print:border-black px-2 py-2 print:py-1.5 font-semibold print:font-bold text-center w-[12%] print:w-[14%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-[15px]">ប្រឡង({gradeConfig.exam})</th>}
                  <th className="border-b border-r border-border print:border-black px-2 py-2 print:py-1.5 font-semibold print:font-bold text-center w-[12%] print:w-[14%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-[15px]">សរុប({totalMax})</th>
                  <th className="border-b border-r border-border print:border-black px-2 py-2 print:py-1.5 font-semibold print:font-bold text-center w-[10%] bg-yellow-50/50 print:bg-yellow-100/50 text-xs print:text-[15px]">ចំណាត់ថ្នាក់</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((student, index) => (
                  <tr key={student.id} className="hover:bg-background-selected/50 transition-colors print:break-inside-avoid">
                    <td className="border-b border-r border-border print:border-black px-2 py-1.5 print:py-1 text-center text-secondary-text print:text-black text-xs print:text-base">{index + 1}</td>
                    <td className="border-b border-r border-border print:border-black px-3.5 py-1.5 print:py-1 font-medium print:font-semibold min-w-[180px] leading-normal text-xs print:text-base">
                      {language === 'KH' ? student.name : (student.englishName || student.name)}
                      {showAdjustment && student.adjustment !== null && student.adjustment !== 0 && (
                        <span className="text-blue-500 font-bold ml-2 text-xs">
                          ({student.adjustment > 0 ? `+${student.adjustment}` : student.adjustment})
                        </span>
                      )}
                    </td>
                    <td className="border-b border-r border-border print:border-black px-2 py-1.5 print:py-1 text-center text-secondary-text print:text-black text-xs print:text-base">
                      {student.gender === 'F' ? 'ស' : 'ប'}
                    </td>
                    {showPractice && gradeConfig.practice > 0 && <td className="border-b border-r border-border print:border-black p-0 relative">
                      <input 
                        type="number" 
                        className="w-full h-full min-h-[36px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[30px] font-khmer text-xs sm:text-sm print:text-base print:font-medium font-semibold" 
                        value={student.practice ?? ''} 
                        onChange={(e) => handleGradeChange(student.id, 'practice', e.target.value)}
                        disabled={isLocked || isLoading}
                        min="0" max={gradeConfig.practice}
                      />
                    </td>}
                    {showBook && gradeConfig.book > 0 && <td className="border-b border-r border-border print:border-black p-0 relative">
                      <input 
                        type="number" 
                        className="w-full h-full min-h-[36px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[30px] font-khmer text-xs sm:text-sm print:text-base print:font-medium font-semibold" 
                        value={student.book ?? ''} 
                        onChange={(e) => handleGradeChange(student.id, 'book', e.target.value)}
                        disabled={isLocked || isLoading}
                        min="0" max={gradeConfig.book}
                      />
                    </td>}
                    {showExam && gradeConfig.exam > 0 && <td className="border-b border-r border-border print:border-black p-0 relative">
                      <input 
                        type="number" 
                        className="w-full h-full min-h-[36px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[30px] font-khmer text-xs sm:text-sm print:text-base print:font-medium font-semibold" 
                        value={student.exam ?? ''} 
                        onChange={(e) => handleGradeChange(student.id, 'exam', e.target.value)}
                        disabled={isLocked || isLoading}
                        min="0" max={gradeConfig.exam}
                      />
                    </td>}
                    <td className="border-b border-r border-border print:border-black px-2 py-1.5 text-center font-khmer print:py-1 font-medium print:text-base text-xs sm:text-sm">{student.total}</td>
                    <td className="border-b border-r border-border print:border-black px-2 py-1.5 text-center font-khmer font-bold text-primary print:text-black print:py-1 print:text-base text-xs sm:text-sm">
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
      
      {/* Sticky Unsaved Changes Floating Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold text-xs tracking-wide">មានទិន្នន័យពិន្ទុមិនទាន់រក្សាទុក!</span>
          </div>
          <button 
            type="button" 
            onClick={() => void handleSave()} 
            disabled={isSaving || isLocked} 
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកឥឡូវនេះ'}
          </button>
        </div>
      )}
      
      {/* Points Bank Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border/80 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/80 bg-background/50">
              <h3 className="text-base font-bold text-main-text flex items-center gap-2.5 font-khmer">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Edit size={16} />
                </div>
                <span>គ្រប់គ្រងពិន្ទុបន្ថែម</span>
              </h3>
              <button 
                onClick={() => setShowBankModal(false)} 
                className="text-secondary-text hover:text-main-text hover:bg-surface-hover p-1.5 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row overflow-hidden flex-1">
              {/* Ledger List */}
              <div className="flex-1 border-r border-border/80 overflow-y-auto bg-background/30 p-5">
                <h3 className="font-bold text-xs text-secondary-text uppercase tracking-wider mb-3">បញ្ជីសិស្សមានពិន្ទុក្នុងស្តុក</h3>
                <div className="bg-surface border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-background text-secondary-text">
                      <tr>
                        <th className="px-3.5 py-2.5 border-b border-border/80 font-bold w-1/2">ឈ្មោះសិស្ស</th>
                        <th className="px-3.5 py-2.5 border-b border-border/80 text-center font-bold">ស្តុក</th>
                        <th className="px-3.5 py-2.5 border-b border-border/80 font-bold">សម្គាល់</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedStudents.filter(s => s.pointsBalance !== 0).map(s => (
                        <tr key={s.id} className="hover:bg-background-selected/40 transition-colors border-b border-border/50 last:border-b-0">
                          <td className="px-3.5 py-2.5 font-semibold text-main-text">{language === 'KH' ? s.name : (s.englishName || s.name)}</td>
                          <td className="px-3.5 py-2.5 text-center font-bold text-emerald-600">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                              {s.pointsBalance > 0 ? `+${s.pointsBalance}` : s.pointsBalance}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-secondary-text text-[11px]">{s.pointsNote || ''}</td>
                        </tr>
                      ))}
                      {displayedStudents.filter(s => s.pointsBalance !== 0).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3.5 py-8 text-center text-secondary-text/70 italic text-xs">
                            មិនទាន់មានសិស្សមានស្តុកពិន្ទុទេ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Area */}
              <div className="w-full md:w-[320px] p-5 flex flex-col gap-4 overflow-y-auto bg-surface">
                <h3 className="font-bold text-xs text-secondary-text uppercase tracking-wider mb-1">បន្ថែម ឬ ដកពិន្ទុ</h3>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-secondary-text">ឈ្មោះសិស្ស <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-main-text outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs font-semibold cursor-pointer"
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
                  <label className="text-xs font-bold text-secondary-text">ចំនួនពិន្ទុបូកថែមទៅក្នុងស្តុក <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-main-text outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs font-bold"
                    placeholder="ឧទាហរណ៍: 5 ឬ -2"
                    value={bankPoints}
                    onChange={(e) => setBankPoints(e.target.value)}
                  />
                  <span className="text-[11px] text-secondary-text leading-tight mt-1">ពិន្ទុនេះនឹងរក្សាទុកក្នុងស្តុក រង់ចាំទាញយកមកបូកនៅពេលក្រោយ</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-secondary-text">មូលហេតុ/សម្គាល់ <span className="text-red-500">*</span></label>
                  <textarea 
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-main-text outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs resize-none min-h-[75px]"
                    placeholder="ឧទាហរណ៍: ឈ្នះការប្រកួត, សកម្មភាពល្អ..."
                    value={bankNote}
                    onChange={(e) => setBankNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border/80 flex justify-end gap-2.5 bg-background/50 mt-auto">
              <button 
                type="button"
                className="px-4 py-2 rounded-xl border border-border text-secondary-text hover:text-main-text hover:bg-surface-hover text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                onClick={() => setShowBankModal(false)}
                disabled={isSaving}
              >
                បោះបង់
              </button>
              <button 
                type="button"
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                onClick={() => void handleSaveBank()}
                disabled={!bankStudentId || !bankPoints || isSaving}
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border/80 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/80 bg-background/50">
              <h2 className="text-base font-bold text-main-text font-khmer flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Settings size={16} />
                </div>
                <span>ការកំណត់ពិន្ទុអតិបរមា</span>
              </h2>
              <button 
                type="button"
                onClick={() => setShowSettingsModal(false)} 
                className="text-secondary-text hover:text-main-text hover:bg-surface-hover p-1.5 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="text-xs text-secondary-text leading-relaxed font-khmer bg-background p-3 rounded-xl border border-border/60">
                កំណត់ពិន្ទុអតិបរមា សម្រាប់មុខវិជ្ជានីមួយៗ។ ប្រសិនបើដាក់ ០ ជួរឈរនោះនឹងត្រូវលាក់។
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-secondary-text">ពិន្ទុលំហាត់អតិបរមា</label>
                <input 
                  type="number" 
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-main-text font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                  value={tempConfig.practice}
                  onChange={(e) => setTempConfig(prev => ({...prev, practice: Number(e.target.value)}))}
                  min="0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-secondary-text">ពិន្ទុសៀវភៅអតិបរមា</label>
                <input 
                  type="number" 
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-main-text font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                  value={tempConfig.book}
                  onChange={(e) => setTempConfig(prev => ({...prev, book: Number(e.target.value)}))}
                  min="0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-secondary-text">ពិន្ទុប្រឡងអតិបរមា</label>
                <input 
                  type="number" 
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-main-text font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                  value={tempConfig.exam}
                  onChange={(e) => setTempConfig(prev => ({...prev, exam: Number(e.target.value)}))}
                  min="0"
                />
              </div>

              <div className={`mt-2 p-3.5 border rounded-xl text-center transition-all ${
                (tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0) !== 50 
                  ? 'bg-red-500/10 border-red-500/30 text-red-600' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
              }`}>
                <span className="text-xs font-bold block">
                  ពិន្ទុសរុបអតិបរមា: {(tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0)} 
                  {((tempConfig.practice || 0) + (tempConfig.book || 0) + (tempConfig.exam || 0) !== 50) && ' (ត្រូវតែស្មើ ៥០ គត់)'}
                </span>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border/80 flex justify-end gap-2.5 bg-background/50 mt-auto">
              <button 
                type="button"
                className="px-4 py-2 rounded-xl border border-border text-secondary-text hover:text-main-text hover:bg-surface-hover text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                onClick={() => setShowSettingsModal(false)}
                disabled={isSaving}
              >
                បោះបង់
              </button>
              <button 
                type="button"
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
