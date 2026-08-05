import { Users, Monitor, AlertTriangle, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState([
    { title: 'សិស្សសរុប (Total Students)', value: '0', icon: <Users size={24} />, color: 'bg-blue-500' },
    { title: 'កុំព្យូទ័រកំពុងប្រើ (Active PCs)', value: '0', icon: <Monitor size={24} />, color: 'bg-emerald-500' },
    { title: 'បញ្ហារាយការណ៍ (Issues)', value: '0', icon: <AlertTriangle size={24} />, color: 'bg-red-500' },
    { title: 'វេនសិក្សា (Active Shifts)', value: '0', icon: <Clock size={24} />, color: 'bg-purple-500' },
  ]);

  useEffect(() => {
    // Basic implementation for dashboard stats
    const fetchStats = async () => {
      try {
        const { count: studentsCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
        
        setStats(prev => [
          { ...prev[0], value: studentsCount?.toString() || '0' },
          { ...prev[1], value: '25' }, // Mock data for now
          { ...prev[2], value: '3' },
          { ...prev[3], value: '4' },
        ]);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer">ទំព័រដើម (Dashboard)</h1>
      <p className="text-slate-500 mb-8 font-khmer text-sm">ទិដ្ឋភាពទូទៅនៃប្រព័ន្ធគ្រប់គ្រងបន្ទប់កុំព្យូទ័រ</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="card p-6 flex flex-col hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${stat.color} text-white flex-center shadow-lg shadow-${stat.color}/30 group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-800 mb-1">{stat.value}</h3>
              <p className="text-sm font-medium text-slate-500 font-khmer">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Quick Actions or Recent Activity could go here */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 font-khmer border-b pb-3">សកម្មភាពថ្មីៗ (Recent Activity)</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <p className="text-slate-600 flex-1">សិស្ស <span className="font-bold">S001</span> បាន Login ចូល</p>
              <span className="text-slate-400">10 នាទីមុន</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <p className="text-slate-600 flex-1">រាយការណ៍បញ្ហា <span className="font-bold">PC-05</span></p>
              <span className="text-slate-400">1 ម៉ោងមុន</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
