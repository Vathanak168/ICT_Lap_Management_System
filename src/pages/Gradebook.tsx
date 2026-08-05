import { useState, useEffect } from 'react';
import { Save, Download, Upload, Lock, Unlock } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord } from '../store/db';
import { useLanguage } from '../contexts/LanguageContext';
import './Gradebook.css';

interface StudentRow extends Student {
  practice: number;
  book: number;
  exam: number;
  total: number;
  rank: number;
}

const Gradebook = () => {
  const [allScopeStudents, setAllScopeStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const { language } = useLanguage();
  
  const displayedStudents = allScopeStudents.filter(s => s.class === (selectedClass || classes[0]?.id));

  useEffect(() => {
    loadData();
  }, [selectedClass]);

  const loadData = async () => {
    const db = await initDB();
    const allClasses = await db.getAll('classes');
    setClasses(allClasses);
    
    if (allClasses.length > 0 && !selectedClass) {
      setSelectedClass(allClasses[0].id);
    }
    
    if (selectedClass || (allClasses.length > 0 && !selectedClass)) {
      const targetClass = selectedClass || allClasses[0].id;
      
      let studentsToFetch: Student[] = [];
      const currentClassObj = allClasses.find(c => c.id === targetClass);
      
      let classesToFetch = [targetClass];
      if (currentClassObj && currentClassObj.linkedClassIds && currentClassObj.linkedClassIds.length > 0) {
        classesToFetch = Array.from(new Set([targetClass, ...currentClassObj.linkedClassIds]));
      }
      
      for (const cid of classesToFetch) {
        const s = await db.getAllFromIndex('students', 'by-class', cid);
        studentsToFetch.push(...s);
      }
    
      // Deterministic Mock grades if none exist for demo
      const rows: StudentRow[] = studentsToFetch.map((s) => {
        let sum = 0;
        for (let i = 0; i < s.id.length; i++) sum += s.id.charCodeAt(i);
        const mockPractice = (sum % 11); // 0-10
        const mockBook = ((sum * 2) % 11); // 0-10
        const mockExam = ((sum * 3) % 31); // 0-30
        
        return {
          ...s,
          practice: mockPractice,
          book: mockBook,
          exam: mockExam,
          total: mockPractice + mockBook + mockExam,
          rank: 0
        };
      });
      
      setAllScopeStudents(calculateRanks(rows));
    }
  };

  const calculateRanks = (rows: StudentRow[]): StudentRow[] => {
    // Sort by Total (desc), then Exam (desc)
    const sorted = [...rows].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.exam - a.exam;
    });

    // Assign ranks handling ties
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].total === sorted[i-1].total && sorted[i].exam === sorted[i-1].exam) {
        sorted[i].rank = sorted[i-1].rank;
      } else {
        sorted[i].rank = currentRank;
      }
      currentRank++;
    }

    // Return to original order (or keep sorted, usually gradebooks are sorted by ID or Name)
    return sorted.sort((a, b) => a.studentId.localeCompare(b.studentId));
  };

  const handleGradeChange = async (studentId: string, field: 'practice' | 'book' | 'exam', value: string) => {
    // allow empty string for deletion, otherwise parse as number
    const numValue = value === '' ? 0 : Number(value);
    
    // Validate bounds
    let finalValue = numValue;
    if (field === 'practice' || field === 'book') {
      if (finalValue < 0) finalValue = 0;
      if (finalValue > 10) finalValue = 10;
    } else if (field === 'exam') {
      if (finalValue < 0) finalValue = 0;
      if (finalValue > 30) finalValue = 30;
    }

    setAllScopeStudents(prev => calculateRanks(prev.map(s => {
      if (s.id === studentId) {
        const updated = { ...s, [field]: value === '' ? null : finalValue };
        // Recalculate total
        const practice = updated.practice || 0;
        const book = updated.book || 0;
        const exam = updated.exam || 0;
        updated.total = practice + book + exam;
        return updated;
      }
      return s;
    })));
  };

  return (
    <>
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
          }
        `}
      </style>
      <div className="gradebook-container flex flex-col w-full pb-10 print:p-8">
      <div className="bg-white border border-gray-300 mb-6 print:hidden">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm">
          កំណត់លក្ខខណ្ឌ (Filter Gradebook)
        </div>
        <div className="p-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ថ្នាក់រៀន (Class Name)<span className="text-red-500 ml-0.5">*</span></label>
              <select 
                className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
                {classes.length === 0 && <option value="">មិនមានថ្នាក់</option>}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ឆ្នាំសិក្សា (Academic Year)</label>
              <select className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors">
                <option>ឆ្នាំសិក្សា ២០២៣-២០២៤</option>
                <option>ឆ្នាំសិក្សា ២០២៤-២០២៥</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
            <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors" onClick={() => setIsLocked(!isLocked)}>
              {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
              <span>{isLocked ? 'បើកកែពិន្ទុ' : 'បិទខែ (Lock)'}</span>
            </button>
            <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors">
              <Upload size={16} />
              <span>Import</span>
            </button>
            <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors" onClick={() => window.print()}>
              <Download size={16} />
              <span>Export A4</span>
            </button>
            <button className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent" disabled={isLocked}>
              <Save size={16} /> រក្សាទុក
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-sm print:border-none print:bg-transparent">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm print:hidden">
          បញ្ជីពិន្ទុសិស្ស (List of Student Grades)
        </div>
        <div className="p-0 print:p-0">
          <div className="hidden print:block w-full font-khmer mb-6">
            {/* School Header Image */}
            <div className="flex justify-center mb-6">
              {/* សូម Save រូបភាព Logo ខាងលើដាក់ឈ្មោះថា beltei-header.png ក្នុង Folder 'public' */}
              <img src="/beltei-header.png" alt="BELTEI Header" className="w-full h-auto max-h-[120px] object-contain object-top" />
            </div>
            
            {/* Report Info */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col gap-1.5 font-bold italic text-[15px]" style={{ fontFamily: '"Khmer OS Battambang", "Noto Sans Khmer", sans-serif' }}>
                <div>សាលាប៊ែលធីអន្តរជាតិទី ២៥</div>
                <div>ថ្នាក់ទី៖ <span className="font-bold italic">{selectedClass ? classes.find(c => c.id === selectedClass)?.name : '7 ក១'}</span></div>
                <div>មុខវិជ្ជា៖ <span className="font-bold italic">កុំព្យូទ័រ</span></div>
                <div>ឈ្មោះគ្រូ៖ <span className="font-bold italic">ឆាយ សិរីវឌ្ឍនៈ</span></div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <h2 className="text-[28px] font-bold" style={{ fontFamily: 'Moul, serif' }}>បញ្ជីស្រង់ពិន្ទុលម្អិត</h2>
                <div className="font-bold text-[15px]" style={{ fontFamily: '"Khmer OS Battambang", "Noto Sans Khmer", sans-serif' }}>សម្រាប់ឆ្នាំសិក្សា ២០២៥-២០២៦</div>
              </div>
              <div className="w-40"></div> {/* Spacer for balance */}
            </div>
          </div>

          <table className="w-full text-left border-collapse print:text-[13px] print:border-2 print:border-black border-t-0">
              <thead className="bg-[#f8f9fa] print:bg-white text-gray-800 print:text-black">
              <tr>
                <th rowSpan={2} className="border-b border-r border-border print:border-black px-2 py-3 print:py-2 font-semibold print:font-bold text-center w-12 text-xs uppercase tracking-wider">ល.រ</th>
                <th rowSpan={2} className="border-b border-r border-border print:border-black px-4 py-3 print:py-2 font-semibold print:font-bold text-left text-xs uppercase tracking-wider">គោតនាម-នាមសិស្ស</th>
                <th rowSpan={2} className="border-b border-r border-border print:border-black px-2 py-3 print:py-2 font-semibold print:font-bold text-center w-12 text-xs uppercase tracking-wider">ភេទ</th>
                <th colSpan={5} className="border-b border-r border-border print:border-black px-2 py-3 print:py-2 font-semibold print:font-bold text-center text-xs uppercase tracking-wider">ឆមាសលើកទី២</th>
              </tr>
              <tr>
                <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1 font-semibold print:font-bold text-center w-28 bg-yellow-50/50 print:bg-yellow-100/50 text-xs">លំហាត់អនុវត្តន៍(១០)</th>
                <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1 font-semibold print:font-bold text-center w-28 bg-yellow-50/50 print:bg-yellow-100/50 text-xs">សៀវភៅ(១០ពិន្ទុ)</th>
                <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1 font-semibold print:font-bold text-center w-28 bg-yellow-50/50 print:bg-yellow-100/50 text-xs">ប្រឡង(៣០ពិន្ទុ)</th>
                <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1 font-semibold print:font-bold text-center w-28 bg-yellow-50/50 print:bg-yellow-100/50 text-xs">សរុប(៥០ពិន្ទុ)</th>
                <th className="border-b border-r border-border print:border-black px-2 py-2.5 print:py-1 font-semibold print:font-bold text-center w-20 bg-yellow-50/50 print:bg-yellow-100/50 text-xs">ចំណាត់ថ្នាក់</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.map((student, index) => (
                <tr key={student.id} className="hover:bg-background-selected/50 transition-colors print:break-inside-avoid">
                  <td className="border-b border-r border-border print:border-black px-2 py-2 print:py-0.5 text-center text-secondary-text print:text-black">{index + 1}</td>
                  <td className="border-b border-r border-border print:border-black px-4 py-2 print:py-0.5 font-medium print:font-normal">
                    {language === 'KH' ? student.name : (student.englishName || student.name)}
                  </td>
                  <td className="border-b border-r border-border print:border-black px-2 py-2 print:py-0.5 text-center text-secondary-text print:text-black">
                    {student.gender === 'F' ? 'ស' : 'ប'}
                  </td>
                  <td className="border-b border-r border-border print:border-black p-0 relative">
                    <input 
                      type="number" 
                      className="w-full h-full min-h-[40px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[26px] font-khmer text-sm" 
                      value={student.practice || ''} 
                      onChange={(e) => handleGradeChange(student.id, 'practice', e.target.value)}
                      disabled={isLocked}
                      min="0" max="10"
                    />
                  </td>
                  <td className="border-b border-r border-border print:border-black p-0 relative">
                    <input 
                      type="number" 
                      className="w-full h-full min-h-[40px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[26px] font-khmer text-sm" 
                      value={student.book || ''} 
                      onChange={(e) => handleGradeChange(student.id, 'book', e.target.value)}
                      disabled={isLocked}
                      min="0" max="10"
                    />
                  </td>
                  <td className="border-b border-r border-border print:border-black p-0 relative">
                    <input 
                      type="number" 
                      className="w-full h-full min-h-[40px] p-1 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary print:text-black print:min-h-0 print:h-[26px] font-khmer text-sm" 
                      value={student.exam || ''} 
                      onChange={(e) => handleGradeChange(student.id, 'exam', e.target.value)}
                      disabled={isLocked}
                      min="0" max="30"
                    />
                  </td>
                  <td className="border-b border-r border-border print:border-black px-2 py-2 text-center font-khmer print:py-0.5 font-medium">{student.total}</td>
                  <td className="border-b border-r border-border print:border-black px-2 py-2 text-center font-khmer font-bold text-primary print:text-black print:py-0.5">
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
      </div>
    </div>
    </>
  );
};

export default Gradebook;
