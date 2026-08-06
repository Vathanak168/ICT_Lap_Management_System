import { Users, Monitor, AlertTriangle, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';

const Dashboard = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [stats, setStats] = useState([
    { title: 'សិស្សសរុប', value: '...', icon: <Users size={24} />, color: 'bg-blue-500' },
    { title: 'គ្រូបង្រៀន', value: '...', icon: <Monitor size={24} />, color: 'bg-emerald-500' },
    { title: 'បញ្ហារាយការណ៍', value: '...', icon: <AlertTriangle size={24} />, color: 'bg-red-500' },
    { title: 'ថ្នាក់រៀន', value: '...', icon: <Clock size={24} />, color: 'bg-purple-500' },
  ]);

  useEffect(() => {
    if (selectedBranch === 'None') {
      setStats([
        { title: 'សិស្សសរុប', value: '-', icon: <Users size={24} />, color: 'bg-blue-500' },
        { title: 'គ្រូបង្រៀន', value: '-', icon: <Monitor size={24} />, color: 'bg-emerald-500' },
        { title: 'បញ្ហារាយការណ៍', value: '-', icon: <AlertTriangle size={24} />, color: 'bg-red-500' },
        { title: 'ថ្នាក់រៀន', value: '-', icon: <Clock size={24} />, color: 'bg-purple-500' },
      ]);
      return;
    }

    const fetchStats = async () => {
      try {
        let studentsQuery = supabase.from('students').select('*', { count: 'exact', head: true });
        let profilesQuery = supabase.from('profiles').select('*', { count: 'exact', head: true });
        let issuesQuery = supabase.from('pc_issues').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
        let classesQuery = supabase.from('classes').select('*', { count: 'exact', head: true });

        if (selectedBranch !== 'All') {
          studentsQuery = studentsQuery.eq('branch', selectedBranch);
          profilesQuery = profilesQuery.eq('branch', selectedBranch);
          issuesQuery = issuesQuery.eq('branch', selectedBranch);
          classesQuery = classesQuery.eq('branch', selectedBranch);
        }

        const [
          { count: studentsCount },
          { count: teachersCount },
          { count: issuesCount },
          { count: classesCount }
        ] = await Promise.all([
          studentsQuery,
          profilesQuery,
          issuesQuery,
          classesQuery
        ]);
        
        setStats([
          { title: 'សិស្សសរុប', value: studentsCount?.toString() || '0', icon: <Users size={24} />, color: 'bg-gradient-to-br from-blue-500 to-blue-700' },
          { title: 'គ្រូបង្រៀន', value: teachersCount?.toString() || '0', icon: <Users size={24} />, color: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
          { title: 'បញ្ហារាយការណ៍', value: issuesCount?.toString() || '0', icon: <AlertTriangle size={24} />, color: 'bg-gradient-to-br from-red-500 to-rose-700' },
          { title: 'ថ្នាក់រៀន', value: classesCount?.toString() || '0', icon: <Clock size={24} />, color: 'bg-gradient-to-br from-purple-500 to-indigo-700' },
        ]);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();
  }, [selectedBranch]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer">ទំព័រដើម</h1>
      <p className="text-slate-500 mb-8 font-khmer text-sm">ទិដ្ឋភាពទូទៅនៃប្រព័ន្ធគ្រប់គ្រងបន្ទប់កុំព្យូទ័រ</p>
      {selectedBranch === 'None' ? (
        <div className="card p-12 text-center flex flex-col items-center justify-center mt-8">
          <Monitor size={48} className="text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">សូមជ្រើសរើសសាខា</h2>
          <p className="text-slate-500 font-khmer">ដើម្បីមើលទិន្នន័យ សូមជ្រើសរើសសាខាណាមួយពីបញ្ជីខាងលើសិន។</p>
        </div>
      ) : (
        <>
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
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="card p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 font-khmer border-b pb-3">សកម្មភាពថ្មីៗ</h2>
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
        </>
      )}
    </div>
  );
};

export default Dashboard;
