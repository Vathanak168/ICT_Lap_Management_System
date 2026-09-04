import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Printer,
  Trash2,
  Users,
} from 'lucide-react';
import { initDB } from '../../store/db';
import type {
  ClassCurriculumRecord,
  ClassRecord,
  Shift,
  SubjectRecord,
  TeachingScheduleRecord,
} from '../../store/db';
import { Modal } from '../../components/ui/Modal';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { useAuth } from '../../contexts/AuthContext';
import './TeachingSchedule.css';

interface SchedulePeriod {
  startTime: string;
  endTime: string;
  label: string;
}

interface ScheduleEditorState {
  dayOfWeek: number;
  period: SchedulePeriod;
  existingId: string | null;
  classId: string;
  subjectId: string;
}

const DAYS = [
  { value: 1, label: 'ចន្ទ' },
  { value: 2, label: 'អង្គារ' },
  { value: 3, label: 'ពុធ' },
  { value: 4, label: 'ព្រហស្បតិ៍' },
  { value: 5, label: 'សុក្រ' },
  { value: 6, label: 'សៅរ៍' },
];

const SHIFT_OPTIONS: Array<{ value: Shift; label: string }> = [
  { value: 'Morning', label: 'ព្រឹក' },
  { value: 'Afternoon', label: 'រសៀល' },
  { value: 'Evening', label: 'យប់' },
];

// These periods follow the timetable supplied by the user.
const PERIODS: SchedulePeriod[] = [
  { startTime: '07:30', endTime: '08:20', label: '7:30-8:20' },
  { startTime: '08:20', endTime: '09:20', label: '8:20-9:20' },
  { startTime: '09:30', endTime: '10:20', label: '9:30-10:20' },
  { startTime: '10:20', endTime: '11:00', label: '10:20-11:00' },
];

const normalizeTime = (value: string) => value.slice(0, 5);

const slotKey = (dayOfWeek: number, startTime: string, endTime: string) =>
  `${dayOfWeek}-${normalizeTime(startTime)}-${normalizeTime(endTime)}`;

const toKhmerDigits = (value: string) =>
  value.replace(/\d/g, digit => '០១២៣៤៥៦៧៨៩'[Number(digit)]);

const formatBranch = (branch: string | null) => {
  const normalized = branch?.trim() ?? '';
  const branchNumber = normalized.match(/\d+/)?.[0];
  if (branchNumber) return `សាខាទី${toKhmerDigits(branchNumber)}`;
  return normalized || 'មិនទាន់កំណត់សាខា';
};

const formatClassName = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return 'ថ្នាក់មិនស្គាល់';
  return normalized.startsWith('ថ្នាក់ទី') ? normalized : `ថ្នាក់ទី ${normalized}`;
};

const shiftLabel = (shift: Shift) => {
  if (shift === 'Morning') return 'វេនព្រឹក';
  if (shift === 'Afternoon') return 'វេនរសៀល';
  return 'វេនយប់';
};

