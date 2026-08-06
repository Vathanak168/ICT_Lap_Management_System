import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Users, Search, Plus, Edit2, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  student_id: string;
  name: string;
  english_name: string;
  gender: string;
  class: string;
  shift: string;
  branch: string;
  status: string;
}

const Students = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selectedBranch === 'None') {
      setStudents([]);
      return;
    }
    fetchStudents();
  }, [selectedBranch]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase.from('students').select('*');
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.english_name && s.english_name.toLowerCase().includes(search.toLowerCase())) ||
    s.student_id.toLowerCase().includes(search.toLowerCase())
  );

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
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              className="input-field pl-10 bg-white"
              placeholder="ស្វែងរកអត្តលេខ ឬឈ្មោះ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          <button className="btn-primary flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20" disabled={selectedBranch === 'None'}>
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
                        <p className="font-bold text-slate-800">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.english_name}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{s.gender}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{s.class}</p>
                        <p className="text-xs text-slate-500">{s.shift}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                          {s.branch}
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

export default Students;
