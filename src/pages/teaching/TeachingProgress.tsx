import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, History, Search, XCircle } from 'lucide-react';
import { initDB } from '../../store/db';
import type {
  ClassRecord, ClassCurriculumRecord, CurriculumLessonRecord,
  Shift, SubjectRecord, TeachingLogRecord,
} from '../../store/db';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import './TeachingProgress.css';

type TabView = 'status' | 'history';
type StatusFilter = 'all' | 'not-started' | 'active' | 'completed';
type ShiftFilter = 'All' | Shift;

interface ProgressRow {
  classId: string;
  className: string;
  classShift: Shift;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  currentLesson: CurriculumLessonRecord | null;
  lastLog: TeachingLogRecord | null;
}

const SHIFT_OPTIONS: Array<{ value: ShiftFilter; label: string }> = [
  { value: 'All', label: 'គ្រប់វេន' },
  { value: 'Morning', label: 'ព្រឹក' },
  { value: 'Afternoon', label: 'រសៀល' },
  { value: 'Evening', label: 'យប់' },
];

const shiftLabel = (shift: Shift) => {
  if (shift === 'Morning') return 'ព្រឹក';
  if (shift === 'Afternoon') return 'រសៀល';
  return 'យប់';
};

const formatClassName = (name: string) => {
  const normalized = name.trim();
  return normalized.startsWith('ថ្នាក់ទី') ? normalized : `ថ្នាក់ទី ${normalized}`;
};

