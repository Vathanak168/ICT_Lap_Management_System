import { useState, useEffect } from 'react';
import { BookOpen, Plus, Calendar, Search } from 'lucide-react';
import { initDB } from '../store/db';
import type { LessonLog as LogType, ClassRecord } from '../store/db';
import './LessonLog.css';

const LessonLog = () => {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState('All');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const db = await initDB();
    const allLogs = await db.getAll('lessonLogs');
    const allClasses = await db.getAll('classes');
    setClasses(allClasses);
    setLogs(allLogs);

    if (allLogs.length === 0) {
      const mockLogs: LogType[] = [
        { id: '1', date: '2026-08-01', class: '6A_Morning', topic: 'Microsoft Word - Format Text', exercises: 'លំហាត់ទី ១ (វាយអត្ថបទ និងកែពណ៌)', notes: 'សិស្សភាគច្រើនយល់ ប៉ុន្តែមេសា វាយអក្សរយឺត។ លើកក្រោយត្រូវបង្រៀន Insert Table។' },
        { id: '2', date: '2026-08-02', class: '7B_Afternoon', topic: 'Excel - Basic Formulas (SUM, AVERAGE)', exercises: 'លំហាត់គណនាប្រាក់ខែ', notes: 'សិស្សឆាប់យល់។ គួររំលឹកឡើងវិញនៅសប្តាហ៍ក្រោយមុនចូល IF function។' },
      ];
      
      const tx = db.transaction('lessonLogs', 'readwrite');
      for (const log of mockLogs) {
        tx.store.add(log);
      }
      await tx.done;
      setLogs(mockLogs);
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
          <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[250px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input 
                  type="text"
                  placeholder="ស្វែងរកតាមមេរៀន ឬកំណត់សម្គាល់..."
                  className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ថ្នាក់រៀន (Class Name)</label>
              <select 
                className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="All">ថ្នាក់ទាំងអស់</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent">
              <Plus size={16} /> បន្ថែមរឿងហេតុថ្មី
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: List */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់ហេតុបង្រៀន (Lesson Logs)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {logs.length} កំណត់ហេតុ</span>
        </div>
        <div className="overflow-x-auto p-6 flex flex-col gap-4 bg-gray-50/30">
          {logs.map(log => (
            <div key={log.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1 leading-tight">{log.topic}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> {log.date}
                      </span>
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-sm font-medium border border-gray-200">
                        {classes.find(c => c.id === log.class)?.name || log.class}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex items-start">
                  <button className="text-sm font-medium text-gray-500 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-sm transition-colors">
                    កែប្រែ
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50/50 p-4 rounded-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">លំហាត់ដែលបានដាក់</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">{log.exercises || 'មិនមាន'}</p>
                </div>
                <div className="bg-yellow-50/30 p-4 rounded-sm border border-yellow-100">
                  <h4 className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-2">កំណត់សម្គាល់ / វាយតម្លៃ</h4>
                  <p className="text-gray-800 text-sm leading-relaxed font-medium">{log.notes}</p>
                </div>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BookOpen size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium text-gray-600">មិនទាន់មានកំណត់ហេតុទេ</p>
              <p className="text-sm mt-1">សូមចុចប៊ូតុង "បន្ថែមរឿងហេតុថ្មី" ដើម្បីកត់ត្រា។</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonLog;
