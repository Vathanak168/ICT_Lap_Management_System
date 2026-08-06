import { useState, useEffect, useRef } from 'react';
import { Search, ArrowLeftRight, UserPlus, Users, Trash2 } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const ShiftSwitching = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedAlternateClassId, setSelectedAlternateClassId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  
  const { activeYear } = useAcademicYear();
  const loadRequestRef = useRef(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-reset selectedAlternateClassId when student changes
  useEffect(() => {
    setSelectedAlternateClassId('');
  }, [selectedStudentId]);

  useEffect(() => {
    if (activeYear) {
      void loadData(activeYear);
    } else {
      setStudents([]);
      setClasses([]);
      setSelectedStudentId('');
      setSelectedAlternateClassId('');
    }
  }, [activeYear]);

  const loadData = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      const [allStudents, allClasses] = await Promise.all([
        db.getAll<Student>('students', targetYear),
        db.getAll<ClassRecord>('classes', targetYear)
      ]);
      
      if (requestId !== loadRequestRef.current) return;
      
      setStudents(allStudents);
      setClasses(allClasses);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load shift switching data:', error);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  const getGrade = (className: string) => {
    const match = className.match(/^(\d+)/);
    return match ? match[1] : '';
  };

  const handleRegister = async () => {
    if (!selectedStudentId || !selectedAlternateClassId) {
      alert('សូមជ្រើសរើសសិស្ស និងថ្នាក់បម្រុង');
      return;
    }
    
    if (!activeYear) return;

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const targetClass = classes.find(c => c.id === selectedAlternateClassId);
    if (!targetClass) {
      alert('រកមិនឃើញថ្នាក់បម្រុងនេះទេ!');
      return;
    }

    const currentClassObj = classes.find(c => c.id === student.class);

    // Strict Validation
    if (student.class === selectedAlternateClassId) {
      alert('ថ្នាក់បម្រុងមិនអាចដូចគ្នានឹងថ្នាក់បច្ចុប្បន្នទេ!');
      return;
    }
    
    if (targetClass.academicYear !== activeYear) {
      alert('ថ្នាក់បម្រុងមិនស្ថិតក្នុងឆ្នាំសិក្សាបច្ចុប្បន្នទេ!');
      return;
    }
    
    if (currentClassObj && getGrade(targetClass.name) !== getGrade(currentClassObj.name)) {
      alert('ថ្នាក់បម្រុងត្រូវតែមានកម្រិតថ្នាក់ (Grade) ដូចគ្នា!');
      return;
    }
    
    if (currentClassObj && targetClass.shift === currentClassObj.shift) {
      alert('សិស្សប្តូរវេន ត្រូវតែជ្រើសរើសវេនសិក្សាថ្មីដែលខុសពីវេនចាស់!');
      return;
    }

    if (window.confirm(`តើអ្នកពិតជាចង់កំណត់សិស្ស ${student.name} ជាសិស្សប្តូរវេនមែនទេ?`)) {
      setIsSaving(true);
      const targetYear = activeYear;
      try {
        const db = await initDB();
        
        // Partial update to avoid full record overwrite
        await db.update('students', student.id, {
          isShiftSwitching: true,
          alternateClassId: selectedAlternateClassId
        });
        
        setSelectedStudentId('');
        setSelectedAlternateClassId('');
        await loadData(targetYear);
      } catch (error: any) {
        alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ។ Error: ' + error.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSwitchShift = async (student: Student) => {
    if (!student.alternateClassId) return;

    const targetClass = classes.find(c => c.id === student.alternateClassId);
    if (!targetClass) {
      alert('រកមិនឃើញថ្នាក់បម្រុងទេ!');
      return;
    }
    
    if (!activeYear) return;

    if (window.confirm(`តើអ្នកចង់ប្តូរសិស្ស ${student.name} ទៅកាន់ថ្នាក់ ${targetClass.name} មែនទេ?`)) {
      setIsSaving(true);
      const targetYear = activeYear;
      try {
        const db = await initDB();
        
        const oldClass = student.class;
        
        // Partial update
        await db.update('students', student.id, {
          class: student.alternateClassId,
          alternateClassId: oldClass,
          shift: targetClass.shift // Update shift to match new class
        });
        
        await loadData(targetYear);
      } catch (error: any) {
         alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ។ Error: ' + error.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleRemoveStatus = async (student: Student) => {
    if (!activeYear) return;
    
    if (window.confirm(`តើអ្នកចង់ដកសិស្ស ${student.name} ពីបញ្ជីសិស្សប្តូរវេនមែនទេ?`)) {
      setIsSaving(true);
      const targetYear = activeYear;
      try {
        const db = await initDB();
        
        // Partial update
        await db.update('students', student.id, {
          isShiftSwitching: false,
          alternateClassId: '' // clear it
        });
        
        await loadData(targetYear);
      } catch (error: any) {
         alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ។ Error: ' + error.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const getClassName = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : 'Unknown';
  };

  const getShiftName = (shift?: string) => {
    if (shift === 'Morning') return 'ព្រឹក';
    if (shift === 'Afternoon') return 'រសៀល';
    if (shift === 'Evening') return 'យប់';
    return shift || 'Unknown';
  };

  // Only show Active students who are shift switchers
  const shiftSwitchers = students.filter(s => s.isShiftSwitching && s.status === 'Active');
  
  // Filter for search
  const filteredSwitchers = shiftSwitchers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Eligible students for the dropdown (not already a switcher, and active)
  const eligibleStudents = students.filter(s => {
    if (s.isShiftSwitching || s.status !== 'Active') return false;
    if (filterClassId && filterClassId !== 'All' && s.class !== filterClassId) return false;
    return true;
  });

  // Determine eligible alternate classes based on selected student
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedStudentClassObj = selectedStudent ? classes.find(cl => cl.id === selectedStudent.class) : null;
  const selectedStudentGrade = selectedStudentClassObj ? getGrade(selectedStudentClassObj.name) : null;

  const eligibleAlternateClasses = classes.filter(c => {
    if (!selectedStudent) return true; // Show all if no student selected
    
    // 1. Must not be the student's current class
    if (c.id === selectedStudent.class) return false;
    
    // 2. Must be the same grade
    if (!selectedStudentGrade) return false;
    
    return getGrade(c.name) === selectedStudentGrade;
  });

  return (
    <div className="flex flex-col w-full pb-10">
      
      {/* Top Panel: Registration */}
      <div className={`bg-white border border-gray-200 shadow-sm rounded-sm mb-6 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>ចុះឈ្មោះសិស្សប្តូរវេន (Register Shift-Switching Student)</span>
        </div>
        <div className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-800 uppercase tracking-wide block mb-1.5">ជ្រើសរើសថ្នាក់បច្ចុប្បន្ន</label>
            <select 
              className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all disabled:opacity-50"
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setSelectedStudentId('');
              }}
              disabled={isSaving || isLoading}
            >
              <option value="All">-- ថ្នាក់ទាំងអស់ --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({getShiftName(c.shift)})</option>
              ))}
            </select>
          </div>

          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-800 uppercase tracking-wide block mb-1.5">ជ្រើសរើសសិស្ស *</label>
            <select 
              className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all disabled:opacity-50"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={isSaving || isLoading || (!filterClassId && eligibleStudents.length > 50)} // Optional: disable if too many without filter
            >
              <option value="">-- ជ្រើសរើសសិស្ស --</option>
              {eligibleStudents.map(s => (
                <option key={s.id} value={s.id}>{s.studentId} - {s.name} ({getClassName(s.class)})</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-800 uppercase tracking-wide block mb-1.5">ជ្រើសរើសថ្នាក់បម្រុង *</label>
            <select 
              className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all disabled:opacity-50"
              value={selectedAlternateClassId}
              onChange={(e) => setSelectedAlternateClassId(e.target.value)}
              disabled={!selectedStudentId || isSaving || isLoading}
            >
              <option value="">-- ជ្រើសរើសថ្នាក់ --</option>
              {eligibleAlternateClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({getShiftName(c.shift)})</option>
              ))}
            </select>
          </div>
          
          <button 
            className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-all h-[38px] w-full md:w-auto justify-center disabled:opacity-50"
            onClick={() => void handleRegister()}
            disabled={isSaving || isLoading || !selectedStudentId || !selectedAlternateClassId}
          >
            <UserPlus size={16} /> {isSaving ? 'កំពុងរក្សាទុក...' : 'បន្ថែម'}
          </button>
        </div>
      </div>

      {/* Middle Panel: Filter */}
      <div className="flex flex-col gap-1.5 mb-4 max-w-xs">
        <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input 
            type="text"
            placeholder="អត្តលេខ ឈ្មោះ..."
            className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all disabled:opacity-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Bottom Panel: Table */}
      <div className={`bg-white border border-gray-200 shadow-sm rounded-sm mb-6 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>បញ្ជីសិស្សប្តូរវេន (Shift-Switching Students)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {filteredSwitchers.length} នាក់</span>
        </div>
        
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-12 text-secondary-text">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
          <div className="overflow-x-auto p-0">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10 border-b border-gray-300">
                <tr>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">អត្តលេខ</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ភេទ</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ថ្នាក់បច្ចុប្បន្ន</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ថ្នាក់បម្រុង</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody>
                {filteredSwitchers.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                    <td className="px-5 py-3 font-mono text-sm text-gray-600">{s.studentId}</td>
                    <td className="px-5 py-3 font-bold text-gray-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                        <Users size={16} />
                      </div>
                      {s.name}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{s.gender}</td>
                    <td className="px-5 py-3">
                      <span className="bg-blue-50 text-blue-800 text-xs px-2.5 py-1 rounded-sm font-medium border border-blue-200 block w-max">
                        {getClassName(s.class)} ({getShiftName(s.shift)})
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-sm font-medium border border-gray-200 block w-max">
                        {getClassName(s.alternateClassId!)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => void handleSwitchShift(s)}
                          disabled={isSaving}
                          className="bg-orange-100 text-orange-700 hover:bg-orange-200 hover:text-orange-800 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ArrowLeftRight size={14} /> ប្តូរវេន
                        </button>
                        <button 
                          onClick={() => void handleRemoveStatus(s)}
                          disabled={isSaving}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors ml-2 disabled:opacity-50"
                          title="ដកចេញពីបញ្ជីប្តូរវេន"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSwitchers.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <ArrowLeftRight size={24} className="text-gray-400" />
                        </div>
                        <p className="text-base font-medium">មិនមានសិស្សប្តូរវេនទេ</p>
                        <p className="text-sm mt-1">សូមជ្រើសរើសសិស្សនៅខាងលើដើម្បីចាប់ផ្តើម។</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default ShiftSwitching;
