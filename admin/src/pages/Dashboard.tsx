import { useEffect, useState } from 'react';
import { 
  Users, 
  Monitor, 
  AlertTriangle, 
  GraduationCap, 
  Plus, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowUpRight, 
  Layers, 
  UserPlus, 
  Wrench,
  Clock,
  Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOutletContext, Link } from 'react-router-dom';

interface RecentItem {
  id: string;
  type: 'student' | 'issue' | 'class';
  title: string;
  subtitle: string;
  time: string;
  badge?: string;
  badgeColor?: string;
}

const Dashboard = () => {
  const { selectedBranch, selectedYear } = useOutletContext<{ selectedBranch: string; selectedYear: string }>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    studentsCount: 0,
    boysCount: 0,
    girlsCount: 0,
    classesCount: 0,
    morningClasses: 0,
    afternoonClasses: 0,
    issuesCount: 0,
    resolvedIssuesCount: 0,
    usersCount: 0,
    teachersCount: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentItem[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // 1. Build queries
        let studentsQ = supabase.from('students').select('id, gender, name, english_name, class, created_at, status');
        let classesQ = supabase.from('classes').select('id, name, shift, academic_year');
        let issuesQ = supabase.from('pc_issues').select('id, pc_number, description, status, reported_date');
        let profilesQ = supabase.from('profiles').select('id, role, name, email');

        if (selectedBranch !== 'All') {
          studentsQ = studentsQ.eq('branch', selectedBranch);
          classesQ = classesQ.eq('branch', selectedBranch);
          issuesQ = issuesQ.eq('branch', selectedBranch);
          profilesQ = profilesQ.eq('branch', selectedBranch);
        }

        if (selectedYear && selectedYear !== 'All') {
          studentsQ = studentsQ.eq('academic_year', selectedYear);
          classesQ = classesQ.eq('academic_year', selectedYear);
        }

        const [studentsRes, classesRes, issuesRes, profilesRes] = await Promise.all([
          studentsQ,
          classesQ,
          issuesQ,
          profilesQ
        ]);

        const studentsData = studentsRes.data || [];
        const classesData = classesRes.data || [];
        const issuesData = issuesRes.data || [];
        const profilesData = profilesRes.data || [];

        const boys = studentsData.filter((s: any) => s.gender === 'M').length;
        const girls = studentsData.filter((s: any) => s.gender === 'F').length;
        const morningCls = classesData.filter((c: any) => c.shift === 'Morning').length;
        const afternoonCls = classesData.filter((c: any) => c.shift === 'Afternoon').length;
        const pendingIssues = issuesData.filter((i: any) => i.status !== 'Resolved').length;
        const resolvedIssues = issuesData.filter((i: any) => i.status === 'Resolved').length;
        const teachers = profilesData.filter((p: any) => p.role === 'teacher').length;

        setStats({
          studentsCount: studentsData.length,
          boysCount: boys,
          girlsCount: girls,
          classesCount: classesData.length,
          morningClasses: morningCls,
          afternoonClasses: afternoonCls,
          issuesCount: pendingIssues,
          resolvedIssuesCount: resolvedIssues,
          usersCount: profilesData.length,
          teachersCount: teachers,
        });

        // 2. Build real activity feed
        const activities: RecentItem[] = [];

        // Add recent students
        studentsData.slice(0, 4).forEach((s: any) => {
          activities.push({
            id: s.id,
            type: 'student',
            title: `សិស្សថ្មី៖ ${s.name || s.english_name}`,
            subtitle: `${s.english_name || ''} (${s.gender === 'M' ? 'ប្រុស' : 'ស្រី'})`,
            time: 'ថ្មីៗនេះ',
            badge: 'ចុះឈ្មោះ',
            badgeColor: 'bg-blue-100 text-blue-700 border-blue-200'
          });
        });

        // Add recent issues
        issuesData.slice(0, 3).forEach((i: any) => {
          activities.push({
            id: i.id,
            type: 'issue',
            title: `បញ្ហាលើ ${i.pc_number}៖ ${i.description || 'ត្រូវការជួសជុល'}`,
            subtitle: i.status === 'Resolved' ? 'បានដោះស្រាយរួច' : 'កំពុងរង់ចាំពិនិត្យ',
            time: i.reported_date ? new Date(i.reported_date).toLocaleDateString() : 'ថ្មីៗនេះ',
            badge: i.status === 'Resolved' ? 'ជោគជ័យ' : 'កំពុងរង់ចាំ',
            badgeColor: i.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
          });
        });

        setRecentActivities(activities);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedBranch, selectedYear]);

  const labHealthPercent = stats.issuesCount === 0 
    ? 100 
    : Math.max(10, Math.round((36 - stats.issuesCount) / 36 * 100));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome & Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-100 text-xs font-semibold mb-1">
            <Sparkles size={13} className="text-amber-300" />
            <span>ប្រព័ន្ធគ្រប់គ្រងបន្ទប់កុំព្យូទ័រ ICT Lab</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-khmer tracking-tight">
            ទិដ្ឋភាពទូទៅនៃប្រព័ន្ធ
          </h1>
          <p className="text-blue-100/80 text-xs sm:text-sm font-khmer max-w-xl leading-relaxed">
            កំពុងបង្ហាញទិន្នន័យសម្រាប់សាខា <strong className="text-white font-bold">{selectedBranch}</strong> · ឆ្នាំសិក្សា <strong className="text-white font-bold">{selectedYear}</strong>
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2.5">
          <Link
            to="/students"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-xs sm:text-sm font-khmer shadow-md hover:bg-blue-50 transition-all active:scale-95"
          >
            <UserPlus size={16} />
            <span>គ្រប់គ្រងសិស្ស</span>
          </Link>
          <Link
            to="/labs"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 border border-white/20 text-white font-bold text-xs sm:text-sm font-khmer backdrop-blur-md transition-all active:scale-95"
          >
            <Monitor size={16} />
            <span>ពិនិត្យ PC Lab</span>
          </Link>
        </div>
      </div>

      {/* Main 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users size={22} />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-khmer">
              សកម្ម
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans">
            {loading ? '...' : stats.studentsCount}
          </h3>
          <p className="text-xs font-bold text-slate-500 font-khmer mt-0.5">សិស្សសរុប</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-khmer">
            <span>ប្រុស: <strong className="text-slate-700">{stats.boysCount}</strong></span>
            <span>ស្រី: <strong className="text-slate-700">{stats.girlsCount}</strong></span>
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <GraduationCap size={22} />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-khmer">
              ថ្នាក់សកម្ម
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans">
            {loading ? '...' : stats.classesCount}
          </h3>
          <p className="text-xs font-bold text-slate-500 font-khmer mt-0.5">ថ្នាក់រៀនសរុប</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-khmer">
            <span>វេនព្រឹក: <strong className="text-slate-700">{stats.morningClasses}</strong></span>
            <span>វេនរសៀល: <strong className="text-slate-700">{stats.afternoonClasses}</strong></span>
          </div>
        </div>

        {/* Reported PC Issues */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={22} />
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full font-khmer ${stats.issuesCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {stats.issuesCount > 0 ? `${stats.issuesCount} បញ្ហា` : 'ដំណើរការល្អ'}
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans">
            {loading ? '...' : stats.issuesCount}
          </h3>
          <p className="text-xs font-bold text-slate-500 font-khmer mt-0.5">បញ្ហាកំពុងរង់ចាំ</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-khmer">
            <span>បានដោះស្រាយ: <strong className="text-emerald-600 font-bold">{stats.resolvedIssuesCount}</strong></span>
            <Link to="/labs" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
              ពិនិត្យ <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>

        {/* Staff & Teachers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldAlert size={22} />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-khmer">
              បុគ្គលិក
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans">
            {loading ? '...' : stats.usersCount}
          </h3>
          <p className="text-xs font-bold text-slate-500 font-khmer mt-0.5">គណនីគ្រូ & Admin</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-khmer">
            <span>គ្រូបង្រៀន: <strong className="text-slate-700">{stats.teachersCount}</strong></span>
            <Link to="/users" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
              គ្រប់គ្រង <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Sections: Lab Health & Quick Actions & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: PC Health Status + Quick Action Grid */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lab Health Status Bar */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Monitor size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 font-khmer text-sm">ស្ថានភាពសុខភាពកុំព្យូទ័រក្នុងបន្ទប់ Lab</h3>
                  <p className="text-xs text-slate-500 font-khmer">ផ្អែកលើរបាយការណ៍បញ្ហាក្នុងសាខា {selectedBranch}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-600">{labHealthPercent}% ល្អ</span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mt-3">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${labHealthPercent > 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-500 to-rose-500'}`}
                style={{ width: `${labHealthPercent}%` }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-khmer">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>ដំណើរការប្រក្រតី: ~36 តុ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-500" />
                <span>រង់ចាំជួសជុល: {stats.issuesCount} តុ</span>
              </div>
              <Link to="/labs" className="text-blue-600 font-bold hover:underline">
                មើលប្លង់ PC &rarr;
              </Link>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-800 font-khmer text-sm mb-4 flex items-center gap-2">
              <Layers size={17} className="text-indigo-600" />
              <span>ផ្លូវកាត់គ្រប់គ្រងរហ័ស</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link
                to="/students"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200/60 transition-all font-khmer text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserPlus size={18} />
                </div>
                <span className="text-xs font-bold leading-tight">បន្ថែមសិស្ស</span>
              </Link>

              <Link
                to="/classes"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200/60 transition-all font-khmer text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={18} />
                </div>
                <span className="text-xs font-bold leading-tight">បង្កើតថ្នាក់រៀន</span>
              </Link>

              <Link
                to="/labs"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200/60 transition-all font-khmer text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wrench size={18} />
                </div>
                <span className="text-xs font-bold leading-tight">រាយការណ៍ PC</span>
              </Link>

              <Link
                to="/users"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/60 transition-all font-khmer text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={18} />
                </div>
                <span className="text-xs font-bold leading-tight">គ្រប់គ្រង User</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Real Activity Feed */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 font-khmer text-sm flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                <span>សកម្មភាពថ្មីៗក្នុងប្រព័ន្ធ</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-400 font-khmer">ថ្មីបំផុត</span>
            </div>

            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-khmer">
                  មិនទាន់មានសកម្មភាពកត់ត្រាថ្មីៗទេ។
                </div>
              ) : (
                recentActivities.map((act, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${act.type === 'student' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 font-khmer truncate">{act.title}</p>
                      <p className="text-[11px] text-slate-400 font-khmer truncate">{act.subtitle}</p>
                    </div>
                    {act.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 font-khmer ${act.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {act.badge}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              to="/students"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 font-khmer flex items-center justify-center gap-1 py-1"
            >
              <span>មើលទិន្នន័យសិស្សទាំងអស់</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
