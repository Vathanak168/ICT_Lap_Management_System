import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Users, Search, Plus, Edit2, Trash2, X, Filter, ChevronDown } from 'lucide-react';

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
}

const Students = () => {
  const { selectedBranch, selectedYear } = useOutletContext<{ selectedBranch: string, selectedYear: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    english_name: '',
    gender: 'M',
    class: '',
    shift: 'Morning',
    branch: '',
    academic_year: '2026-2027',
    status: 'Active'
  });

  useEffect(() => {
    setFilterClass('All'); // Reset class filter when branch/year changes
    if (selectedBranch === 'None' || selectedYear === 'None') {
      setStudents([]);
      return;
    }
    fetchStudents();
  }, [selectedBranch, selectedYear]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase.from('students').select('*').order('student_id');
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }
      
      if (selectedYear !== 'All') {
        query = query.eq('academic_year', selectedYear);
      }

      let classQuery = supabase.from('classes').select('*');
      if (selectedBranch !== 'All') classQuery = classQuery.eq('branch', selectedBranch);
      if (selectedYear !== 'All') classQuery = classQuery.eq('academic_year', selectedYear);

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
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        student_id: student.student_id || '',
        name: student.name || '',
        english_name: student.english_name || '',
        gender: student.gender || 'M',
        class: student.class || '',
        shift: student.shift || 'Morning',
        branch: student.branch || (selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 1'),
        academic_year: student.academic_year || '2026-2027',
        status: student.status || 'Active'
      });
    } else {
      setEditingStudent(null);
      setFormData({
        student_id: '',
        name: '',
        english_name: '',
        gender: 'M',
        class: '',
        shift: 'Morning',
        branch: selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 1',
        academic_year: '2026-2027',
        status: 'Active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(formData)
          .eq('id', editingStudent.id);
          
        if (error) throw error;
        setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...formData } : s));
      } else {
        const { data, error } = await supabase
          .from('students')
          .insert([formData])
          .select()
          .single();
          
        if (error) throw error;
        if (data) setStudents([...students, data]);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការរក្សាទុក: ${error.message}`);
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
          const newTask = {
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
          };
          await supabase.from('pc_sync_tasks').insert([newTask]);
        } catch (err) {
          console.error('Failed to create pc sync task in admin', err);
        }
      }
      
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      
      setStudents(students.filter(s => s.id !== id));
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  const uniqueClasses = Array.from(new Set(students.map(s => s.class).filter(Boolean))).sort();

  const filteredStudents = students.filter(s => {
    const searchLower = search.toLowerCase();
    const nameMatch = s.name ? s.name.toLowerCase().includes(searchLower) : false;
    const englishMatch = s.english_name ? s.english_name.toLowerCase().includes(searchLower) : false;
    const idMatch = s.student_id ? s.student_id.toLowerCase().includes(searchLower) : false;
    const branchMatch = s.branch ? s.branch.toLowerCase().includes(searchLower) : false;
    
    const matchesSearch = nameMatch || englishMatch || idMatch || branchMatch;
      
    const matchesClass = filterClass === 'All' || s.class === filterClass;
    
    return matchesSearch && matchesClass;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <Users size={24} />
            </div>
            សិស្ស
          </h1>
          <p className="text-slate-500 font-khmer text-sm">
            កំពុងបង្ហាញទិន្នន័យសម្រាប់៖ <strong className="text-blue-600">{selectedBranch === 'None' ? 'មិនទាន់ជ្រើសរើសសាខា' : (selectedBranch === 'All' ? 'គ្រប់សាខាទាំងអស់' : selectedBranch)}</strong>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer"
              placeholder="ស្វែងរកអត្តលេខ ឬឈ្មោះ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          
          <div className="relative group w-full sm:w-48">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Filter size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <select
              className="w-full h-11 pl-11 pr-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 appearance-none cursor-pointer hover:border-slate-300"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              disabled={selectedBranch === 'None' || uniqueClasses.length === 0}
            >
              <option value="All">គ្រប់ថ្នាក់ទាំងអស់</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>ថ្នាក់ {classesList.find(cl => cl.id === c)?.name || c}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
              <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20 h-11 px-6 rounded-xl" 
            disabled={selectedBranch === 'None'}
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-khmer">សិស្សថ្មី</span>
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {selectedBranch === 'None' ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Users size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">សូមជ្រើសរើសសាខា</h2>
            <p className="text-slate-500 font-khmer">អ្នកត្រូវជ្រើសរើសសាខាណាមួយនៅខាងលើសិន ទើបអាចមើល ឬកែប្រែទិន្នន័យសិស្សបាន។</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">អត្តលេខ</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ឈ្មោះសិស្ស</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ភេទ</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ថ្នាក់រៀន (វេន)</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ឆ្នាំសិក្សា</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">សាខា</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-khmer">
                      កំពុងទាញយកទិន្នន័យ...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-khmer">
                      មិនមានទិន្នន័យ
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-700">{s.student_id}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 font-khmer">{s.name}</p>
                        <p className="text-xs text-slate-500 font-khmer">{s.english_name}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-khmer">{s.gender === 'M' ? 'ប្រុស' : 'ស្រី'}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800 font-khmer">
                          {classesList.find(c => c.id === s.class)?.name || s.class}
                        </p>
                        <p className="text-xs text-slate-500 font-khmer">{s.shift}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                          {s.academic_year || 'មិនមាន'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold font-khmer">
                          {s.branch}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(s)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 font-khmer">
                {editingStudent ? 'កែប្រែព័ត៌មានសិស្ស' : 'បន្ថែមសិស្សថ្មី'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">អត្តលេខសិស្ស *</label>
                  <input
                    type="text"
                    required
                    value={formData.student_id}
                    onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឧ. 001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ឈ្មោះ (ខ្មែរ) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឧ. សុខ សាន្ត"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ឈ្មោះ (អង់គ្លេស)</label>
                  <input
                    type="text"
                    value={formData.english_name}
                    onChange={(e) => setFormData({...formData, english_name: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឧ. Sok San"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ភេទ</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                  >
                    <option value="M">ប្រុស (M)</option>
                    <option value="F">ស្រី (F)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ថ្នាក់រៀន</label>
                  <select
                    value={formData.class}
                    onChange={(e) => {
                      const newClassId = e.target.value;
                      const matchedClass = classesList.find(c => c.id === newClassId);
                      setFormData({
                        ...formData, 
                        class: newClassId,
                        shift: matchedClass ? matchedClass.shift : formData.shift
                      });
                    }}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    required
                  >
                    <option value="">ជ្រើសរើសថ្នាក់</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - វេន{c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">វេន</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({...formData, shift: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                  >
                    <option value="Morning">ព្រឹក (Morning)</option>
                    <option value="Afternoon">រសៀល (Afternoon)</option>
                    <option value="Evening">យប់ (Evening)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">សាខា</label>
                  <select
                    value={formData.branch}
                    onChange={(e) => setFormData({...formData, branch: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                  >
                    {Array.from({ length: 32 }, (_, i) => (
                      <option key={i + 1} value={`BELTEI IS ${i + 1}`}>BELTEI IS {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ឆ្នាំសិក្សា</label>
                  <input
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({...formData, academic_year: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឧ. 2026-2027"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ស្ថានភាព</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                  >
                    <option value="Active">សកម្ម (Active)</option>
                    <option value="Inactive">អសកម្ម (Inactive)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-medium font-khmer hover:bg-slate-100 rounded-xl transition-colors"
                >
                  បោះបង់
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-orange-500 text-white font-medium font-khmer rounded-xl hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
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
