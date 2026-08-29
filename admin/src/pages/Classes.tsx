import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Monitor, Search, Plus, Edit2, Trash2, X } from 'lucide-react';

interface ClassInfo {
  id: string;
  name: string;
  shift: string;
  academic_year: string;
  branch: string;
  notes: string;
}

const Classes = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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

  useEffect(() => {
    if (selectedBranch === 'None') {
      setClasses([]);
      return;
    }
    fetchClasses();
  }, [selectedBranch]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      let query = supabase.from('classes').select('*').order('name', { ascending: true });
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
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
        academic_year: cls.academic_year || '2026-2027',
        branch: cls.branch || (selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 1'),
        notes: cls.notes || ''
      });
    } else {
      setEditingClass(null);
      setFormData({
        id: '',
        name: '',
        shift: 'Morning',
        academic_year: '2026-2027',
        branch: selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 1',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name,
            shift: formData.shift,
            academic_year: formData.academic_year,
            branch: formData.branch,
            notes: formData.notes
          })
          .eq('id', editingClass.id);
          
        if (error) throw error;
        setClasses(classes.map(c => c.id === editingClass.id ? { ...c, ...formData } : c));

        if (formData.shift !== editingClass.shift) {
          const updates = { shift: formData.shift };
          
          await supabase
            .from('students')
            .update(updates)
            .eq('class', editingClass.id)
            .eq('academic_year', formData.academic_year);
            
          await Promise.all([
            supabase.from('attendance').update(updates).eq('class_id', editingClass.id),
            supabase.from('grades').update(updates).eq('class_id', editingClass.id),
            supabase.from('seating_plans').update(updates).eq('class_id', editingClass.id),
            supabase.from('lesson_logs').update(updates).eq('class_id', editingClass.id)
          ]);
        }
      } else {
        // If it's new, check if ID needs generating
        let finalId = formData.id;
        if (!finalId) {
           finalId = crypto.randomUUID();
        }
        
        const newClass = { ...formData, id: finalId };
        const { data, error } = await supabase
          .from('classes')
          .insert([newClass])
          .select()
          .single();
          
        if (error) throw error;
        if (data) setClasses([...classes, data]);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការរក្សាទុក: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបថ្នាក់ "${name}" មែនទេ?`)) return;
    
    try {
      const [studentRes] = await Promise.all([
        supabase.from('students').delete().eq('class', id),
        supabase.from('attendance').delete().eq('class_id', id),
        supabase.from('grades').delete().eq('class_id', id),
        supabase.from('seating_plans').delete().eq('class_id', id),
        supabase.from('lesson_logs').delete().eq('class_id', id),
        supabase.from('lesson_plans').delete().eq('class_id', id) // Also clean up lesson plans linked to class
      ]);
      
      if (studentRes.error) {
        console.error('Failed to cascade delete students:', studentRes.error);
        // Continue to delete the class anyway, or throw?
        // Let's not throw, but log it.
      }

      // 2. Delete the class
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      
      setClasses(classes.filter(c => c.id !== id));
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Monitor size={24} />
            </div>
            ថ្នាក់រៀន
          </h1>
          <p className="text-slate-500 font-khmer text-sm">
            កំពុងបង្ហាញទិន្នន័យសម្រាប់៖ <strong className="text-blue-600">{selectedBranch === 'None' ? 'មិនទាន់ជ្រើសរើសសាខា' : (selectedBranch === 'All' ? 'គ្រប់សាខាទាំងអស់' : selectedBranch)}</strong>
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer"
              placeholder="ស្វែងរកលេខបន្ទប់..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-indigo-500/20 h-11 px-6 rounded-xl" 
            disabled={selectedBranch === 'None'}
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-khmer">ថ្នាក់ថ្មី</span>
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {selectedBranch === 'None' ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Monitor size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">សូមជ្រើសរើសសាខា</h2>
            <p className="text-slate-500 font-khmer">អ្នកត្រូវជ្រើសរើសសាខាណាមួយនៅខាងលើសិន ទើបអាចមើល ឬកែប្រែទិន្នន័យថ្នាក់រៀនបាន។</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">លេខបន្ទប់</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">វេនសិក្សា</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ឆ្នាំសិក្សា</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">សាខា</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-khmer">
                      កំពុងទាញយកទិន្នន័យ...
                    </td>
                  </tr>
                ) : filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-khmer">
                      មិនមានទិន្នន័យ
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-500">ID: {c.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
                          {c.shift}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{c.academic_year}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                          {c.branch}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(c)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id, c.name)}
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

      {/* Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 font-khmer flex items-center gap-2">
                <Monitor className="text-indigo-500" size={24} />
                {editingClass ? 'កែប្រែព័ត៌មានថ្នាក់' : 'បន្ថែមថ្នាក់ថ្មី'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ID ថ្នាក់រៀន</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingClass}
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="ឧ. 2026-2027_6A1_Morning (បើមិនបញ្ជូល វានឹងបង្កើតដោយស្វ័យប្រវត្តិ)"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">មិនអាចកែប្រែបានទេបន្ទាប់ពីបង្កើតរួច</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ឈ្មោះថ្នាក់</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឧ. 6A1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">វេនសិក្សា</label>
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
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ចំណាំ (បើមាន)</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer min-h-[100px] resize-y"
                    placeholder="បញ្ចូលចំណាំផ្សេងៗ..."
                  ></textarea>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium font-khmer rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
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

export default Classes;
