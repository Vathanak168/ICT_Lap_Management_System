import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Printer,
  Trash2,
  Users,
  Plus,
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
import { compareKhmer } from '../../utils/khmerSort';
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
  { value: 'Morning', label: 'វេនព្រឹក' },
  { value: 'Afternoon', label: 'វេនរសៀល' },
  { value: 'Evening', label: 'វេនយប់' },
];

// Dynamic timetable periods according to shift
const SHIFT_PERIODS: Record<Shift, SchedulePeriod[]> = {
  Morning: [
    { startTime: '07:30', endTime: '08:20', label: '7:30-8:20' },
    { startTime: '08:20', endTime: '09:20', label: '8:20-9:20' },
    { startTime: '09:30', endTime: '10:20', label: '9:30-10:20' },
    { startTime: '10:20', endTime: '11:00', label: '10:20-11:00' },
  ],
  Afternoon: [
    { startTime: '13:00', endTime: '13:50', label: '1:00-1:50' },
    { startTime: '13:50', endTime: '14:50', label: '1:50-2:50' },
    { startTime: '15:00', endTime: '15:50', label: '3:00-3:50' },
    { startTime: '15:50', endTime: '16:30', label: '3:50-4:30' },
  ],
  Evening: [
    { startTime: '17:30', endTime: '18:20', label: '5:30-6:20' },
    { startTime: '18:20', endTime: '19:10', label: '6:20-7:10' },
    { startTime: '19:20', endTime: '20:10', label: '7:20-8:10' },
    { startTime: '20:10', endTime: '21:00', label: '8:10-9:00' },
  ],
};

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

  const periods = useMemo(() => SHIFT_PERIODS[selectedShift] || SHIFT_PERIODS.Morning, [selectedShift]);

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
      classRows.sort((a, b) => compareKhmer(a.name, b.name));
      subjectRows.sort((a, b) => compareKhmer(a.name, b.name));
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

      // Check if this class is already linked to this subject in classCurriculums.
      // If not, auto-link it seamlessly so the teacher is never blocked!
      const isAssigned = assignments.some(
        a => a.classId === editor.classId && a.subjectId === editor.subjectId
      );
      if (!isAssigned) {
        const newAssign: ClassCurriculumRecord = {
          id: crypto.randomUUID(),
          classId: editor.classId,
          subjectId: editor.subjectId,
          startDate: new Date().toISOString(),
          academicYear: activeYear,
        };
        await db.add('classCurriculums', newAssign);
      }

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

  const handleQuickDelete = async (e: React.MouseEvent, scheduleId: string) => {
    e.stopPropagation();
    if (!window.confirm('តើអ្នកពិតជាចង់លុបម៉ោងនេះចេញពីកាលវិភាគមែនទេ?')) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      await db.delete('teachingSchedules', scheduleId);
      await loadData();
    } catch (err) {
      console.error('Failed to quick delete schedule slot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <CalendarDays size={48} className="mb-4 opacity-50 text-blue-500" />
        <p className="text-lg font-medium text-gray-600">សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p>
      </div>
    );
  }

  return (
    <div className="teaching-schedule-page">
      {/* Page Header */}
      <div className="schedule-page-header">
        <div>
          <h1>
            <CalendarDays size={25} />
            <span>កាលវិភាគបង្រៀន</span>
            <span className="subtitle-latin">(Teaching Schedule)</span>
          </h1>
          <p>ជ្រើសរើសវេនសិក្សា រួចចុចលើក្រឡាថ្ងៃ និងម៉ោង ដើម្បីកំណត់ ឬកែប្រែថ្នាក់បង្រៀន។</p>
        </div>

        <div className="schedule-header-actions">
          {/* Elegant Shift Switcher */}
          <div className="schedule-shift-pills" role="tablist">
            {SHIFT_OPTIONS.map(option => {
              const classCount = classes.filter(classItem => classItem.shift === option.value).length;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={selectedShift === option.value}
                  className={`shift-pill-btn ${selectedShift === option.value ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedShift(option.value);
                    setEditor(null);
                  }}
                >
                  <span>{option.label}</span>
                  <span className="count-pill">{classCount}</span>
                </button>
              );
            })}
          </div>

          <button type="button" className="schedule-print-button" onClick={() => window.print()}>
            <Printer size={16} />
            <span>បោះពុម្ព</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="schedule-summary-grid">
        <div className="schedule-summary-card">
          <Building2 size={20} className="kpi-icon blue" />
          <div>
            <span>សាខា</span>
            <strong>{formatBranch(branch)}</strong>
          </div>
        </div>
        <div className="schedule-summary-card">
          <Users size={20} className="kpi-icon indigo" />
          <div>
            <span>ថ្នាក់រៀន {shiftLabel(selectedShift)}</span>
            <strong>{shiftClasses.length} ថ្នាក់</strong>
          </div>
        </div>
        <div className="schedule-summary-card">
          <BookOpen size={20} className="kpi-icon amber" />
          <div>
            <span>មុខវិជ្ជាដែលបានភ្ជាប់</span>
            <strong>{shiftAssignments.length} ការភ្ជាប់</strong>
          </div>
        </div>
        <div className="schedule-summary-card">
          <CheckCircle2 size={20} className="kpi-icon emerald" />
          <div>
            <span>ម៉ោងដែលបានរៀបចំ</span>
            <strong>{shiftSchedule.length} ម៉ោង</strong>
          </div>
        </div>
      </div>

      {loadError && <div className="schedule-alert">{loadError}</div>}

      {/* Official Beltei Timetable Sheet */}
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
            <Loader2 size={32} className="animate-spin text-blue-600" />
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
                {periods.map(period => (
                  <tr key={period.label}>
                    <th className="schedule-period-label">
                      <span className="period-time-range">{period.label}</span>
                    </th>
                    {DAYS.map(day => {
                      const item = scheduleBySlot.get(slotKey(day.value, period.startTime, period.endTime));
                      const classItem = item ? classById.get(item.classId) : null;
                      const subject = item ? subjectById.get(item.subjectId) : null;

                      return (
                        <td key={day.value}>
                          <button
                            type="button"
                            className={`schedule-cell ${item ? 'has-entry' : 'is-empty'}`}
                            onClick={() => openEditor(day.value, period)}
                            disabled={Boolean(loadError) || isSaving}
                            aria-label={`${item ? 'កែ' : 'បន្ថែម'} ថ្ងៃ${day.label} ម៉ោង ${period.label}`}
                          >
                            {item ? (
                              <div className="cell-entry-box">
                                <span className="schedule-cell-class" style={{ color: subject?.color || '#002a5c' }}>
                                  {classItem ? formatClassName(classItem.name) : 'ថ្នាក់មិនស្គាល់'}
                                </span>
                                <span className="schedule-cell-subject" style={{ color: subject?.color || '#2a5298' }}>
                                  {subject?.name || 'មុខវិជ្ជាមិនស្គាល់'}
                                </span>
                                <span
                                  className="quick-cell-delete"
                                  onClick={(e) => void handleQuickDelete(e, item.id)}
                                  title="លុបម៉ោងនេះចេញ"
                                >
                                  ✕
                                </span>
                              </div>
                            ) : (
                              <div className="cell-empty-placeholder">
                                <Plus size={14} className="cell-plus-icon" />
                                <span className="cell-add-text">បន្ថែម</span>
                              </div>
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
            <Link to="/classes">បង្កើតថ្នាក់រៀនថ្មី</Link>
          </div>
        )}
      </section>

      {/* Streamlined Slot Editor Modal */}
      <Modal
        isOpen={Boolean(editor)}
        onClose={() => { if (!isSaving) setEditor(null); }}
        title={editor?.existingId ? 'កែសម្រួលម៉ោងបង្រៀន' : 'កំណត់ម៉ោងបង្រៀនថ្មី'}
      >
        {editor && (
          <div className="schedule-editor-body">
            {/* Context Header */}
            <div className="schedule-editor-context">
              <div className="context-item">
                <span>ថ្ងៃសិក្សា</span>
                <strong>{DAYS.find(day => day.value === editor.dayOfWeek)?.label}</strong>
              </div>
              <div className="context-item">
                <span>ម៉ោងសិក្សា</span>
                <strong>{editor.period.label}</strong>
              </div>
              <div className="context-item">
                <span>វេន</span>
                <strong>{shiftLabel(selectedShift)}</strong>
              </div>
              <div className="context-item">
                <span>សាខា</span>
                <strong>{formatBranch(branch)}</strong>
              </div>
            </div>

            {/* Class Selector */}
            <label className="schedule-field">
              <span className="field-label">ជ្រើសរើសថ្នាក់រៀន <span className="required-star">*</span></span>
              <select
                value={editor.classId}
                onChange={event => selectClass(event.target.value)}
                disabled={isSaving}
                className="schedule-select-control"
              >
                <option value="">-- ជ្រើសរើសថ្នាក់រៀន --</option>
                {shiftClasses.map(classItem => (
                  <option key={classItem.id} value={classItem.id}>
                    {formatClassName(classItem.name)}
                  </option>
                ))}
              </select>
              <small className="field-hint">បង្ហាញតែថ្នាក់ក្នុង{shiftLabel(selectedShift)} សម្រាប់ឆ្នាំសិក្សានេះ។</small>
            </label>

            {/* Subject Selector (Non-blocking: auto-links if not yet linked!) */}
            {editor.classId && (
              <label className="schedule-field">
                <span className="field-label">
                  ជ្រើសរើសមុខវិជ្ជា <span className="required-star">*</span>
                </span>
                <select
                  value={editor.subjectId}
                  onChange={event => setEditor({ ...editor, subjectId: event.target.value })}
                  disabled={isSaving}
                  className="schedule-select-control"
                >
                  <option value="">-- ជ្រើសរើសមុខវិជ្ជា --</option>
                  {(selectedClassSubjects.length > 0 ? selectedClassSubjects : subjects).map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>

                {selectedClassSubjects.length === 0 ? (
                  <small className="field-hint text-blue-600 font-medium">
                    ✨ ថ្នាក់នេះមិនទាន់ភ្ជាប់មុខវិជ្ជាទេ ប្រព័ន្ធនឹងភ្ជាប់មុខវិជ្ជានេះទៅថ្នាក់ដោយស្វ័យប្រវត្តិ។
                  </small>
                ) : (
                  <small className="field-hint">មុខវិជ្ជាដែលបានកំណត់សម្រាប់ថ្នាក់នេះ។</small>
                )}
              </label>
            )}

            {/* Modal Actions */}
            <div className="schedule-editor-actions">
              {editor.existingId ? (
                <button
                  type="button"
                  className="schedule-delete-btn"
                  onClick={() => void deleteSlot()}
                  disabled={isSaving}
                >
                  <Trash2 size={16} />
                  <span>លុបម៉ោងនេះ</span>
                </button>
              ) : <div />}

              <div className="actions-right-group">
                <button
                  type="button"
                  className="schedule-cancel-btn"
                  onClick={() => setEditor(null)}
                  disabled={isSaving}
                >
                  បោះបង់
                </button>
                <button
                  type="button"
                  className="schedule-save-btn"
                  onClick={() => void saveSlot()}
                  disabled={isSaving || !editor.classId || !editor.subjectId}
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកកាលវិភាគ'}</span>
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
