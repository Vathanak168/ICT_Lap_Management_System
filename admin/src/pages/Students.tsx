import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Download, 
  Key, 
  Monitor, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Globe
} from 'lucide-react';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';
import { translateKhmerToEnglish } from '../utils/khmerTranslator';

interface Student {
  id: string;
  student_id: string;
  name: string;
  english_name: string;
  gender: string;
  class: string;
  shift: string;
  branch: string;
  academic_year: string;
  status: string;
  pc_number?: string | null;
  password?: string | null;
}

const Students = () => {
  const { selectedBranch, selectedYear } = useOutletContext<{ selectedBranch: string; selectedYear: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter & Search State
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [filterShift, setFilterShift] = useState('All');
  const [filterDesk, setFilterDesk] = useState<'All' | 'ASSIGNED' | 'UNASSIGNED'>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    english_name: '',
    gender: 'M',
    class: '',
    shift: 'Morning',
    branch: '',
    academic_year: '2026-2027',
    status: 'Active',
    pc_number: '',
    password: ''
  });

  const { success, error: toastError, info } = useToast();

  useEffect(() => {
    setFilterClass('All');
    setCurrentPage(1);
    fetchStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedYear]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase.from('students').select('*').order('student_id');
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }
      
      if (selectedYear && selectedYear !== 'All') {
        query = query.eq('academic_year', selectedYear);
      }

      let classQuery = supabase.from('classes').select('*');
      if (selectedBranch !== 'All') classQuery = classQuery.eq('branch', selectedBranch);
      if (selectedYear && selectedYear !== 'All') classQuery = classQuery.eq('academic_year', selectedYear);

      const [studentsRes, classesRes] = await Promise.all([query, classQuery]);

      if (studentsRes.error) throw studentsRes.error;
      if (classesRes.error) throw classesRes.error;
      
      const loadedStudents = studentsRes.data || [];
      const loadedClasses = classesRes.data || [];
      
      loadedStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
      loadedClasses.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
      
      setStudents(loadedStudents);
      setClassesList(loadedClasses);
    } catch (error) {
      console.error('Error fetching students:', error);
      toastError('បរាជ័យក្នុងការទាញយកទិន្នន័យសិស្ស');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (student?: Student) => {
    setShowPassword(false);
    if (student) {
      setEditingStudent(student);
      setFormData({
        student_id: student.student_id || '',
        name: student.name || '',
        english_name: student.english_name || '',
        gender: student.gender || 'M',
        class: student.class || '',
        shift: student.shift || 'Morning',
        branch: student.branch || (selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 25'),
        academic_year: student.academic_year || (selectedYear !== 'All' ? selectedYear : '2026-2027'),
        status: student.status || 'Active',
        pc_number: student.pc_number || '',
        password: student.password || ''
      });
    } else {
      setEditingStudent(null);
      setFormData({
        student_id: '',
        name: '',
        english_name: '',
        gender: 'M',
        class: classesList[0]?.id || '',
        shift: classesList[0]?.shift || 'Morning',
        branch: selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 25',
        academic_year: selectedYear !== 'All' ? selectedYear : '2026-2027',
        status: 'Active',
        pc_number: '',
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    const randomNum = 100000 + Math.floor(Math.random() * 900000);
    const newPass = `Lab!${randomNum}`;
    setFormData(prev => ({ ...prev, password: newPass }));
    setShowPassword(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Normalize pcNumber format if provided (e.g. 1 -> PC-01, pc-1 -> PC-01)
      let formattedPc = formData.pc_number.trim();
      if (formattedPc) {
        const match = formattedPc.match(/^PC[-_ ]?(\d+)$/i);
        if (match) {
          formattedPc = `PC-${match[1].padStart(2, '0')}`;
        } else if (/^\d+$/.test(formattedPc)) {
          formattedPc = `PC-${formattedPc.padStart(2, '0')}`;
        }
      }

      const payload = {
        student_id: formData.student_id.trim(),
        name: formData.name.trim(),
        english_name: formData.english_name.trim(),
        gender: formData.gender,
        class: formData.class,
        shift: formData.shift,
        branch: formData.branch,
        academic_year: formData.academic_year,
        status: formData.status,
        pc_number: formattedPc || null,
        password: formData.password.trim() || null
      };

      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudent.id);
        
        if (error) throw error;

        // If password was changed or assigned to PC, queue sync task
        if (formattedPc && formData.password) {
          try {
            await supabase.from('pc_sync_tasks').insert([{
              id: crypto.randomUUID(),
              pc_number: formattedPc,
              student_id: payload.student_id,
              student_name: payload.english_name || payload.name,
              action: 'UPDATE_PASSWORD',
              password: payload.password,
              status: 'PENDING',
              created_at: new Date().toISOString(),
              branch: payload.branch,
              academic_year: payload.academic_year
            }]);
          } catch (syncErr) {
            console.warn('Could not insert pc_sync_task:', syncErr);
          }
        }

        success('បានកែប្រែព័ត៌មានសិស្សដោយជោគជ័យ');
      } else {
        const { error } = await supabase
          .from('students')
          .insert([payload]);
        
        if (error) throw error;
        success('បានបន្ថែមសិស្សថ្មីដោយជោគជ័យ');
      }
      
      setIsModalOpen(false);
      fetchStudents();
    } catch (error: any) {
      console.error('Error saving student:', error);
      toastError(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបសិស្ស "${name}" មែនទេ?`)) return;
    
    try {
      const studentToDelete = students.find(s => s.id === id);
      if (studentToDelete && studentToDelete.pc_number) {
        try {
          await supabase.from('pc_sync_tasks').insert([{
            id: crypto.randomUUID(),
            pc_number: studentToDelete.pc_number,
            student_id: studentToDelete.student_id,
            student_name: studentToDelete.name,
            action: 'REMOVE',
            password: null,
            status: 'PENDING',
            created_at: new Date().toISOString(),
            branch: studentToDelete.branch || '',
            academic_year: studentToDelete.academic_year || ''
          }]);
        } catch (err) {
          console.warn('Failed to queue remove task:', err);
        }
      }
      
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      
      setStudents(prev => prev.filter(s => s.id !== id));
      success(`បានលុបសិស្ស "${name}" ដោយជោគជ័យ`);
    } catch (error: any) {
      toastError(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  // Export filtered students to CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toastError('មិនមានទិន្នន័យសម្រាប់ Export ទេ');
      return;
    }

    const headers = ['Student ID', 'Khmer Name', 'English Name', 'Gender', 'Class', 'Shift', 'PC Desk', 'Password', 'Branch', 'Academic Year'];
    const rows = filteredStudents.map(s => [
      `"${s.student_id || ''}"`,
      `"${s.name || ''}"`,
      `"${s.english_name || ''}"`,
      `"${s.gender === 'M' ? 'ប្រុស' : 'ស្រី'}"`,
      `"${classesList.find(c => c.id === s.class)?.name || s.class || ''}"`,
      `"${s.shift || ''}"`,
      `"${s.pc_number || ''}"`,
      `"${s.password || ''}"`,
      `"${s.branch || ''}"`,
      `"${s.academic_year || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Students_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success(`បានទាញយកទិន្នន័យសិស្សចំនួន ${filteredStudents.length} នាក់ជា CSV`);
  };

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(students.map(s => s.class).filter(Boolean))).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const searchLower = search.toLowerCase().trim();
      const nameMatch = s.name ? s.name.toLowerCase().includes(searchLower) : false;
      const englishMatch = s.english_name ? s.english_name.toLowerCase().includes(searchLower) : false;
      const idMatch = s.student_id ? s.student_id.toLowerCase().includes(searchLower) : false;
      const pcMatch = s.pc_number ? s.pc_number.toLowerCase().includes(searchLower) : false;
      
      const matchesSearch = !searchLower || nameMatch || englishMatch || idMatch || pcMatch;
      const matchesClass = filterClass === 'All' || s.class === filterClass;
      const matchesShift = filterShift === 'All' || s.shift === filterShift;
      const matchesDesk = filterDesk === 'All' 
        || (filterDesk === 'ASSIGNED' ? !!s.pc_number : !s.pc_number);
      
      return matchesSearch && matchesClass && matchesShift && matchesDesk;
    });
  }, [students, search, filterClass, filterShift, filterDesk]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 font-khmer flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Users size={22} />
            </div>
            <span>ការគ្រប់គ្រងសិស្ស</span>
          </h1>
          <p className="text-slate-500 font-khmer text-xs sm:text-sm mt-1">
            សាខា៖ <strong className="text-blue-600">{selectedBranch}</strong> · សរុប <strong className="text-slate-800">{filteredStudents.length}</strong> នាក់
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-khmer font-bold transition-all shadow-2xs"
            title="ទាញយកជា CSV / Excel"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-khmer font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Plus size={17} />
            <span>បន្ថែមសិស្សថ្មី</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full h-10 pl-10 pr-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="ស្វែងរកតាម ID, ឈ្មោះ, ឬតុ..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Class Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">គ្រប់ថ្នាក់ទាំងអស់</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>
                  ថ្នាក់ {classesList.find(cl => cl.id === c)?.name || c}
                </option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
              value={filterShift}
              onChange={(e) => {
                setFilterShift(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">គ្រប់វេនរៀន</option>
              <option value="Morning">វេនព្រឹក</option>
              <option value="Afternoon">វេនរសៀល</option>
              <option value="Evening">វេនយប់</option>
            </select>
          </div>

          {/* Desk / PC Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
              value={filterDesk}
              onChange={(e) => {
                setFilterDesk(e.target.value as any);
                setCurrentPage(1);
              }}
            >
              <option value="All">គ្រប់ស្ថានភាពតុ</option>
              <option value="ASSIGNED">មានតុរួចរាល់</option>
              <option value="UNASSIGNED">មិនទាន់មានតុ</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs font-khmer text-slate-500">
          <span>ទិន្នន័យសរុប: <strong className="text-slate-800">{students.length}</strong></span>
          <span>·</span>
          <span>មានតុ: <strong className="text-emerald-600">{students.filter(s => s.pc_number).length}</strong></span>
          <span>·</span>
          <span>អត់ទាន់មានតុ: <strong className="text-amber-600">{students.filter(s => !s.pc_number).length}</strong></span>
          <span>·</span>
          <span>មាន Password: <strong className="text-blue-600">{students.filter(s => s.password).length}</strong></span>
        </div>
      </div>

      {/* Main Students Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 font-khmer flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">កំពុងទាញយកបញ្ជីសិស្ស...</p>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-khmer flex flex-col items-center justify-center gap-2">
            <Users size={36} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-600">មិនមានទិន្នន័យសិស្សទេ</p>
            <p className="text-xs text-slate-400">សូមសាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬការ Filter របស់អ្នក។</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-khmer font-bold">
                  <th className="px-5 py-3.5">អត្តលេខ</th>
                  <th className="px-5 py-3.5">ឈ្មោះសិស្ស</th>
                  <th className="px-5 py-3.5">ភេទ</th>
                  <th className="px-5 py-3.5">ថ្នាក់ / វេន</th>
                  <th className="px-5 py-3.5">តុ / PC</th>
                  <th className="px-5 py-3.5">Password</th>
                  <th className="px-5 py-3.5 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Student ID */}
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-700">
                      {s.student_id}
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 font-khmer">{s.name}</div>
                      {s.english_name && (
                        <div className="text-xs text-slate-400 font-medium">{s.english_name}</div>
                      )}
                    </td>

                    {/* Gender */}
                    <td className="px-5 py-3.5 font-khmer">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${s.gender === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                        {s.gender === 'M' ? 'ប្រុស' : 'ស្រី'}
                      </span>
                    </td>

                    {/* Class & Shift */}
                    <td className="px-5 py-3.5 font-khmer">
                      <div className="font-bold text-slate-800">
                        {classesList.find(c => c.id === s.class)?.name || s.class}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {s.shift === 'Morning' ? 'វេនព្រឹក' : s.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'}
                      </div>
                    </td>

                    {/* PC Number */}
                    <td className="px-5 py-3.5">
                      {s.pc_number ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                          <Monitor size={12} /> {s.pc_number}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] text-slate-400 italic font-khmer">
                          មិនទាន់មានតុ
                        </span>
                      )}
                    </td>

                    {/* Password */}
                    <td className="px-5 py-3.5">
                      {s.password ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs">
                          <Key size={11} className="text-slate-400" /> {s.password}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs italic font-khmer">គ្មាន</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(s)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="កែសម្រួល"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="លុប"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredStudents.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="សិស្ស"
        />
      </div>

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 font-khmer flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Users size={17} />
                </div>
                <span>{editingStudent ? 'កែប្រែព័ត៌មានសិស្ស' : 'បន្ថែមសិស្សថ្មី'}</span>
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">អត្តលេខសិស្ស *</label>
                  <input
                    type="text"
                    required
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="ឧ. 00123686"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ភេទ</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="M">ប្រុស</option>
                    <option value="F">ស្រី</option>
                  </select>
                </div>

                {/* Khmer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ឈ្មោះជាភាសាខ្មែរ *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="ឧ. ឌីណន សុវណ្ណភូមិ"
                  />
                </div>

                {/* English Name */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 font-khmer">ឈ្មោះជាភាសាអង់គ្លេស</label>
                    {formData.name && (
                      <button
                        type="button"
                        onClick={() => {
                          const trans = translateKhmerToEnglish(formData.name);
                          setFormData({ ...formData, english_name: trans });
                          info(`បានបកប្រែជា៖ ${trans}`);
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 font-khmer hover:underline cursor-pointer"
                      >
                        <Globe size={12} />
                        <span>បកប្រែស្វ័យប្រវត្តិ</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.english_name}
                    onChange={(e) => setFormData({ ...formData, english_name: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="ឧ. Dynon Sovannphum"
                  />
                </div>

                {/* Class */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ថ្នាក់រៀន *</label>
                  <select
                    value={formData.class}
                    onChange={(e) => {
                      const newCls = e.target.value;
                      const matched = classesList.find(c => c.id === newCls);
                      setFormData({
                        ...formData,
                        class: newCls,
                        shift: matched ? matched.shift : formData.shift
                      });
                    }}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                    required
                  >
                    <option value="">-- ជ្រើសរើសថ្នាក់ --</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} - វេន{c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">វេនសិក្សា</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Morning">វេនព្រឹក</option>
                    <option value="Afternoon">វេនរសៀល</option>
                    <option value="Evening">វេនយប់</option>
                  </select>
                </div>
              </div>

              {/* PC & Password Card */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-700 font-khmer flex items-center gap-1.5">
                  <Monitor size={15} className="text-blue-600" />
                  <span>ការចាត់តាំងតុ PC & លេខសម្ងាត់ Login</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PC Desk */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-khmer font-semibold">លេខតុ / PC (ឧ. PC-01)</label>
                    <input
                      type="text"
                      value={formData.pc_number}
                      onChange={(e) => setFormData({ ...formData, pc_number: e.target.value })}
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:border-blue-500 outline-none uppercase"
                      placeholder="PC-01"
                    />
                  </div>

                  {/* Password with Generator */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-600 font-khmer font-semibold">Password ចូល PC</label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 font-khmer inline-flex items-center gap-1"
                      >
                        <RefreshCw size={11} /> បង្កើតចៃដន្យ
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full h-10 pl-3.5 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:border-blue-500 outline-none"
                        placeholder="Lab!123456"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-khmer font-semibold hover:bg-slate-50 transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-khmer font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isSaving ? 'កំពុងរក្សាទុក...' : editingStudent ? 'កែប្រែព័ត៌មាន' : 'រក្សាទុកសិស្ស'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
