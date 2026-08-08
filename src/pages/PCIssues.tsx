import { useState, useEffect, useRef } from 'react';
import { Plus, Search, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { initDB } from '../store/db';
import type { PCIssue } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import './PCIssues.css';

const PCIssues = () => {
  const [issues, setIssues] = useState<PCIssue[]>([]);
  const { activeYear } = useAcademicYear();
  
  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Loading and Error State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadRequestRef = useRef(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<Partial<PCIssue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!currentIssue.pcNumber) newErrors.pcNumber = 'សូមបញ្ចូលលេខ PC';
    if (!currentIssue.description) newErrors.description = 'សូមបញ្ចូលរោគសញ្ញា';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!activeYear) {
      alert('សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន');
      return;
    }

    const targetYear = activeYear;
    setIsSaving(true);
    try {
      const db = await initDB();
      const dateFoundStr = (currentIssue.dateFound || new Date().toISOString()).split('T')[0];
      const dateResolvedStr = currentIssue.status === 'Good' 
        ? ((currentIssue.dateResolved || new Date().toISOString()).split('T')[0]) 
        : undefined;

      const issueToSave: PCIssue = {
        id: currentIssue.id || crypto.randomUUID(),
        pcNumber: currentIssue.pcNumber!,
        seatNumber: currentIssue.seatNumber || currentIssue.pcNumber,
        status: currentIssue.status || 'Issue',
        description: currentIssue.description!,
        reportedBy: currentIssue.reportedBy || 'Teacher',
        dateFound: dateFoundStr,
        reportedDate: dateFoundStr,
        dateResolved: dateResolvedStr,
        resolvedDate: dateResolvedStr,
        resolution: currentIssue.resolution || '',
        notes: currentIssue.notes || '',
        academicYear: targetYear
      };

      await db.put('pcIssues', issueToSave);
      setShowModal(false);
      await loadIssues(targetYear);
    } catch (error) {
      console.error(error);
      alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setErrors({});
    setCurrentIssue({
      status: 'Issue',
      dateFound: new Date().toISOString().split('T')[0],
      academicYear: activeYear || ''
    });
    setShowModal(true);
  };

  const openEditModal = (issue: PCIssue) => {
    setErrors({});
    setCurrentIssue(issue);
    setShowModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Good': return <CheckCircle size={16} className="text-success" />;
      case 'Issue': return <AlertTriangle size={16} className="text-danger" />;
      case 'Repairing': return <Clock size={16} className="text-warning" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Good': return 'ដំណើរការល្អ (ជួសជុលរួច)';
      case 'Issue': return 'មានបញ្ហា';
      case 'Repairing': return 'កំពុងជួសជុល';
      case 'Broken': return 'ខូច (ប្រើលែងបាន)';
      default: return status;
    }
  };

  const filteredIssues = issues.filter(i => {
    const matchSearch = i.pcNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col w-full pb-10">
      
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-300 mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់លក្ខខណ្ឌ និងសកម្មភាព (Filters & Actions)</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input 
                  type="text"
                  placeholder="ស្វែងរកលេខ PC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្ថានភាព (Status)</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
              >
                <option value="All">ស្ថានភាពទាំងអស់</option>
                <option value="Issue">មានបញ្ហា</option>
                <option value="Repairing">កំពុងជួសជុល</option>
                <option value="Good">ជួសជុលរួច</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent disabled:opacity-50"
              onClick={openAddModal}
              disabled={isLoading || isSaving || !activeYear}
            >
              <Plus size={16} /> កត់ត្រាបញ្ហាថ្មី
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-red-200">
          <div className="bg-red-50 text-red-800 px-4 py-2 font-bold text-sm border-b border-red-200">
            កំពុងមានបញ្ហា (Issues)
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-full text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div className="text-3xl font-bold text-red-600">{issues.filter(i => i.status === 'Issue').length}</div>
          </div>
        </div>
        
        <div className="bg-white border border-yellow-200">
          <div className="bg-yellow-50 text-yellow-800 px-4 py-2 font-bold text-sm border-b border-yellow-200">
            កំពុងជួសជុល (Repairing)
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
              <Clock size={24} />
            </div>
            <div className="text-3xl font-bold text-yellow-600">{issues.filter(i => i.status === 'Repairing').length}</div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>បញ្ជីបញ្ហាកុំព្យូទ័រ (List of PC Issues)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {filteredIssues.length}</span>
        </div>
        
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-12 text-secondary-text">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
          <div className="overflow-x-auto p-0">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">លេខ PC</th>
                  <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">បញ្ហា / រោគសញ្ញា</th>
                  <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">ស្ថានភាព</th>
                  <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">ថ្ងៃកត់ត្រា</th>
                  <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">កំណត់សម្គាល់</th>
                  <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map(issue => (
                  <tr key={issue.id} className={issue.status === 'Good' ? 'bg-green-50/30' : ''}>
                    <td className="border-b border-gray-200 px-4 py-3 font-bold text-gray-800">{issue.pcNumber}</td>
                    <td className="border-b border-gray-200 px-4 py-3 font-medium text-red-600">{issue.description}</td>
                    <td className="border-b border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        {getStatusIcon(issue.status)}
                        <span className={
                          issue.status === 'Good' ? 'text-green-700' :
                          issue.status === 'Issue' ? 'text-red-700' :
                          'text-yellow-700'
                        }>
                          {getStatusText(issue.status)}
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-gray-200 px-4 py-3 text-sm">{issue.dateFound}</td>
                    <td className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600">
                      {issue.status === 'Good' ? issue.resolution : issue.notes || '---'}
                    </td>
                    <td className="border-b border-gray-200 px-4 py-3 text-right">
                       <button 
                         className="text-sm font-medium text-gray-500 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-sm transition-colors disabled:opacity-50"
                         onClick={() => openEditModal(issue)}
                         disabled={isSaving}
                       >
                         កែប្រែ
                       </button>
                    </td>
                  </tr>
                ))}
                {filteredIssues.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center p-12 text-secondary-text">
                        <AlertTriangle size={32} className="text-secondary-text mb-2 opacity-50" />
                        <p>មិនមានទិន្នន័យបញ្ហាកុំព្យូទ័រទេ</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={currentIssue.id ? 'កែប្រែបញ្ហាកុំព្យូទ័រ' : 'កត់ត្រាបញ្ហាថ្មី'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">លេខកុំព្យូទ័រ *</label>
              <Input 
                value={currentIssue.pcNumber || ''} 
                onChange={(e) => setCurrentIssue({...currentIssue, pcNumber: e.target.value})}
                placeholder="ឧ. PC-01"
                error={!!errors.pcNumber}
                disabled={isSaving}
              />
              {errors.pcNumber && <p className="text-danger text-xs mt-1">{errors.pcNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">ថ្ងៃរកឃើញ</label>
              <Input 
                type="date"
                value={(currentIssue.dateFound || '').split('T')[0]} 
                onChange={(e) => setCurrentIssue({...currentIssue, dateFound: e.target.value})}
                disabled={isSaving}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">រោគសញ្ញា / បញ្ហា *</label>
            <Input 
              value={currentIssue.description || ''} 
              onChange={(e) => setCurrentIssue({...currentIssue, description: e.target.value})}
              placeholder="ឧ. បើកមិនចេញ, ខូច Mouse..."
              error={!!errors.description}
              disabled={isSaving}
            />
            {errors.description && <p className="text-danger text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">ស្ថានភាព *</label>
            <select 
              className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white disabled:opacity-50"
              value={currentIssue.status || 'Issue'}
              onChange={(e) => setCurrentIssue({...currentIssue, status: e.target.value})}
              disabled={isSaving}
            >
              <option value="Issue">មានបញ្ហា</option>
              <option value="Repairing">កំពុងជួសជុល</option>
              <option value="Good">ជួសជុលរួច (Good)</option>
            </select>
          </div>
          
          {currentIssue.status === 'Good' && (
            <div>
              <label className="block text-sm font-medium text-primary mb-1">វិធីសាស្ត្រជួសជុល (Resolution)</label>
              <Input 
                value={currentIssue.resolution || ''} 
                onChange={(e) => setCurrentIssue({...currentIssue, resolution: e.target.value})}
                placeholder="តើបានធ្វើអ្វីខ្លះដើម្បីជួសជុល?"
                disabled={isSaving}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary mb-1">កំណត់សម្គាល់ផ្សេងៗ</label>
            <Input 
              value={currentIssue.notes || ''} 
              onChange={(e) => setCurrentIssue({...currentIssue, notes: e.target.value})}
              placeholder="ព័ត៌មានបន្ថែម..."
              disabled={isSaving}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isSaving}>បោះបង់</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PCIssues;
