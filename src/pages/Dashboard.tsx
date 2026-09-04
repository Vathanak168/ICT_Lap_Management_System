import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Monitor,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initDB } from '../store/db';
import type {
  ClassCurriculumRecord,
  ClassRecord,
  CurriculumLessonRecord,
  PCIssue,
  Shift,
  SubjectRecord,
  TeachingLogRecord,
  TeachingScheduleRecord,
} from '../store/db';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { useAuth } from '../contexts/AuthContext';

const BRAND_BLUE = '#2a5298';

const getLocalDate = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatKhmerDate = (dateObj: Date = new Date()) => {
  const days = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  return `ថ្ងៃ${days[dateObj.getDay()]} ទី${dateObj.getDate()} ខែ${months[dateObj.getMonth()]} ឆ្នាំ${dateObj.getFullYear()}`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'អរុណសួស្តី';
  if (hour < 17) return 'ទិវាសួស្តី';
  return 'សាយណ្ហសួស្តី';
};

const formatClassName = (name: string) => {
  const normalized = name.trim();
  return normalized.startsWith('ថ្នាក់ទី') ? normalized : `ថ្នាក់ទី ${normalized}`;
};

const shiftLabel = (shift: Shift) => (
  shift === 'Morning' ? 'ព្រឹក' : shift === 'Afternoon' ? 'រសៀល' : 'យប់'
);

const minutesFromTime = (value: string) => {
  const [hours = 0, minutes = 0] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  pcIssues: number;
  attendanceRate: number | null;
  attendanceRecorded: number;
  attendanceClassCount: number;
  absentToday: number;
  lateToday: number;
}

interface MetricCardProps {
  title: string;
  value: ReactNode;
  detail: string;
  icon: typeof Users;
  iconClass: string;
  iconBackground: string;
  onClick: () => void;
}

