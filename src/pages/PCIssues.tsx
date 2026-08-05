import { useState, useEffect } from 'react';
import { Plus, Search, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { initDB } from '../store/db';
import type { PCIssue } from '../store/db';
import './PCIssues.css';

const PCIssues = () => {
  const [issues, setIssues] = useState<PCIssue[]>([]);
  
  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    const db = await initDB();
    const allIssues = await db.getAll('pcIssues');
    setIssues(allIssues);

    if (allIssues.length === 0) {
      // Mock data
      const mockIssues: PCIssue[] = [
        { id: '1', pcNumber: 'PC-05', seatNumber: 'A-05', status: 'Issue', currentIssue: 'Mouse មិនដើរ', dateFound: '2026-08-01', notes: 'ត្រូវការទិញថ្មី' },
        { id: '2', pcNumber: 'PC-12', seatNumber: 'B-02', status: 'Repairing', currentIssue: 'អេក្រង់ញ័រ', dateFound: '2026-07-28', notes: 'ជាងកំពុងមើល' },
        { id: '3', pcNumber: 'PC-08', seatNumber: 'A-08', status: 'Good', currentIssue: 'Keyboard គាំង', dateFound: '2026-07-20', dateResolved: '2026-07-21', resolution: 'ដោះលាងសម្អាតរួច' },
      ];
      
      const tx = db.transaction('pcIssues', 'readwrite');
      for (const issue of mockIssues) {
        tx.store.add(issue);
      }
      await tx.done;
      setIssues(mockIssues);
    }
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
                  className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្ថានភាព (Status)</label>
              <select className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors">
                <option>ស្ថានភាពទាំងអស់</option>
                <option>មានបញ្ហា</option>
                <option>ជួសជុលរួច</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent">
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
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {issues.length}</span>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10">
              <tr>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">លេខ PC</th>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">លេខតុ</th>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">បញ្ហា / រោគសញ្ញា</th>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">ស្ថានភាព</th>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">ថ្ងៃកត់ត្រា</th>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">ថ្ងៃដោះស្រាយ</th>
                <th className="border-b border-gray-300 px-4 py-3 font-semibold text-sm uppercase tracking-wider">កំណត់សម្គាល់</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.id} className={issue.status === 'Good' ? 'bg-green-50/30' : ''}>
                  <td className="border-b border-gray-200 px-4 py-3 font-bold text-gray-800">{issue.pcNumber}</td>
                  <td className="border-b border-gray-200 px-4 py-3 text-sm">{issue.seatNumber}</td>
                  <td className="border-b border-gray-200 px-4 py-3 font-medium text-red-600">{issue.currentIssue}</td>
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
                  <td className="border-b border-gray-200 px-4 py-3 text-sm">{issue.dateResolved || '---'}</td>
                  <td className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600">
                    {issue.status === 'Good' ? issue.resolution : issue.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PCIssues;
