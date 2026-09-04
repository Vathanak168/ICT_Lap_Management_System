import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { 
  Monitor, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  LayoutGrid, 
  ListFilter,
  Wrench,
  Users
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

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

interface StudentAssignment {
  id: string;
  student_id: string;
  name: string;
  english_name: string;
  class: string;
  shift: string;
  pc_number: string;
}

const Labs = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [issues, setIssues] = useState<PCIssue[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Resolved'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Selected PC for modal / details
  const [selectedPcDetail, setSelectedPcDetail] = useState<string | null>(null);

  // Modal State for Reporting/Editing Issue
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

  const { success, error: toastError } = useToast();

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let issueQ = supabase.from('pc_issues').select('*').order('reported_date', { ascending: false });
      let studentQ = supabase.from('students').select('id, student_id, name, english_name, class, shift, pc_number').not('pc_number', 'is', null);

      if (selectedBranch !== 'All') {
        issueQ = issueQ.eq('branch', selectedBranch);
        studentQ = studentQ.eq('branch', selectedBranch);
      }

      const [issuesRes, studentsRes] = await Promise.all([issueQ, studentQ]);

      if (issuesRes.error) throw issuesRes.error;
      setIssues(issuesRes.data || []);
      setStudentAssignments(studentsRes.data || []);
    } catch (error) {
      console.error('Error fetching pc issues:', error);
      toastError('បរាជ័យក្នុងការទាញយកទិន្នន័យកុំព្យូទ័រ');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIssue = async (id: string, pcNumber: string) => {
    try {
      const { error } = await supabase
        .from('pc_issues')
        .update({
          status: 'Resolved',
          resolved_date: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      success(`បានកំណត់ ${pcNumber} ថាបានដោះស្រាយរួចរាល់`);
      fetchData();
    } catch (error) {
      console.error('Error resolving issue:', error);
      toastError('មានបញ្ហាក្នុងការកែប្រែស្ថានភាព');
    }
  };

  const handleOpenModal = (issue?: PCIssue, defaultPcNumber?: string) => {
    if (issue) {
      setEditingIssue(issue);
      setFormData({
        pc_number: issue.pc_number || '',
        description: issue.description || '',
        status: issue.status || 'Pending',
        reported_by: issue.reported_by || '',
        branch: issue.branch || (selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 25')
      });
    } else {
      setEditingIssue(null);
      setFormData({
        pc_number: defaultPcNumber || '',
        description: '',
        status: 'Pending',
        reported_by: '',
        branch: selectedBranch !== 'All' ? selectedBranch : 'BELTEI IS 25'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Normalize PC Number e.g. PC-1 -> PC-01
      let formattedPc = formData.pc_number.trim();
      const match = formattedPc.match(/^PC[-_ ]?(\d+)$/i);
      if (match) {
        formattedPc = `PC-${match[1].padStart(2, '0')}`;
      }

      const payload = {
        pc_number: formattedPc,
        description: formData.description.trim(),
        status: formData.status,
        reported_by: formData.reported_by.trim() || 'Admin',
        branch: formData.branch,
        reported_date: editingIssue ? editingIssue.reported_date : new Date().toISOString(),
        resolved_date: formData.status === 'Resolved' ? new Date().toISOString() : null
      };

      if (editingIssue) {
        const { error } = await supabase
          .from('pc_issues')
          .update(payload)
          .eq('id', editingIssue.id);

        if (error) throw error;
        success(`បានកែប្រែរបាយការណ៍ ${formattedPc} ដោយជោគជ័យ`);
      } else {
        const { error } = await supabase
          .from('pc_issues')
          .insert([payload]);

        if (error) throw error;
        success(`បានរាយការណ៍បញ្ហាលើ ${formattedPc} ដោយជោគជ័យ`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving issue:', error);
      toastError(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, pc: string) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបកំណត់ត្រាបញ្ហាលើ "${pc}" មែនទេ?`)) return;

    try {
      const { error } = await supabase.from('pc_issues').delete().eq('id', id);
      if (error) throw error;
      setIssues(prev => prev.filter(i => i.id !== id));
      success(`បានលុបរបាយការណ៍ ${pc}`);
    } catch (error: any) {
      toastError(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  // Map of PC issues by PC Number
  const pendingIssuesByPc = useMemo(() => {
    const map = new Map<string, PCIssue>();
    issues.filter(i => i.status !== 'Resolved').forEach(i => {
      const norm = i.pc_number.toUpperCase().replace(/\s+/g, '');
      map.set(norm, i);
    });
    return map;
  }, [issues]);

  // Students by PC Number
  const studentsByPc = useMemo(() => {
    const map = new Map<string, StudentAssignment[]>();
    studentAssignments.forEach(s => {
      if (s.pc_number) {
        const norm = s.pc_number.toUpperCase().replace(/\s+/g, '');
        if (!map.has(norm)) map.set(norm, []);
        map.get(norm)!.push(s);
      }
    });
    return map;
  }, [studentAssignments]);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchSearch = !search || 
        issue.pc_number.toLowerCase().includes(search.toLowerCase()) || 
        issue.description.toLowerCase().includes(search.toLowerCase()) ||
        issue.reported_by.toLowerCase().includes(search.toLowerCase());
      
      const matchFilter = filter === 'All' || issue.status === filter;
      return matchSearch && matchFilter;
    });
  }, [issues, search, filter]);

  // Generate 36 PC desks array
  const pcDesks = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => `PC-${String(i + 1).padStart(2, '0')}`);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 font-khmer flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Monitor size={22} />
            </div>
            <span>ការគ្រប់គ្រងកុំព្យូទ័រ & បន្ទប់ Lab</span>
          </h1>
          <p className="text-slate-500 font-khmer text-xs sm:text-sm mt-1">
            សាខា៖ <strong className="text-blue-600">{selectedBranch}</strong> · បញ្ហាកំពុងរង់ចាំ៖ <strong className="text-rose-600">{pendingIssuesByPc.size}</strong> តុ
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={15} />
              <span>ប្លង់កុំព្យូទ័រ</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all ${
                viewMode === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter size={15} />
              <span>តារាងបញ្ហា</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs sm:text-sm font-khmer font-bold transition-all shadow-md shadow-cyan-500/20 active:scale-95"
          >
            <Plus size={17} />
            <span>រាយការណ៍បញ្ហា</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Interactive Visual PC Grid */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          {/* Legend Banner */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-khmer">
            <div className="flex items-center gap-4 text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>ដំណើរការល្អ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                <span>មានបញ្ហារង់ចាំដោះស្រាយ</span>
              </div>
            </div>
            <span className="text-slate-400">ចុចលើ PC ណាមួយដើម្បីពិនិត្យសិស្ស ឬរាយការណ៍បញ្ហា</span>
          </div>

          {/* Grid Layout: 36 PCs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
            {pcDesks.map(pc => {
              const activeIssue = pendingIssuesByPc.get(pc.toUpperCase());
              const assignedList = studentsByPc.get(pc.toUpperCase()) || [];
              const hasIssue = !!activeIssue;

              return (
                <div
                  key={pc}
                  onClick={() => setSelectedPcDetail(pc)}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-28 relative group shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                    hasIssue
                      ? 'bg-rose-50/70 border-rose-300 hover:bg-rose-50'
                      : 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-slate-800 tracking-tight">
                      {pc}
                    </span>
                    <div className={`w-2.5 h-2.5 rounded-full ${hasIssue ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                  </div>

                  {hasIssue ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 font-khmer truncate">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span className="truncate">{activeIssue.description}</span>
                      </div>
                      <span className="text-[10px] text-rose-500 font-khmer">កំពុងរង់ចាំ</span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 font-khmer">
                        <Users size={12} className="text-blue-500 shrink-0" />
                        <span>{assignedList.length} សិស្ស</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-khmer font-bold">ល្អប្រក្រតី</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-khmer pt-1 border-t border-slate-100/80 flex items-center justify-between">
                    <span>លម្អិត</span>
                    <span className="opacity-0 group-hover:opacity-100 text-blue-600">&rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Issue Tracker Table */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full h-10 pl-10 pr-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                  placeholder="ស្វែងរកតាម PC, ពិពណ៌នា, ឬអ្នករាយការណ៍..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="relative w-full sm:w-56">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="w-full h-10 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-khmer text-slate-700 focus:bg-white focus:border-cyan-500 outline-none transition-all cursor-pointer"
                >
                  <option value="All">គ្រប់ស្ថានភាព</option>
                  <option value="Pending">កំពុងរង់ចាំ</option>
                  <option value="Resolved">បានដោះស្រាយ</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-khmer">
              សរុប <strong>{filteredIssues.length}</strong> របាយការណ៍
            </div>
          </div>

          {/* Issues Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 font-khmer flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">កំពុងទាញយកទិន្នន័យបញ្ហា...</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-khmer flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={36} className="text-emerald-400" />
                <p className="text-sm font-bold text-slate-700">មិនមានបញ្ហាកំពុងរង់ចាំឡើយ!</p>
                <p className="text-xs text-slate-400">កុំព្យូទ័រទាំងអស់ដំណើរការបានយ៉ាងរលូន។</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-khmer font-bold">
                      <th className="px-5 py-3.5">តុ / PC</th>
                      <th className="px-5 py-3.5">ការពិពណ៌នាបញ្ហា</th>
                      <th className="px-5 py-3.5">អ្នករាយការណ៍</th>
                      <th className="px-5 py-3.5">កាលបរិច្ឆេទ</th>
                      <th className="px-5 py-3.5">ស្ថានភាព</th>
                      <th className="px-5 py-3.5 text-right">សកម្មភាព</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIssues.map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs">
                            <Monitor size={13} className="text-cyan-600" /> {issue.pc_number}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-khmer text-slate-800 max-w-md">
                          {issue.description}
                        </td>
                        <td className="px-5 py-3.5 font-khmer text-slate-600">
                          {issue.reported_by || 'Admin'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-sans text-xs">
                          {issue.reported_date ? new Date(issue.reported_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-5 py-3.5 font-khmer">
                          {issue.status === 'Resolved' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={12} /> ដោះស្រាយរួច
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={12} /> កំពុងរង់ចាំ
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {issue.status !== 'Resolved' && (
                              <button
                                onClick={() => handleResolveIssue(issue.id, issue.pc_number)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold font-khmer transition-colors flex items-center gap-1"
                                title="កំណត់ថាដោះស្រាយរួច"
                              >
                                <CheckCircle2 size={13} /> ដោះស្រាយ
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenModal(issue)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="កែសម្រួល"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(issue.id, issue.pc_number)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="លុប"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PC Detail Drawer Modal (When clicked on grid) */}
      {selectedPcDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-mono font-black text-sm">
                  {selectedPcDetail}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-khmer">
                    ព័ត៌មានលម្អិតកុំព្យូទ័រ {selectedPcDetail}
                  </h2>
                  <p className="text-xs text-slate-500 font-khmer">សាខា {selectedBranch}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPcDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Status Section */}
              {pendingIssuesByPc.get(selectedPcDetail.toUpperCase()) ? (
                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200 text-xs font-khmer space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-700 flex items-center gap-1.5">
                      <AlertTriangle size={15} /> មានបញ្ហារាយការណ៍
                    </span>
                    <button
                      onClick={() => {
                        const issue = pendingIssuesByPc.get(selectedPcDetail.toUpperCase())!;
                        handleResolveIssue(issue.id, selectedPcDetail);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-xs"
                    >
                      ដោះស្រាយរួចរាល់
                    </button>
                  </div>
                  <p className="text-rose-900 font-medium">
                    {pendingIssuesByPc.get(selectedPcDetail.toUpperCase())?.description}
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 text-xs font-khmer flex items-center justify-between">
                  <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> ដំណើរការល្អប្រក្រតី
                  </span>
                  <button
                    onClick={() => {
                      const pc = selectedPcDetail;
                      setSelectedPcDetail(null);
                      handleOpenModal(undefined, pc);
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    រាយការណ៍បញ្ហា &rarr;
                  </button>
                </div>
              )}

              {/* Students Assigned to this PC */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 font-khmer mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-blue-600" />
                  <span>សិស្សដែលចាត់តាំងលើតុ {selectedPcDetail} ({(studentsByPc.get(selectedPcDetail.toUpperCase()) || []).length} នាក់)៖</span>
                </h4>

                {(studentsByPc.get(selectedPcDetail.toUpperCase()) || []).length === 0 ? (
                  <p className="text-xs text-slate-400 font-khmer italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    មិនទាន់មានសិស្សចាត់តាំងលើតុនេះទេ។
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(studentsByPc.get(selectedPcDetail.toUpperCase()) || []).map(st => (
                      <div key={st.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs font-khmer">
                        <div>
                          <p className="font-bold text-slate-800">{st.name}</p>
                          <p className="text-[11px] text-slate-400 font-sans">{st.english_name || st.student_id}</p>
                        </div>
                        <span className="font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                          {st.shift === 'Morning' ? 'ព្រឹក' : 'រសៀល'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setSelectedPcDetail(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-khmer font-bold hover:bg-slate-50"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report / Edit Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 font-khmer flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                  <Wrench size={17} />
                </div>
                <span>{editingIssue ? 'កែប្រែរបាយការណ៍បញ្ហា' : 'រាយការណ៍បញ្ហាកុំព្យូទ័រ'}</span>
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">លេខតុ / PC *</label>
                  <input
                    type="text"
                    required
                    value={formData.pc_number}
                    onChange={(e) => setFormData({ ...formData, pc_number: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all uppercase"
                    placeholder="PC-01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ស្ថានភាព</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Pending">កំពុងរង់ចាំ</option>
                    <option value="Resolved">បានដោះស្រាយរួច</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">ការពិពណ៌នាបញ្ហា *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:border-cyan-500 outline-none resize-none"
                  placeholder="ឧ. ខូច Mouse, អត់លឺសំឡេង, បើកមិនចេញ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">អ្នករាយការណ៍</label>
                  <input
                    type="text"
                    value={formData.reported_by}
                    onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:border-cyan-500 outline-none"
                    placeholder="ឧ. គ្រូ ICT"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-khmer">សាខា</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-khmer focus:border-cyan-500 outline-none"
                    placeholder="BELTEI IS 25"
                  />
                </div>
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
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs sm:text-sm font-khmer font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
                >
                  {isSaving ? 'កំពុងរក្សាទុក...' : editingIssue ? 'កែប្រែបញ្ហា' : 'រាយការណ៍'}
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
