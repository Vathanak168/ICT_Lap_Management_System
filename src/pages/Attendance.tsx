import { useState, useEffect } from 'react';
import { Save, Calendar, CalendarDays, CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, AttendanceRecord } from '../store/db';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';

type AttendanceStatus = 'Present' | 'Absent' | 'Excused' | 'Late' | null;

const Attendance = () => {
  const { language } = useLanguage();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [initialAttendanceData, setInitialAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
      loadAttendance(selectedClass, selectedDate);
    } else {
      setStudents([]);
      setAttendanceData({});
      setInitialAttendanceData({});
    }
  }, [selectedClass, selectedDate]);

  const loadClasses = async () => {
    const db = await initDB();
    const allClasses = await db.getAll('classes');
    setClasses(allClasses);
    if (allClasses.length > 0) {
      setSelectedClass(allClasses[0].id);
    }
  };

  const loadStudents = async (classId: string) => {
    const db = await initDB();
    const allStudents = await db.getAllFromIndex('students', 'by-class', classId);
    setStudents(allStudents.filter(s => s.status !== 'Inactive')); // Or inactive
  };

  const loadAttendance = async (classId: string, date: string) => {
    const db = await initDB();
    const id = `${classId}_${date}`;
    const record = await db.get('attendance', id);
    
    if (record) {
      setAttendanceData(record.records as Record<string, AttendanceStatus>);
      setInitialAttendanceData(record.records as Record<string, AttendanceStatus>);
      setRecordId(record.id);
    } else {
      setAttendanceData({});
      setInitialAttendanceData({});
      setRecordId(null);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status
    }));
  };

  const handleBulkAction = (status: AttendanceStatus) => {
    if (!status) {
      setAttendanceData({});
      return;
    }
    const newData: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      newData[s.id] = status;
    });
    setAttendanceData(newData);
  };

  const hasChanges = JSON.stringify(attendanceData) !== JSON.stringify(initialAttendanceData);

  const handleSave = async () => {
    if (!selectedClass) return;
    
    const db = await initDB();
    const id = recordId || `${selectedClass}_${selectedDate}`;
    
    const record: AttendanceRecord = {
      id,
      date: selectedDate,
      class: selectedClass,
      records: attendanceData as any
    };
    
    const tx = db.transaction('attendance', 'readwrite');
    await tx.store.put(record);
    await tx.done;
    
    setInitialAttendanceData(attendanceData);
    setRecordId(id);
    
    // In a real app, use a proper Toast component here
    alert('រក្សាទុកទិន្នន័យវត្តមានជោគជ័យ!');
  };

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };
  
  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Format date to "DD/MM/YYYY" clearly indicated
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Calculate stats
  const presentCount = Object.values(attendanceData).filter(v => v === 'Present').length;
  const absentCount = Object.values(attendanceData).filter(v => v === 'Absent').length;
  const excusedCount = Object.values(attendanceData).filter(v => v === 'Excused').length;
  const lateCount = Object.values(attendanceData).filter(v => v === 'Late').length;

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់វត្តមាន (Attendance Settings)</span>
        </div>
        <div className="p-4 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
          
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5 min-w-[200px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ជ្រើសរើសថ្នាក់ (Class)</label>
              <select 
                className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all cursor-pointer"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">កាលបរិច្ឆេទ (Date)</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => changeDate(-1)}
                  className="p-2 border border-gray-300 bg-white rounded-sm hover:bg-gray-50 text-gray-600 transition-colors"
                  title="ថ្ងៃមុន"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="relative group cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-sm hover:border-[#2a5298] transition-colors">
                    <CalendarDays size={16} className="text-gray-600" />
                    <span className="font-semibold text-gray-800 text-sm">{formatDateDisplay(selectedDate)}</span>
                  </div>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                </div>
                <button 
                  onClick={() => changeDate(1)}
                  className="p-2 border border-gray-300 bg-white rounded-sm hover:bg-gray-50 text-gray-600 transition-colors"
                  title="ថ្ងៃបន្ទាប់"
                >
                  <ChevronRight size={16} />
                </button>
                <button 
                  onClick={setToday}
                  className="px-3 py-2 bg-gray-100 text-gray-700 border border-gray-300 font-medium rounded-sm hover:bg-gray-200 transition-colors ml-2 text-sm"
                >
                  ថ្ងៃនេះ
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex gap-4 border-r border-gray-300 pr-4 mr-1">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-green-600">{presentCount}</span>
                <span className="text-[10px] uppercase font-bold text-gray-500">មានមុខ</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-red-600">{absentCount}</span>
                <span className="text-[10px] uppercase font-bold text-gray-500">អវត្តមាន</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-yellow-600">{excusedCount}</span>
                <span className="text-[10px] uppercase font-bold text-gray-500">ច្បាប់</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-blue-600">{lateCount}</span>
                <span className="text-[10px] uppercase font-bold text-gray-500">យឺត</span>
              </div>
            </div>
            
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50" 
              onClick={handleSave} 
              disabled={!hasChanges}
            >
              <Save size={16} /> រក្សាទុក
            </button>
          </div>
        </div>
        
        {/* Bulk Actions Bar inside Top Panel */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center gap-3">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">កំណត់ទាំងអស់ (Bulk Action):</span>
          <button 
            onClick={() => handleBulkAction('Present')}
            className="px-3 py-1 text-xs font-bold rounded-sm border border-green-600 text-green-700 hover:bg-green-600 hover:text-white transition-colors"
          >
            មានមុខ
          </button>
          <button 
            onClick={() => handleBulkAction('Absent')}
            className="px-3 py-1 text-xs font-bold rounded-sm border border-red-600 text-red-700 hover:bg-red-600 hover:text-white transition-colors"
          >
            អវត្តមាន
          </button>
          <button 
            onClick={() => handleBulkAction(null)}
            className="px-3 py-1 text-xs font-bold rounded-sm border border-gray-400 text-gray-700 hover:bg-gray-200 transition-colors ml-auto"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Bottom Panel: Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>បញ្ជីវត្តមានសិស្ស (Attendance List)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សិស្សសរុប {students.length} នាក់</span>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10 border-b border-gray-300">
              <tr>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-center w-16">ល.រ</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">អត្តលេខ</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-center">ស្ថានភាពវត្តមាន (Segmented Control)</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="border-b border-gray-100 px-5 py-4 text-center text-gray-500 font-medium">{index + 1}</td>
                  <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-500">{student.studentId}</td>
                  <td className="border-b border-gray-100 px-5 py-4 font-bold text-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#2a5298]">
                      <User size={16} />
                    </div>
                    {language === 'KH' ? student.name : (student.englishName || student.name)}
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4">
                    <div className="flex justify-center">
                      <div className="inline-flex bg-gray-100 p-1 rounded-sm border border-gray-200">
                        <button
                          onClick={() => handleStatusChange(student.id, 'Present')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-all ${
                            attendanceData[student.id] === 'Present' 
                              ? 'bg-green-600 text-white shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                          }`}
                        >
                          <CheckCircle2 size={16} /> <span>មានមុខ</span>
                        </button>
                        
                        <button
                          onClick={() => handleStatusChange(student.id, 'Absent')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-all ${
                            attendanceData[student.id] === 'Absent' 
                              ? 'bg-red-600 text-white shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                          }`}
                        >
                          <XCircle size={16} /> <span>អវត្តមាន</span>
                        </button>
                        
                        <button
                          onClick={() => handleStatusChange(student.id, 'Excused')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-all ${
                            attendanceData[student.id] === 'Excused' 
                              ? 'bg-yellow-500 text-white shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                          }`}
                        >
                          <AlertCircle size={16} /> <span>ច្បាប់</span>
                        </button>
                        
                        <button
                          onClick={() => handleStatusChange(student.id, 'Late')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-all ${
                            attendanceData[student.id] === 'Late' 
                              ? 'bg-blue-500 text-white shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                          }`}
                        >
                          <Clock size={16} /> <span>យឺត</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && selectedClass && (
                <tr>
                  <td colSpan={4}>
                    <div className="flex flex-col items-center justify-center p-12 text-secondary-text">
                      <Calendar size={32} className="text-secondary-text mb-4 opacity-50" />
                      <p className="text-base font-medium">មិនមានសិស្សនៅក្នុងថ្នាក់នេះទេ</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Unsaved Changes Warning Toast Position */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
          <AlertCircle size={18} className="text-warning" />
          <span className="font-medium text-sm">អ្នកមានទិន្នន័យមិនទាន់រក្សាទុក!</span>
          <Button variant="primary" size="sm" onClick={handleSave} className="ml-2 bg-white text-primary hover:bg-gray-100">
            រក្សាទុកឥឡូវនេះ
          </Button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
