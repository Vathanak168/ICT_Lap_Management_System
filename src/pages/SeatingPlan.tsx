import React, { useState, useEffect } from 'react';
import { Monitor, User, UserMinus, Key, Zap, RefreshCw, AlertTriangle, MonitorPlay, Eye, EyeOff, Printer, Trash2, CheckCircle2, Keyboard } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord, PCIssue } from '../store/db';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

import { useLanguage } from '../contexts/LanguageContext';

interface Desk {
  id: string;
  pcNumber: string;
  studentId?: string;
  status: 'Good' | 'Issue';
}

const SeatingPlan = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [pcIssues, setPcIssues] = useState<PCIssue[]>([]);
  
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true);

  // For Drag and Drop
  const [draggedDeskId, setDraggedDeskId] = useState<string | null>(null);

  // For Issue Reporting
  const [issueDescription, setIssueDescription] = useState('');
  const [isReportingIssue, setIsReportingIssue] = useState(false);

  const { language } = useLanguage();

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
      const allStudents = await db.getAllFromIndex('students', 'by-class', targetClass);
      
      const allIssues = await db.getAll('pcIssues');
      setPcIssues(allIssues);
      
      const studentsForClass = allStudents.filter(s => s.status === 'Active');
      setStudents(studentsForClass);

      const initialDesks: Desk[] = Array.from({ length: 37 }, (_, i) => {
        const pcNum = i === 0 ? 'Teacher PC' : `PC-${i.toString().padStart(2, '0')}`;
        const assignedStudent = studentsForClass.find(s => s.pcNumber === pcNum);
        
        // Find if there is an active issue for this PC
        const activeIssue = allIssues.find(issue => issue.pcNumber === pcNum && issue.status !== 'Good');
        
        return {
          id: `desk-${i}`,
          pcNumber: pcNum,
          status: activeIssue ? 'Issue' : 'Good',
          studentId: assignedStudent?.id
        };
      });
      
      setDesks(initialDesks);
      
      if (selectedDesk) {
        const updatedDesk = initialDesks.find(d => d.id === selectedDesk.id);
        setSelectedDesk(updatedDesk || null);
      }
    }
  };

  const handleDeskClick = (desk: Desk) => {
    setSelectedDesk(desk);
    setIsReportingIssue(false);
    setIssueDescription('');
    setIsModalOpen(true);
  };

  // -------------------------------------------------------------
  // Drag and Drop Logic
  // -------------------------------------------------------------
  const handleDragStart = (e: React.DragEvent, desk: Desk) => {
    if (!desk.studentId) {
      e.preventDefault();
      return;
    }
    setDraggedDeskId(desk.id);
    e.dataTransfer.setData('text/plain', desk.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDesk: Desk) => {
    e.preventDefault();
    if (targetDesk.pcNumber === 'Teacher PC') return; // Cannot drop on teacher PC
    if (targetDesk.status === 'Issue') return; // Cannot drop on broken PC
    
    const sourceDeskId = e.dataTransfer.getData('text/plain');
    if (sourceDeskId === targetDesk.id) return;
    
    const sourceDesk = desks.find(d => d.id === sourceDeskId);
    if (!sourceDesk || !sourceDesk.studentId) return;

    const sourceStudent = students.find(s => s.id === sourceDesk.studentId);
    const targetStudent = targetDesk.studentId ? students.find(s => s.id === targetDesk.studentId) : null;

    const db = await initDB();
    const tx = db.transaction('students', 'readwrite');

    if (sourceStudent) {
      sourceStudent.pcNumber = targetDesk.pcNumber;
      await tx.store.put(sourceStudent);
    }
    
    if (targetStudent) {
      targetStudent.pcNumber = sourceDesk.pcNumber;
      await tx.store.put(targetStudent);
    }

    await tx.done;
    setDraggedDeskId(null);
    loadData();
  };

  const handleDragEnd = () => {
    setDraggedDeskId(null);
  };

  // -------------------------------------------------------------
  // Password & Assignment Logic
  // -------------------------------------------------------------
  const generateUniquePassword = (existingPasswords: Set<string>): string => {
    let newPassword = '';
    do {
      newPassword = Math.floor(100 + Math.random() * 900).toString();
    } while (existingPasswords.has(newPassword));
    return newPassword;
  };

  const generatePassword = async () => {
    if (!selectedDesk || !selectedDesk.studentId) return;
    
    const existingPasswords = new Set(students.map(s => s.password).filter(Boolean) as string[]);
    const newPassword = generateUniquePassword(existingPasswords);
    
    const studentIndex = students.findIndex(s => s.id === selectedDesk.studentId);
    if (studentIndex > -1) {
      const updatedStudent = { ...students[studentIndex], password: newPassword };
      
      const newStudents = [...students];
      newStudents[studentIndex] = updatedStudent;
      setStudents(newStudents);
      
      const db = await initDB();
      await db.put('students', updatedStudent);
    }
  };

  const generatePasswordsForClass = async () => {
    if (!selectedClass || students.length === 0) return;
    
    if (!window.confirm('តើអ្នកពិតជាចង់បង្កើត Password ថ្មីសម្រាប់សិស្សទាំងអស់ក្នុងថ្នាក់នេះមែនទេ? (Password ចាស់នឹងត្រូវបាត់បង់)')) return;

    const newStudents = [...students];
    const usedPasswords = new Set<string>();
    const db = await initDB();
    const tx = db.transaction('students', 'readwrite');

    for (let i = 0; i < newStudents.length; i++) {
      const newPassword = generateUniquePassword(usedPasswords);
      usedPasswords.add(newPassword);
      newStudents[i] = { ...newStudents[i], password: newPassword };
      await tx.store.put(newStudents[i]);
    }
    
    await tx.done;
    setStudents(newStudents);
  };

  const getStudentForDesk = (studentId?: string) => {
    return students.find(s => s.id === studentId);
  };

  const handleAssignStudent = async (studentId: string) => {
    if (!selectedDesk) return;
    const student = students.find(s => s.id === studentId);
    if (student) {
      const updatedStudent = { ...student, pcNumber: selectedDesk.pcNumber };
      const db = await initDB();
      await db.put('students', updatedStudent);
      loadData();
    }
  };

  const handleUnassignStudent = async () => {
    if (!selectedDesk || !selectedDesk.studentId) return;
    const student = students.find(s => s.id === selectedDesk.studentId);
    if (student) {
      const updatedStudent = { ...student, pcNumber: undefined, password: undefined };
      const db = await initDB();
      await db.put('students', updatedStudent);
      loadData();
    }
  };

  const handleClearAllAssignments = async () => {
    if (!selectedClass || students.length === 0) return;
    
    if (!window.confirm('តើអ្នកពិតជាចង់ដកសិស្សទាំងអស់ចេញពីតុ និងលុប Password ចោលមែនទេ?')) return;
    
    const newStudents = [...students];
    const db = await initDB();
    const tx = db.transaction('students', 'readwrite');

    for (let i = 0; i < newStudents.length; i++) {
      if (newStudents[i].pcNumber || newStudents[i].password) {
        newStudents[i] = { ...newStudents[i], pcNumber: undefined, password: undefined };
        await tx.store.put(newStudents[i]);
      }
    }
    
    await tx.done;
    setStudents(newStudents);
    loadData();
  };

  const handleAutoAssign = async () => {
    if (!selectedClass) return;
    
    // Sort unassigned students by ID
    const unassignedStudents = students
      .filter(s => !s.pcNumber)
      .sort((a, b) => a.studentId.localeCompare(b.studentId));

    if (unassignedStudents.length === 0) {
      alert('មិនមានសិស្សទំនេរដែលត្រូវរៀបចំទេ។');
      return;
    }

    // Get available desks
    const availableDesks = desks.filter(d => d.pcNumber !== 'Teacher PC' && d.status === 'Good' && !d.studentId);
    
    if (availableDesks.length === 0) {
      alert('មិនមានកុំព្យូទ័រទំនេរ និងល្អគ្រប់គ្រាន់ទេ។');
      return;
    }

    const db = await initDB();
    const tx = db.transaction('students', 'readwrite');

    let assignedCount = 0;
    for (let i = 0; i < unassignedStudents.length; i++) {
      if (i < availableDesks.length) {
        const student = unassignedStudents[i];
        const desk = availableDesks[i];
        student.pcNumber = desk.pcNumber;
        await tx.store.put(student);
        assignedCount++;
      }
    }
    
    await tx.done;
    alert(`បានរៀបចំកន្លែងអង្គុយដោយស្វ័យប្រវត្តិជូនសិស្សចំនួន ${assignedCount} នាក់ជោគជ័យ!`);
    loadData();
  };

  // -------------------------------------------------------------
  // Issue Reporting Logic
  // -------------------------------------------------------------
  const handleReportIssue = async () => {
    if (!selectedDesk || !issueDescription.trim()) return;

    const db = await initDB();
    const newIssue: PCIssue = {
      id: Date.now().toString(),
      pcNumber: selectedDesk.pcNumber,
      seatNumber: selectedDesk.pcNumber,
      status: 'Issue',
      currentIssue: issueDescription.trim(),
      dateFound: new Date().toISOString()
    };
    
    await db.put('pcIssues', newIssue);
    setIsReportingIssue(false);
    setIssueDescription('');
    loadData();
  };

  const handleMarkResolved = async () => {
    if (!selectedDesk) return;
    
    const activeIssue = pcIssues.find(issue => issue.pcNumber === selectedDesk.pcNumber && issue.status !== 'Good');
    
    if (activeIssue) {
      const db = await initDB();
      const updatedIssue = {
        ...activeIssue,
        status: 'Good' as const,
        dateResolved: new Date().toISOString()
      };
      await db.put('pcIssues', updatedIssue);
      loadData();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const unassignedStudentsList = students
    .filter(s => !s.pcNumber)
    .sort((a, b) => a.studentId.localeCompare(b.studentId));

  const renderDesk = (desk: Desk) => {
    const student = getStudentForDesk(desk.studentId);
    const isTeacher = desk.pcNumber === 'Teacher PC';

    let borderClass = 'border-border';
    let bgClass = 'bg-white hover:bg-background-selected';
    let iconColor = 'text-blue-500';

    if (isTeacher) {
      borderClass = 'border-green-300';
      bgClass = 'bg-green-50 hover:bg-green-100';
      iconColor = 'text-green-600';
    } else if (desk.status === 'Issue') {
      borderClass = 'border-red-300';
      bgClass = 'bg-red-50 hover:bg-red-100';
      iconColor = 'text-danger';
    } else if (student) {
      borderClass = 'border-blue-200';
      bgClass = 'bg-blue-50 hover:bg-blue-100';
    }
    
    const isDragging = draggedDeskId === desk.id;

    return (
      <div 
        key={desk.id} 
        draggable={!isTeacher && desk.status !== 'Issue' && !!student}
        onDragStart={(e) => handleDragStart(e, desk)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, desk)}
        onDragEnd={handleDragEnd}
        className={`flex flex-col border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md 
          ${borderClass} ${bgClass} 
          ${isDragging ? 'opacity-50 scale-95 border-dashed border-2' : ''}
          ${!isTeacher && desk.status !== 'Issue' ? 'active:scale-95' : ''}
        `}
        onClick={() => handleDeskClick(desk)}
      >
        <div className={`px-3 py-2 print:py-1 flex items-center justify-between border-b ${borderClass} bg-white/50`}>
          <div className="flex items-center gap-2 pointer-events-none">
            <Monitor size={14} className={iconColor} />
            <span className={`text-xs print:text-[10px] font-semibold ${isTeacher ? 'text-green-700' : 'text-secondary-text'}`}>
              {desk.pcNumber}
            </span>
          </div>
          {!isTeacher && desk.status === 'Issue' && (
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
          )}
        </div>
        <div className="p-3 print:p-2 flex-1 flex flex-col justify-center min-h-[80px] print:min-h-[60px] pointer-events-none">
          {isTeacher ? (
            <div className="text-center font-bold text-green-700">តុគ្រូ (Teacher)</div>
          ) : student ? (
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold text-sm print:text-xs line-clamp-2 text-primary leading-tight text-center transition-all duration-300">
                {language === 'KH' ? student.name : (student.englishName || student.name)}
              </div>
              {showPasswords && student.password && (
                <div className="flex items-center justify-center gap-1 px-2 py-1 print:py-0.5 bg-white/80 rounded-md text-xs print:text-[10px] font-mono font-medium text-primary border border-border/50 mx-auto">
                  <Key size={12} className="text-secondary-text" /> 
                  {student.password}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-secondary-text/50">
              <Keyboard size={20} className="mb-1" />
              <span className="text-xs font-medium uppercase tracking-wider">ទំនេរ</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeStudentCount = students.filter(s => s.pcNumber).length;

  return (
    <div className="flex flex-col w-full pb-10 print:pb-0">
      
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-300 mb-6 print:hidden">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់លក្ខខណ្ឌ និងសកម្មភាព (Filters & Actions)</span>
        </div>
        <div className="p-4 flex flex-col xl:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5 min-w-[250px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ជ្រើសរើសថ្នាក់ (Class)</label>
              <select 
                className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
                {classes.length === 0 && <option value="">មិនមានថ្នាក់</option>}
              </select>
            </div>
            
            <button 
              className="mt-5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={() => setShowPasswords(!showPasswords)}
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />} បង្ហាញ Password
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0">
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent"
              onClick={handleAutoAssign}
            >
              <Zap size={16} /> រៀបចំកន្លែងស្វ័យប្រវត្តិ
            </button>
            <button 
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={generatePasswordsForClass}
            >
              <RefreshCw size={16} /> បង្កើត Password រួម
            </button>
            <button 
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={handleClearAllAssignments}
            >
              <Trash2 size={16} /> លុបទិន្នន័យតុ
            </button>
            <button 
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent"
              onClick={handlePrint}
            >
              <Printer size={16} /> បោះពុម្ពប្លង់តុ
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Lab Layout */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6 print:border-none print:mb-0">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center print:hidden">
          <span>ប្លង់កុំព្យូទ័រ (Seating Plan)</span>
        </div>
        <div className="p-4 sm:p-6 print:p-0">
          <div className="flex flex-wrap items-center justify-between mb-8 pb-4 border-b border-gray-200 gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-100 border border-blue-200"></div>
                <span className="text-gray-600">មានសិស្សអង្គុយ ({activeStudentCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white border border-gray-300"></div>
                <span className="text-gray-600">ទំនេរ ({students.length > 0 ? 36 - activeStudentCount : 36})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-100 border border-red-300"></div>
                <span className="text-gray-600">កុំព្យូទ័រមានបញ្ហា</span>
              </div>
            </div>
            <span className="bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1 rounded-sm border border-gray-300">
              សិស្សសរុប៖ {students.length} នាក់
            </span>
          </div>

        {/* Full width lab layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 justify-center bg-background rounded-xl p-8 border border-border/50 print:bg-white print:border-none print:p-0 print:gap-8 print:flex-row print:w-full print:items-start">
          
          {/* Left Column */}
          <div className="flex-1 max-w-[500px] flex flex-col gap-6">
            {/* Teacher Desk Box */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4 lg:col-span-2 print:col-span-2">
                {desks[0] && renderDesk(desks[0])}
              </div>
            </div>
            
            {/* Student Desks 1-20 (5 groups of 4) */}
            {[0, 1, 2, 3, 4].map(rowIndex => (
              <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 print:gap-2" key={`left-row-${rowIndex}`}>
                {desks.slice(1 + rowIndex * 4, 1 + rowIndex * 4 + 4).map(renderDesk)}
              </div>
            ))}
          </div>

          {/* Right Column / Board */}
          <div className="flex-1 max-w-[500px] flex flex-col gap-6">
            {/* Empty spacer for alignment with teacher desk */}
            <div className="grid grid-cols-4 gap-4 hidden lg:grid print:grid">
              <div className="col-span-2 invisible h-[114px] print:h-[75px]"></div>
            </div>
            
            {/* Student Desks 21-36 (4 groups of 4) */}
            {[0, 1, 2, 3].map(rowIndex => (
              <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 print:gap-2" key={`right-row-${rowIndex}`}>
                {desks.slice(21 + rowIndex * 4, 21 + rowIndex * 4 + 4).map(renderDesk)}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Desk Details Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={`ព័ត៌មានតុ ${selectedDesk?.pcNumber}`}
      >
        {selectedDesk && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedDesk.status === 'Issue' ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}`}>
                  {selectedDesk.status === 'Issue' ? <MonitorPlay size={24} /> : <Monitor size={24} />}
                </div>
                <div>
                  <p className="text-sm text-secondary-text mb-0.5">ស្ថានភាពកុំព្យូទ័រ</p>
                  <p className={`font-semibold ${selectedDesk.status === 'Issue' ? 'text-danger' : 'text-success'}`}>
                    {selectedDesk.status === 'Issue' ? 'មានបញ្ហា (Needs Fix)' : 'ដំណើរការល្អ (Good)'}
                  </p>
                </div>
              </div>
              {selectedDesk.pcNumber !== 'Teacher PC' && (
                <div>
                  {selectedDesk.status === 'Issue' ? (
                     <Button variant="primary" size="sm" onClick={handleMarkResolved} className="bg-success hover:bg-green-600">
                        <CheckCircle2 size={16} className="mr-1" /> ដោះស្រាយរួចរាល់
                     </Button>
                  ) : (
                     <Button variant="danger" size="sm" onClick={() => setIsReportingIssue(!isReportingIssue)}>
                        <AlertTriangle size={16} className="mr-1" /> រាយការណ៍បញ្ហា
                     </Button>
                  )}
                </div>
              )}
            </div>

            {isReportingIssue && (
              <div className="p-4 bg-danger-light border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-4">
                <h4 className="text-sm font-semibold text-danger mb-2">រាយការណ៍បញ្ហាកុំព្យូទ័រនេះ</h4>
                <div className="flex gap-2">
                  <Input 
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="សូមបញ្ចូលបញ្ហា (ឧ. ខូច Mouse, បើកមិនចេញ)..."
                  />
                  <Button variant="danger" onClick={handleReportIssue}>រាយការណ៍</Button>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">សិស្សអង្គុយតុនេះ</h3>
              
              {selectedDesk.studentId ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">
                        <User size={24} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-primary text-base">{getStudentForDesk(selectedDesk.studentId)?.name}</h4>
                        <p className="text-sm text-secondary-text">អត្តលេខ៖ {getStudentForDesk(selectedDesk.studentId)?.studentId}</p>
                      </div>
                    </div>
                    <Button variant="danger" size="sm" onClick={handleUnassignStudent}>
                      ដកចេញ
                    </Button>
                  </div>
                  
                  <div className="bg-white border border-border p-4 rounded-xl shadow-sm">
                    <label className="block text-sm font-medium text-secondary-text mb-3">លេខកូដសម្ងាត់ (Password)</label>
                    <div className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Key size={18} className="text-secondary-text" />
                        <span className="font-mono text-lg font-semibold tracking-wider text-primary">
                          {getStudentForDesk(selectedDesk.studentId)?.password || '---'}
                        </span>
                      </div>
                      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={generatePassword}>
                        បង្កើតថ្មី
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center justify-center p-8 bg-background border border-dashed border-border rounded-xl text-center">
                    <UserMinus size={32} className="text-secondary-text mb-3" />
                    <p className="text-secondary-text font-medium mb-1">មិនទាន់មានសិស្សអង្គុយ</p>
                    <p className="text-sm text-secondary-text/70 mb-4">សូមជ្រើសរើសសិស្សដើម្បីចាត់តាំងឲ្យអង្គុយតុនេះ</p>
                    
                    <select 
                      className="block w-full max-w-xs rounded-lg border-border focus:border-primary focus:ring-primary text-sm py-2 px-3 border bg-white shadow-sm disabled:opacity-50"
                      value=""
                      onChange={(e) => handleAssignStudent(e.target.value)}
                      disabled={selectedDesk.status === 'Issue' || selectedDesk.pcNumber === 'Teacher PC'}
                    >
                      <option value="" disabled>ជ្រើសរើសសិស្ស...</option>
                      {unassignedStudentsList.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.studentId})</option>
                      ))}
                      {unassignedStudentsList.length === 0 && <option value="" disabled>គ្មានសិស្សទំនេរទេ</option>}
                    </select>
                    {selectedDesk.status === 'Issue' && (
                      <p className="text-xs text-danger mt-2 mt-4">មិនអាចចាត់តាំងសិស្សឲ្យអង្គុយកុំព្យូទ័រខូចបានទេ</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
    </div>
  );
};

export default SeatingPlan;
