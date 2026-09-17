import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  BookOpen,
  Search,
  Zap,
  RotateCcw,
  UserCheck,
  LayoutGrid,
  ChevronDown,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { initDB } from '../../store/db';
import type {
  ClassRecord,
  SubjectRecord,
  CurriculumLessonRecord,
  ClassCurriculumRecord,
  Shift,
  TeachingLogRecord,
  TeachingScheduleRecord,
} from '../../store/db';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { Modal } from '../../components/ui/Modal';
import { compareKhmer } from '../../utils/khmerSort';
import './TeachingToday.css';

interface ClassTeachingState {
  classId: string;
  className: string;
  classShift: Shift;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  subjectLessons: CurriculumLessonRecord[];
  completedLessonIds: Set<string>;
  currentLesson: CurriculumLessonRecord | null;
  previousLesson: CurriculumLessonRecord | null;
  totalLessons: number;
  completedLessons: number;
  lastLog: TeachingLogRecord | null;
  isPartialContinue: boolean;
  partialPercent: number;
}

type TodayView = 'schedule' | 'all';

const SHIFT_OPTIONS: Array<{ value: Shift; label: string; time: string }> = [
  { value: 'Morning', label: 'វេនព្រឹក', time: '07:30 - 11:00' },
  { value: 'Afternoon', label: 'វេនរសៀល', time: '13:00 - 16:30' },
  { value: 'Evening', label: 'វេនយប់', time: '17:30 - 20:30' },
];

const getLiveShift = (): { shift: Shift; label: string; time: string } => {
  const hour = new Date().getHours();
  if (hour < 12) return { shift: 'Morning', label: 'វេនព្រឹក', time: '07:30 - 11:00' };
  if (hour < 17) return { shift: 'Afternoon', label: 'វេនរសៀល', time: '13:00 - 16:30' };
  return { shift: 'Evening', label: 'វេនយប់', time: '17:30 - 20:30' };
};

const formatClassName = (name: string) => {
  const normalized = name.trim();
  return normalized.startsWith('ថ្នាក់ទី') ? normalized : `ថ្នាក់ទី ${normalized}`;
};

const shiftLabel = (shift: Shift) => SHIFT_OPTIONS.find(option => option.value === shift)?.label || shift;