const TeachingSchedule = () => {
  const { activeYear } = useAcademicYear();
  const { user, branch } = useAuth();
  const loadRequestRef = useRef(0);

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [assignments, setAssignments] = useState<ClassCurriculumRecord[]>([]);
  const [schedule, setSchedule] = useState<TeachingScheduleRecord[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift>('Morning');
  const [editor, setEditor] = useState<ScheduleEditorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeYear || !user?.id) return;
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const db = await initDB();
      const [classRows, subjectRows, assignmentRows] = await Promise.all([
        db.getAll('classes', activeYear),
        db.getAll('subjects', activeYear),
        db.getAll('classCurriculums', activeYear),
      ]);

      if (requestId !== loadRequestRef.current) return;
      classRows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      subjectRows.sort((a, b) => a.name.localeCompare(b.name));
      setClasses(classRows);
      setSubjects(subjectRows);
      setAssignments(assignmentRows);

      try {
        const scheduleRows = await db.getAll('teachingSchedules', activeYear);
        if (requestId !== loadRequestRef.current) return;
        setSchedule(scheduleRows.filter(row => row.teacherId === user.id));
      } catch (error) {
        if (requestId !== loadRequestRef.current) return;
        console.error('Failed to load teaching schedule:', error);
        setSchedule([]);
        setLoadError('មិនទាន់អាចប្រើតារាងកាលវិភាគបានទេ។ សូមដំណើរការ File teaching_schedule_schema.sql ក្នុង Supabase ជាមុនសិន។');
      }
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      console.error('Failed to load schedule data:', error);
      setClasses([]);
      setSubjects([]);
      setAssignments([]);
      setSchedule([]);
      setLoadError('មិនអាចទាញទិន្នន័យថ្នាក់ និងមុខវិជ្ជាបានទេ។ សូមពិនិត្យការតភ្ជាប់រួចសាកល្បងម្តងទៀត។');
    } finally {
      if (requestId === loadRequestRef.current) setIsLoading(false);
    }
  }, [activeYear, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const shiftClasses = useMemo(
    () => classes.filter(classItem => classItem.shift === selectedShift),
    [classes, selectedShift],
  );

  const shiftClassIds = useMemo(
    () => new Set(shiftClasses.map(classItem => classItem.id)),
    [shiftClasses],
  );

  const shiftAssignments = useMemo(
    () => assignments.filter(assignment => shiftClassIds.has(assignment.classId)),
    [assignments, shiftClassIds],
  );

  const shiftSchedule = useMemo(
    () => schedule.filter(item => item.shift === selectedShift),
    [schedule, selectedShift],
  );

  const scheduleBySlot = useMemo(() => {
    const slots = new Map<string, TeachingScheduleRecord>();
    shiftSchedule.forEach(item => {
      slots.set(slotKey(item.dayOfWeek, item.startTime, item.endTime), item);
    });
    return slots;
  }, [shiftSchedule]);

  const classById = useMemo(
    () => new Map(classes.map(classItem => [classItem.id, classItem])),
    [classes],
  );

  const subjectById = useMemo(
    () => new Map(subjects.map(subject => [subject.id, subject])),
    [subjects],
  );

  const subjectsForClass = useCallback((classId: string) => {
    const assignedIds = new Set(
      assignments
        .filter(assignment => assignment.classId === classId)
        .map(assignment => assignment.subjectId),
    );
    return subjects.filter(subject => assignedIds.has(subject.id));
  }, [assignments, subjects]);

  const selectedClassSubjects = useMemo(
    () => (editor?.classId ? subjectsForClass(editor.classId) : []),
    [editor?.classId, subjectsForClass],
  );

  const openEditor = (dayOfWeek: number, period: SchedulePeriod) => {
    const existing = scheduleBySlot.get(slotKey(dayOfWeek, period.startTime, period.endTime));
    const availableSubjects = existing ? subjectsForClass(existing.classId) : [];
    const existingSubjectIsValid = availableSubjects.some(subject => subject.id === existing?.subjectId);
    setEditor({
      dayOfWeek,
      period,
      existingId: existing?.id ?? null,
      classId: existing?.classId ?? '',
      subjectId: existingSubjectIsValid
        ? existing?.subjectId ?? ''
        : availableSubjects.length === 1
          ? availableSubjects[0].id
          : '',
    });
  };

  const selectClass = (classId: string) => {
    if (!editor) return;
    const availableSubjects = subjectsForClass(classId);
    const previousSubjectStillValid = availableSubjects.some(subject => subject.id === editor.subjectId);
    setEditor({
      ...editor,
      classId,
      subjectId: previousSubjectStillValid
        ? editor.subjectId
        : availableSubjects.length === 1
          ? availableSubjects[0].id
          : '',
    });
  };

  const saveSlot = async () => {
    if (!editor || !activeYear || !user?.id || !editor.classId || !editor.subjectId) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const record: TeachingScheduleRecord = {
        id: editor.existingId ?? crypto.randomUUID(),
        teacherId: user.id,
        shift: selectedShift,
        dayOfWeek: editor.dayOfWeek,
        startTime: editor.period.startTime,
        endTime: editor.period.endTime,
        classId: editor.classId,
        subjectId: editor.subjectId,
        academicYear: activeYear,
      };
      await db.put('teachingSchedules', record);
      setEditor(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save schedule slot:', error);
      alert('មិនអាចរក្សាទុកកាលវិភាគបានទេ។ សូមពិនិត្យ Database រួចសាកល្បងម្តងទៀត។');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSlot = async () => {
    if (!editor?.existingId) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      await db.delete('teachingSchedules', editor.existingId);
      setEditor(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete schedule slot:', error);
      alert('មិនអាចលុបម៉ោងសិក្សានេះបានទេ។');
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <CalendarDays size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium text-gray-600">សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p>
      </div>
    );
  }

  return (
    <div className="teaching-schedule-page">
      <div className="schedule-page-header">
        <div>
          <h1>
            <CalendarDays size={25} />
            កាលវិភាគបង្រៀន
            <span>(Teaching Schedule)</span>
          </h1>
          <p>ជ្រើសប្រអប់ថ្ងៃ និងម៉ោង រួចជ្រើសថ្នាក់រៀន—មុខវិជ្ជានឹងទាញតាមថ្នាក់ដោយស្វ័យប្រវត្តិ។</p>
        </div>
        <div className="schedule-header-actions">
          <div className="schedule-shift-select-wrap">
            <select
              className="schedule-shift-select"
              value={selectedShift}
              aria-label="ជ្រើសវេនសិក្សា"
              onChange={event => {
                setSelectedShift(event.target.value as Shift);
                setEditor(null);
              }}
            >
              {SHIFT_OPTIONS.map(option => {
                const classCount = classes.filter(classItem => classItem.shift === option.value).length;
                return (
                  <option key={option.value} value={option.value}>
                    {option.label} ({classCount})
                  </option>
                );
              })}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <button type="button" className="schedule-print-button" onClick={() => window.print()}>
            <Printer size={17} /> បោះពុម្ព
          </button>
        </div>
      </div>

      <div className="schedule-summary-grid">
        <div className="schedule-summary-card">
          <Building2 size={20} />
          <div><span>សាខា</span><strong>{formatBranch(branch)}</strong></div>
        </div>
        <div className="schedule-summary-card">
          <Users size={20} />
          <div><span>ថ្នាក់រៀន {shiftLabel(selectedShift)}</span><strong>{shiftClasses.length} ថ្នាក់</strong></div>
        </div>
        <div className="schedule-summary-card">
          <BookOpen size={20} />
          <div><span>មុខវិជ្ជាដែលបានភ្ជាប់</span><strong>{shiftAssignments.length} ការភ្ជាប់</strong></div>
        </div>
        <div className="schedule-summary-card">
          <CheckCircle2 size={20} />
          <div><span>ម៉ោងដែលបានរៀបចំ</span><strong>{shiftSchedule.length} ម៉ោង</strong></div>
        </div>
      </div>

      {loadError && <div className="schedule-alert">{loadError}</div>}

      <section className="schedule-sheet">
        <div className="schedule-school-brand">
          <img
            src="/beltei-header.png"
            alt="BELTEI International School"
            className="schedule-school-header"
          />
        </div>
        <div className="schedule-sheet-heading">
          <h2>កាលវិភាគបង្រៀនសម្រាប់សិស្សបន្ទប់កុំព្យូទ័រ</h2>
          <h3>ថ្នាក់បឋម (៤-៦) និងថ្នាក់មធ្យម (៧-៨)</h3>
          <p>នៃសាលា ប៊ែលធី អន្តរជាតិ {formatBranch(branch)} · {shiftLabel(selectedShift)}</p>
        </div>

        {isLoading ? (
          <div className="schedule-loading">
            <Loader2 size={30} className="animate-spin" />
            <span>កំពុងទាញទិន្នន័យកាលវិភាគ...</span>
          </div>
        ) : (
          <div className="schedule-table-scroll">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th className="schedule-time-heading">ម៉ោងសិក្សា</th>
                  {DAYS.map(day => <th key={day.value}>{day.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period.label}>
                    <th className="schedule-period-label">{period.label}</th>
                    {DAYS.map(day => {
                      const item = scheduleBySlot.get(slotKey(day.value, period.startTime, period.endTime));
                      const classItem = item ? classById.get(item.classId) : null;
                      const subject = item ? subjectById.get(item.subjectId) : null;
                      return (
                        <td key={day.value}>
                          <button
                            type="button"
                            className={`schedule-cell ${item ? 'has-entry' : ''}`}
                            onClick={() => openEditor(day.value, period)}
                            disabled={Boolean(loadError)}
                            aria-label={`${item ? 'កែ' : 'ជ្រើស'} ថ្ងៃ${day.label} ម៉ោង ${period.label}`}
                          >
                            {item && (
                              <>
                                <span className="schedule-cell-class" style={{ color: subject?.color || '#002a5c' }}>
                                  {classItem ? formatClassName(classItem.name) : 'ថ្នាក់មិនស្គាល់'}
                                </span>
                                <span className="schedule-cell-subject" style={{ color: subject?.color || '#2a5298' }}>
                                  {subject?.name || 'មុខវិជ្ជាមិនស្គាល់'}
                                </span>
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && shiftClasses.length === 0 && (
          <div className="schedule-empty-note">
            {classes.length === 0
              ? 'មិនទាន់មានទិន្នន័យថ្នាក់សម្រាប់ឆ្នាំសិក្សានេះទេ។ '
              : `មិនទាន់មានទិន្នន័យថ្នាក់${shiftLabel(selectedShift)}សម្រាប់ឆ្នាំសិក្សានេះទេ។ `}
            <Link to="/classes">បង្កើតថ្នាក់រៀន</Link>
          </div>
        )}
      </section>

      <Modal
        isOpen={Boolean(editor)}
        onClose={() => { if (!isSaving) setEditor(null); }}
        title={editor?.existingId ? 'កែម៉ោងបង្រៀន' : 'បន្ថែមម៉ោងបង្រៀន'}
      >
        {editor && (
          <div className="schedule-editor">
            <div className="schedule-editor-context">
              <div><span>ថ្ងៃ</span><strong>{DAYS.find(day => day.value === editor.dayOfWeek)?.label}</strong></div>
              <div><span>ម៉ោង</span><strong>{editor.period.label}</strong></div>
              <div><span>វេន</span><strong>{shiftLabel(selectedShift)}</strong></div>
              <div><span>សាខា</span><strong>{formatBranch(branch)}</strong></div>
            </div>

            <label className="schedule-field">
              <span>ថ្នាក់រៀន</span>
              <select value={editor.classId} onChange={event => selectClass(event.target.value)} disabled={isSaving}>
                <option value="">-- ជ្រើសថ្នាក់ --</option>
                {shiftClasses.map(classItem => (
                  <option key={classItem.id} value={classItem.id}>
                    {formatClassName(classItem.name)}
                  </option>
                ))}
              </select>
              <small>បញ្ជីនេះទាញ Auto តែថ្នាក់{shiftLabel(selectedShift)} ក្នុងឆ្នាំសិក្សាបច្ចុប្បន្ន។</small>
            </label>

            {editor.classId && selectedClassSubjects.length === 0 && (
              <div className="schedule-subject-warning">
                ថ្នាក់នេះមិនទាន់ភ្ជាប់មុខវិជ្ជាទេ។ សូមចូលទៅ <Link to="/teaching/curriculum">កម្មវិធីមេរៀន → Assign ថ្នាក់</Link> ជាមុនសិន។
              </div>
            )}

            {editor.classId && selectedClassSubjects.length === 1 && (
              <div className="schedule-auto-subject">
                <span>មុខវិជ្ជា</span>
                <strong style={{ color: selectedClassSubjects[0].color }}>
                  {selectedClassSubjects[0].name}
                </strong>
              </div>
            )}

            {editor.classId && selectedClassSubjects.length > 1 && (
              <label className="schedule-field">
                <span>មុខវិជ្ជា</span>
                <select
                  value={editor.subjectId}
                  onChange={event => setEditor({ ...editor, subjectId: event.target.value })}
                  disabled={isSaving}
                >
                  <option value="">-- ជ្រើសមុខវិជ្ជា --</option>
                  {selectedClassSubjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
                <small>បង្ហាញតែមុខវិជ្ជាដែលបាន Assign ទៅថ្នាក់នេះប៉ុណ្ណោះ។</small>
              </label>
            )}

            <div className="schedule-editor-actions">
              {editor.existingId && (
                <button type="button" className="schedule-delete-button" onClick={() => void deleteSlot()} disabled={isSaving}>
                  <Trash2 size={16} /> លុបម៉ោងនេះ
                </button>
              )}
              <div className="schedule-editor-actions-right">
                <button type="button" className="schedule-cancel-button" onClick={() => setEditor(null)} disabled={isSaving}>
                  បោះបង់
                </button>
                <button
                  type="button"
                  className="schedule-save-button"
                  onClick={() => void saveSlot()}
                  disabled={isSaving || !editor.classId || !editor.subjectId}
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TeachingSchedule;
