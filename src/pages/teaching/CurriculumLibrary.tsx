import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BookOpen, Plus, Edit, Trash2, Save,
  Library, ListChecks, ChevronDown, ChevronRight, Search
} from 'lucide-react';
import { initDB } from '../../store/db';
import type {
  SubjectRecord, CurriculumLessonRecord, ClassCurriculumRecord, ClassRecord, Shift
} from '../../store/db';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import './CurriculumLibrary.css';

// Default subject configs
const DEFAULT_SUBJECTS = [
  { name: 'Microsoft Word', color: '#3B82F6', icon: 'word' },
  { name: 'Microsoft PowerPoint', color: '#F97316', icon: 'ppt' },
  { name: 'Microsoft Excel', color: '#22C55E', icon: 'excel' },
  { name: 'Typing', color: '#8B5CF6', icon: 'keyboard' },
];

// Default curriculum data for pre-seeding
const DEFAULT_CURRICULUM: Record<string, Array<{ module: string; title: string; objectives?: string; exercise?: string }>> = {
  'Microsoft Word': [
    { module: 'Introduction', title: 'Introduction to Microsoft Word', objectives: '• Open and navigate Word\n• Understand the Ribbon interface\n• Create and save a document', exercise: 'Create a new document and save it.' },
    { module: 'Basic Editing', title: 'Typing & Editing Text', objectives: '• Type and edit text\n• Use Undo/Redo\n• Select, copy, cut, paste', exercise: 'Type a short paragraph and practice editing.' },
    { module: 'Formatting', title: 'Font & Paragraph Formatting', objectives: '• Change font style, size, color\n• Align text\n• Use line spacing', exercise: 'Format a given document with specific styles.' },
    { module: 'Page Layout', title: 'Margins, Size & Orientation', objectives: '• Set page margins\n• Change paper size\n• Switch orientation', exercise: 'Set up a document with custom page layout.' },
    { module: 'Tables', title: 'Create & Format Tables', objectives: '• Insert a table\n• Add/remove rows and columns\n• Apply table style', exercise: 'Create a student score table.' },
    { module: 'Insert', title: 'Pictures & Shapes', objectives: '• Insert images\n• Insert shapes\n• Position and resize objects', exercise: 'Create a poster with images and shapes.' },
    { module: 'Documents', title: 'Header, Footer & Page Number', objectives: '• Add header and footer\n• Insert page numbers\n• Customize header/footer', exercise: 'Create a multi-page document with headers.' },
    { module: 'Project', title: 'Create a Formal Document', objectives: '• Apply all learned skills\n• Create a professional document\n• Print preview', exercise: 'Create a formal letter or report.' },
  ],
  'Microsoft Excel': [
    { module: 'Introduction', title: 'Introduction to Microsoft Excel', objectives: '• Open and navigate Excel\n• Understand cells, rows, columns\n• Enter and edit data', exercise: 'Create a simple data table.' },
    { module: 'Basic Operations', title: 'Cell Formatting & Data Entry', objectives: '• Format cells (number, text, date)\n• Merge cells\n• Use auto-fill', exercise: 'Create a formatted student list.' },
    { module: 'Formulas', title: 'Basic Formulas (+ - × ÷)', objectives: '• Write basic arithmetic formulas\n• Use cell references\n• Understand formula bar', exercise: 'Calculate simple math problems.' },
    { module: 'Functions', title: 'SUM, AVERAGE, MIN & MAX', objectives: '• Use SUM function\n• Use AVERAGE function\n• Use MIN and MAX', exercise: 'Calculate student score statistics.' },
    { module: 'Functions', title: 'COUNT & IF Functions', objectives: '• Use COUNT/COUNTA\n• Write IF statements\n• Nested conditions', exercise: 'Create a pass/fail grade sheet.' },
    { module: 'Charts', title: 'Create Charts & Graphs', objectives: '• Insert column/bar charts\n• Insert pie charts\n• Customize chart elements', exercise: 'Create charts from student data.' },
    { module: 'Data', title: 'Sort & Filter Data', objectives: '• Sort data ascending/descending\n• Apply filters\n• Use custom sort', exercise: 'Sort and filter a product list.' },
    { module: 'Project', title: 'Create a Grade Report', objectives: '• Apply all learned skills\n• Build a complete spreadsheet\n• Use formulas and charts together', exercise: 'Create a complete class grade report.' },
  ],
  'Microsoft PowerPoint': [
    { module: 'Introduction', title: 'Introduction to PowerPoint', objectives: '• Open and navigate PowerPoint\n• Understand slides and layouts\n• Create a new presentation', exercise: 'Create a 3-slide presentation.' },
    { module: 'Design', title: 'Themes & Slide Design', objectives: '• Apply themes\n• Customize backgrounds\n• Use slide layouts', exercise: 'Design a presentation with a theme.' },
    { module: 'Content', title: 'Text & Text Boxes', objectives: '• Add and format text\n• Use text boxes\n• Apply WordArt', exercise: 'Create a title slide with styled text.' },
    { module: 'Media', title: 'Images, Shapes & SmartArt', objectives: '• Insert images and shapes\n• Use SmartArt graphics\n• Position and group objects', exercise: 'Create an infographic slide.' },
    { module: 'Animations', title: 'Animations & Transitions', objectives: '• Add slide transitions\n• Apply entrance/exit animations\n• Set animation timing', exercise: 'Add animations to a presentation.' },
    { module: 'Advanced', title: 'Tables & Charts in Slides', objectives: '• Insert tables\n• Insert charts\n• Link Excel data', exercise: 'Add a data table and chart to slides.' },
    { module: 'Delivery', title: 'Slideshow & Presenter View', objectives: '• Run slideshow\n• Use presenter view\n• Set slideshow timing', exercise: 'Practice presenting with presenter view.' },
    { module: 'Project', title: 'Create a Complete Presentation', objectives: '• Apply all learned skills\n• Create a 10+ slide presentation\n• Present to class', exercise: 'Create and present a topic presentation.' },
  ],
  'Typing': [
    { module: 'Foundation', title: 'Keyboard Posture & Finger Position', objectives: '• Sit with correct posture\n• Place fingers on the home row\n• Type without looking at the keyboard', exercise: 'Practice the home-row position for 10 minutes.' },
    { module: 'Home Row', title: 'Home Row Keys: A S D F J K L ;', objectives: '• Use the correct finger for each key\n• Build typing accuracy\n• Keep eyes on the screen', exercise: 'Type home-row drills with at least 90% accuracy.' },
    { module: 'Top Row', title: 'Top Row Keys: Q W E R T Y U I O P', objectives: '• Reach the top row correctly\n• Return fingers to the home row\n• Type common words', exercise: 'Complete top-row word drills.' },
    { module: 'Bottom Row', title: 'Bottom Row Keys: Z X C V B N M', objectives: '• Reach the bottom row correctly\n• Combine all letter rows\n• Maintain rhythm', exercise: 'Complete mixed-letter drills using all rows.' },
    { module: 'Accuracy', title: 'Capital Letters & Punctuation', objectives: '• Use Shift keys correctly\n• Type punctuation marks\n• Apply spacing rules', exercise: 'Type a formatted paragraph with punctuation.' },
    { module: 'Numbers', title: 'Numbers & Symbols', objectives: '• Type number-row keys\n• Use common symbols\n• Enter mixed text and numbers', exercise: 'Type dates, prices, and simple formulas.' },
    { module: 'Speed', title: 'Typing Speed & Accuracy', objectives: '• Measure words per minute\n• Reduce typing errors\n• Improve consistent speed', exercise: 'Complete a 3-minute timed typing test.' },
    { module: 'Project', title: 'Timed Typing Assessment', objectives: '• Apply touch-typing technique\n• Reach the target speed\n• Maintain at least 90% accuracy', exercise: 'Complete the final timed typing assessment.' },
  ],
};

