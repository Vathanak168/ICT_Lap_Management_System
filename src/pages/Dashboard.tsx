import { useState, useEffect } from 'react';
import { Users, CheckCircle, Monitor, BookOpen, AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { initDB } from '../store/db';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    pcIssues: 0,
    attendanceRate: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const db = await initDB();
      const students = await db.getAll('students');
      const activeStudents = students.filter(s => s.status !== 'Inactive');
      
      const pcIssues = await db.getAll('pcIssues');
      const activeIssues = pcIssues.filter(i => i.status !== 'Good');

      // In a real app, calculate actual attendance rate for today
      // For now we mock the percentage but use real student count
      
      setStats({
        totalStudents: activeStudents.length,
        pcIssues: activeIssues.length,
        attendanceRate: 95 // Mock percentage for UI purposes
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  return (
    <div className="flex flex-col w-full h-full pb-4">


      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-[#2a5298] border-none rounded-2xl p-5 shadow-md hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer text-white" onClick={() => navigate('/students')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
            <Users size={80} />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/30">
              <Users size={32} className="text-white" />
            </div>
            <div>
              <p className="text-base font-medium text-blue-100 mb-0.5">សិស្សសរុប (Students)</p>
              <h3 className="text-4xl font-bold">{stats.totalStudents > 0 ? stats.totalStudents : '១២៤'}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 border-none rounded-2xl p-5 shadow-md hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer text-white" onClick={() => navigate('/attendance')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
            <CheckCircle size={80} />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/30">
              <CheckCircle size={32} className="text-white" />
            </div>
            <div>
              <p className="text-base font-medium text-emerald-100 mb-0.5">វត្តមានថ្ងៃនេះ (Attendance)</p>
              <h3 className="text-4xl font-bold">{stats.attendanceRate}%</h3>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-500 border-none rounded-2xl p-5 shadow-md hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer text-white" onClick={() => navigate('/issues')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
            <Monitor size={80} />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/30">
              <Monitor size={32} className="text-white" />
            </div>
            <div>
              <p className="text-base font-medium text-orange-100 mb-0.5">PC មានបញ្ហា (Issues)</p>
              <h3 className="text-4xl font-bold">{stats.pcIssues > 0 ? stats.pcIssues : '៣'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* To-Do List */}
        <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-[#2a5298]" />
              <h2 className="text-base font-bold text-gray-800">ការងារត្រូវធ្វើ (Today's To-Dos)</h2>
            </div>
            <Badge variant="default" className="text-[10px] bg-[#2a5298]">៣ ភារកិច្ច</Badge>
          </div>
          <div className="p-3">
            <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border-l-4 border-orange-400 mb-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-gray-100 border-l-orange-400">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5">កត់វត្តមានថ្នាក់ 6A</h4>
                <p className="text-xs text-gray-500">មិនទាន់បានកត់សម្រាប់ថ្ងៃនេះទេ សូមប្រញាប់បំពេញ។</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/attendance')} className="text-xs py-1 px-2 h-auto">កត់ឥឡូវនេះ</Button>
            </div>
            
            <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border-l-4 border-red-500 mb-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-gray-100 border-l-red-500">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5">PC-05 ខូច Mouse</h4>
                <p className="text-xs text-gray-500">តុអង្គុយរបស់ សុខ ដារ៉ា (ថ្នាក់ 7B) មិនអាចចុចឆ្វេងស្តាំបាន។</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/issues')} className="text-xs py-1 px-2 h-auto">មើលបញ្ហា</Button>
            </div>
            
            <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border-l-4 border-blue-400 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-gray-100 border-l-blue-400">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5">បញ្ចូលពិន្ទុ Word លំហាត់ទី២</h4>
                <p className="text-xs text-gray-500">ថ្នាក់ 8C ទើបប្រឡងរួចម្សិលមិញ។</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/grades')} className="text-xs py-1 px-2 h-auto">បញ្ចូលពិន្ទុ</Button>
            </div>
          </div>
          <div className="p-3 border-t border-border mt-auto bg-gray-50/50">
            <button className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-bold text-gray-500 hover:text-[#2a5298] transition-colors">
              មើលភារកិច្ចទាំងអស់ <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-base font-bold text-gray-800">ការព្រមាន (Alerts)</h2>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="mt-0.5 bg-white p-1.5 rounded-full shadow-sm text-orange-500 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-0.5">មេសា (ថ្នាក់ 6A)</h4>
                <p className="text-xs text-orange-700">សិស្សនេះបានអវត្តមាន ៣ ដងជាប់គ្នាក្នុងសប្តាហ៍នេះ។ សូមទាក់ទងទៅទីប្រឹក្សា។</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
              <div className="mt-0.5 bg-white p-1.5 rounded-full shadow-sm text-red-500 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-0.5">វិច្ឆិកា (ថ្នាក់ 7B)</h4>
                <p className="text-xs text-red-700">ពិន្ទុធ្លាក់ចុះខ្លាំងក្នុងខែនេះ ជាពិសេសផ្នែក Excel។ ត្រូវការការណែនាំបន្ថែម។</p>
              </div>
            </div>
            
            <div className="mt-3 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 bg-gray-50/50">
              <BookOpen size={24} className="mb-2 opacity-50" />
              <p className="font-medium text-xs">មិនមានការព្រមានថ្មីៗទេ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
