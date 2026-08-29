import { useState, useEffect, useMemo } from 'react';
import { Monitor, Download, CheckCircle2, RefreshCw, Trash2, Shield, AlertTriangle, FileDown, ShieldAlert, Cpu } from 'lucide-react';
import { initDB } from '../store/db';
import type { PcSyncTask } from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Button } from '../components/ui/Button';
import { getSetupScript, getResetScript, getSyncPayloadScript } from '../lib/scripts/labScripts';

// Helper to encode string to Base64 using UTF-8
function utf8ToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

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

  const handleDownloadGlobalScript = (type: 'SETUP' | 'RESET') => {
    let scriptContent = '';
    let fileName = '';

    if (type === 'SETUP') {
      scriptContent = getSetupScript();
      fileName = 'SetupLab_PC.ps1';
    } else {
      scriptContent = getResetScript();
      fileName = 'ResetLab_PC.ps1';
    }

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPayload = async (pcNumber: string, pcTasks: PcSyncTask[]) => {
    try {
      // 1. Task Compaction
      // If a student is ADDed and then UPDATE_PASSWORDed, we should just UPSERT them once.
      // If a student is ADDed and then REMOVEd, we should just drop both tasks.
      const studentState = new Map<string, any>();
      
      pcTasks.forEach(task => {
        const existing = studentState.get(task.studentId);
        
        if (task.action === 'ADD' || task.action === 'UPDATE_PASSWORD') {
            studentState.set(task.studentId, {
                action: 'UPSERT',
                studentId: task.studentId,
                password: task.password || '123',
                studentName: task.studentName
            });
        } else if (task.action === 'REMOVE') {
            if (existing && existing.action === 'UPSERT') {
                // If it was just added in this batch, just delete the action entirely, no need to touch the PC.
                // But to be safe if the PC already had it from a previous batch, we should still issue REMOVE.
                // Since our system relies on UPSERT, issuing a REMOVE is safest.
                studentState.set(task.studentId, {
                    action: 'REMOVE',
                    studentId: task.studentId,
                    studentName: task.studentName
                });
            } else {
                studentState.set(task.studentId, {
                    action: 'REMOVE',
                    studentId: task.studentId,
                    studentName: task.studentName
                });
            }
        }
      });

      const finalTasks = Array.from(studentState.values());
      const tasksJson = JSON.stringify(finalTasks);
      
      // 2. Base64 Encoding
      const tasksBase64 = utf8ToBase64(tasksJson);

      // 3. Generate Script
      const script = getSyncPayloadScript(pcNumber, tasksBase64);
      
      // 4. Download
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pcNumber + '.ps1'; // Expected format for USB Listener
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Ask if they want to mark as completed
      if (window.confirm('តើអ្នកបានចម្លង File ' + pcNumber + '.ps1 ចូល USB រួចរាល់ និងចង់សម្គាល់ថាវាបានបញ្ចប់ (Completed) ដែរឬទេ?')) {
        const db = await initDB();
        const updatedTasks = pcTasks.map(t => ({ ...t, status: 'COMPLETED' as const }));
        await db.putMany('pcSyncTasks', updatedTasks as any);
        await fetchTasks();
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('មានបញ្ហាក្នុងការបង្កើត Payload');
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#1a73e8] to-[#1557b0] p-8 rounded-3xl shadow-lg border border-blue-600/30 text-white relative overflow-hidden">
        {/* Abstract Background Design */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner">
              <Cpu className="text-white" size={28} />
            </div>
            <h1 className="text-3xl font-bold font-khmer">ការគ្រប់គ្រងកុំព្យូទ័រ (Lab Sync)</h1>
          </div>
          <p className="text-blue-100 font-khmer text-lg opacity-90 max-w-xl">
            ទាញយក Script ដើម្បីតំឡើងកុំព្យូទ័រ និងធ្វើបច្ចុប្បន្នភាពគណនីសិស្សដោយសុវត្ថិភាពខ្ពស់។
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto relative z-10 mt-4 md:mt-0">
          <Button onClick={fetchTasks} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm backdrop-blur-sm flex items-center gap-2">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {tasks.length > 0 && (
            <Button onClick={handleClearAll} className="bg-red-500/80 hover:bg-red-500 text-white border border-red-500/50 shadow-sm backdrop-blur-sm flex items-center gap-2">
              <Trash2 size={18} />
              Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
        
        {/* Left Column: Global Scripts */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <Shield className="text-indigo-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800 font-khmer">Global Scripts</h2>
            </div>
            
            <div className="p-5 space-y-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5">
                    <FileDown size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Setup Lab PC</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                      Script សម្រាប់តំឡើងកុំព្យូទ័រថ្មី បិទហ្គេម បិទ USB សិស្ស និងរៀបចំកម្មវិធីរង់ចាំ (Listener)។
                    </p>
                    <Button onClick={() => handleDownloadGlobalScript('SETUP')} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-none shadow-sm flex justify-center items-center gap-2 h-9">
                      <Download size={16} /> 
                      <span className="font-semibold text-sm">Download Setup</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-100"></div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-50 text-red-600 mt-0.5">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-700 text-sm mb-1">Factory Reset</h3>
                    <p className="text-xs text-red-500/80 leading-relaxed mb-3">
                      Script សម្រាប់លុបចោលនូវរាល់គណនីសិស្ស និងបើកសិទ្ធិកុំព្យូទ័រឲ្យដូចដើមវិញ។
                    </p>
                    <Button onClick={() => handleDownloadGlobalScript('RESET')} className="w-full bg-red-50 hover:bg-red-100 text-red-700 border-none shadow-sm flex justify-center items-center gap-2 h-9">
                      <AlertTriangle size={16} /> 
                      <span className="font-semibold text-sm">Download Reset</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pending PC Tasks */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800 font-khmer flex items-center gap-3 mb-4">
            <Monitor className="text-slate-500" size={24} />
            កុំព្យូទ័រដែលកំពុងរង់ចាំ (Pending Sync)
          </h2>

          {isLoading ? (
            <div className="flex justify-center items-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : tasksByPc.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-16 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="text-green-500" size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 font-khmer mb-2">មិនមានភារកិច្ចរង់ចាំទេ</h3>
              <p className="text-slate-500 font-khmer text-lg">កុំព្យូទ័រទាំងអស់បានធ្វើបច្ចុប្បន្នភាពរួចរាល់</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {tasksByPc.map(([pcNumber, pcTasks]) => (
                <div key={pcNumber} className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200">
                  <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center transition-colors group-hover:from-blue-50/50 group-hover:to-white">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-inner group-hover:bg-[#1a73e8] group-hover:text-white transition-colors">
                        <Monitor size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{pcNumber}</h3>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 mt-1 inline-block border border-orange-200">
                          {pcTasks.length} PENDING
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 overflow-y-auto max-h-[220px] space-y-2.5 custom-scrollbar">
                    {pcTasks.map(task => (
                      <div key={task.id} className="flex flex-col gap-1.5 text-sm bg-slate-50/50 hover:bg-slate-50 p-3 rounded-xl border border-slate-100 transition-colors">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-700">{task.studentName}</span>
                          <span className={"text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md tracking-wide " + (
                            task.action === 'ADD' ? 'bg-green-100 text-green-700' :
                            task.action === 'REMOVE' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          )}>
                            {task.action}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono bg-white px-2 py-0.5 rounded border border-slate-100 w-fit">{task.studentId}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                    <Button 
                      onClick={() => handleDownloadPayload(pcNumber, pcTasks)}
                      className="w-full flex justify-center items-center gap-2 h-11 bg-white hover:bg-blue-50 text-[#1a73e8] border border-blue-200 shadow-sm transition-all group-hover:bg-[#1a73e8] group-hover:text-white group-hover:border-[#1a73e8]"
                    >
                      <Download size={18} />
                      <span className="font-bold tracking-wide text-sm">DOWNLOAD PAYLOAD</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PcSync;
