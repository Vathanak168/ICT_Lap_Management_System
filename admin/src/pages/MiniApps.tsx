import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { AppWindow, Search, Plus, Edit2, Trash2 } from 'lucide-react';

interface MiniApp {
  id: string;
  name: string;
  url: string;
  icon_url: string;
  branch: string;
}

const MiniApps = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [apps, setApps] = useState<MiniApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', url: '', icon_url: '', branch: 'ទូទៅ' });

  useEffect(() => {
    fetchApps();
  }, [selectedBranch]);

  const fetchApps = async () => {
    try {
      setLoading(true);
      let query = supabase.from('mini_apps').select('*').order('created_at', { ascending: false });
      
      // If a specific branch is selected, show Global apps + Branch-specific apps
      if (selectedBranch !== 'None' && selectedBranch !== 'All') {
        query = query.in('branch', ['ទូទៅ', selectedBranch]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setApps(data || []);
    } catch (error) {
      console.error('Error fetching mini apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (app?: MiniApp) => {
    if (app) {
      setEditingId(app.id);
      setFormData({ name: app.name, url: app.url, icon_url: app.icon_url, branch: app.branch });
    } else {
      setEditingId(null);
      setFormData({ name: '', url: '', icon_url: '', branch: selectedBranch !== 'None' && selectedBranch !== 'All' ? selectedBranch : 'ទូទៅ' });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase.from('mini_apps').update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mini_apps').insert([formData]);
        if (error) throw error;
      }
      setShowModal(false);
      fetchApps();
    } catch (error) {
      console.error('Error saving app:', error);
      alert('មានបញ្ហាក្នុងការរក្សាទុក។');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('តើអ្នកពិតជាចង់លុបកម្មវិធីនេះមែនទេ?')) return;
    try {
      const { error } = await supabase.from('mini_apps').delete().eq('id', id);
      if (error) throw error;
      fetchApps();
    } catch (error) {
      console.error('Error deleting app:', error);
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <AppWindow size={24} />
            </div>
            Mini Apps
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
              placeholder="ស្វែងរកឈ្មោះកម្មវិធី..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => handleOpenModal()} 
            className="btn-primary flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-indigo-500/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-khmer">បន្ថែម App</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-8 p-6 bg-slate-50/50 rounded-3xl border border-slate-200/50 shadow-inner min-h-[400px]">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-khmer">កំពុងទាញយកទិន្នន័យ...</div>
        ) : filteredApps.length === 0 ? (
          <div className="col-span-full py-12 text-center flex flex-col items-center justify-center">
            <AppWindow size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">មិនមានកម្មវិធីទេ</h2>
            <p className="text-slate-500 font-khmer">សូមចុចប៊ូតុង "បន្ថែម App" ដើម្បីបង្កើត Mini App ថ្មីមួយ។</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <div key={app.id} className="flex flex-col items-center group relative animate-in fade-in zoom-in-95 duration-300">
              {/* Action Buttons visible on hover */}
              <div className="absolute -top-2 -right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
                <button 
                  onClick={(e) => { e.preventDefault(); handleOpenModal(app); }} 
                  className="w-7 h-7 flex items-center justify-center bg-white/95 backdrop-blur text-blue-600 rounded-full shadow-md hover:bg-blue-50 border border-slate-100 transition-colors"
                  title="កែប្រែ"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); handleDelete(app.id); }} 
                  className="w-7 h-7 flex items-center justify-center bg-white/95 backdrop-blur text-red-600 rounded-full shadow-md hover:bg-red-50 border border-slate-100 transition-colors"
                  title="លុប"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <a 
                href={app.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 w-full active:scale-95 transition-transform duration-200 cursor-pointer"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22%] bg-white p-2.5 shadow-sm border border-slate-200/60 group-hover:shadow-md transition-all duration-300 flex items-center justify-center overflow-hidden relative group-hover:-translate-y-1">
                  <img 
                    src={app.icon_url} 
                    alt={app.name} 
                    className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300 ease-out relative z-10"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/128x128/png?text=APP' }}
                  />
                  {/* Glass reflection effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none z-20"></div>
                </div>
                <div className="text-center w-full px-1 flex flex-col items-center">
                  <h3 className="text-xs sm:text-sm font-medium text-slate-700 truncate w-full group-hover:text-blue-600 transition-colors">{app.name}</h3>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate w-full mt-0.5">
                    {app.branch === 'ទូទៅ' ? 'ទូទៅ' : app.branch?.replace('BELTEI IS ', 'B-')}
                  </span>
                </div>
              </a>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 font-khmer">
                {editingId ? 'កែប្រែ Mini App' : 'បន្ថែម Mini App ថ្មី'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-khmer">ឈ្មោះ App *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer" 
                  placeholder="ឧ. Google Drive"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-khmer">Link (URL) *</label>
                <input 
                  type="url" 
                  required 
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer" 
                  placeholder="https://drive.google.com"
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-khmer">Link រូបភាព *</label>
                <input 
                  type="url" 
                  required 
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer" 
                  placeholder="https://example.com/logo.png"
                  value={formData.icon_url}
                  onChange={e => setFormData({...formData, icon_url: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-khmer">សម្រាប់សាខា</label>
                <select 
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700"
                  value={formData.branch}
                  onChange={e => setFormData({...formData, branch: e.target.value})}
                >
                  <option value="ទូទៅ">ទូទៅ (គ្រប់សាខា)</option>
                  {Array.from({ length: 32 }, (_, i) => (
                    <option key={i + 1} value={`BELTEI IS ${i + 1}`}>BELTEI IS {i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  បោះបង់
                </button>
                <button type="submit" className="btn-primary py-2.5">
                  រក្សាទុក
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniApps;
