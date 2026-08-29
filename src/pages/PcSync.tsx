import { useState, useEffect, useMemo } from 'react';
import { Monitor, Download, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { initDB } from '../store/db';
import type { PcSyncTask } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';

const PcSync = () => {
  const [tasks, setTasks] = useState<PcSyncTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { activeYear } = useAcademicYear();

  const fetchTasks = async () => {
    if (!activeYear) return;
    setIsLoading(true);
    try {
      const db = await initDB();
      const allTasks = await db.getAll('pcSyncTasks', activeYear);
      setTasks(allTasks.filter(t => t.status === 'PENDING').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeYear]);

  // Group tasks by PC
  const tasksByPc = useMemo(() => {
    const grouped = new Map<string, PcSyncTask[]>();
    tasks.forEach(task => {
      if (!grouped.has(task.pcNumber)) {
        grouped.set(task.pcNumber, []);
      }
      grouped.get(task.pcNumber)!.push(task);
    });
    // Sort by PC number numerically if possible
    return Array.from(grouped.entries()).sort((a, b) => {
      const numA = parseInt(a[0].replace(/\D/g, '') || '0');
      const numB = parseInt(b[0].replace(/\D/g, '') || '0');
      if (numA !== numB) return numA - numB;
      return a[0].localeCompare(b[0]);
    });
  }, [tasks]);

  const generateScriptContent = (pcTasks: PcSyncTask[], pcNumber: string) => {
    let script = `# Auto-generated script for ${pcNumber}\n`;
    script += `# Created at: ${new Date().toLocaleString()}\n\n`;

    pcTasks.forEach(task => {
      script += `# [${task.action}] Student: ${task.studentName} (${task.studentId})\n`;
      if (task.action === 'ADD') {
        script += `net user "${task.studentId}" "${task.password || '123'}" /add\n`;
        // Uncomment if you want to add to Users group:
        // script += `net localgroup "Users" "${task.studentId}" /add\n`;
      } else if (task.action === 'REMOVE') {
        script += `net user "${task.studentId}" /delete\n`;
      } else if (task.action === 'UPDATE_PASSWORD') {
        script += `net user "${task.studentId}" "${task.password || '123'}"\n`;
      }
      script += '\n';
    });
    
    script += 'Write-Host "Sync completed successfully."\n';
    script += 'Pause\n';
    return script;
  };

  const handleDownload = async (pcNumber: string, pcTasks: PcSyncTask[]) => {
    try {
      const script = generateScriptContent(pcTasks, pcNumber);
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sync_${pcNumber.replace(/\s+/g, '_')}_${new Date().getTime()}.ps1`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Ask if they want to mark as completed
      if (window.confirm(`តើអ្នកចង់សម្គាល់ភារកិច្ចរបស់ ${pcNumber} ថាបានបញ្ចប់ (Completed) ដែរឬទេ?`)) {
        const db = await initDB();
        const updatedTasks = pcTasks.map(t => ({ ...t, status: 'COMPLETED' as const }));
        // Note: putMany may have issues with type casting here, cast as any if it fails
        await db.putMany('pcSyncTasks', updatedTasks as any);
        await fetchTasks();
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('មានបញ្ហាក្នុងការទាញយក Script');
    }
  };

  const handleClearAll = async () => {
    if (tasks.length === 0) return;
    if (window.confirm('តើអ្នកពិតជាចង់លុបចោលភារកិច្ចទាំងអស់មែនទេ? (លុបហើយមិនអាចយកមកវិញបានទេ)')) {
      try {
        const db = await initDB();
        for (const task of tasks) {
          await db.delete('pcSyncTasks', task.id);
        }
        await fetchTasks();
      } catch (error) {
        console.error('Clear failed:', error);
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-khmer flex items-center gap-3">
            <Monitor className="text-blue-500" size={28} />
            PC Sync Scripts
          </h1>
          <p className="text-slate-500 mt-1 font-khmer">គ្រប់គ្រង និងទាញយក Script សម្រាប់អាប់ដេតកុំព្យូទ័រ</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button onClick={fetchTasks} variant="secondary" className="flex items-center gap-2">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {tasks.length > 0 && (
            <Button onClick={handleClearAll} variant="danger" className="flex items-center gap-2">
              <Trash2 size={18} />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : tasksByPc.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle2 className="mx-auto text-green-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-slate-800 font-khmer mb-2">មិនមានភារកិច្ចរង់ចាំទេ</h3>
          <p className="text-slate-500 font-khmer">កុំព្យូទ័រទាំងអស់បានធ្វើបច្ចុប្បន្នភាពរួចរាល់</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tasksByPc.map(([pcNumber, pcTasks]) => (
            <div key={pcNumber} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    <Monitor size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{pcNumber}</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                      {pcTasks.length} Pending
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto max-h-64 space-y-3">
                {pcTasks.map(task => (
                  <div key={task.id} className="flex flex-col gap-1 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-700">{task.studentName}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        task.action === 'ADD' ? 'bg-green-100 text-green-700' :
                        task.action === 'REMOVE' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {task.action}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{task.studentId}</span>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-white">
                <Button 
                  onClick={() => handleDownload(pcNumber, pcTasks)}
                  className="w-full flex justify-center items-center gap-2"
                >
                  <Download size={18} />
                  <span className="font-khmer">Download Script</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PcSync;
