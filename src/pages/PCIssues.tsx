import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Monitor, 
  Wrench, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { initDB } from '../store/db';
import type { PCIssue } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import './PCIssues.css';

const getLocalDate = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PCIssues = () => {
  const [issues, setIssues] = useState<PCIssue[]>([]);
  const { activeYear } = useAcademicYear();
  
  // Filtering & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Issue' | 'Repairing' | 'Good'>('All');
  
  // Loading & Action state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadRequestRef = useRef(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<Partial<PCIssue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Delete Confirmation State
  const [deleteConfirmIssue, setDeleteConfirmIssue] = useState<PCIssue | null>(null);
  
  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 3000);
  };

  const loadIssues = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      const allIssues = await db.getAll('pcIssues', targetYear);
      
      if (requestId !== loadRequestRef.current) return;
      setIssues(allIssues);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load pc issues:', error);
        showToast('error', 'មានបញ្ហាក្នុងការទាញយកទិន្នន័យបញ្ហាកុំព្យូទ័រ');
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const load = () => {
      if (activeYear) {
        void loadIssues(activeYear);
      } else {
        setIssues([]);
      }
    };
    
    load();
    
    window.addEventListener('appDataChanged', load);
    return () => window.removeEventListener('appDataChanged', load);
  }, [activeYear]);

  // Counts for Metric Cards & Filter Tabs
  const totalCount = issues.length;
  const issueCount = useMemo(() => issues.filter(i => i.status === 'Issue' || i.status === 'Broken').length, [issues]);
  const repairingCount = useMemo(() => issues.filter(i => i.status === 'Repairing').length, [issues]);
  const resolvedCount = useMemo(() => issues.filter(i => i.status === 'Good' || i.status === 'Resolved').length, [issues]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!currentIssue.pcNumber?.trim()) newErrors.pcNumber = 'សូមបញ្ចូល ឬជ្រើសរើសលេខ PC';
    if (!currentIssue.description?.trim()) newErrors.description = 'សូមបញ្ចូលរោគសញ្ញា ឬបញ្ហា';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!activeYear) {
      showToast('error', 'សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន');
      return;
    }

    const targetYear = activeYear;
    setIsSaving(true);
    try {
      const db = await initDB();
      const formattedPcNumber = currentIssue.pcNumber!.trim().toUpperCase();
      const dateFoundStr = currentIssue.reportedDate || currentIssue.dateFound || getLocalDate();
      const isResolved = currentIssue.status === 'Good';
      const resolvedDateStr = isResolved
        ? (currentIssue.resolvedDate || currentIssue.dateResolved || getLocalDate())
        : undefined;

      const issueToSave: PCIssue = {
        id: currentIssue.id || crypto.randomUUID(),
        pcNumber: formattedPcNumber,
        seatNumber: currentIssue.seatNumber || formattedPcNumber,
        status: currentIssue.status || 'Issue',
        description: currentIssue.description!.trim(),
        reportedBy: currentIssue.reportedBy || 'គ្រូបង្រៀន',
        reportedDate: dateFoundStr,
        dateFound: dateFoundStr,
        resolvedDate: resolvedDateStr,
        dateResolved: resolvedDateStr,
        resolution: isResolved ? (currentIssue.resolution?.trim() || 'ជួសជុលរួចរាល់') : '',
        notes: currentIssue.notes?.trim() || '',
        academicYear: targetYear
      };

      await db.put('pcIssues', issueToSave);
      window.dispatchEvent(new CustomEvent('appDataChanged'));
      
      setShowModal(false);
      showToast('success', currentIssue.id ? 'បានកែសម្រួលបញ្ហាកុំព្យូទ័រជោគជ័យ!' : 'បានកត់ត្រាបញ្ហាកុំព្យូទ័រថ្មីជោគជ័យ!');
      await loadIssues(targetYear);
    } catch (error) {
      console.error(error);
      showToast('error', 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickResolve = async (issue: PCIssue) => {
    if (!activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const today = getLocalDate();
      const updatedIssue: PCIssue = {
        ...issue,
        status: 'Good',
        resolvedDate: today,
        dateResolved: today,
        resolution: issue.resolution || 'ជួសជុលរួចរាល់'
      };

      await db.put('pcIssues', updatedIssue);
      window.dispatchEvent(new CustomEvent('appDataChanged'));
      showToast('success', `បានកំណត់ PC ${issue.pcNumber} ថាបានជួសជុលរួចរាល់!`);
      await loadIssues(activeYear);
    } catch (error) {
      console.error('Quick resolve failed:', error);
      showToast('error', 'មានបញ្ហាក្នុងការធ្វើបច្ចុប្បន្នភាពស្ថានភាព');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmIssue || !activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      await db.delete('pcIssues', deleteConfirmIssue.id);
      window.dispatchEvent(new CustomEvent('appDataChanged'));
      showToast('success', `បានលុបទិន្នន័យបញ្ហា PC ${deleteConfirmIssue.pcNumber} ជោគជ័យ!`);
      setDeleteConfirmIssue(null);
      await loadIssues(activeYear);
    } catch (error) {
      console.error('Delete issue failed:', error);
      showToast('error', 'មានបញ្ហាក្នុងការលុបទិន្នន័យ');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setErrors({});
    setCurrentIssue({
      status: 'Issue',
      reportedDate: getLocalDate(),
      academicYear: activeYear || ''
    });
    setShowModal(true);
  };

  const openEditModal = (issue: PCIssue) => {
    setErrors({});
    setCurrentIssue({
      ...issue,
      reportedDate: issue.reportedDate || issue.dateFound || getLocalDate(),
      resolvedDate: issue.resolvedDate || issue.dateResolved || getLocalDate()
    });
    setShowModal(true);
  };

  // Filtered and sorted issues
  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        i.pcNumber.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.resolution || '').toLowerCase().includes(q);
      
      const isIssue = i.status === 'Issue' || i.status === 'Broken';
      const isRepairing = i.status === 'Repairing';
      const isGood = i.status === 'Good' || i.status === 'Resolved';

      if (statusFilter === 'Issue') return matchSearch && isIssue;
      if (statusFilter === 'Repairing') return matchSearch && isRepairing;
      if (statusFilter === 'Good') return matchSearch && isGood;
      return matchSearch;
    }).sort((a, b) => {
      // Prioritize active issues first, then repairing, then resolved
      const getPriority = (status: string) => {
        if (status === 'Issue' || status === 'Broken') return 1;
        if (status === 'Repairing') return 2;
        return 3;
      };
      const diff = getPriority(a.status) - getPriority(b.status);
      if (diff !== 0) return diff;
      
      // Secondary sort: PC Number numeric order
      return a.pcNumber.localeCompare(b.pcNumber, undefined, { numeric: true });
    });
  }, [issues, searchTerm, statusFilter]);

  // Common PC numbers for datalist / quick select
  const pcOptions = useMemo(() => {
    return Array.from({ length: 45 }, (_, i) => `PC-${String(i + 1).padStart(2, '0')}`);
  }, []);

  return (
    <div className="flex flex-col w-full pb-16 space-y-4 animate-in fade-in duration-200">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium transition-all animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-rose-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner - Clean Ribbon */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <Monitor size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">កត់ត្រា និងតាមដានបញ្ហាកុំព្យូទ័រ</h1>
            <p className="text-xs text-blue-100/80">គ្រប់គ្រង និងតាមដានការជួសជុលកុំព្យូទ័រក្នុងបន្ទប់អនុវត្ត ICT</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {activeYear && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/15 text-white shadow-2xs">
              ឆ្នាំសិក្សា {activeYear}
            </span>
          )}
          <button 
            type="button"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            onClick={openAddModal}
            disabled={isLoading || isSaving || !activeYear}
          >
            <Plus size={16} />
            <span>កត់ត្រាបញ្ហាថ្មី</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Issues Card */}
        <div 
          onClick={() => setStatusFilter('All')}
          className={`bg-surface rounded-2xl border p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'All' ? 'border-primary ring-2 ring-primary/20' : 'border-border/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">បញ្ហាសរុប</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-main-text">{totalCount}</strong>
            <span className="text-xs font-medium text-secondary-text">ករណី</span>
          </div>
        </div>

        {/* Active Issues Card */}
        <div 
          onClick={() => setStatusFilter('Issue')}
          className={`bg-rose-50/60 rounded-2xl border p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'Issue' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-rose-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">កំពុងមានបញ្ហា</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-rose-700">{issueCount}</strong>
            <span className="text-xs font-medium text-rose-700/80">គ្រឿង</span>
          </div>
        </div>

        {/* Under Repair Card */}
        <div 
          onClick={() => setStatusFilter('Repairing')}
          className={`bg-amber-50/60 rounded-2xl border p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'Repairing' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-amber-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">កំពុងជួសជុល</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-amber-700">{repairingCount}</strong>
            <span className="text-xs font-medium text-amber-700/80">គ្រឿង</span>
          </div>
        </div>

        {/* Resolved Card */}
        <div 
          onClick={() => setStatusFilter('Good')}
          className={`bg-emerald-50/60 rounded-2xl border p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'Good' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">ជួសជុលរួចរាល់</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <strong className="text-2xl font-bold text-emerald-700">{resolvedCount}</strong>
            <span className="text-xs font-medium text-emerald-700/80">គ្រឿង</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 p-3.5 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'All'
                ? 'bg-primary text-white shadow-2xs'
                : 'bg-background hover:bg-surface-hover text-secondary-text'
            }`}
          >
            ទាំងអស់ ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Issue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'Issue'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-background hover:bg-surface-hover text-rose-700'
            }`}
          >
            មានបញ្ហា ({issueCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Repairing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'Repairing'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-background hover:bg-surface-hover text-amber-700'
            }`}
          >
            កំពុងជួសជុល ({repairingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Good')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'Good'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-background hover:bg-surface-hover text-emerald-700'
            }`}
          >
            ជួសជុលរួច ({resolvedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] md:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text" />
          <input 
            type="text"
            placeholder="ស្វែងរកតាមលេខ PC, រោគសញ្ញា..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9.5 pr-8 py-2 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary-text hover:text-main-text"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        {isLoading && issues.length === 0 && !isSaving ? (
          <div className="flex items-center justify-center p-16 text-secondary-text gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">កំពុងទាញយកទិន្នន័យបញ្ហាកុំព្យូទ័រ...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-14">ល.រ</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider w-28">លេខ PC</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">រោគសញ្ញា / បញ្ហា</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center w-36">ស្ថានភាព</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider w-32">កាលបរិច្ឆេទ</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">វិធីដោះស្រាយ / ចំណាំ</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right w-36">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredIssues.map((issue, index) => {
                  const isGood = issue.status === 'Good' || issue.status === 'Resolved';
                  const isIssue = issue.status === 'Issue' || issue.status === 'Broken';
                  const isRepairing = issue.status === 'Repairing';

                  return (
                    <tr 
                      key={issue.id} 
                      className={`hover:bg-surface-hover/50 transition-colors group ${
                        isGood ? 'bg-emerald-50/15' : isIssue ? 'bg-rose-50/10' : 'bg-amber-50/10'
                      }`}
                    >
                      {/* Index */}
                      <td className="px-4 py-3 text-center text-xs font-semibold text-secondary-text">
                        {index + 1}
                      </td>

                      {/* PC Number Badge */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-background border border-border/80 text-main-text shadow-2xs">
                          <Monitor size={12} className="text-primary" />
                          <span>{issue.pcNumber}</span>
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <span className={`text-xs sm:text-sm font-semibold ${
                          isIssue ? 'text-rose-600' : isRepairing ? 'text-amber-700' : 'text-main-text'
                        }`}>
                          {issue.description}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 text-center">
                        {isGood && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-300/60">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>ជួសជុលរួច</span>
                          </span>
                        )}
                        {isIssue && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100/70 text-rose-800 border border-rose-300/60">
                            <AlertTriangle size={13} className="text-rose-600" />
                            <span>មានបញ្ហា</span>
                          </span>
                        )}
                        {isRepairing && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100/70 text-amber-800 border border-amber-300/60">
                            <Clock size={13} className="text-amber-600" />
                            <span>កំពុងជួសជុល</span>
                          </span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs text-secondary-text gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-secondary-text/70 uppercase">កត់ត្រា:</span>
                            <span className="font-medium text-main-text">{issue.reportedDate || issue.dateFound || '—'}</span>
                          </div>
                          {issue.resolvedDate && isGood && (
                            <div className="flex items-center gap-1 text-emerald-700">
                              <span className="text-[10px] uppercase">រួច:</span>
                              <span className="font-medium">{issue.resolvedDate}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Resolution / Notes */}
                      <td className="px-4 py-3 text-xs text-secondary-text">
                        {isGood && issue.resolution ? (
                          <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                            <Check size={12} className="text-emerald-600 shrink-0" />
                            <span className="truncate max-w-[200px]" title={issue.resolution}>{issue.resolution}</span>
                          </div>
                        ) : issue.notes ? (
                          <span className="truncate max-w-[200px] block" title={issue.notes}>{issue.notes}</span>
                        ) : (
                          <span className="text-secondary-text/50">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isGood && (
                            <button
                              type="button"
                              onClick={() => handleQuickResolve(issue)}
                              disabled={isSaving}
                              title="សម្គាល់ថាបានជួសជុលរួច (Quick Resolve)"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(issue)}
                            disabled={isSaving}
                            title="កែប្រែព័ត៌មាន"
                            className="p-1.5 rounded-lg bg-background hover:bg-surface-hover text-secondary-text hover:text-main-text border border-border transition-all shadow-2xs active:scale-95 cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmIssue(issue)}
                            disabled={isSaving}
                            title="លុបចោល"
                            className="p-1.5 rounded-lg bg-background hover:bg-rose-50 text-secondary-text hover:text-rose-600 border border-border hover:border-rose-200 transition-all shadow-2xs active:scale-95 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredIssues.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center p-14 text-secondary-text">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <Monitor size={26} />
                        </div>
                        <p className="text-sm font-semibold text-main-text">
                          {searchTerm ? 'រកមិនឃើញបញ្ហាកុំព្យូទ័រដែលត្រូវនឹងពាក្យស្វែងរកឡើយ' : 'មិនទាន់មានទិន្នន័យបញ្ហាកុំព្យូទ័រនៅឡើយទេ'}
                        </p>
                        {searchTerm ? (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="mt-2 text-xs text-primary hover:underline font-medium cursor-pointer"
                          >
                            សម្អាតពាក្យស្វែងរក
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={openAddModal}
                            className="mt-3 text-xs font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>កត់ត្រាបញ្ហាថ្មីឥឡូវនេះ</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Datalist for fast PC selection */}
      <datalist id="pc-options">
        {pcOptions.map(pc => (
          <option key={pc} value={pc} />
        ))}
      </datalist>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border/80 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/80 bg-background/50">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  currentIssue.id ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-600'
                }`}>
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-main-text">
                    {currentIssue.id ? `កែប្រែបញ្ហាកុំព្យូទ័រ (${currentIssue.pcNumber || ''})` : 'កត់ត្រាបញ្ហាកុំព្យូទ័រថ្មី'}
                  </h3>
                  <p className="text-xs text-secondary-text">បញ្ចូលព័ត៌មានលម្អិតនៃបញ្ហាកុំព្យូទ័រ</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowModal(false)} 
                className="text-secondary-text hover:text-main-text hover:bg-surface-hover p-1.5 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PC Number */}
                <div>
                  <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                    លេខកុំព្យូទ័រ (PC) *
                  </label>
                  <input
                    type="text"
                    list="pc-options"
                    placeholder="ឧ. PC-01"
                    value={currentIssue.pcNumber || ''}
                    onChange={(e) => setCurrentIssue({ ...currentIssue, pcNumber: e.target.value })}
                    disabled={isSaving}
                    className={`w-full bg-background border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs ${
                      errors.pcNumber ? 'border-rose-500' : 'border-border'
                    }`}
                  />
                  {errors.pcNumber && <p className="text-rose-600 text-[11px] font-medium mt-1">{errors.pcNumber}</p>}
                </div>

                {/* Reported Date */}
                <div>
                  <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                    កាលបរិច្ឆេទរកឃើញ
                  </label>
                  <input
                    type="date"
                    value={(currentIssue.reportedDate || currentIssue.dateFound || getLocalDate()).split('T')[0]}
                    onChange={(e) => setCurrentIssue({ ...currentIssue, reportedDate: e.target.value, dateFound: e.target.value })}
                    disabled={isSaving}
                    className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Symptom / Description */}
              <div>
                <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                  រោគសញ្ញា ឬបញ្ហាដែលជួបប្រទះ *
                </label>
                <input
                  type="text"
                  placeholder="ឧ. បើកមិនចេញ, ខូច Mouse, អេក្រង់ខៀវ, គ្មានអ៊ីនធឺណិត..."
                  value={currentIssue.description || ''}
                  onChange={(e) => setCurrentIssue({ ...currentIssue, description: e.target.value })}
                  disabled={isSaving}
                  className={`w-full bg-background border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs ${
                    errors.description ? 'border-rose-500' : 'border-border'
                  }`}
                />
                {errors.description && <p className="text-rose-600 text-[11px] font-medium mt-1">{errors.description}</p>}
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                  ស្ថានភាពបច្ចុប្បន្ន *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentIssue({ ...currentIssue, status: 'Issue' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      currentIssue.status === 'Issue' || currentIssue.status === 'Broken'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs ring-1 ring-rose-500/30'
                        : 'bg-background border-border text-secondary-text hover:bg-surface-hover'
                    }`}
                  >
                    <AlertTriangle size={14} />
                    <span>មានបញ្ហា</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentIssue({ ...currentIssue, status: 'Repairing' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      currentIssue.status === 'Repairing'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-2xs ring-1 ring-amber-500/30'
                        : 'bg-background border-border text-secondary-text hover:bg-surface-hover'
                    }`}
                  >
                    <Clock size={14} />
                    <span>កំពុងជួសជុល</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentIssue({ 
                      ...currentIssue, 
                      status: 'Good',
                      resolvedDate: currentIssue.resolvedDate || getLocalDate() 
                    })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      currentIssue.status === 'Good' || currentIssue.status === 'Resolved'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs ring-1 ring-emerald-500/30'
                        : 'bg-background border-border text-secondary-text hover:bg-surface-hover'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>ជួសជុលរួច</span>
                  </button>
                </div>
              </div>

              {/* Resolution Field (shown when status is Good) */}
              {(currentIssue.status === 'Good' || currentIssue.status === 'Resolved') && (
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/60 space-y-2 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    វិធីសាស្ត្រដោះស្រាយ ឬជួសជុល
                  </label>
                  <input
                    type="text"
                    placeholder="ឧ. បានប្តូរ Mouse ថ្មី, បានដំឡើង Windows ឡើងវិញ..."
                    value={currentIssue.resolution || ''}
                    onChange={(e) => setCurrentIssue({ ...currentIssue, resolution: e.target.value })}
                    disabled={isSaving}
                    className="w-full bg-surface border border-emerald-300 text-main-text text-xs rounded-xl px-3.5 py-2 font-medium outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
                  />
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                  កំណត់សម្គាល់បន្ថែម
                </label>
                <input
                  type="text"
                  placeholder="ព័ត៌មានបន្ថែមផ្សេងៗ..."
                  value={currentIssue.notes || ''}
                  onChange={(e) => setCurrentIssue({ ...currentIssue, notes: e.target.value })}
                  disabled={isSaving}
                  className="w-full bg-background border border-border text-main-text text-xs rounded-xl px-3.5 py-2.5 font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end items-center gap-2.5 px-6 py-4 border-t border-border/80 bg-background/50">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-border text-secondary-text hover:text-main-text hover:bg-surface-hover text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                បោះបង់
              </button>
              <button 
                type="button" 
                onClick={handleSave} 
                disabled={isSaving}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmIssue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border/80 shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-center text-main-text mb-2">
              តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?
            </h3>
            <p className="text-xs text-secondary-text text-center mb-6 leading-relaxed">
              អ្នករៀបនឹងលុបកត់ត្រាបញ្ហារបស់ <strong className="text-main-text">{deleteConfirmIssue.pcNumber}</strong>: <br />
              <span className="italic text-rose-600">"{deleteConfirmIssue.description}"</span>។ សកម្មភាពនេះមិនអាចត្រឡប់ក្រោយវិញបានទេ។
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmIssue(null)}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-secondary-text hover:text-main-text hover:bg-surface-hover text-xs font-bold transition-all cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                {isSaving ? 'កំពុងលុប...' : 'យល់ព្រមលុប'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PCIssues;
