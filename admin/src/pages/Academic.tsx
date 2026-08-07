import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, Search, BookMarked, Calendar, CheckSquare, Award, Trash2 } from 'lucide-react';

const Academic = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [activeTab, setActiveTab] = useState<'lessons' | 'attendance' | 'grades' | 'seating'>('lessons');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedBranch === 'None') {
      setData([]);
      return;
    }
    fetchData();
  }, [activeTab, selectedBranch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let tableName = '';
      
      switch (activeTab) {
        case 'lessons': tableName = 'lesson_logs'; break;
        case 'attendance': tableName = 'attendance'; break;
        case 'grades': tableName = 'grades'; break;
        case 'seating': tableName = 'seating_plans'; break;
      }

      let query = supabase.from(tableName).select('*').order('id', { ascending: false }).limit(50);
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }

      const { data, error } = await query;
      if (error) throw error;
      setData(data || []);
    } catch (error) {
      console.error('Error fetching academic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?')) return;

    let tableName = '';
    switch (activeTab) {
      case 'lessons': tableName = 'lesson_logs'; break;
      case 'attendance': tableName = 'attendance'; break;
      case 'grades': tableName = 'grades'; break;
      case 'seating': tableName = 'seating_plans'; break;
    }

    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      setData(data.filter(item => item.id !== id));
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  const tabs = [
    { id: 'lessons', label: 'កំណត់ហេតុបង្រៀន', icon: <BookMarked size={18} /> },
    { id: 'attendance', label: 'បញ្ជីវត្តមាន', icon: <CheckSquare size={18} /> },
    { id: 'grades', label: 'ពិន្ទុសិស្ស', icon: <Award size={18} /> },
    { id: 'seating', label: 'ប្លង់តុ', icon: <Calendar size={18} /> },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
          <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
            <BookOpen size={24} />
          </div>
          ការគ្រប់គ្រងការសិក្សា
        </h1>
        <p className="text-slate-500 font-khmer text-sm">
          កំពុងបង្ហាញទិន្នន័យសម្រាប់៖ <strong className="text-blue-600">{selectedBranch === 'None' ? 'មិនទាន់ជ្រើសរើសសាខា' : (selectedBranch === 'All' ? 'គ្រប់សាខាទាំងអស់' : selectedBranch)}</strong>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            disabled={selectedBranch === 'None'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-khmer font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card p-6 min-h-[400px]">
        {selectedBranch === 'None' ? (
          <div className="flex-center h-full text-center flex-col gap-4 text-slate-500 font-khmer py-12">
            <BookOpen size={48} className="text-slate-300" />
            <h2 className="text-xl font-bold text-slate-700">សូមជ្រើសរើសសាខា</h2>
            <p>អ្នកត្រូវជ្រើសរើសសាខាណាមួយនៅខាងលើសិន ទើបអាចមើលទិន្នន័យសិក្សាបាន។</p>
          </div>
        ) : loading ? (
          <div className="flex-center h-40 text-slate-500 font-khmer">កំពុងទាញយកទិន្នន័យ...</div>
        ) : data.length === 0 ? (
          <div className="flex-center h-40 text-slate-500 font-khmer flex-col gap-2">
            <BookOpen size={40} className="text-slate-300 mb-2" />
            មិនមានទិន្នន័យ {tabs.find(t => t.id === activeTab)?.label} ទេនៅក្នុងសាខានេះ។
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 font-khmer font-semibold text-slate-600 text-sm">ID / ថ្នាក់</th>
                  <th className="px-4 py-3 font-khmer font-semibold text-slate-600 text-sm">ព័ត៌មានលម្អិត</th>
                  <th className="px-4 py-3 font-khmer font-semibold text-slate-600 text-sm">សាខា</th>
                  <th className="px-4 py-3 font-khmer font-semibold text-slate-600 text-sm text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{item.class_id || item.id}</p>
                      <p className="text-xs text-slate-500">វេន: {item.shift}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-md truncate">
                      {activeTab === 'lessons' && <span>មេរៀន: {item.topic} (បង្រៀនដោយ: {item.teacher_name})</span>}
                      {activeTab === 'attendance' && <span>កាលបរិច្ឆេទ: {item.date}</span>}
                      {activeTab === 'grades' && <span>ខែ: {item.month} ({item.type})</span>}
                      {activeTab === 'seating' && <span>បានបង្កើត: {new Date(item.created_at).toLocaleDateString()}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                        {item.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="លុបទិន្នន័យនេះ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Academic;