const MetricCard = ({ title, value, detail, icon: Icon, iconClass, iconBackground, onClick }: MetricCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative w-full rounded-2xl border border-border/80 bg-surface p-5 text-left shadow-xs transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md focus:outline-hidden active:scale-99 cursor-pointer overflow-hidden"
  >
    <div className="flex items-start justify-between gap-3">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-2xs transition-transform group-hover:scale-105 ${iconBackground}`}>
        <Icon size={22} className={iconClass} />
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-secondary-text transition-all group-hover:bg-primary group-hover:text-white group-hover:translate-x-0.5 shadow-2xs">
        <ChevronRight size={15} />
      </div>
    </div>
    <p className="mt-3.5 text-[11px] font-bold text-secondary-text uppercase tracking-wider">{title}</p>
    <div className="mt-1 flex items-baseline justify-between gap-3">
      <strong className="text-2xl font-bold tracking-tight text-main-text">{value}</strong>
      <span className="truncate text-xs font-medium text-secondary-text bg-background px-2.5 py-1 rounded-lg border border-border/60">{detail}</span>
    </div>
  </button>
);

interface QuickActionProps {
  label: string;
  detail: string;
  icon: typeof Users;
  iconClass: string;
  iconBg: string;
  onClick: () => void;
}

const QuickAction = ({ label, detail, icon: Icon, iconClass, iconBg, onClick }: QuickActionProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center gap-3 rounded-xl border border-border/70 bg-surface p-3 text-left transition-all hover:border-primary/30 hover:bg-surface-hover hover:shadow-2xs active:scale-98 cursor-pointer"
  >
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-2xs transition-transform group-hover:scale-105 ${iconBg}`}>
      <Icon size={18} className={iconClass} />
    </span>
    <span className="min-w-0 flex-1">
      <strong className="block truncate text-xs font-bold text-main-text group-hover:text-primary transition-colors">{label}</strong>
      <span className="mt-0.5 block truncate text-[11px] text-secondary-text">{detail}</span>
    </span>
    <ChevronRight size={14} className="text-secondary-text/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
  </button>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { activeYear } = useAcademicYear();
  const { branch, role, user } = useAuth();
  const loadRequestRef = useRef(0);

  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    pcIssues: 0,
    attendanceRate: null,
    attendanceRecorded: 0,
    attendanceClassCount: 0,
    absentToday: 0,
    lateToday: 0,
  });
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [activePCIssues, setActivePCIssues] = useState<PCIssue[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<ClassCurriculumRecord[]>([]);
  const [teachingLessons, setTeachingLessons] = useState<CurriculumLessonRecord[]>([]);
  const [teachingLogs, setTeachingLogs] = useState<TeachingLogRecord[]>([]);
  const [teachingSchedules, setTeachingSchedules] = useState<TeachingScheduleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!activeYear) {
      setStats({
        totalStudents: 0,
        totalClasses: 0,
        pcIssues: 0,
        attendanceRate: null,
        attendanceRecorded: 0,
        attendanceClassCount: 0,
        absentToday: 0,
        lateToday: 0,
      });
      setClasses([]);
      setActivePCIssues([]);
      setSubjects([]);
      setTeachingAssignments([]);
      setTeachingLessons([]);
      setTeachingLogs([]);
      setTeachingSchedules([]);
      setIsLoading(false);
      setErrorMsg('');
      loadRequestRef.current++;
      return;
    }

    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setErrorMsg('');

    const loadDashboardData = async () => {
      try {
        const db = await initDB();
        const [students, classRows, pcIssues, attendance, subjectRows, assignments, lessons, logs, schedules] = await Promise.all([
          db.getAll('students', activeYear),
          db.getAll('classes', activeYear),
          db.getAll('pcIssues', activeYear),
          db.getAll('attendance', activeYear),
          db.getAll('subjects', activeYear),
          db.getAll('classCurriculums', activeYear),
          db.getAll('curriculumLessons', activeYear),
          db.getAll('teachingLogs', activeYear),
          db.getAll('teachingSchedules', activeYear),
        ]);

        if (requestId !== loadRequestRef.current) return;

        const activeStudents = students.filter(student => student.status !== 'Inactive');
        const unresolvedIssues = pcIssues
          .filter(issue => issue.status !== 'Good' && issue.status !== 'Resolved')
          .sort((a, b) => {
            const aDate = a.reportedDate || a.dateFound || '';
            const bDate = b.reportedDate || b.dateFound || '';
            return bDate.localeCompare(aDate);
          });
        const today = getLocalDate();
        const todayRecords = attendance.filter(record => record.date === today);
        const explicitStatuses = todayRecords.flatMap(record => (
          Object.values(record.records).filter(status => ['P', 'A', 'L', 'E'].includes(status))
        ));
        const attending = explicitStatuses.filter(status => status === 'P' || status === 'L').length;
        const attendanceRate = explicitStatuses.length > 0
          ? Math.round((attending / explicitStatuses.length) * 100)
          : null;
        const recordedClassIds = new Set(todayRecords.map(record => record.classId || record.class).filter(Boolean));

        setStats({
          totalStudents: activeStudents.length,
          totalClasses: classRows.length,
          pcIssues: unresolvedIssues.length,
          attendanceRate,
          attendanceRecorded: explicitStatuses.length,
          attendanceClassCount: recordedClassIds.size,
          absentToday: explicitStatuses.filter(status => status === 'A').length,
          lateToday: explicitStatuses.filter(status => status === 'L').length,
        });
        setClasses(classRows);
        setActivePCIssues(unresolvedIssues);
        setSubjects(subjectRows);
        setTeachingAssignments(assignments);
        setTeachingLessons(lessons);
        setTeachingLogs(logs);
        setTeachingSchedules(schedules);
      } catch (error: any) {
        if (requestId !== loadRequestRef.current) return;
        console.error('Error loading dashboard data:', error);
        setErrorMsg(error.message || 'បរាជ័យក្នុងការទាញយកទិន្នន័យ។');
      } finally {
        if (requestId === loadRequestRef.current) setIsLoading(false);
      }
    };

    void loadDashboardData();
    return () => { loadRequestRef.current++; };
  }, [activeYear]);

  const displayName = useMemo(() => {
    const metadata = user?.user_metadata || {};
    return metadata.full_name || metadata.name || user?.email?.split('@')[0] || 'លោកគ្រូ/អ្នកគ្រូ';
  }, [user]);

  const classShiftSummary = useMemo(() => {
    const morning = classes.filter(item => item.shift === 'Morning').length;
    const afternoon = classes.filter(item => item.shift === 'Afternoon').length;
    const evening = classes.filter(item => item.shift === 'Evening').length;
    return [morning > 0 ? `ព្រឹក ${morning}` : '', afternoon > 0 ? `រសៀល ${afternoon}` : '', evening > 0 ? `យប់ ${evening}` : '']
      .filter(Boolean)
      .join(' · ') || 'មិនទាន់មានថ្នាក់';
  }, [classes]);

  const teachingSummary = useMemo(() => {
    let totalLessons = 0;
    let completedLessons = 0;
    let completedAssignments = 0;
    let activeAssignments = 0;

    for (const assignment of teachingAssignments) {
      const subjectLessons = teachingLessons.filter(lesson => lesson.subjectId === assignment.subjectId);
      if (subjectLessons.length === 0) continue;
      activeAssignments++;
      totalLessons += subjectLessons.length;
      const lessonIds = new Set(subjectLessons.map(lesson => lesson.id));
      const completedIds = new Set(
        teachingLogs
          .filter(log => log.classId === assignment.classId && log.status === 'completed' && lessonIds.has(log.lessonId))
          .map(log => log.lessonId),
      );
      completedLessons += completedIds.size;
      if (completedIds.size === subjectLessons.length) completedAssignments++;
    }

    return {
      activeAssignments,
      completedAssignments,
      totalLessons,
      completedLessons,
      remainingLessons: Math.max(totalLessons - completedLessons, 0),
      percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    };
  }, [teachingAssignments, teachingLessons, teachingLogs]);

  const todaySchedule = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentMinutes = today.getHours() * 60 + today.getMinutes();

    return teachingSchedules
      .filter(schedule => schedule.dayOfWeek === dayOfWeek)
      .filter(schedule => !user?.id || schedule.teacherId === user.id)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(schedule => {
        const classItem = classes.find(item => item.id === schedule.classId);
        const subject = subjects.find(item => item.id === schedule.subjectId);
        const subjectLessons = teachingLessons
          .filter(lesson => lesson.subjectId === schedule.subjectId)
          .sort((a, b) => a.orderNo - b.orderNo);
        const lessonIds = new Set(subjectLessons.map(lesson => lesson.id));
        const relatedLogs = teachingLogs.filter(log => log.classId === schedule.classId && lessonIds.has(log.lessonId));
        const completedIds = new Set(relatedLogs.filter(log => log.status === 'completed').map(log => log.lessonId));
        const currentLesson = subjectLessons.find(lesson => !completedIds.has(lesson.id)) || null;
        const start = minutesFromTime(schedule.startTime);
        const end = minutesFromTime(schedule.endTime);
        const timing = currentMinutes >= start && currentMinutes < end
          ? 'current'
          : currentMinutes < start ? 'upcoming' : 'finished';

        return { schedule, classItem, subject, currentLesson, timing };
      });
  }, [classes, subjects, teachingLessons, teachingLogs, teachingSchedules, user?.id]);

  const attendanceDetail = stats.attendanceRate === null ? 'មិនទាន់កត់ត្រា' : `កត់ត្រា ${stats.attendanceRecorded} នាក់`;
  const visibleIssues = activePCIssues.slice(0, 3);

  return (
    <div className="relative flex w-full flex-col gap-6 pb-12">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex min-h-[420px] items-start justify-center rounded-2xl bg-background/60 pt-28 backdrop-blur-xs">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-3.5 text-sm font-bold text-primary shadow-xl">
            <Loader2 size={20} className="animate-spin text-primary" /> 
            <span>កំពុងផ្ទុកទិន្នន័យ Dashboard...</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-5 py-4 text-rose-800 shadow-2xs">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <strong className="block text-sm font-bold">មិនអាចទាញយកទិន្នន័យបាន</strong>
            <p className="mt-0.5 text-xs text-rose-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Hero Welcome Banner - Clean Ribbon Matching Attendance Standard */}
      <section className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs shrink-0">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                {getGreeting()} {displayName}
              </h1>
              {activeYear && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-blue-100 shadow-2xs">
                  ឆ្នាំសិក្សា {activeYear}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-blue-100/80 flex flex-wrap items-center gap-2 font-medium">
              <span>{branch || 'មិនទាន់កំណត់សាខា'}</span>
              <span>·</span>
              <span>{role === 'admin' ? 'អ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin)' : 'គ្រូបង្រៀន ICT'}</span>
              <span>·</span>
              <span className="text-blue-200/90">{formatKhmerDate()}</span>
            </p>
          </div>
        </div>

        {/* Quick CTAs in Hero */}
        <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
          <button 
            type="button" 
            onClick={() => navigate('/teaching/today')} 
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-900 shadow-xs transition-all hover:bg-blue-50 active:scale-95 cursor-pointer"
          >
            <Sparkles size={14} className="text-blue-600" /> 
            <span>ចាប់ផ្តើមបង្រៀន</span>
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/attendance')} 
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-bold text-white transition-all active:scale-95 backdrop-blur-xs cursor-pointer shadow-2xs"
          >
            <ClipboardCheck size={14} className="text-emerald-300" /> 
            <span>កត់វត្តមាន</span>
          </button>
        </div>
      </section>

      {/* No Academic Year Alert */}
      {!activeYear && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800 shadow-2xs flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <span>សូមជ្រើសរើសឆ្នាំសិក្សានៅផ្នែកខាងលើ ដើម្បីបង្ហាញទិន្នន័យ Dashboard។</span>
        </div>
      )}

      {/* Core 4 Metric Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Students */}
        <MetricCard 
          title="សិស្សកំពុងសិក្សា" 
          value={stats.totalStudents} 
          detail="សិស្សសកម្ម" 
          icon={Users} 
          iconClass="text-blue-600" 
          iconBackground="bg-blue-50 border border-blue-200/60" 
          onClick={() => navigate('/students')} 
        />

        {/* Total Classes */}
        <MetricCard 
          title="ថ្នាក់រៀនសរុប" 
          value={stats.totalClasses} 
          detail={classShiftSummary} 
          icon={LayoutGrid} 
          iconClass="text-indigo-600" 
          iconBackground="bg-indigo-50 border border-indigo-200/60" 
          onClick={() => navigate('/classes')} 
        />

        {/* Today Attendance */}
        <MetricCard 
          title="វត្តមានថ្ងៃនេះ" 
          value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`} 
          detail={attendanceDetail} 
          icon={CheckCircle2} 
          iconClass="text-emerald-600" 
          iconBackground="bg-emerald-50 border border-emerald-200/60" 
          onClick={() => navigate('/attendance')} 
        />

        {/* PC Issues */}
        <MetricCard 
          title="PC ត្រូវដោះស្រាយ" 
          value={stats.pcIssues} 
          detail={stats.pcIssues > 0 ? 'កំពុងរង់ចាំដោះស្រាយ' : 'គ្រប់ PC ដំណើរការល្អ'} 
          icon={Monitor} 
          iconClass={stats.pcIssues > 0 ? 'text-rose-600' : 'text-emerald-600'} 
          iconBackground={stats.pcIssues > 0 ? 'bg-rose-50 border border-rose-200/60' : 'bg-emerald-50 border border-emerald-200/60'} 
          onClick={() => navigate('/issues')} 
        />
      </section>

      {/* Schedule & Quick Operations Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        {/* Today's Teaching Schedule Card */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-4.5 bg-surface">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-primary rounded-xl shadow-2xs">
                  <CalendarCheck size={19} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-main-text">កាលវិភាគបង្រៀនថ្ងៃនេះ</h2>
                  <p className="mt-0.5 text-[11px] text-secondary-text">បង្ហាញតាមគណនីគ្រូដែលបាន Login</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => navigate('/teaching/schedule')} 
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                <span>មើលកាលវិភាគ</span> 
                <ArrowRight size={14} />
              </button>
            </div>

            {todaySchedule.length > 0 ? (
              <div className="divide-y divide-border/60">
                {todaySchedule.slice(0, 4).map(({ schedule, classItem, subject, currentLesson, timing }) => {
                  const timingLabel = timing === 'current' ? 'កំពុងបង្រៀន' : timing === 'upcoming' ? 'បន្ទាប់' : 'បានកន្លងផុត';
                  const timingClass = timing === 'current'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                    : timing === 'upcoming' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/70' 
                    : 'bg-background text-secondary-text border border-border';

                  return (
                    <button 
                      key={schedule.id} 
                      type="button" 
                      onClick={() => navigate('/teaching/today')} 
                      className="group grid w-full grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 px-6 py-3.5 text-left transition-colors hover:bg-surface-hover/60 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-main-text font-mono">{schedule.startTime.slice(0, 5)}</p>
                        <p className="mt-0.5 text-[10px] text-secondary-text font-mono">ដល់ {schedule.endTime.slice(0, 5)}</p>
                      </div>
                      <div className="min-w-0 border-l-2 pl-3.5" style={{ borderColor: subject?.color || BRAND_BLUE }}>
                        <div className="flex min-w-0 items-center gap-2">
                          <strong className="truncate text-xs font-bold text-main-text group-hover:text-primary transition-colors">
                            {classItem ? formatClassName(classItem.name) : 'មិនស្គាល់ថ្នាក់'}
                          </strong>
                          <span className="shrink-0 text-[10px] font-semibold text-secondary-text bg-background px-1.5 py-0.5 rounded-md border border-border/50">
                            វេន{shiftLabel(schedule.shift)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-secondary-text">
                          {subject?.name || 'មិនស្គាល់មុខវិជ្ជា'}{currentLesson ? ` · ${currentLesson.title}` : ' · បានបញ្ចប់កម្មវិធី'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {timing === 'current' && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${timingClass}`}>
                          {timingLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary mb-3 shadow-2xs">
                  <CalendarDays size={22} />
                </span>
                <h3 className="text-sm font-bold text-main-text">មិនមានកាលវិភាគសម្រាប់ថ្ងៃនេះ</h3>
                <p className="mt-1 max-w-sm text-xs leading-5 text-secondary-text">
                  អាចបន្ថែមម៉ោងបង្រៀននៅផ្ទាំងកាលវិភាគ ដើម្បីឲ្យ Dashboard រំលឹកការងារប្រចាំថ្ងៃ។
                </p>
                <button 
                  type="button" 
                  onClick={() => navigate('/teaching/schedule')} 
                  className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  <span>រៀបចំកាលវិភាគ</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>

          {todaySchedule.length > 4 && (
            <div className="bg-background/50 border-t border-border/60 px-6 py-2.5 text-center text-xs font-medium text-secondary-text">
              មាន {todaySchedule.length - 4} ម៉ោងទៀតក្នុងកាលវិភាគថ្ងៃនេះ
            </div>
          )}
        </div>

        {/* Quick Actions & Daily Status Card */}
        <div className="rounded-2xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shadow-2xs">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-main-text">ការងាររហ័ស</h2>
                <p className="text-[11px] text-secondary-text">ចូលទៅការងារដែលប្រើញឹកញាប់</p>
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <QuickAction 
                label="កត់វត្តមាន" 
                detail="វត្តមានថ្ងៃនេះ" 
                icon={ClipboardCheck} 
                iconClass="text-emerald-600" 
                iconBg="bg-emerald-50 border border-emerald-100"
                onClick={() => navigate('/attendance')} 
              />
              <QuickAction 
                label="បង្រៀនថ្ងៃនេះ" 
                detail="កត់មេរៀនបង្រៀន" 
                icon={BookOpen} 
                iconClass="text-blue-600" 
                iconBg="bg-blue-50 border border-blue-100"
                onClick={() => navigate('/teaching/today')} 
              />
              <QuickAction 
                label="រាយការណ៍ PC" 
                detail="បញ្ហាឧបករណ៍" 
                icon={Wrench} 
                iconClass="text-amber-600" 
                iconBg="bg-amber-50 border border-amber-100"
                onClick={() => navigate('/issues')} 
              />
              <QuickAction 
                label="PC Sync" 
                detail="គ្រប់គ្រងគណនី PC" 
                icon={Monitor} 
                iconClass="text-violet-600" 
                iconBg="bg-violet-50 border border-violet-100"
                onClick={() => navigate('/pc-sync')} 
              />
            </div>
          </div>

          {/* Today's Metrics Micro-Widget */}
          <div className="mt-5 rounded-xl border border-border/80 bg-background/50 p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <span className="text-xs font-bold text-main-text">សង្ខេបស្ថានភាពថ្ងៃនេះ</span>
              <Clock3 size={15} className="text-secondary-text" />
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-secondary-text">ថ្នាក់បានកត់វត្តមាន</span>
                <strong className="font-bold text-main-text">{stats.attendanceClassCount}/{stats.totalClasses} ថ្នាក់</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary-text">អវត្តមាន / មកយឺត</span>
                <strong className={stats.absentToday > 0 ? 'font-bold text-rose-600' : 'font-bold text-main-text'}>
                  {stats.absentToday} នាក់ / {stats.lateToday} នាក់
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary-text">ម៉ោងបង្រៀនថ្ងៃនេះ</span>
                <strong className="font-bold text-main-text">{todaySchedule.length} ម៉ោង</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum Progress & PC Issues Bottom Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Curriculum Progress Card */}
        <div className="rounded-2xl border border-border/80 bg-surface p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-2xs">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-main-text">វឌ្ឍនភាពកម្មវិធីមេរៀន</h2>
                  <p className="mt-0.5 text-[11px] text-secondary-text">គណនាតាមមេរៀនដែលបានបង្រៀនរួច</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => navigate('/teaching/progress')} 
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                មើលលម្អិត →
              </button>
            </div>

            {teachingSummary.totalLessons > 0 ? (
              <div className="mt-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <strong className="text-2xl font-bold text-main-text tracking-tight">
                      {teachingSummary.percent}%
                    </strong>
                    <span className="ml-2 text-xs font-semibold text-secondary-text">បានបញ្ចប់</span>
                  </div>
                  <span className="text-xs font-bold text-secondary-text bg-background px-2.5 py-1 rounded-lg border border-border/60">
                    {teachingSummary.completedLessons}/{teachingSummary.totalLessons} មេរៀន
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3.5 h-3 overflow-hidden rounded-full bg-background border border-border/60 p-0.5">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 transition-all duration-500 shadow-2xs" 
                    style={{ width: `${teachingSummary.percent}%` }} 
                  />
                </div>

                {/* Micro Stat Blocks */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-blue-50/70 border border-blue-200/60 p-3 text-center shadow-2xs">
                    <strong className="block text-lg font-bold text-blue-900">{teachingSummary.activeAssignments}</strong>
                    <span className="text-[11px] font-semibold text-blue-700">ថ្នាក់-មុខវិជ្ជា</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/60 p-3 text-center shadow-2xs">
                    <strong className="block text-lg font-bold text-emerald-900">{teachingSummary.completedAssignments}</strong>
                    <span className="text-[11px] font-semibold text-emerald-700">បានបញ្ចប់</span>
                  </div>
                  <div className="rounded-xl bg-amber-50/70 border border-amber-200/60 p-3 text-center shadow-2xs">
                    <strong className="block text-lg font-bold text-amber-900">{teachingSummary.remainingLessons}</strong>
                    <span className="text-[11px] font-semibold text-amber-700">មេរៀននៅសល់</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/50 p-6 text-center">
                <BookOpen size={28} className="text-secondary-text opacity-50 mb-2" />
                <p className="text-xs font-semibold text-main-text">មិនទាន់មានកម្មវិធីមេរៀនភ្ជាប់ទៅថ្នាក់ទេ</p>
                <button 
                  type="button" 
                  onClick={() => navigate('/teaching/curriculum')} 
                  className="mt-3 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  រៀបចំកម្មវិធីមេរៀន →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PC Issues Card */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-6 py-4.5 bg-surface">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl shadow-2xs ${stats.pcIssues > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {stats.pcIssues > 0 ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-main-text">PC ត្រូវយកចិត្តទុកដាក់</h2>
                  <p className="mt-0.5 text-[11px] text-secondary-text">បញ្ហាដែលមិនទាន់បានដោះស្រាយ</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => navigate('/issues')} 
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                មើលទាំងអស់ →
              </button>
            </div>

            {visibleIssues.length > 0 ? (
              <div className="divide-y divide-border/60">
                {visibleIssues.map(issue => (
                  <button 
                    key={issue.id} 
                    type="button" 
                    onClick={() => navigate('/issues')} 
                    className="flex w-full items-center gap-3.5 px-6 py-4 text-left transition-colors hover:bg-rose-50/30 cursor-pointer group"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-2xs border border-rose-100">
                      <Monitor size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-xs font-bold text-main-text group-hover:text-rose-700 transition-colors">
                        PC ទី {issue.pcNumber}
                      </strong>
                      <span className="mt-0.5 block truncate text-[11px] text-secondary-text">
                        {issue.description || issue.currentIssue || 'មិនមានការពិពណ៌នាបញ្ហា'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-secondary-text font-mono bg-background px-2 py-0.5 rounded-md border border-border/60">
                      {issue.reportedDate || issue.dateFound || ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[190px] flex-col items-center justify-center p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 shadow-2xs">
                  <CheckCircle2 size={24} />
                </span>
                <h3 className="text-sm font-bold text-main-text">គ្រប់ PC ដំណើរការល្អ</h3>
                <p className="mt-1 text-xs text-secondary-text">មិនមានបញ្ហាដែលកំពុងរង់ចាំដោះស្រាយទេ។</p>
              </div>
            )}
          </div>

          {activePCIssues.length > 3 && (
            <div className="bg-rose-50/40 border-t border-rose-100 px-6 py-2.5 text-center text-xs font-bold text-rose-600">
              មាន {activePCIssues.length - 3} បញ្ហាផ្សេងទៀត
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
