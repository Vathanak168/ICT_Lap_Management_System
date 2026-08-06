import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { AppWindow, Search, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';

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
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              className="input-field pl-10 bg-white"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-khmer">កំពុងទាញយកទិន្នន័យ...</div>
        ) : filteredApps.length === 0 ? (
          <div className="col-span-full card py-12 text-center flex flex-col items-center justify-center">
            <AppWindow size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">មិនមានកម្មវិធីទេ</h2>
            <p className="text-slate-500 font-khmer">សូមចុចប៊ូតុង "បន្ថែម App" ដើម្បីបង្កើត Mini App ថ្មីមួយ។</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <div key={app.id} className="card p-5 flex flex-col group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 p-2 shadow-sm border border-slate-200">
                  <img 
                    src={app.icon_url} 
                    alt={app.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=APP' }}
                  />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(app)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(app.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-800 mb-1">{app.name}</h3>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                  {app.branch}
                </span>
                <a 
                  href={app.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  បើក <ExternalLink size={14} />
                </a>
              </div>
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
                  className="input-field py-2" 
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
                  className="input-field py-2" 
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
                  className="input-field py-2" 
                  placeholder="https://example.com/logo.png"
                  value={formData.icon_url}
                  onChange={e => setFormData({...formData, icon_url: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-khmer">សម្រាប់សាខា</label>
                <select 
                  className="input-field py-2"
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