type DefaultSubjectConfig = (typeof DEFAULT_SUBJECTS)[number];

const isTypingSubject = (name: string) => /^(computer\s+)?typing$/i.test(name.trim());

const createDefaultSubject = async (
  db: Awaited<ReturnType<typeof initDB>>,
  definition: DefaultSubjectConfig,
  academicYear: string,
) => {
  const subject: SubjectRecord = {
    id: crypto.randomUUID(),
    name: definition.name,
    color: definition.color,
    icon: definition.icon,
    academicYear,
  };
  await db.add('subjects', subject);

  const defaultLessons = DEFAULT_CURRICULUM[subject.name] || [];
  for (let index = 0; index < defaultLessons.length; index++) {
    const definitionLesson = defaultLessons[index];
    const lesson: CurriculumLessonRecord = {
      id: crypto.randomUUID(),
      subjectId: subject.id,
      orderNo: index + 1,
      module: definitionLesson.module,
      title: definitionLesson.title,
      objectives: definitionLesson.objectives || null,
      exercise: definitionLesson.exercise || null,
      estimatedPeriods: 1,
      academicYear,
    };
    await db.add('curriculumLessons', lesson);
  }

  return subject;
};

type ActiveTab = 'curriculum' | 'assign';
type AssignShift = 'All' | Shift;

