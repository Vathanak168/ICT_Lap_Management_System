import { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Edit2, Trash2, KeyRound, Download, Eye, User, Users, ArrowLeftRight } from 'lucide-react';
import { initDB } from '../store/db';
import type { Student, ClassRecord } from '../store/db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { translateKhmerToEnglish } from '../utils/khmerTranslator';
import { useLanguage } from '../contexts/LanguageContext';

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [filterClass, setFilterClass] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const { language } = useLanguage();
  
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [currentStudent, setCurrentStudent] = useState<Partial<Student>>({
    studentId: '', name: '', englishName: '', gender: 'M', class: '', shift: 'Morning', status: 'Active'
  });

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Click outside to close menu
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    const db = await initDB();
    const allStudents = await db.getAll('students');
    const allClasses = await db.getAll('classes');
    setClasses(allClasses);
    setStudents(allStudents);
  };

  const handleSave = async () => {
    if (!currentStudent.name || !currentStudent.studentId || !currentStudent.class) {
      alert('សូមបំពេញព័ត៌មានចាំបាច់ (អត្តលេខ, ឈ្មោះ, ថ្នាក់)');
      return;
    }
    
    const db = await initDB();
    const newStudent: Student = {
      ...(currentStudent as Student),
      id: currentStudent.id || Date.now().toString(),
    };
    
    const tx = db.transaction('students', 'readwrite');
    await tx.store.put(newStudent);
    await tx.done;
    
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យសិស្សនេះមែនទេ?')) {
      const db = await initDB();
      const tx = db.transaction('students', 'readwrite');
      await tx.store.delete(id);
      await tx.done;
      loadData();
    }
  };
  
  const handleResetPassword = async (student: Student) => {
    if (window.confirm(`តើអ្នកចង់ Reset Password របស់សិស្ស ${student.name} មែនទេ?`)) {
      const db = await initDB();
      const tx = db.transaction('students', 'readwrite');
      const updatedStudent = { ...student, status: 'ResetRequired' as const };
      await tx.store.put(updatedStudent);
      await tx.done;
      loadData();
      // Show toast ideally
    }
  };

  const openEditModal = (student: Student) => {
    setCurrentStudent(student);
    setShowModal(true);
  };
  
  const getClassName = (classId: string) => {
    const c = classes.find(cls => cls.id === classId);
    return c ? c.name : classId;
  };
  
  const translateShift = (shift: string) => {
    switch(shift) {
      case 'Morning': return 'ព្រឹក';
      case 'Afternoon': return 'រសៀល';
      case 'Evening': return 'យប់';
      default: return shift;
    }
  };

  const filteredStudents = students.filter(s => {
    const matchClass = filterClass === 'All' || s.class === filterClass;
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="flex flex-col w-full pb-10">
      
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់លក្ខខណ្ឌ និងសកម្មភាព (Filters & Actions)</span>
        </div>
        <div className="p-4 flex flex-col xl:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap items-center gap-6 w-full xl:w-auto">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input 
                  type="text"
                  placeholder="អត្តលេខ ឈ្មោះ..."
                  className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ថ្នាក់រៀន (Class Name)</label>
              <select 
                className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all cursor-pointer"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="All">ថ្នាក់ទាំងអស់</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({translateShift(c.shift)})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0">
            <button 
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50" 
              disabled={!students.some(s => !s.englishName)}
              onClick={async () => {
                if (!window.confirm('តើអ្នកចង់បកប្រែឈ្មោះសិស្សដែលមិនទាន់មានឈ្មោះអង់គ្លេសដោយស្វ័យប្រវត្តិមែនទេ? (ទិន្នន័យនឹងត្រូវរក្សាទុកក្នុង Database)')) return;
                const db = await initDB();
                const tx = db.transaction('students', 'readwrite');
                const newStudents = [...students];
                let translatedCount = 0;
                for (let i = 0; i < newStudents.length; i++) {
                  if (!newStudents[i].englishName) {
                    newStudents[i] = { ...newStudents[i], englishName: translateKhmerToEnglish(newStudents[i].name) };
                    await tx.store.put(newStudents[i]);
                    translatedCount++;
                  }
                }
                await tx.done;
                setStudents(newStudents);
                alert(`បានបកប្រែនិងរក្សាទុកឈ្មោះសិស្សចំនួន ${translatedCount} នាក់ជោគជ័យ! លោកអ្នកអាចកែប្រែឈ្មោះទាំងនេះបានបើសិនជាវាមិនត្រឹមត្រូវ។`);
              }}
            >
              បកប្រែទាំងអស់
            </button>
            <button 
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={!students.some(s => s.englishName)}
              onClick={async () => {
                if (!window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យបកប្រែទាំងអស់ចេញមែនទេ? (សកម្មភាពនេះមិនអាចត្រលប់វិញបានទេ)')) return;
                const db = await initDB();
                const tx = db.transaction('students', 'readwrite');
                const newStudents = [...students];
                for (let i = 0; i < newStudents.length; i++) {
                  if (newStudents[i].englishName) {
                    newStudents[i] = { ...newStudents[i], englishName: '' };
                    await tx.store.put(newStudents[i]);
                  }
                }
                await tx.done;
                setStudents(newStudents);
              }}
            >
              លុបការបកប្រែ
            </button>
            <button 
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={() => setShowImportModal(true)}
            >
              <Download size={16} /> Import Excel
            </button>
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] hover:shadow-md text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-all border border-transparent"
              onClick={() => {
                setCurrentStudent({
                  studentId: '', name: '', englishName: '', gender: 'M', class: classes.length > 0 ? classes[0].id : '', shift: 'Morning', status: 'Active'
                });
                setShowModal(true);
              }}
            >
              <UserPlus size={16} /> បន្ថែមសិស្ស
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>បញ្ជីឈ្មោះសិស្ស (List of Students)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {filteredStudents.length} នាក់ (សកម្ម {students.filter(s => s.status === 'Active').length})</span>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10 border-b border-gray-300">
              <tr>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">អត្តលេខ</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ឈ្មោះសិស្ស {language === 'EN' ? '(EN)' : '(KH)'}</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ភេទ</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ថ្នាក់</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ស្ថានភាពគណនី</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-500">{student.studentId}</td>
                  <td className="border-b border-gray-100 px-5 py-4 font-bold text-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#2a5298]">
                      <User size={16} />
                    </div>
                    {language === 'KH' ? student.name : (student.englishName || student.name)}
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4 text-sm text-gray-600">{student.gender === 'M' ? 'ប្រុស' : 'ស្រី'}</td>
                  <td className="border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-sm font-medium">{getClassName(student.class)}</span>
                      {student.isShiftSwitching && (
                        <span className="bg-orange-50 text-orange-600 border border-orange-200 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" title="សិស្សប្តូរវេន">
                          <ArrowLeftRight size={10} /> ប្តូរវេន
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4">
                    {student.status === 'Active' && <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-sm font-medium">សកម្ម (Active)</span>}
                    {student.status === 'Inactive' && <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-sm font-medium">អសកម្ម (Inactive)</span>}
                    {student.status === 'ResetRequired' && <span className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-sm font-medium">ត្រូវប្តូរលេខកូដ</span>}
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4 text-right relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === student.id ? null : student.id);
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-sm transition-colors focus:outline-none"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeMenuId === student.id && (
                      <div className="absolute right-8 top-10 w-48 bg-white border border-gray-200 rounded-sm shadow-lg py-1 z-20 text-left">
                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <Eye size={16} /> ព័ត៌មានលម្អិត
                        </button>
                        <button 
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          onClick={() => { setActiveMenuId(null); openEditModal(student); }}
                        >
                          <Edit2 size={16} /> កែប្រែ
                        </button>
                        <button 
                          className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-2"
                          onClick={() => { setActiveMenuId(null); handleResetPassword(student); }}
                        >
                          <KeyRound size={16} /> Reset Password
                        </button>
                        <div className="h-px bg-gray-200 my-1"></div>
                        <button 
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          onClick={() => { setActiveMenuId(null); handleDelete(student.id); }}
                        >
                          <Trash2 size={16} /> លុបគណនី
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center p-12 text-secondary-text">
                      <div className="w-12 h-12 bg-background-selected rounded-full flex items-center justify-center mb-4">
                        <Users size={24} className="text-secondary-text" />
                      </div>
                      <p className="text-base font-medium">មិនមានទិន្នន័យសិស្សទេ</p>
                      <p className="text-sm mt-1">សូមបន្ថែមសិស្សថ្មី ដើម្បីចាប់ផ្តើម។</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add/Edit Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={currentStudent.id ? 'កែប្រែព័ត៌មានសិស្ស' : 'បន្ថែមសិស្សថ្មី'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">អត្តលេខសិស្ស</label>
            <Input 
              value={currentStudent.studentId} 
              onChange={(e) => setCurrentStudent({...currentStudent, studentId: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ឈ្មោះពេញ (ខ្មែរ)</label>
            <Input 
              value={currentStudent.name} 
              onChange={(e) => setCurrentStudent({...currentStudent, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ឈ្មោះអង់គ្លេស (English Name)</label>
            <Input 
              value={currentStudent.englishName || ''} 
              onChange={(e) => setCurrentStudent({...currentStudent, englishName: e.target.value})}
              placeholder="Ex: Keo Piseth"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ភេទ</label>
            <select 
              className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white"
              value={currentStudent.gender}
              onChange={(e) => setCurrentStudent({...currentStudent, gender: e.target.value as 'M'|'F'})}
            >
              <option value="M">ប្រុស</option>
              <option value="F">ស្រី</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ថ្នាក់</label>
            <select 
              className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white"
              value={currentStudent.class}
              onChange={(e) => {
                const cls = classes.find(c => c.id === e.target.value);
                setCurrentStudent({...currentStudent, class: e.target.value, shift: cls ? cls.shift : 'Morning'});
              }}
            >
              <option value="">ជ្រើសរើសថ្នាក់...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({translateShift(c.shift)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ស្ថានភាពគណនី</label>
            <select 
              className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white"
              value={currentStudent.status}
              onChange={(e) => setCurrentStudent({...currentStudent, status: e.target.value as any})}
            >
              <option value="Active">សកម្ម (Active)</option>
              <option value="Inactive">អសកម្ម (Inactive)</option>
              <option value="ResetRequired">ត្រូវប្តូរលេខកូដ (Reset Required)</option>
            </select>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)}>បោះបង់</Button>
            <Button variant="primary" onClick={handleSave}>រក្សាទុក</Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        title="Import ពី Excel"
      >
        <div className="space-y-4">
          <div className="bg-background-selected p-4 rounded-lg text-sm text-secondary-text mb-4">
            សូមទាញយកទម្រង់គំរូ (Template) ដើម្បីរៀបចំទិន្នន័យឲ្យបានត្រឹមត្រូវ មុននឹងបញ្ជូលទៅក្នុងប្រព័ន្ធ។
          </div>
          <Button variant="secondary" className="w-full justify-center">ទាញយកទម្រង់គំរូ (Download Template)</Button>
          
          <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-secondary-text bg-background hover:bg-background-selected transition-colors cursor-pointer mt-4">
            <Download size={32} className="mb-2 text-secondary-text" />
            <p className="font-medium text-primary">ចុចទីនេះ ដើម្បីជ្រើសរើសឯកសារ</p>
            <p className="text-xs mt-1">គាំទ្រតែឯកសារ .xlsx និង .xls ប៉ុណ្ណោះ</p>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowImportModal(false)}>បោះបង់</Button>
            <Button variant="primary" disabled>បញ្ជាក់ការបញ្ជូល (Import)</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Students;
