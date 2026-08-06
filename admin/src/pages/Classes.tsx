import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Monitor, Search, Plus, Edit2, Trash2 } from 'lucide-react';

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
      let query = supabase.from('classes').select('*');
      
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
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              className="input-field pl-10 bg-white"
              placeholder="ស្វែងរកលេខបន្ទប់..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          <button className="btn-primary flex items-center gap-2 whitespace-nowrap" disabled={selectedBranch === 'None'}>
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
                          <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 size={18} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
    </div>
  );
};

export default Classes;