const CurriculumLibrary = () => {
  const { activeYear } = useAcademicYear();
  const loadRef = useRef(0);
  const typingSeedRef = useRef(new Set<string>());

  // Data
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [lessons, setLessons] = useState<CurriculumLessonRecord[]>([]);
  const [assignments, setAssignments] = useState<ClassCurriculumRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('curriculum');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [assignShift, setAssignShift] = useState<AssignShift>('All');
  const [assignSearch, setAssignSearch] = useState('');

  // Lesson Edit Modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Partial<CurriculumLessonRecord> | null>(null);

  // Subject Modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Partial<SubjectRecord> | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    if (!activeYear) return;
    const reqId = ++loadRef.current;
    setIsLoading(true);
    try {
      const db = await initDB();
      const [subs, lsns, assigns, cls] = await Promise.all([
        db.getAll('subjects', activeYear),
        db.getAll('curriculumLessons', activeYear),
        db.getAll('classCurriculums', activeYear),
        db.getAll('classes', activeYear),
      ]);
      if (reqId !== loadRef.current) return;
      subs.sort((a, b) => a.name.localeCompare(b.name));
      lsns.sort((a, b) => a.orderNo - b.orderNo);
      cls.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setSubjects(subs);
      setLessons(lsns);
      setAssignments(assigns);
      setClasses(cls);
      if (subs.length > 0 && (!selectedSubjectId || !subs.find(s => s.id === selectedSubjectId))) {
        setSelectedSubjectId(subs[0].id);
      }
    } catch (err) {
      if (reqId === loadRef.current) console.error('Failed to load curriculum data:', err);
    } finally {
      if (reqId === loadRef.current) setIsLoading(false);
    }
  }, [activeYear, selectedSubjectId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Existing branches are upgraded once: add Typing when they already have a curriculum.
  useEffect(() => {
    if (
      !activeYear
      || isLoading
      || subjects.length === 0
      || subjects.some(subject => isTypingSubject(subject.name))
      || typingSeedRef.current.has(activeYear)
    ) return;

    typingSeedRef.current.add(activeYear);
    const addTyping = async () => {
      try {
        const db = await initDB();
        const typingDefinition = DEFAULT_SUBJECTS.find(subject => subject.name === 'Typing');
        if (!typingDefinition) return;
        await createDefaultSubject(db, typingDefinition, activeYear);
        await loadData();
      } catch (error) {
        typingSeedRef.current.delete(activeYear);
        console.error('Failed to add Typing subject:', error);
      }
    };
    void addTyping();
  }, [activeYear, isLoading, loadData, subjects]);

  // Auto-seed subjects if empty
  const handleSeedDefaults = async () => {
    if (!activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();

      for (const def of DEFAULT_SUBJECTS) {
        await createDefaultSubject(db, def, activeYear);
      }

      await loadData();
    } catch (err) {
      console.error('Failed to seed defaults:', err);
      alert('មានបញ្ហាក្នុងការបង្កើតមេរៀន');
    } finally {
      setIsSaving(false);
    }
  };

  // Derived state
  const selectedSubject = useMemo(
    () => subjects.find(s => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const subjectLessons = useMemo(
    () => (selectedSubjectId ? lessons.filter(l => l.subjectId === selectedSubjectId) : []),
    [lessons, selectedSubjectId]
  );

  const lessonsByModule = useMemo(() => {
    const groups: Record<string, CurriculumLessonRecord[]> = {};
    subjectLessons.forEach(l => {
      const mod = l.module || 'General';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(l);
    });
    return groups;
  }, [subjectLessons]);

  // CRUD: Lesson
  const openAddLesson = () => {
    if (!selectedSubjectId) return;
    setEditingLesson({
      subjectId: selectedSubjectId,
      orderNo: subjectLessons.length + 1,
      module: '',
      title: '',
      objectives: '',
      exercise: '',
      estimatedPeriods: 1,
    });
    setShowLessonModal(true);
  };

  const openEditLesson = (lesson: CurriculumLessonRecord) => {
    setEditingLesson({ ...lesson });
    setShowLessonModal(true);
  };

  const saveLesson = async () => {
    if (!editingLesson || !activeYear || !editingLesson.title?.trim()) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const record: CurriculumLessonRecord = {
        id: editingLesson.id || crypto.randomUUID(),
        subjectId: editingLesson.subjectId || selectedSubjectId!,
        orderNo: editingLesson.orderNo || subjectLessons.length + 1,
        module: editingLesson.module || '',
        title: editingLesson.title!.trim(),
        objectives: editingLesson.objectives || null,
        exercise: editingLesson.exercise || null,
        estimatedPeriods: editingLesson.estimatedPeriods || 1,
        academicYear: activeYear,
      };
      await db.put('curriculumLessons', record);
      setShowLessonModal(false);
      setEditingLesson(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save lesson:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLesson = async (id: string) => {
    if (!window.confirm('តើអ្នកពិតជាចង់លុបមេរៀននេះមែនទេ?')) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      await db.delete('curriculumLessons', id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete lesson:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // CRUD: Subject
  const openAddSubject = () => {
    setEditingSubject({ name: '', color: '#6366F1', icon: 'book' });
    setShowSubjectModal(true);
  };

  const openEditSubject = (subject: SubjectRecord) => {
    setEditingSubject({ ...subject });
    setShowSubjectModal(true);
  };

  const saveSubject = async () => {
    if (!editingSubject || !activeYear || !editingSubject.name?.trim()) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const record: SubjectRecord = {
        id: editingSubject.id || crypto.randomUUID(),
        name: editingSubject.name!.trim(),
        color: editingSubject.color || '#6366F1',
        icon: editingSubject.icon || 'book',
        academicYear: activeYear,
      };
      await db.put('subjects', record);
      setShowSubjectModal(false);
      setEditingSubject(null);
      setSelectedSubjectId(record.id);
      await loadData();
    } catch (err) {
      console.error('Failed to save subject:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Assign curriculum to class
  const toggleAssignment = async (classId: string, subjectId: string) => {
    if (!activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      const existing = assignments.find(
        a => a.classId === classId && a.subjectId === subjectId
      );
      if (existing) {
        await db.delete('classCurriculums', existing.id);
      } else {
        const record: ClassCurriculumRecord = {
          id: crypto.randomUUID(),
          classId,
          subjectId,
          startDate: new Date().toISOString().split('T')[0],
          academicYear: activeYear,
        };
        await db.add('classCurriculums', record);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to toggle assignment:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModule = (mod: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  const isAssigned = (classId: string, subjectId: string) =>
    assignments.some(a => a.classId === classId && a.subjectId === subjectId);

  const filteredClasses = useMemo(() => {
    const query = assignSearch.trim().toLocaleLowerCase();
    return classes.filter(classItem => {
      if (assignShift !== 'All' && classItem.shift !== assignShift) return false;
      return !query || classItem.name.toLocaleLowerCase().includes(query);
    });
  }, [assignSearch, assignShift, classes]);

  const formatClassName = (name: string) => {
    const normalized = name.trim();
    return normalized.startsWith('ថ្នាក់ទី') ? normalized : `ថ្នាក់ទី ${normalized}`;
  };

  // --- RENDER ---
  if (!activeYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Library size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium text-gray-600">សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p>
      </div>
    );
  }

  return (
    <div className="curriculum-page">
      {/* Header */}
      <div className="curriculum-page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library size={24} className="text-[#2a5298]" />
            រៀបចំមេរៀន
          </h1>
          <p className="text-sm text-gray-500 mt-1">បង្កើតមុខវិជ្ជា បញ្ចូលមេរៀន រួចភ្ជាប់ទៅថ្នាក់រៀន</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="curriculum-step-tabs">
          <button
            className={`curriculum-tab ${activeTab === 'curriculum' ? 'active' : ''}`}
            onClick={() => setActiveTab('curriculum')}
          >
            <span className="step-number">១</span><BookOpen size={16} /> រៀបចំមុខវិជ្ជា និងមេរៀន
          </button>
          <button
            className={`curriculum-tab ${activeTab === 'assign' ? 'active' : ''}`}
            onClick={() => setActiveTab('assign')}
          >
            <span className="step-number">២</span><ListChecks size={16} /> ភ្ជាប់ទៅថ្នាក់
            <span className="tab-count">{assignments.length}</span>
          </button>
        </div>

      {isLoading ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
          <div className="animate-spin h-8 w-8 border-b-2 border-[#2a5298] mx-auto mb-4"></div>
          <p className="text-gray-500">កំពុងទាញយក...</p>
        </div>
      ) : activeTab === 'curriculum' ? (
        /* === CURRICULUM TAB === */
        subjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="curriculum-empty">
              <div className="empty-icon">
                <BookOpen size={32} />
              </div>
              <h3>មិនទាន់មានមុខវិជ្ជាទេ</h3>
              <p>ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតមេរៀន Word, Excel, PowerPoint និង Typing ស្វ័យប្រវត្តិ</p>
              <button
                onClick={() => void handleSeedDefaults()}
                disabled={isSaving}
                className="mt-4 px-6 py-2.5 bg-[#2a5298] text-white rounded-lg font-bold text-sm hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <BookOpen size={16} />
                {isSaving ? 'កំពុងបង្កើត...' : 'បង្កើតមេរៀន Word / Excel / PowerPoint / Typing'}
              </button>
            </div>
          </div>
        ) : (
          <div className="curriculum-workspace">
            <aside className="curriculum-subject-panel">
              <div className="subject-panel-heading">
                <div><strong>មុខវិជ្ជា</strong><span>{subjects.length} មុខវិជ្ជា</span></div>
                <button onClick={openAddSubject} title="បន្ថែមមុខវិជ្ជា"><Plus size={17} /></button>
              </div>
              <div className="curriculum-subject-list">
              {subjects.map(sub => (
                <button
                  key={sub.id}
                  className={`curriculum-subject-item ${selectedSubjectId === sub.id ? 'active' : ''}`}
                  onClick={() => setSelectedSubjectId(sub.id)}
                >
                  <span className="tab-dot" style={{ backgroundColor: sub.color }}></span>
                  <span className="subject-item-name">{sub.name}<small>{lessons.filter(l => l.subjectId === sub.id).length} មេរៀន</small></span>
                  <ChevronRight size={16} />
                </button>
              ))}
              </div>
            </aside>

            {/* Lessons List */}
            {selectedSubject && (
              <section className={`curriculum-lesson-panel ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="lesson-panel-heading">
                  <h2>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSubject.color }}></span>
                    {selectedSubject.name}
                    <span className="text-sm font-medium text-gray-400">· {subjectLessons.length} មេរៀន</span>
                  </h2>
                  <div className="lesson-panel-actions">
                    <button className="edit-subject-button" onClick={() => openEditSubject(selectedSubject)}><Edit size={15} /> កែឈ្មោះ/ពណ៌</button>
                    <Button variant="primary" onClick={openAddLesson} icon={Plus} disabled={isSaving}>បន្ថែមមេរៀន</Button>
                  </div>
                </div>

                {subjectLessons.length === 0 ? (
                  <div className="curriculum-empty">
                    <div className="empty-icon"><BookOpen size={28} /></div>
                    <h3>មិនទាន់មានមេរៀនទេ</h3>
                    <p>ចុច "បន្ថែមមេរៀន" ដើម្បីចាប់ផ្តើម</p>
                  </div>
                ) : (
                  Object.entries(lessonsByModule).map(([moduleName, moduleLessons]) => (
                    <div key={moduleName} className="module-section">
                      <button className="module-header w-full text-left cursor-pointer hover:bg-gray-50 rounded-md -mx-1 px-1" onClick={() => toggleModule(moduleName)}>
                        {collapsedModules.has(moduleName) ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        <h3>{moduleName || 'General'}</h3>
                        <span className="module-count">{moduleLessons.length}</span>
                      </button>

                      {!collapsedModules.has(moduleName) && moduleLessons.map(lesson => (
                        <div key={lesson.id} className="lesson-card">
                          <div className="lesson-order" style={{ backgroundColor: selectedSubject.color }}>
                            {String(lesson.orderNo).padStart(2, '0')}
                          </div>
                          <div className="lesson-content">
                            <div className="lesson-title">{lesson.title}</div>
                            {lesson.objectives && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{lesson.objectives.replace(/[•\n]/g, ' · ').trim()}</p>
                            )}
                            <div className="lesson-meta">
                              {lesson.exercise && (
                                <span className="lesson-meta-tag">📝 {lesson.exercise.substring(0, 40)}{lesson.exercise.length > 40 ? '...' : ''}</span>
                              )}
                              <span className="lesson-meta-tag">⏱ {lesson.estimatedPeriods} ម៉ោងសិក្សា</span>
                            </div>
                          </div>
                          <div className="lesson-actions">
                            <button title="កែប្រែ" onClick={() => openEditLesson(lesson)}>
                              <Edit size={14} />
                            </button>
                            <button title="លុប" className="delete-btn" onClick={() => void deleteLesson(lesson.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </section>
            )}
          </div>
        )
      ) : (
        /* === ASSIGN TAB === */
        <div className="curriculum-assign-panel">
          <div className="assign-panel-heading">
            <div><h2>ភ្ជាប់មុខវិជ្ជាទៅថ្នាក់</h2><p>ថ្នាក់តែមួយអាចភ្ជាប់មុខវិជ្ជា ២ ឬច្រើនបាន ហើយរក្សាទុកដោយស្វ័យប្រវត្តិ</p></div>
            <span className="auto-save-note">✓ រក្សាទុក Auto</span>
          </div>

          <div className="assign-filters">
            <label><Search size={17} /><input value={assignSearch} onChange={event => setAssignSearch(event.target.value)} placeholder="ស្វែងរកថ្នាក់..." /></label>
            <div className="assign-shift-options">
              {([
                ['All', 'គ្រប់វេន'], ['Morning', 'ព្រឹក'], ['Afternoon', 'រសៀល'], ['Evening', 'យប់'],
              ] as Array<[AssignShift, string]>).map(([value, label]) => (
                <button key={value} className={assignShift === value ? 'active' : ''} onClick={() => setAssignShift(value)}>{label}</button>
              ))}
            </div>
            <span className="assign-result-count">{filteredClasses.length} ថ្នាក់</span>
          </div>

          {classes.length === 0 ? (
            <div className="curriculum-empty">
              <div className="empty-icon"><ListChecks size={28} /></div>
              <h3>មិនមានថ្នាក់រៀនទេ</h3>
              <p>សូមបង្កើតថ្នាក់រៀនមុន</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="curriculum-empty">
              <div className="empty-icon"><BookOpen size={28} /></div>
              <h3>មិនមានមុខវិជ្ជាទេ</h3>
              <p>សូមបង្កើតមុខវិជ្ជានៅជំហានទី១ជាមុន</p>
            </div>
          ) : (
            <div className={`assign-grid ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}>
              {filteredClasses.map(cls => {
                const assignedCount = subjects.filter(s => isAssigned(cls.id, s.id)).length;
                return (
                  <div key={cls.id} className="assign-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="class-name flex items-center gap-2">
                        {formatClassName(cls.name)}
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {cls.shift === 'Morning' ? 'ព្រឹក' : cls.shift === 'Afternoon' ? 'រសៀល' : 'យប់'}
                        </span>
                      </div>
                      {assignedCount > 0 && (
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          បានភ្ជាប់ {assignedCount}
                        </span>
                      )}
                    </div>
                    {subjects.map(sub => {
                      const assigned = isAssigned(cls.id, sub.id);
                      return (
                        <div key={sub.id} className="subject-checkbox" onClick={() => void toggleAssignment(cls.id, sub.id)}>
                          <input
                            type="checkbox"
                            checked={assigned}
                            readOnly
                          />
                          <label>
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: sub.color }}></span>
                            {sub.name}
                          </label>
                          {assigned && <span className="assigned-badge">✓ បានភ្ជាប់</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lesson Edit Modal */}
      <Modal
        isOpen={showLessonModal}
        onClose={() => { setShowLessonModal(false); setEditingLesson(null); }}
        title={editingLesson?.id ? 'កែប្រែមេរៀន' : 'បន្ថែមមេរៀនថ្មី'}
      >
        {editingLesson && (
          <div className="lesson-edit-form">
            <div className="form-row">
              <div>
                <label>លេខលំដាប់</label>
                <input
                  type="number"
                  min={1}
                  value={editingLesson.orderNo || 1}
                  onChange={e => setEditingLesson({ ...editingLesson, orderNo: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label>ក្រុមមេរៀន</label>
                <input
                  type="text"
                  value={editingLesson.module || ''}
                  onChange={e => setEditingLesson({ ...editingLesson, module: e.target.value })}
                  placeholder="ឧ. Introduction, Formatting..."
                />
              </div>
            </div>

            <div>
              <label>ចំណងជើងមេរៀន *</label>
              <input
                type="text"
                value={editingLesson.title || ''}
                onChange={e => setEditingLesson({ ...editingLesson, title: e.target.value })}
                placeholder="ឧ. Create & Format Tables"
              />
            </div>

            <div>
              <label>គោលបំណង</label>
              <textarea
                rows={3}
                value={editingLesson.objectives || ''}
                onChange={e => setEditingLesson({ ...editingLesson, objectives: e.target.value })}
                placeholder="• Objective 1&#10;• Objective 2"
              />
            </div>

            <div>
              <label>លំហាត់</label>
              <textarea
                rows={2}
                value={editingLesson.exercise || ''}
                onChange={e => setEditingLesson({ ...editingLesson, exercise: e.target.value })}
                placeholder="ឧ. Create a student score table."
              />
            </div>

            <div>
              <label>ចំនួនម៉ោងសិក្សា</label>
              <select
                value={editingLesson.estimatedPeriods || 1}
                onChange={e => setEditingLesson({ ...editingLesson, estimatedPeriods: parseInt(e.target.value) })}
              >
                <option value={1}>១ ម៉ោងសិក្សា</option>
                <option value={2}>២ ម៉ោងសិក្សា</option>
                <option value={3}>៣ ម៉ោងសិក្សា</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-2">
              <button
                onClick={() => { setShowLessonModal(false); setEditingLesson(null); }}
                className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-lg"
                disabled={isSaving}
              >
                បោះបង់
              </button>
              <button
                onClick={() => void saveLesson()}
                disabled={isSaving || !editingLesson.title?.trim()}
                className="px-5 py-2 bg-[#2a5298] text-white text-sm font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={14} />
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subject Modal */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        title={editingSubject?.id ? 'កែប្រែមុខវិជ្ជា' : 'បន្ថែមមុខវិជ្ជាថ្មី'}
      >
        {editingSubject && (
          <div className="lesson-edit-form">
            <div>
              <label>ឈ្មោះមុខវិជ្ជា *</label>
              <input
                type="text"
                value={editingSubject.name || ''}
                onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                placeholder="ឧ. Microsoft Access"
              />
            </div>
            <div>
              <label>ពណ៌សម្គាល់</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editingSubject.color || '#6366F1'}
                  onChange={e => setEditingSubject({ ...editingSubject, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-none"
                />
                <input
                  type="text"
                  value={editingSubject.color || '#6366F1'}
                  onChange={e => setEditingSubject({ ...editingSubject, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-2">
              <button
                onClick={() => { setShowSubjectModal(false); setEditingSubject(null); }}
                className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-lg"
              >
                បោះបង់
              </button>
              <button
                onClick={() => void saveSubject()}
                disabled={isSaving || !editingSubject.name?.trim()}
                className="px-5 py-2 bg-[#2a5298] text-white text-sm font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={14} />
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CurriculumLibrary;
