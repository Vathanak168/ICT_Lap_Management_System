import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Users, 
  ArrowUpRight
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

interface ClassInfo {
  id: string;
  name: string;
  shift: string;
  academic_year: string;
  branch: string;
  notes: string;
  studentCount?: number;
}

const Classes = () => {
  const { selectedBranch, selectedYear } = useOutletContext<{ selectedBranch: string; selectedYear: string }>();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterShift, setFilterShift] = useState('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    shift: 'Morning',
    academic_year: '2026-2027',
    branch: '',
    notes: ''
  });

  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchClasses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedYear]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      let query = supabase.from('classes').select('*').order('name', { ascending: true });
      let studentsQ = supabase.from('students').select('id, class');
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
        studentsQ = studentsQ.eq('branch', selectedBranch);
      }

      if (selectedYear && selectedYear !== 'All') {
        query = query.eq('academic_year', selectedYear);
        studentsQ = studentsQ.eq('academic_year', selectedYear);
      }

      const [classRes, studentsRes] = await Promise.all([query, studentsQ]);

      if (classRes.error) throw classRes.error;
      
      const loadedClasses = classRes.data || [];
      const loadedStudents = studentsRes.data || [];

      // Calculate student count per class
      const countMap = new Map<string, number>();
      loadedStudents.forEach((s: any) => {
        if (s.class) {
          countMap.set(s.class, (countMap.get(s.class) || 0) + 1);
        }
      });

      const enrichedClasses = loadedClasses.map((c: any) => ({
        ...c,
        studentCount: countMap.get(c.id) || 0
      }));

      enrichedClasses.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
      setClasses(enrichedClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toastError('បរាជ័យក្នុងការទាញយកទិន្នន័យថ្នាក់រៀន');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cls?: ClassInfo) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({
        id: cls.id || '',
        name: cls.name || '',
        shift: cls.shift || 'Morning',
        academic_year: cls.academic_year || (selectedYear !== 'All' ? selectedYear : '2026-2027'),
        branch: cls.branch || (selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 25'),
        notes: cls.notes || ''
      });
    } else {
      setEditingClass(null);
      setFormData({
        id: '',
        name: '',
        shift: 'Morning',
        academic_year: selectedYear !== 'All' ? selectedYear : '2026-2027',
        branch: selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 25',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const payload = {
        name: formData.name.trim(),
        shift: formData.shift,
        academic_year: formData.academic_year,
        branch: formData.branch,
        notes: formData.notes.trim()
      };

      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', editingClass.id);

        if (error) throw error;
        success('បានកែប្រែព័ត៌មានថ្នាក់ដោយជោគជ័យ');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([payload]);

        if (error) throw error;
        success('បានបង្កើតថ្នាក់ថ្មីដោយជោគជ័យ');
      }

      setIsModalOpen(false);
      fetchClasses();
    } catch (error: any) {
      console.error('Error saving class:', error);
      toastError(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបថ្នាក់ "${name}" មែនទេ? (សិស្សក្នុងថ្នាក់នេះនឹងបាត់បង់ការចាត់ថ្នាក់)`)) return;

    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      setClasses(prev => prev.filter(c => c.id !== id));
      success(`បានលុបថ្នាក់ "${name}" ដោយជោគជ័យ`);
    } catch (error: any) {
      toastError(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase().trim());
      const matchShift = filterShift === 'All' || c.shift === filterShift;
      return matchSearch && matchShift;
    });
  }, [classes, search, filterShift]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 font-khmer flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <GraduationCap size={22} />
            </div>
            <span>ការគ្រប់គ្រងថ្នាក់រៀន</span>
          </h1>
          <p className="text-slate-500 font-khmer text-xs sm:text-sm mt-1">
            សាខា៖ <strong className="text-blue-600">{selectedBranch}</strong> · សរុប <strong className="text-slate-800">{filteredClasses.length}</strong> ថ្នាក់
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-khmer font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
        >
          <Plus size={17} />
          <span>បង្កើតថ្នាក់ថ្មី</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full h-10 pl-10 pr-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="ស្វែងរកឈ្មោះថ្នាក់រៀន..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative w-full sm:w-56">
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="All">គ្រប់វេនសិក្សា</option>
              <option value="Morning">វេនព្រឹក</option>
              <option value="Afternoon">វេនរសៀល</option>
              <option value="Evening">វេនយប់</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-khmer w-full sm:w-auto text-right">
          បង្ហាញ <strong>{filteredClasses.length}</strong> នៃ <strong>{classes.length}</strong> ថ្នាក់
        </div>
      </div>

      {/* Grid of Class Cards */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-khmer flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">កំពុងទាញយកបញ្ជីថ្នាក់រៀន...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="py-20 text-center text-slate-400 font-khmer flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
          <GraduationCap size={40} className="text-slate-300" />
          <p className="text-sm font-bold text-slate-600">មិនមានទិន្នន័យថ្នាក់រៀនទេ</p>
          <p className="text-xs text-slate-400">សូមបង្កើតថ្នាក់ថ្មី ឬជ្រើសរើសសាខាផ្សេង។</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredClasses.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base font-sans">
                      {c.name.slice(0, 3)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-khmer">
                        ថ្នាក់ {c.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold font-khmer ${c.shift === 'Morning' ? 'bg-blue-50 text-blue-700' : c.shift === 'Afternoon' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
                          {c.shift === 'Morning' ? 'វេនព្រឹក' : c.shift === 'Afternoon' ? 'វេនរសៀល' : 'វេនយប់'}
                        </span>
                        <span className="text-xs text-slate-400 font-sans">{c.academic_year}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenModal(c)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="កែសម្រួល"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="លុប"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {c.notes && (
                  <p className="text-xs text-slate-500 font-khmer line-clamp-2 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {c.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-khmer font-semibold">
                  <Users size={14} className="text-blue-600" />
                  <span>សិស្ស៖ <strong className="text-slate-900 font-bold">{c.studentCount} នាក់</strong></span>
                </div>

                <button
                  onClick={() => navigate(`/students`)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 font-khmer group-hover:translate-x-0.5 transition-transform"
                >
                  <span>បញ្ជីសិស្ស</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 font-khmer flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <GraduationCap size={17} />
                </div>
                <span>{editingClass ? 'កែប្រែព័ត៌មានថ្នាក់' : 'បង្កើតថ្នាក់រៀនថ្មី'}</span>
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ឈ្មោះថ្នាក់រៀន *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="ឧ. 4A1, 7A2, Grade 12"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">វេនសិក្សា</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Morning">វេនព្រឹក</option>
                    <option value="Afternoon">វេនរសៀល</option>
                    <option value="Evening">វេនយប់</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ឆ្នាំសិក្សា</label>
                  <input
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-sans focus:border-indigo-500 outline-none"
                    placeholder="2026-2027"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">សាខា</label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:border-indigo-500 outline-none"
                  placeholder="BELTEI IS 25"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">កំណត់សម្គាល់</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:border-indigo-500 outline-none resize-none"
                  placeholder="ព័ត៌មានបន្ថែមអំពីថ្នាក់..."
                />
              </div>

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
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-khmer font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
                >
                  {isSaving ? 'កំពុងរក្សាទុក...' : editingClass ? 'កែប្រែថ្នាក់' : 'បង្កើតថ្នាក់'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
