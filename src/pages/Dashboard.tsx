import { useState, useEffect, useRef } from 'react';
import { Users, CheckCircle, Monitor, AlertTriangle, Clock, Info } from 'lucide-react';
import { initDB } from '../store/db';
import type { PCIssue } from '../store/db';
import { Badge } from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const getLocalDate = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    pcIssues: 0,
    attendanceRate: 0
  });
  
  const [activePCIssues, setActivePCIssues] = useState<PCIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { activeYear } = useAcademicYear();
  const loadRequestRef = useRef(0);

  useEffect(() => {
    if (!activeYear) {
      setStats({
        totalStudents: 0,
        pcIssues: 0,
        attendanceRate: 0
      });
      setActivePCIssues([]);
      setIsLoading(false);
      setErrorMsg('');
      loadRequestRef.current++;
      return;
    }

    const requestId = ++loadRequestRef.current;
    
    // Clear old data and set loading
    setStats({ totalStudents: 0, pcIssues: 0, attendanceRate: 0 });
    setActivePCIssues([]);
    setIsLoading(true);
    setErrorMsg('');

    const loadDashboardData = async () => {
      try {
        const db = await initDB();
        
        const [students, pcIssues, allAttendance] = await Promise.all([
          db.getAll('students', activeYear),
          db.getAll('pcIssues', activeYear),
          db.getAll('attendance', activeYear)
        ]);

        if (requestId !== loadRequestRef.current) return;

        const activeStudents = students.filter(s => s.status !== 'Inactive');
        const activeIssues = pcIssues.filter(i => i.status !== 'Good');
        
        // Calculate today's real attendance rate
        const today = getLocalDate();
        const todaysRecords = allAttendance.filter(r => r.date === today);
        
        let totalStudentsPresent = 0;
        let totalStudentsRecorded = 0;
        
        todaysRecords.forEach(record => {
          const statuses = Object.values(record.records);
          // Only count explicit statuses 'P', 'A', 'L', 'E'
          const explicitStatuses = statuses.filter(s => ['P', 'A', 'L', 'E'].includes(s));
          
          totalStudentsRecorded += explicitStatuses.length;
          // Count 'P' (Present) and 'L' (Late) as attending
          totalStudentsPresent += explicitStatuses.filter(s => s === 'P' || s === 'L').length;
        });
        
        let calculatedRate = 0;
        if (totalStudentsRecorded > 0) {
          calculatedRate = Math.round((totalStudentsPresent / totalStudentsRecorded) * 100);
        }

        setStats({
          totalStudents: activeStudents.length,
          pcIssues: activeIssues.length,
          attendanceRate: calculatedRate
        });
        
        setActivePCIssues(activeIssues);
        
      } catch (error: any) {
        if (requestId === loadRequestRef.current) {
          console.error("Error loading dashboard data:", error);
          setErrorMsg(error.message || 'បរាជ័យក្នុងការទាញយកទិន្នន័យ (Failed to load data).');
          setStats({ totalStudents: 0, pcIssues: 0, attendanceRate: 0 });
          setActivePCIssues([]);
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          setIsLoading(false);
        }
      }
    };
    
    void loadDashboardData();
    
    return () => {
      loadRequestRef.current++;
    };
  }, [activeYear]);

  return (
    <div className="flex flex-col w-full h-full pb-4 relative">
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center pt-20">
           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2a5298] mb-4"></div>
           <p className="text-[#2a5298] font-medium">កំពុងផ្ទុកទិន្នន័យ...</p>
        </div>
      )}
      
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 shadow-sm flex items-start gap-3">
           <AlertTriangle size={20} className="shrink-0 mt-0.5" />
           <div>
             <h4 className="font-bold text-sm">មានកំហុស (Error)</h4>
             <p className="text-sm">{errorMsg}</p>
           </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
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
              <h3 className="text-4xl font-bold">{stats.totalStudents > 0 ? stats.totalStudents : '០'}</h3>
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
              <p className="text-base font-medium text-emerald-100 mb-0.5">អត្រាវត្តមានថ្ងៃនេះ (Attendance Rate)</p>
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
              <h3 className="text-4xl font-bold">{stats.pcIssues > 0 ? stats.pcIssues : '០'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* Alerts & Notifications (PC Issues) */}
        <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-base font-bold text-gray-800">ការព្រមាន & បញ្ហាPC (Alerts & PC Issues)</h2>
            </div>
            <Badge variant="default" className="text-[10px] bg-red-500">{activePCIssues.length} បញ្ហា</Badge>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {activePCIssues.length > 0 ? (
              activePCIssues.map(issue => (
                <div key={issue.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => navigate('/issues')}>
                  <div className="mt-0.5 bg-white p-1.5 rounded-full shadow-sm text-red-500 shrink-0">
                    <Monitor size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-0.5">PC ទី {issue.pcNumber}</h4>
                    {/* Fixed from currentIssue to description */}
                    <p className="text-xs text-red-700">{issue.description || 'មិនមានការពិពណ៌នាបញ្ហា'}</p>
                    <p className="text-[10px] text-red-600 mt-1 opacity-80">រាយការណ៍នៅថ្ងៃទី: {issue.dateFound || 'N/A'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="mt-3 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 bg-gray-50/50">
                <CheckCircle size={24} className="mb-2 opacity-50 text-emerald-500" />
                <p className="font-medium text-xs">មិនមានបញ្ហាកុំព្យូទ័រថ្មីៗទេ (All PCs Good!)</p>
              </div>
            )}
          </div>
        </div>

        {/* To-Do List */}
        <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-[#2a5298]" />
              <h2 className="text-base font-bold text-gray-800">ការងារត្រូវធ្វើ (To-Dos)</h2>
            </div>
          </div>
          <div className="p-3 flex-1 flex flex-col">
            
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 h-full min-h-[200px]">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                <Info size={24} />
              </div>
              <h4 className="text-sm font-medium text-gray-600 mb-1">ស្អាតល្អ! អ្នកមិនមានការងារដែលយឺតយ៉ាវទេ</h4>
              <p className="text-xs text-gray-500 max-w-[250px]">មុខងារតាមដានការងារប្រចាំថ្ងៃនឹងរំលឹកអ្នកនៅទីនេះដោយស្វ័យប្រវត្តិ នៅពេលមានកិច្ចការបន្ទាន់។</p>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