const formatDate = (date: string) => new Intl.DateTimeFormat('km-KH', {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(date));

const TeachingProgress = () => {
  const { activeYear } = useAcademicYear();
  const loadRef = useRef(0);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [lessons, setLessons] = useState<CurriculumLessonRecord[]>([]);
  const [assignments, setAssignments] = useState<ClassCurriculumRecord[]>([]);
  const [teachingLogs, setTeachingLogs] = useState<TeachingLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTabView, setActiveTabView] = useState<TabView>('status');
  const [selectedShift, setSelectedShift] = useState<ShiftFilter>('All');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');

  const loadData = useCallback(async () => {
    if (!activeYear) return;
    const reqId = ++loadRef.current;
    setIsLoading(true);
    try {
      const db = await initDB();
      const [cls, subs, lsns, assigns, logs] = await Promise.all([
        db.getAll('classes', activeYear),
        db.getAll('subjects', activeYear),
        db.getAll('curriculumLessons', activeYear),
        db.getAll('classCurriculums', activeYear),
        db.getAll('teachingLogs', activeYear),
      ]);
      if (reqId !== loadRef.current) return;
      cls.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      lsns.sort((a, b) => a.orderNo - b.orderNo);
      setClasses(cls);
      setSubjects(subs);
      setLessons(lsns);
      setAssignments(assigns);
      setTeachingLogs(logs);
    } catch (error) {
      if (reqId === loadRef.current) console.error('Failed to load teaching status:', error);
    } finally {
      if (reqId === loadRef.current) setIsLoading(false);
    }
  }, [activeYear]);

  useEffect(() => { void loadData(); }, [loadData]);

  const progressRows = useMemo<ProgressRow[]>(() => assignments.flatMap(assignment => {
    const classItem = classes.find(item => item.id === assignment.classId);
    const subject = subjects.find(item => item.id === assignment.subjectId);
    if (!classItem || !subject) return [];
    const subjectLessons = lessons.filter(item => item.subjectId === subject.id);
    const lessonIds = new Set(subjectLessons.map(item => item.id));
    const classLogs = teachingLogs
      .filter(log => log.classId === classItem.id && lessonIds.has(log.lessonId))
      .sort((a, b) => new Date(b.taughtAt).getTime() - new Date(a.taughtAt).getTime());
    const completedIds = new Set(classLogs.filter(log => log.status === 'completed').map(log => log.lessonId));
    const currentLesson = subjectLessons.find(lesson => !completedIds.has(lesson.id)) || null;
    return [{
      classId: classItem.id,
      className: classItem.name,
      classShift: classItem.shift,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      totalLessons: subjectLessons.length,
      completedLessons: completedIds.size,
      percent: subjectLessons.length ? Math.round((completedIds.size / subjectLessons.length) * 100) : 0,
      currentLesson,
      lastLog: classLogs[0] || null,
    }];
  }).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true })
    || a.subjectName.localeCompare(b.subjectName)), [assignments, classes, lessons, subjects, teachingLogs]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return progressRows.filter(row => {
      if (selectedShift !== 'All' && row.classShift !== selectedShift) return false;
      if (selectedSubjectId !== 'all' && row.subjectId !== selectedSubjectId) return false;
      if (query && !`${row.className} ${row.subjectName}`.toLocaleLowerCase().includes(query)) return false;
      if (selectedStatus === 'not-started') return row.completedLessons === 0 && !row.lastLog;
      if (selectedStatus === 'completed') return row.totalLessons > 0 && !row.currentLesson;
      if (selectedStatus === 'active') return !!row.currentLesson && (row.completedLessons > 0 || !!row.lastLog);
      return true;
    });
  }, [progressRows, searchText, selectedShift, selectedStatus, selectedSubjectId]);

  const filteredHistory = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return [...teachingLogs]
      .sort((a, b) => new Date(b.taughtAt).getTime() - new Date(a.taughtAt).getTime())
      .filter(log => {
        const classItem = classes.find(item => item.id === log.classId);
        const lesson = lessons.find(item => item.id === log.lessonId);
        const subject = lesson ? subjects.find(item => item.id === lesson.subjectId) : null;
        if (selectedShift !== 'All' && classItem?.shift !== selectedShift) return false;
        if (selectedSubjectId !== 'all' && subject?.id !== selectedSubjectId) return false;
        return !query || `${classItem?.name || ''} ${subject?.name || ''} ${lesson?.title || ''}`
          .toLocaleLowerCase().includes(query);
      });
  }, [classes, lessons, searchText, selectedShift, selectedSubjectId, subjects, teachingLogs]);

  const statusLabel = (row: ProgressRow) => {
    if (!row.totalLessons) return { label: 'មិនទាន់មានមេរៀន', className: 'empty' };
    if (!row.currentLesson) return { label: 'បានបង្រៀនគ្រប់មេរៀន', className: 'completed' };
    if (!row.completedLessons && !row.lastLog) return { label: 'មិនទាន់ចាប់ផ្តើម', className: 'not-started' };
    return { label: 'កំពុងបង្រៀន', className: 'active' };
  };

  if (!activeYear) return (
    <div className="teaching-page-empty"><BookOpen size={48} /><p>សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p></div>
  );

  return (
    <div className="teaching-status-page">
      <header className="teaching-page-header">
        <div><h1>ស្ថានភាពបង្រៀន</h1><p>រកមើលមេរៀនបន្ទាប់ និងប្រវត្តិរបស់ថ្នាក់នីមួយៗ</p></div>
        <Link to="/teaching/today" className="teaching-primary-link">ចាប់ផ្តើមបង្រៀន <ArrowRight size={17} /></Link>
      </header>

      <div className="status-view-tabs" role="tablist" aria-label="ផ្នែកស្ថានភាពបង្រៀន">
        <button className={activeTabView === 'status' ? 'active' : ''} onClick={() => setActiveTabView('status')}>
          <BookOpen size={17} /> ស្ថានភាពថ្នាក់
        </button>
        <button className={activeTabView === 'history' ? 'active' : ''} onClick={() => setActiveTabView('history')}>
          <History size={17} /> ប្រវត្តិបង្រៀន
        </button>
      </div>

      <section className="teaching-filter-bar" aria-label="ស្វែងរក និងចម្រាញ់">
        <label className="teaching-search-field"><Search size={17} />
          <input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="ស្វែងរកថ្នាក់ ឬមុខវិជ្ជា..." />
        </label>
        <select value={selectedShift} onChange={event => setSelectedShift(event.target.value as ShiftFilter)}>
          {SHIFT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={selectedSubjectId} onChange={event => setSelectedSubjectId(event.target.value)}>
          <option value="all">គ្រប់មុខវិជ្ជា</option>
          {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        {activeTabView === 'status' && (
          <select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value as StatusFilter)}>
            <option value="all">គ្រប់ស្ថានភាព</option>
            <option value="not-started">មិនទាន់ចាប់ផ្តើម</option>
            <option value="active">កំពុងបង្រៀន</option>
            <option value="completed">បានបញ្ចប់</option>
          </select>
        )}
      </section>

      {isLoading ? <div className="teaching-loading-card">កំពុងទាញយក...</div>
        : !progressRows.length ? (
          <div className="teaching-page-empty teaching-card-empty">
            <BookOpen size={42} /><h2>មិនទាន់មានថ្នាក់ដែលភ្ជាប់មុខវិជ្ជា</h2>
            <p>ចូលទៅ «រៀបចំមេរៀន» រួចភ្ជាប់មុខវិជ្ជាទៅថ្នាក់ជាមុនសិន។</p>
            <Link to="/teaching/curriculum">ទៅរៀបចំមេរៀន</Link>
          </div>
        ) : activeTabView === 'status' ? (
          !filteredRows.length ? <div className="teaching-no-results">រកមិនឃើញទិន្នន័យតាមលក្ខខណ្ឌដែលបានជ្រើសទេ។</div> : (
            <div className="status-list">
              <div className="status-list-heading"><span>ថ្នាក់ និងមុខវិជ្ជា</span><span>ស្ថានភាពបច្ចុប្បន្ន</span><span>មេរៀនបន្ទាប់</span><span>កត់ត្រាចុងក្រោយ</span></div>
              {filteredRows.map(row => {
                const status = statusLabel(row);
                return <article key={`${row.classId}-${row.subjectId}`} className="status-row">
                  <div className="status-class-cell"><span className="status-subject-dot" style={{ backgroundColor: row.subjectColor }} />
                    <div><strong>{formatClassName(row.className)}</strong><span>{row.subjectName} · វេន{shiftLabel(row.classShift)}</span></div>
                  </div>
                  <div className="status-progress-cell">
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                    <div className="status-progress-summary"><div><span style={{ width: `${row.percent}%`, backgroundColor: row.subjectColor }} /></div><small>{row.completedLessons}/{row.totalLessons} មេរៀន</small></div>
                  </div>
                  <div className="status-next-cell">
                    {row.currentLesson ? <><strong>មេរៀនទី {row.currentLesson.orderNo}</strong><span>{row.currentLesson.title}</span></> : <span className="status-muted">—</span>}
                  </div>
                  <div className="status-last-cell">
                    {row.lastLog ? <><strong>{formatDate(row.lastLog.taughtAt)}</strong><span>
                      {row.lastLog.status === 'completed' && 'បានបង្រៀនរួច'}
                      {row.lastLog.status === 'partial' && `មិនទាន់ចប់ · ${row.lastLog.progressPercent}%`}
                      {row.lastLog.status === 'skipped' && 'បានរំលង'}
                    </span></> : <span className="status-muted">មិនទាន់មាន</span>}
                  </div>
                </article>;
              })}
            </div>
          )
        ) : !filteredHistory.length ? <div className="teaching-no-results">មិនទាន់មានប្រវត្តិបង្រៀនតាមលក្ខខណ្ឌដែលបានជ្រើសទេ។</div> : (
          <div className="simple-history-list">
            {filteredHistory.map(log => {
              const lesson = lessons.find(item => item.id === log.lessonId);
              const classItem = classes.find(item => item.id === log.classId);
              const subject = lesson ? subjects.find(item => item.id === lesson.subjectId) : null;
              return <article key={log.id} className="simple-history-row">
                <div className={`simple-history-icon ${log.status}`}>
                  {log.status === 'completed' && <CheckCircle2 size={18} />}
                  {log.status === 'partial' && <Clock3 size={18} />}
                  {log.status === 'skipped' && <XCircle size={18} />}
                </div>
                <div className="simple-history-main">
                  <strong>{formatClassName(classItem?.name || '?')} · {subject?.name || 'មុខវិជ្ជាមិនស្គាល់'}</strong>
                  <span>{lesson ? `មេរៀនទី ${lesson.orderNo} · ${lesson.title}` : 'មេរៀនមិនស្គាល់'}</span>
                  {log.note && <small>{log.note}</small>}
                </div>
                <div className="simple-history-meta"><strong>
                  {log.status === 'completed' && 'បានបង្រៀនរួច'}
                  {log.status === 'partial' && `មិនទាន់ចប់ ${log.progressPercent}%`}
                  {log.status === 'skipped' && 'បានរំលង'}
                </strong><span>{formatDate(log.taughtAt)}</span></div>
              </article>;
            })}
          </div>
        )}
    </div>
  );
};

export default TeachingProgress;
