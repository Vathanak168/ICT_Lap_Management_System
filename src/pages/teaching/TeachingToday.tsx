import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle, Clock, BookOpen, Search, Zap } from 'lucide-react';
import { initDB } from '../../store/db';
import type {
  ClassRecord, SubjectRecord, CurriculumLessonRecord,
  ClassCurriculumRecord, Shift, TeachingLogRecord, TeachingScheduleRecord
} from '../../store/db';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { Modal } from '../../components/ui/Modal';
import './TeachingToday.css';

interface ClassTeachingState {
  classId: string;
  className: string;
  classShift: Shift;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  currentLesson: CurriculumLessonRecord | null;
  previousLesson: CurriculumLessonRecord | null;
  totalLessons: number;
  completedLessons: number;
  lastLog: TeachingLogRecord | null;
  isPartialContinue: boolean;
  partialPercent: number;
}

type TodayView = 'schedule' | 'all';

const SHIFT_OPTIONS: Array<{ value: Shift; label: string }> = [
  { value: 'Morning', label: 'ព្រឹក' },
  { value: 'Afternoon', label: 'រសៀល' },
  { value: 'Evening', label: 'យប់' },
];

const getCurrentShift = (): Shift => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
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

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'អរុណសួស្តី 👋';
  if (h < 17) return 'ទិវាសួស្តី 👋';
  return 'សាយណ្ហសួស្តី 👋';
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
  const [selectedShift, setSelectedShift] = useState<Shift>(getCurrentShift);
  const [searchText, setSearchText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Partial modal
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialTarget, setPartialTarget] = useState<ClassTeachingState | null>(null);
  const [partialPercent, setPartialPercent] = useState(50);
  const [partialNote, setPartialNote] = useState('');

  // Undo
  const [undoLog, setUndoLog] = useState<{ logId: string; message: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      cls.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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

  // Compute teaching states
  const classTeachingStates: ClassTeachingState[] = useMemo(() => {
    const states: ClassTeachingState[] = [];

    for (const assign of assignments) {
      const cls = classes.find(c => c.id === assign.classId);
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (!cls || !sub) continue;

      const subjectLessons = lessons.filter(l => l.subjectId === sub.id);
      const classLogs = teachingLogs.filter(
        l => l.classId === cls.id && subjectLessons.some(sl => sl.id === l.lessonId)
      );

      // Find completed lesson IDs (status = 'completed')
      const completedLessonIds = new Set(
        classLogs.filter(l => l.status === 'completed').map(l => l.lessonId)
      );

      // Find partial logs
      const partialLogs = classLogs.filter(l => l.status === 'partial');

      // Current lesson = first lesson not completed
      const currentLesson = subjectLessons.find(l => !completedLessonIds.has(l.id)) || null;

      // Previous lesson = lesson before current
      let previousLesson: CurriculumLessonRecord | null = null;
      if (currentLesson) {
        const idx = subjectLessons.findIndex(l => l.id === currentLesson.id);
        if (idx > 0) previousLesson = subjectLessons[idx - 1];
      }

      // Check if current is a partial continue
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
        subjectColor: sub.color,
        currentLesson,
        previousLesson,
        totalLessons: subjectLessons.length,
        completedLessons: completedLessonIds.size,
        lastLog: sortedLogs[0] || null,
        isPartialContinue: !!currentPartialLog,
        partialPercent: currentPartialLog?.progressPercent || 0,
      });
    }

    // Sort: remaining first, then completed
    states.sort((a, b) => {
      const aComplete = !a.currentLesson;
      const bComplete = !b.currentLesson;
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return a.className.localeCompare(b.className, undefined, { numeric: true });
    });

    return states;
  }, [classes, subjects, lessons, assignments, teachingLogs]);

  const todaySchedule = useMemo(() => {
    const currentDay = new Date().getDay();
    return schedule
      .filter(item => item.dayOfWeek === currentDay && item.shift === selectedShift)
      .filter(item => !user?.id || item.teacherId === user.id)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedule, selectedShift, user?.id]);

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
    .map(item => `${item.startTime.slice(0, 5)}-${item.endTime.slice(0, 5)}`);

  // Actions
  const completeLesson = async (state: ClassTeachingState) => {
    if (!state.currentLesson || !activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const logId = crypto.randomUUID();

      // Delete any partial log for this lesson first
      const existingPartials = teachingLogs.filter(
        l => l.classId === state.classId && l.lessonId === state.currentLesson!.id && l.status === 'partial'
      );
      for (const pl of existingPartials) {
        await db.delete('teachingLogs', pl.id);
      }

      const log: TeachingLogRecord = {
        id: logId,
        classId: state.classId,
        lessonId: state.currentLesson.id,
        teacherId: user?.id || null,
        status: 'completed',
        progressPercent: 100,
        taughtAt: new Date().toISOString(),
        note: null,
        academicYear: activeYear,
      };
      await db.add('teachingLogs', log);

      // Show undo toast
      setUndoLog({ logId, message: `បានកត់ត្រា ${formatClassName(state.className)} · ${state.subjectName} · មេរៀនទី ${state.currentLesson.orderNo}` });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoLog(null), 8000);

      await loadData();
    } catch (err) {
      console.error('Failed to complete lesson:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const openPartialModal = (state: ClassTeachingState) => {
    setPartialTarget(state);
    setPartialPercent(state.isPartialContinue ? state.partialPercent : 50);
    setPartialNote('');
    setShowPartialModal(true);
  };

  const savePartial = async () => {
    if (!partialTarget?.currentLesson || !activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();

      // Delete existing partial logs for this lesson
      const existingPartials = teachingLogs.filter(
        l => l.classId === partialTarget.classId && l.lessonId === partialTarget.currentLesson!.id && l.status === 'partial'
      );
      for (const pl of existingPartials) {
        await db.delete('teachingLogs', pl.id);
      }

      const log: TeachingLogRecord = {
        id: crypto.randomUUID(),
        classId: partialTarget.classId,
        lessonId: partialTarget.currentLesson.id,
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

  const skipLesson = async (state: ClassTeachingState) => {
    if (!state.currentLesson || !activeYear) return;
    if (!window.confirm(`តើអ្នកចង់រំលងមេរៀនទី ${state.currentLesson.orderNo} សម្រាប់ ${formatClassName(state.className)} មែនទេ?`)) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const log: TeachingLogRecord = {
        id: crypto.randomUUID(),
        classId: state.classId,
        lessonId: state.currentLesson.id,
        teacherId: user?.id || null,
        status: 'skipped',
        progressPercent: 0,
        taughtAt: new Date().toISOString(),
        note: 'Skipped',
        academicYear: activeYear,
      };
      await db.add('teachingLogs', log);
      await loadData();
    } catch (err) {
      console.error('Failed to skip lesson:', err);
    } finally {
      setIsSaving(false);
    }
  };

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  if (!activeYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Zap size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium text-gray-600">សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p>
      </div>
    );
  }

  return (
    <div className="teaching-today-page">
      <header className="today-page-header">
        <div>
          <h1>ចាប់ផ្តើមបង្រៀន</h1>
          <p>{getGreeting()} · {formatDate()}</p>
        </div>
        <Link to="/teaching/schedule" className="today-schedule-link"><CalendarDays size={17} /> កាលវិភាគ</Link>
      </header>

      <section className="today-control-panel">
        <div className="today-view-switch">
          <button className={todayView === 'schedule' ? 'active' : ''} onClick={() => setTodayView('schedule')}>តាមកាលវិភាគថ្ងៃនេះ</button>
          <button className={todayView === 'all' ? 'active' : ''} onClick={() => setTodayView('all')}>ថ្នាក់ទាំងអស់</button>
        </div>
        <div className="today-shift-switch" aria-label="ជ្រើសរើសវេន">
          {SHIFT_OPTIONS.map(option => (
            <button key={option.value} className={selectedShift === option.value ? 'active' : ''} onClick={() => setSelectedShift(option.value)}>{option.label}</button>
          ))}
        </div>
        <label className="today-search"><Search size={17} /><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="ស្វែងរកថ្នាក់..." /></label>
        <label className="today-completed-toggle"><input type="checkbox" checked={showCompleted} onChange={event => setShowCompleted(event.target.checked)} /> បង្ហាញថ្នាក់បានបញ្ចប់</label>
      </section>

      {isLoading ? (
        <div className="today-empty-card">កំពុងទាញយក...</div>
      ) : classTeachingStates.length === 0 ? (
        <div className="today-empty-card">
          <BookOpen size={42} /><h3>មិនទាន់មានមេរៀនសម្រាប់បង្រៀន</h3>
          <p>សូមរៀបចំមុខវិជ្ជា មេរៀន និងភ្ជាប់ទៅថ្នាក់ជាមុនសិន។</p>
          <Link to="/teaching/curriculum">ទៅរៀបចំមេរៀន</Link>
        </div>
      ) : (
        <>
          <div className="today-result-summary">
            <strong>{visibleTeachingStates.length}</strong> ថ្នាក់ត្រូវបង្ហាញ
            <span>·</span><span>វេន{shiftLabel(selectedShift)}</span>
            {todayView === 'schedule' && <><span>·</span><span>{todaySchedule.length} ម៉ោងក្នុងកាលវិភាគថ្ងៃនេះ</span></>}
          </div>

          {!visibleTeachingStates.length ? (
            <div className="today-empty-card compact">
              <CalendarDays size={36} />
              <h3>{todayView === 'schedule' ? `មិនមានថ្នាក់វេន${shiftLabel(selectedShift)}ក្នុងកាលវិភាគថ្ងៃនេះ` : 'រកមិនឃើញថ្នាក់តាមលក្ខខណ្ឌនេះ'}</h3>
              <p>{todayView === 'schedule' ? 'អាចប្តូរវេន ឬចុច «ថ្នាក់ទាំងអស់» ដើម្បីជ្រើសថ្នាក់ដោយខ្លួនឯង។' : 'សូមប្តូរពាក្យស្វែងរក ឬបង្ហាញថ្នាក់ដែលបានបញ្ចប់។'}</p>
            </div>
          ) : (
            <div className={`today-class-grid ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}>
              {visibleTeachingStates.map(state => {
                const progressPercent = state.totalLessons ? Math.round((state.completedLessons / state.totalLessons) * 100) : 0;
                const allDone = !state.currentLesson;
                const scheduleTimes = getScheduleTimes(state);
                return (
                  <article key={`${state.classId}-${state.subjectId}`} className={`class-teach-card ${allDone ? 'is-completed' : ''}`} style={{ borderTopColor: state.subjectColor }}>
                    <div className="card-teach-header">
                      <div className="class-info"><h3>{formatClassName(state.className)}</h3><span>វេន{shiftLabel(state.classShift)}</span></div>
                      <div className="today-card-tags">
                        {scheduleTimes.map(time => <span key={time} className="schedule-time-tag"><Clock size={13} /> {time}</span>)}
                        <span className="subject-badge" style={{ backgroundColor: state.subjectColor }}>{state.subjectName}</span>
                      </div>
                    </div>
                    <div className="progress-strip"><div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progressPercent}%`, backgroundColor: state.subjectColor }} /></div><span className="progress-label">បានបង្រៀន {state.completedLessons}/{state.totalLessons}</span></div>
                    {allDone ? <div className="completed-overlay"><CheckCircle size={18} /> បានបង្រៀនគ្រប់មេរៀន</div> : state.currentLesson ? <>
                      <div className="lesson-info-block">
                        <div className="lesson-number">មេរៀនទី {state.currentLesson.orderNo}{state.isPartialContinue && <span className="continue-badge">បន្តពី {state.partialPercent}%</span>}</div>
                        <div className="lesson-name">{state.currentLesson.title}</div>
                        {state.currentLesson.exercise && <div className="lesson-exercise">លំហាត់៖ {state.currentLesson.exercise}</div>}
                        {state.previousLesson && <div className="prev-lesson"><CheckCircle size={12} /> មេរៀនមុន៖ {state.previousLesson.title}</div>}
                      </div>
                      <div className="teach-actions">
                        <button className="teach-btn complete" onClick={() => void completeLesson(state)} disabled={isSaving}><CheckCircle size={16} /> បានបង្រៀនរួច</button>
                        <button className="teach-btn partial" onClick={() => openPartialModal(state)} disabled={isSaving}><Clock size={16} /> បង្រៀនមិនទាន់ចប់</button>
                        <button className="teach-btn skip" onClick={() => void skipLesson(state)} disabled={isSaving}>រំលងមេរៀននេះ</button>
                      </div>
                    </> : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Undo Toast */}
      {undoLog && (
        <div className="undo-toast">
          <span>{undoLog.message}</span>
          <button onClick={() => void undoComplete()}>មិនរក្សាទុក</button>
        </div>
      )}

      {/* Partial Modal */}
      <Modal
        isOpen={showPartialModal}
        onClose={() => { setShowPartialModal(false); setPartialTarget(null); }}
        title="បង្រៀនបានប៉ុន្មាន?"
      >
        {partialTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{formatClassName(partialTarget.className)}</strong> · {partialTarget.subjectName} · មេរៀនទី {partialTarget.currentLesson?.orderNo}
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                បានបង្រៀនដល់កម្រិតណា?
              </label>
              <div className="partial-options">
                {[25, 50, 75].map(pct => (
                  <button
                    key={pct}
                    className={`partial-option ${partialPercent === pct ? 'selected' : ''}`}
                    onClick={() => setPartialPercent(pct)}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                កំណត់សម្គាល់ (បើមាន)
              </label>
              <textarea
                rows={2}
                value={partialNote}
                onChange={e => setPartialNote(e.target.value)}
                placeholder="ឧ. សិស្សត្រូវហាត់បន្ថែមអំពីការបង្កើតតារាង"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => { setShowPartialModal(false); setPartialTarget(null); }}
                className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-lg"
              >
                បោះបង់
              </button>
              <button
                onClick={() => void savePartial()}
                disabled={isSaving}
                className="px-5 py-2 bg-[#2a5298] text-white text-sm font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TeachingToday;