const formatDate = (d: Date = new Date()) => {
  const days = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatKhmerDateTime = (isoStr: string) => {
  try {
    const d = new Date(isoStr);
    const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} (${hours}:${minutes})`;
  } catch {
    return isoStr;
  }
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'អរុណសួស្តី';
  if (h < 17) return 'ទិវាសួស្តី';
  return 'សាយណ្ហសួស្តី';
};

const TeachingToday = () => {
  const { activeYear } = useAcademicYear();
  const { user } = useAuth();
  const loadRef = useRef(0);

  // Raw data
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [lessons, setLessons] = useState<CurriculumLessonRecord[]>([]);
  const [assignments, setAssignments] = useState<ClassCurriculumRecord[]>([]);
  const [teachingLogs, setTeachingLogs] = useState<TeachingLogRecord[]>([]);
  const [schedule, setSchedule] = useState<TeachingScheduleRecord[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [todayView, setTodayView] = useState<TodayView>('schedule');
  const [selectedShift, setSelectedShift] = useState<Shift>(() => getLiveShift().shift);
  const [searchText, setSearchText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // In-card lesson override selection: key is `${classId}-${subjectId}`, value is `lessonId`
  const [customSelectedLessons, setCustomSelectedLessons] = useState<Record<string, string>>({});

  // Partial modal
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialTarget, setPartialTarget] = useState<{ state: ClassTeachingState; lesson: CurriculumLessonRecord } | null>(null);
  const [partialPercent, setPartialPercent] = useState(50);
  const [partialNote, setPartialNote] = useState('');

  // Undo Toast
  const [undoLog, setUndoLog] = useState<{ logId: string; message: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveShift = useMemo(() => getLiveShift(), []);

  const loadData = useCallback(async () => {
    if (!activeYear) return;
    const reqId = ++loadRef.current;
    setIsLoading(true);
    try {
      const db = await initDB();
      const [cls, subs, lsns, assigns, logs, scheduleRows] = await Promise.all([
        db.getAll('classes', activeYear),
        db.getAll('subjects', activeYear),
        db.getAll('curriculumLessons', activeYear),
        db.getAll('classCurriculums', activeYear),
        db.getAll('teachingLogs', activeYear),
        db.getAll('teachingSchedules', activeYear),
      ]);
      if (reqId !== loadRef.current) return;
      cls.sort((a, b) => compareKhmer(a.name, b.name));
      lsns.sort((a, b) => a.orderNo - b.orderNo);
      setClasses(cls);
      setSubjects(subs);
      setLessons(lsns);
      setAssignments(assigns);
      setTeachingLogs(logs);
      setSchedule(scheduleRows);
    } catch (err) {
      if (reqId === loadRef.current) console.error('Failed to load teaching data:', err);
    } finally {
      if (reqId === loadRef.current) setIsLoading(false);
    }
  }, [activeYear]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Compute teaching states for all class-subject assignments
  const classTeachingStates: ClassTeachingState[] = useMemo(() => {
    const states: ClassTeachingState[] = [];

    for (const assign of assignments) {
      const cls = classes.find(c => c.id === assign.classId);
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (!cls || !sub) continue;

      const subjectLessons = lessons
        .filter(l => l.subjectId === sub.id)
        .sort((a, b) => a.orderNo - b.orderNo);

      const classLogs = teachingLogs.filter(
        l => l.classId === cls.id && subjectLessons.some(sl => sl.id === l.lessonId)
      );

      // Find completed lesson IDs
      const completedLessonIds = new Set(
        classLogs.filter(l => l.status === 'completed').map(l => l.lessonId)
      );

      // Find partial logs
      const partialLogs = classLogs.filter(l => l.status === 'partial');

      // Next recommended lesson = first lesson not completed
      const currentLesson = subjectLessons.find(l => !completedLessonIds.has(l.id)) || null;

      // Previous lesson = lesson right before current
      let previousLesson: CurriculumLessonRecord | null = null;
      if (currentLesson) {
        const idx = subjectLessons.findIndex(l => l.id === currentLesson.id);
        if (idx > 0) previousLesson = subjectLessons[idx - 1];
      } else if (subjectLessons.length > 0) {
        previousLesson = subjectLessons[subjectLessons.length - 1];
      }

      // Check if recommended lesson is currently partial continue
      const currentPartialLog = currentLesson
        ? partialLogs.find(l => l.lessonId === currentLesson.id)
        : null;

      // Last log for this class+subject
      const sortedLogs = classLogs.sort((a, b) =>
        new Date(b.taughtAt).getTime() - new Date(a.taughtAt).getTime()
      );

      states.push({
        classId: cls.id,
        className: cls.name,
        classShift: cls.shift,
        subjectId: sub.id,
        subjectName: sub.name,
        subjectColor: sub.color || '#2a5298',
        subjectLessons,
        completedLessonIds,
        currentLesson,
        previousLesson,
        totalLessons: subjectLessons.length,
        completedLessons: completedLessonIds.size,
        lastLog: sortedLogs[0] || null,
        isPartialContinue: !!currentPartialLog,
        partialPercent: currentPartialLog?.progressPercent || 0,
      });
    }

    // Sort: classes with remaining lessons first, then completed, then Khmer alphabet
    states.sort((a, b) => {
      const aComplete = !a.currentLesson;
      const bComplete = !b.currentLesson;
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return compareKhmer(a.className, b.className);
    });

    return states;
  }, [classes, subjects, lessons, assignments, teachingLogs]);

  // Today's schedule items for user & selected shift
  const todaySchedule = useMemo(() => {
    const currentDay = new Date().getDay();
    return schedule
      .filter(item => item.dayOfWeek === currentDay && item.shift === selectedShift)
      .filter(item => !user?.id || item.teacherId === user.id)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedule, selectedShift, user?.id]);

  // Shift counts
  const shiftCounts = useMemo(() => {
    const counts = { Morning: 0, Afternoon: 0, Evening: 0 };
    for (const state of classTeachingStates) {
      if (counts[state.classShift] !== undefined) {
        counts[state.classShift]++;
      }
    }
    return counts;
  }, [classTeachingStates]);

  // Visible teaching states based on filters
  const visibleTeachingStates = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    const scheduledKeys = new Set(todaySchedule.map(item => `${item.classId}-${item.subjectId}`));

    return classTeachingStates.filter(state => {
      if (state.classShift !== selectedShift) return false;
      if (todayView === 'schedule' && !scheduledKeys.has(`${state.classId}-${state.subjectId}`)) return false;
      if (!showCompleted && !state.currentLesson) return false;
      return !query || `${state.className} ${state.subjectName}`.toLocaleLowerCase().includes(query);
    });
  }, [classTeachingStates, searchText, selectedShift, showCompleted, todaySchedule, todayView]);

  const getScheduleTimes = (state: ClassTeachingState) => todaySchedule
    .filter(item => item.classId === state.classId && item.subjectId === state.subjectId)
    .map(item => `${item.startTime.slice(0, 5)} - ${item.endTime.slice(0, 5)}`);

  // Complete a lesson
  const completeLesson = async (state: ClassTeachingState, targetLesson: CurriculumLessonRecord) => {
    if (!targetLesson || !activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const logId = crypto.randomUUID();

      // Delete any existing partial log for this lesson
      const existingPartials = teachingLogs.filter(
        l => l.classId === state.classId && l.lessonId === targetLesson.id && l.status === 'partial'
      );
      for (const pl of existingPartials) {
        await db.delete('teachingLogs', pl.id);
      }

      const log: TeachingLogRecord = {
        id: logId,
        classId: state.classId,
        lessonId: targetLesson.id,
        teacherId: user?.id || null,
        status: 'completed',
        progressPercent: 100,
        taughtAt: new Date().toISOString(),
        note: null,
        academicYear: activeYear,
      };
      await db.add('teachingLogs', log);

      // Set undo notification
      setUndoLog({
        logId,
        message: `បានកត់ត្រាជោគជ័យ៖ ${formatClassName(state.className)} · ${state.subjectName} · មេរៀនទី ${targetLesson.orderNo}`
      });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoLog(null), 8000);

      // Reset custom selection override for this card so it naturally advances
      setCustomSelectedLessons(prev => {
        const next = { ...prev };
        delete next[`${state.classId}-${state.subjectId}`];
        return next;
      });

      await loadData();
    } catch (err) {
      console.error('Failed to complete lesson:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Open modal for partial teaching
  const openPartialModal = (state: ClassTeachingState, targetLesson: CurriculumLessonRecord) => {
    setPartialTarget({ state, lesson: targetLesson });
    const existingPartial = teachingLogs.find(
      l => l.classId === state.classId && l.lessonId === targetLesson.id && l.status === 'partial'
    );
    setPartialPercent(existingPartial ? existingPartial.progressPercent : 50);
    setPartialNote(existingPartial?.note || '');
    setShowPartialModal(true);
  };

  // Save partial teaching
  const savePartial = async () => {
    if (!partialTarget?.lesson || !activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();

      // Delete existing partial logs for this lesson
      const existingPartials = teachingLogs.filter(
        l => l.classId === partialTarget.state.classId && l.lessonId === partialTarget.lesson.id && l.status === 'partial'
      );
      for (const pl of existingPartials) {
        await db.delete('teachingLogs', pl.id);
      }

      const log: TeachingLogRecord = {
        id: crypto.randomUUID(),
        classId: partialTarget.state.classId,
        lessonId: partialTarget.lesson.id,
        teacherId: user?.id || null,
        status: 'partial',
        progressPercent: partialPercent,
        taughtAt: new Date().toISOString(),
        note: partialNote || null,
        academicYear: activeYear,
      };
      await db.add('teachingLogs', log);

      setShowPartialModal(false);
      setPartialTarget(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save partial:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Skip lesson
  const skipLesson = async (state: ClassTeachingState, targetLesson: CurriculumLessonRecord) => {
    if (!targetLesson || !activeYear) return;
    if (!window.confirm(`តើអ្នកពិតជាចង់រំលង «មេរៀនទី ${targetLesson.orderNo}: ${targetLesson.title}» សម្រាប់ ${formatClassName(state.className)} មែនទេ?`)) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const log: TeachingLogRecord = {
        id: crypto.randomUUID(),
        classId: state.classId,
        lessonId: targetLesson.id,
        teacherId: user?.id || null,
        status: 'skipped',
        progressPercent: 0,
        taughtAt: new Date().toISOString(),
        note: 'Skipped',
        academicYear: activeYear,
      };
      await db.add('teachingLogs', log);

      setCustomSelectedLessons(prev => {
        const next = { ...prev };
        delete next[`${state.classId}-${state.subjectId}`];
        return next;
      });

      await loadData();
    } catch (err) {
      console.error('Failed to skip lesson:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Undo complete
  const undoComplete = async () => {
    if (!undoLog) return;
    try {
      const db = await initDB();
      await db.delete('teachingLogs', undoLog.logId);
      setUndoLog(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      await loadData();
    } catch (err) {
      console.error('Failed to undo:', err);
    }
  };

  // Cleanup undo timer
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  if (!activeYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Zap size={48} className="mb-4 opacity-50 text-blue-500" />
        <p className="text-lg font-medium text-gray-600">សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p>
      </div>
    );
  }

  return (
    <div className="teaching-today-page">
      {/* Enhanced Header with Live Shift Detection */}
      <header className="today-page-header">
        <div className="today-header-left">
          <div className="today-title-row">
            <h1>{getGreeting()}, <span className="teacher-name">{(user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'លោកគ្រូ/អ្នកគ្រូ'}</span></h1>
            <span className="live-shift-tag">
              <span className="live-pulse" />
              <span>ពេលនេះ៖ <strong>{liveShift.label}</strong> ({liveShift.time})</span>
            </span>
          </div>
          <p className="today-date-text">{formatDate()}</p>
        </div>

        <div className="today-header-actions">
          <Link to="/teaching/schedule" className="today-header-btn secondary">
            <CalendarDays size={17} />
            <span>កាលវិភាគបង្រៀន</span>
          </Link>
          <Link to="/teaching/curriculum" className="today-header-btn outline">
            <BookOpen size={17} />
            <span>រៀបចំមេរៀន</span>
          </Link>
        </div>
      </header>

      {/* Control & Filter Panel */}
      <section className="today-control-panel">
        <div className="today-view-switch">
          <button
            className={todayView === 'schedule' ? 'active' : ''}
            onClick={() => setTodayView('schedule')}
          >
            <Clock size={15} />
            <span>កាលវិភាគថ្ងៃនេះ ({todaySchedule.length})</span>
          </button>
          <button
            className={todayView === 'all' ? 'active' : ''}
            onClick={() => setTodayView('all')}
          >
            <BookOpen size={15} />
            <span>ថ្នាក់ទាំងអស់</span>
          </button>
        </div>

        <div className="today-shift-switch" aria-label="ជ្រើសរើសវេន">
          {SHIFT_OPTIONS.map(option => (
            <button
              key={option.value}
              className={`${selectedShift === option.value ? 'active' : ''} ${liveShift.shift === option.value ? 'is-current-time' : ''}`}
              onClick={() => setSelectedShift(option.value)}
            >
              <span>{option.label}</span>
              <span className="shift-count-badge">{shiftCounts[option.value] || 0}</span>
              {liveShift.shift === option.value && <span className="now-indicator" title="វេនកំពុងបង្រៀនពេលនេះ">•</span>}
            </button>
          ))}
        </div>

        <div className="today-search-box">
          <Search size={16} className="search-icon" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="ស្វែងរកតាមឈ្មោះថ្នាក់ ឬមុខវិជ្ជា..."
          />
          {searchText && (
            <button className="clear-search-btn" onClick={() => setSearchText('')}>✕</button>
          )}
        </div>

        <label className="today-completed-toggle" title="បង្ហាញថ្នាក់ដែលបានបង្រៀនចប់គ្រប់មេរៀនទាំងអស់">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={event => setShowCompleted(event.target.checked)}
          />
          <span>បង្ហាញថ្នាក់ចប់សព្វគ្រប់</span>
        </label>
      </section>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="today-empty-card">
          <div className="loading-spinner" />
          <p>កំពុងទាញយកព័ត៌មានការបង្រៀន...</p>
        </div>
      ) : classTeachingStates.length === 0 ? (
        <div className="today-empty-card">
          <BookOpen size={48} className="empty-icon" />
          <h3>មិនទាន់មានមេរៀនសម្រាប់បង្រៀននៅឡើយទេ</h3>
          <p>សូមចូលទៅកាន់ផ្ទាំង «រៀបចំមេរៀន» ដើម្បីបង្កើតមុខវិជ្ជា មេរៀន និងភ្ជាប់ទៅកាន់ថ្នាក់ជាមុនសិន។</p>
          <Link to="/teaching/curriculum" className="empty-cta-btn">
            <span>រៀបចំមេរៀន និងភ្ជាប់ថ្នាក់</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Strip */}
          <div className="today-result-summary">
            <div className="summary-left">
              <span>បង្ហាញ <strong>{visibleTeachingStates.length}</strong> ថ្នាក់</span>
              <span className="bullet-sep">•</span>
              <span className="summary-badge shift">{shiftLabel(selectedShift)}</span>
              {todayView === 'schedule' && (
                <>
                  <span className="bullet-sep">•</span>
                  <span className="summary-badge schedule">{todaySchedule.length} ម៉ោងក្នុងកាលវិភាគថ្ងៃនេះ</span>
                </>
              )}
            </div>
            {selectedShift !== liveShift.shift && (
              <button
                className="jump-to-live-btn"
                onClick={() => setSelectedShift(liveShift.shift)}
              >
                <Sparkles size={14} />
                <span>ប្តូរទៅ {liveShift.label} (ពេលនេះ)</span>
              </button>
            )}
          </div>

          {/* Cards Grid */}
          {!visibleTeachingStates.length ? (
            <div className="today-empty-card compact">
              <CalendarDays size={38} className="empty-icon" />
              <h3>{todayView === 'schedule' ? `មិនមានថ្នាក់${shiftLabel(selectedShift)} ក្នុងកាលវិភាគថ្ងៃនេះទេ` : 'រកមិនឃើញថ្នាក់ដែលត្រូវនឹងពាក្យស្វែងរក'}</h3>
              <p>
                {todayView === 'schedule'
                  ? 'លោកគ្រូ/អ្នកគ្រូ អាចប្តូរទៅជ្រើសរើស «ថ្នាក់ទាំងអស់» ដើម្បីកត់ត្រាដោយសេរី ឬប្តូរវេនបង្រៀន។'
                  : 'សូមសាកល្បងលុបពាក្យស្វែងរក ឬធីកលើ «បង្ហាញថ្នាក់ចប់សព្វគ្រប់»។'}
              </p>
              {todayView === 'schedule' && (
                <button className="empty-switch-btn" onClick={() => setTodayView('all')}>
                  មើលថ្នាក់ទាំងអស់ក្នុង{shiftLabel(selectedShift)}
                </button>
              )}
            </div>
          ) : (
            <div className={`today-class-grid ${isSaving ? 'is-saving' : ''}`}>
              {visibleTeachingStates.map(state => {
                const cardKey = `${state.classId}-${state.subjectId}`;
                const scheduleTimes = getScheduleTimes(state);
                const progressPercent = state.totalLessons ? Math.round((state.completedLessons / state.totalLessons) * 100) : 0;
                const allDone = state.completedLessons >= state.totalLessons && state.totalLessons > 0;

                // Active Lesson Selection (Allows custom jump to ANY lesson)
                const customLessonId = customSelectedLessons[cardKey];
                const activeLesson: CurriculumLessonRecord | null = customLessonId
                  ? (state.subjectLessons.find(l => l.id === customLessonId) || state.currentLesson)
                  : state.currentLesson;

                const isCustomOverride = !!customLessonId && customLessonId !== state.currentLesson?.id;
                const isLessonDone = activeLesson ? state.completedLessonIds.has(activeLesson.id) : false;

                // Check if activeLesson is continuing partial
                const isLessonPartial = activeLesson && !isLessonDone && state.isPartialContinue && activeLesson.id === state.currentLesson?.id;

                return (
                  <article
                    key={cardKey}
                    className={`class-teach-card ${allDone && !isCustomOverride ? 'is-all-completed' : ''}`}
                    style={{ borderTopColor: state.subjectColor }}
                  >
                    {/* Card Header */}
                    <div className="card-teach-header">
                      <div className="class-title-group">
                        <div className="class-name-row">
                          <h3 className="class-name">{formatClassName(state.className)}</h3>
                          <span className="shift-chip">{shiftLabel(state.classShift)}</span>
                        </div>

                        {/* Direct Classroom Quick Hub Links */}
                        <div className="classroom-quick-hub">
                          <Link
                            to={`/attendance?classId=${state.classId}`}
                            className="quick-hub-link attendance"
                            title={`កត់ត្រាវត្តមាន ${formatClassName(state.className)}`}
                          >
                            <UserCheck size={13} />
                            <span>វត្តមាន</span>
                          </Link>
                          <Link
                            to={`/seating?classId=${state.classId}`}
                            className="quick-hub-link seating"
                            title={`មើលប្លង់តុ ${formatClassName(state.className)}`}
                          >
                            <LayoutGrid size={13} />
                            <span>ប្លង់តុ</span>
                          </Link>
                        </div>
                      </div>

                      {/* Tags: Schedule Time & Subject Badge */}
                      <div className="card-right-tags">
                        {scheduleTimes.map(time => (
                          <span key={time} className="schedule-time-tag">
                            <Clock size={12} />
                            <span>{time}</span>
                          </span>
                        ))}
                        <span className="subject-badge" style={{ backgroundColor: state.subjectColor }}>
                          {state.subjectName}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-section">
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-indicator"
                          style={{ width: `${progressPercent}%`, backgroundColor: state.subjectColor }}
                        />
                      </div>
                      <div className="progress-info-row">
                        <span className="progress-fraction">
                          បានបង្រៀន <strong>{state.completedLessons}</strong> / {state.totalLessons} មេរៀន
                        </span>
                        <span className="progress-pct">{progressPercent}%</span>
                      </div>
                    </div>

                    {/* In-Card Lesson Selector & Details Block */}
                    <div className="lesson-control-block">
                      <div className="lesson-selector-bar">
                        <label className="selector-label">
                          <span>ជ្រើសរើសមេរៀន៖</span>
                        </label>

                        <div className="selector-dropdown-wrapper">
                          <select
                            value={activeLesson?.id || ''}
                            onChange={(e) => {
                              const newId = e.target.value;
                              setCustomSelectedLessons(prev => ({
                                ...prev,
                                [cardKey]: newId,
                              }));
                            }}
                            className="lesson-dropdown-select"
                          >
                            {state.subjectLessons.map(lsn => {
                              const isDone = state.completedLessonIds.has(lsn.id);
                              const isRecommended = lsn.id === state.currentLesson?.id;
                              const statusPrefix = isDone ? '✓ ' : isRecommended ? '▶ ' : '  ';
                              const statusSuffix = isDone ? '(រួច)' : isRecommended ? '(បន្ទាប់)' : '';
                              return (
                                <option key={lsn.id} value={lsn.id}>
                                  {statusPrefix} មេរៀនទី {lsn.orderNo}: {lsn.title} {statusSuffix}
                                </option>
                              );
                            })}
                          </select>
                          <ChevronDown size={14} className="dropdown-arrow" />
                        </div>

                        {/* Reset to recommended button if overridden */}
                        {isCustomOverride && state.currentLesson && (
                          <button
                            className="reset-recommended-btn"
                            onClick={() => {
                              setCustomSelectedLessons(prev => {
                                const next = { ...prev };
                                delete next[cardKey];
                                return next;
                              });
                            }}
                            title="ត្រឡប់ទៅមេរៀនបន្ទាប់តាមកាលវិភាគ"
                          >
                            <RotateCcw size={12} />
                            <span>មេរៀនបន្ទាប់</span>
                          </button>
                        )}
                      </div>

                      {/* Detailed Target Lesson Display */}
                      {activeLesson ? (
                        <div className={`lesson-card-details ${isLessonDone ? 'is-done-state' : ''}`}>
                          <div className="lesson-details-header">
                            <span className="lesson-order-badge">
                              មេរៀនទី {activeLesson.orderNo}
                            </span>
                            {activeLesson.module && (
                              <span className="lesson-module-tag">
                                {activeLesson.module}
                              </span>
                            )}
                            {isLessonDone && (
                              <span className="lesson-status-tag completed">
                                <CheckCircle2 size={12} />
                                <span>បានរៀនចប់រួចរាល់</span>
                              </span>
                            )}
                            {isLessonPartial && (
                              <span className="lesson-status-tag partial">
                                <Clock size={12} />
                                <span>បន្តពី {state.partialPercent}%</span>
                              </span>
                            )}
                          </div>

                          <h4 className="lesson-main-title">{activeLesson.title}</h4>

                          {activeLesson.exercise && (
                            <div className="lesson-exercise-box">
                              <span className="exercise-label">📝 លំហាត់អនុវត្ត៖</span>
                              <p className="exercise-content">{activeLesson.exercise}</p>
                            </div>
                          )}

                          {/* Last Log Context */}
                          {state.lastLog && !isLessonDone && (
                            <div className="lesson-last-context">
                              <span className="context-label">បង្រៀនលើកមុន៖</span>
                              <span className="context-time">{formatKhmerDateTime(state.lastLog.taughtAt)}</span>
                              {state.lastLog.note && <span className="context-note">({state.lastLog.note})</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="lesson-card-details empty">
                          <CheckCircle2 size={24} className="text-emerald-500" />
                          <p>បានបង្រៀនគ្រប់មេរៀនចប់សព្វគ្រប់ហើយ!</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons with High Visual Hierarchy */}
                    <div className="card-actions-zone">
                      {activeLesson ? (
                        isLessonDone ? (
                          <div className="completed-lesson-action-bar">
                            <div className="completed-notice">
                              <CheckCircle2 size={16} />
                              <span>មេរៀននេះត្រូវបានកត់ត្រារួចហើយ</span>
                            </div>
                            <button
                              className="teach-btn review"
                              onClick={() => void completeLesson(state, activeLesson)}
                              disabled={isSaving}
                              title="កត់ត្រាបង្រៀនឡើងវិញ ឬរំលឹកមេរៀននេះ"
                            >
                              <RotateCcw size={15} />
                              <span>បង្រៀនរំលឹកឡើងវិញ</span>
                            </button>
                          </div>
                        ) : (
                          <div className="active-action-buttons">
                            {/* Primary Action Button: Large Emerald Button */}
                            <button
                              className="teach-btn primary-complete"
                              onClick={() => void completeLesson(state, activeLesson)}
                              disabled={isSaving}
                            >
                              <CheckCircle2 size={18} />
                              <span>បានបង្រៀនចប់ (១០០%)</span>
                            </button>

                            {/* Secondary Action: Partial Modal */}
                            <button
                              className="teach-btn secondary-partial"
                              onClick={() => openPartialModal(state, activeLesson)}
                              disabled={isSaving}
                            >
                              <Clock size={16} />
                              <span>បង្រៀនមិនទាន់ចប់</span>
                            </button>

                            {/* Tertiary Action: Skip */}
                            <button
                              className="teach-btn ghost-skip"
                              onClick={() => void skipLesson(state, activeLesson)}
                              disabled={isSaving}
                            >
                              <span>រំលងមេរៀននេះ</span>
                            </button>
                          </div>
                        )
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Undo Toast */}
      {undoLog && (
        <div className="undo-toast-box">
          <div className="undo-toast-content">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{undoLog.message}</span>
          </div>
          <button className="undo-action-btn" onClick={() => void undoComplete()}>
            <RotateCcw size={14} />
            <span>មិនរក្សាទុក (Undo)</span>
          </button>
        </div>
      )}

      {/* Partial Modal */}
      <Modal
        isOpen={showPartialModal}
        onClose={() => { setShowPartialModal(false); setPartialTarget(null); }}
        title="កត់ត្រាការបង្រៀនមិនទាន់ចប់"
      >
        {partialTarget && (
          <div className="partial-modal-body">
            <div className="partial-class-summary">
              <span className="summary-class-badge">{formatClassName(partialTarget.state.className)}</span>
              <span className="summary-subject-badge" style={{ backgroundColor: partialTarget.state.subjectColor }}>
                {partialTarget.state.subjectName}
              </span>
              <span className="summary-lesson-title">
                មេរៀនទី {partialTarget.lesson.orderNo}: {partialTarget.lesson.title}
              </span>
            </div>

            <div className="partial-input-group">
              <label className="input-title">តើបង្រៀនបានកម្រិតណាដែរ?</label>
              <div className="partial-pct-pills">
                {[25, 50, 75].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    className={`pct-pill-btn ${partialPercent === pct ? 'active' : ''}`}
                    onClick={() => setPartialPercent(pct)}
                  >
                    <span>{pct}%</span>
                    <span className="pct-desc">
                      {pct === 25 ? 'ទើបចាប់ផ្តើម' : pct === 50 ? 'ពាក់កណ្តាល' : 'ជិតចប់'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="partial-input-group">
              <label className="input-title">កំណត់សម្គាល់សម្រាប់បង្រៀនបន្ត (បើមាន)៖</label>
              <textarea
                rows={3}
                value={partialNote}
                onChange={e => setPartialNote(e.target.value)}
                placeholder="ឧ. សិស្សទើបអនុវត្តដល់ចំណុចទី ៣ ត្រូវបន្តលំហាត់ទី ៤ នៅម៉ោងក្រោយ..."
                className="partial-note-textarea"
              />
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                onClick={() => { setShowPartialModal(false); setPartialTarget(null); }}
                className="modal-cancel-btn"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={() => void savePartial()}
                disabled={isSaving}
                className="modal-submit-btn"
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការបង្រៀន'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TeachingToday;
