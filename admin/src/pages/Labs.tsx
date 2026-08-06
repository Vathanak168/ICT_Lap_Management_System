import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Monitor, Search, Filter, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

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
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              className="input-field pl-10 bg-white"
              placeholder="ស្វែងរក PC ឬបញ្ហា..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter size={18} className="text-slate-400" />
            </div>
            <select
              className="input-field pl-10 bg-white appearance-none cursor-pointer"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              disabled={selectedBranch === 'None'}
            >
              <option value="All">ទាំងអស់</option>
              <option value="Pending">កំពុងខូច (Pending)</option>
              <option value="Resolved">ជួសជុលរួច (Resolved)</option>
            </select>
          </div>
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
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Labs;
