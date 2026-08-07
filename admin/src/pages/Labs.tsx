import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Monitor, Search, Filter, AlertTriangle, CheckCircle2, Clock, Plus, Edit2, Trash2, X } from 'lucide-react';

interface PCIssue {
  id: string;
  pc_number: string;
  description: string;
  status: string;
  reported_by: string;
  reported_date: string;
  resolved_date: string | null;
  branch: string;
}

const Labs = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [issues, setIssues] = useState<PCIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Resolved'>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<PCIssue | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    pc_number: '',
    description: '',
    status: 'Pending',
    reported_by: '',
    branch: ''
  });

  useEffect(() => {
    if (selectedBranch === 'None') {
      setIssues([]);
      return;
    }
    fetchIssues();
  }, [selectedBranch]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      let query = supabase.from('pc_issues').select('*').order('reported_date', { ascending: false });
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }

      const { data, error } = await query;
      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Error fetching pc issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIssue = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pc_issues')
        .update({
          status: 'Resolved',
          resolved_date: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      fetchIssues(); // Refresh list
    } catch (error) {
      console.error('Error resolving issue:', error);
      alert('មានបញ្ហាក្នុងការកែប្រែស្ថានភាព។');
    }
  };

  const handleOpenModal = (issue?: PCIssue) => {
    if (issue) {
      setEditingIssue(issue);
      setFormData({
        pc_number: issue.pc_number || '',
        description: issue.description || '',
        status: issue.status || 'Pending',
        reported_by: issue.reported_by || '',
        branch: issue.branch || (selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 1')
      });
    } else {
      setEditingIssue(null);
      setFormData({
        pc_number: '',
        description: '',
        status: 'Pending',
        reported_by: '',
        branch: selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 1'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (editingIssue) {
        const { error } = await supabase
          .from('pc_issues')
          .update(formData)
          .eq('id', editingIssue.id);
          
        if (error) throw error;
        setIssues(issues.map(i => i.id === editingIssue.id ? { ...i, ...formData } : i));
      } else {
        const newIssue = { 
          ...formData, 
          reported_date: new Date().toISOString() 
        };
        const { data, error } = await supabase
          .from('pc_issues')
          .insert([newIssue])
          .select()
          .single();
          
        if (error) throw error;
        if (data) setIssues([data, ...issues]);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការរក្សាទុក: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, pcNum: string) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបបញ្ហាកុំព្យូទ័រ ${pcNum} មែនទេ?`)) return;
    
    try {
      const { error } = await supabase.from('pc_issues').delete().eq('id', id);
      if (error) throw error;
      
      setIssues(issues.filter(i => i.id !== id));
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.pc_number.toLowerCase().includes(search.toLowerCase()) || 
                          issue.description.toLowerCase().includes(search.toLowerCase()) ||
                          issue.reported_by.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' ? true : issue.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Monitor size={24} />
            </div>
            គ្រប់គ្រងកុំព្យូទ័រ
          </h1>
          <p className="text-slate-500 font-khmer text-sm">
            កំពុងបង្ហាញទិន្នន័យសម្រាប់៖ <strong className="text-blue-600">{selectedBranch === 'None' ? 'មិនទាន់ជ្រើសរើសសាខា' : (selectedBranch === 'All' ? 'គ្រប់សាខាទាំងអស់' : selectedBranch)}</strong>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer"
              placeholder="ស្វែងរក PC ឬបញ្ហា..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Filter size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <select
              className="w-full h-11 pl-11 pr-8 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 appearance-none cursor-pointer"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              disabled={selectedBranch === 'None'}
            >
              <option value="All">ទាំងអស់</option>
              <option value="Pending">កំពុងខូច (Pending)</option>
              <option value="Resolved">ជួសជុលរួច (Resolved)</option>
            </select>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/20 h-11 px-6 rounded-xl" 
            disabled={selectedBranch === 'None'}
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-khmer">បញ្ហាថ្មី</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {selectedBranch === 'None' ? (
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <Monitor size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">សូមជ្រើសរើសសាខា</h2>
            <p className="text-slate-500 font-khmer">អ្នកត្រូវជ្រើសរើសសាខាណាមួយនៅខាងលើសិន ទើបអាចមើលបញ្ហាកុំព្យូទ័របាន។</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-slate-500 font-khmer">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-12 card text-slate-500 font-khmer">
            មិនមានរបាយការណ៍កុំព្យូទ័រទេ
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="card p-5 hover:shadow-md transition-shadow group flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex-center shadow-inner ${
                issue.status === 'Pending' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'
              }`}>
                {issue.status === 'Pending' ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <h3 className="text-lg font-bold text-slate-800">{issue.pc_number}</h3>
                  {issue.status === 'Pending' ? (
                    <span className="badge-inactive bg-red-100 text-red-700 border-red-200">
                      កំពុងខូច
                    </span>
                  ) : (
                    <span className="badge-active bg-emerald-100 text-emerald-700 border-emerald-200">
                      ជួសជុលរួច
                    </span>
                  )}
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold ml-auto">
                    {issue.branch}
                  </span>
                </div>
                <p className="text-slate-700 font-khmer text-sm mb-2 leading-relaxed">{issue.description}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> រាយការណ៍៖ {new Date(issue.reported_date).toLocaleDateString()}
                  </span>
                  <span>រាយការណ៍ដោយ៖ {issue.reported_by}</span>
                  {issue.resolved_date && (
                    <span className="text-emerald-600">
                      ជួសជុលនៅ៖ {new Date(issue.resolved_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              
              {issue.status === 'Pending' && (
                <div className="shrink-0 mt-4 sm:mt-0">
                  <button 
                    onClick={() => handleResolveIssue(issue.id)}
                    className="btn-primary py-2 px-4 flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/20"
                  >
                    <CheckCircle2 size={18} />
                    បានជួសជុល
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 sm:mt-0 shrink-0 border-l border-slate-100 pl-4 ml-2">
                <button 
                  onClick={() => handleOpenModal(issue)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(issue.id, issue.pc_number)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PC Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 font-khmer flex items-center gap-2">
                <Monitor className="text-emerald-500" size={24} />
                {editingIssue ? 'កែប្រែបញ្ហាកុំព្យូទ័រ' : 'បន្ថែមបញ្ហាថ្មី'}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">លេខកុំព្យូទ័រ (PC Number)</label>
                  <input
                    type="text"
                    required
                    value={formData.pc_number}
                    onChange={(e) => setFormData({...formData, pc_number: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឧ. PC-01"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">រាយការណ៍ដោយ</label>
                  <input
                    type="text"
                    required
                    value={formData.reported_by}
                    onChange={(e) => setFormData({...formData, reported_by: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                    placeholder="ឈ្មោះគ្រូ ឬអ្នករាយការណ៍"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ស្ថានភាព</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                  >
                    <option value="Pending">កំពុងខូច (Pending)</option>
                    <option value="Resolved">ជួសជុលរួច (Resolved)</option>
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
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ការពិពណ៌នាពីបញ្ហា</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer min-h-[100px] resize-y"
                    placeholder="ពណ៌នាពីបញ្ហាកុំព្យូទ័រ..."
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
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium font-khmer rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-600/20"
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

export default Labs;
