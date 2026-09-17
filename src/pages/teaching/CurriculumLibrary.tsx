import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BookOpen, Plus, Edit, Trash2,
  Library, ListChecks, ChevronDown, ChevronRight, Search,
  ArrowUp, ArrowDown, CheckCheck, X, Sparkles
} from 'lucide-react';
import { initDB } from '../../store/db';
import type {
  SubjectRecord, CurriculumLessonRecord, ClassCurriculumRecord, ClassRecord, Shift
} from '../../store/db';
import { Modal } from '../../components/ui/Modal';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { compareKhmer } from '../../utils/khmerSort';
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

  // Batch Assign State
  const [batchTargetSubjectId, setBatchTargetSubjectId] = useState<string>('');

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
      subs.sort((a, b) => compareKhmer(a.name, b.name));
      lsns.sort((a, b) => a.orderNo - b.orderNo);
      cls.sort((a, b) => compareKhmer(a.name, b.name));
      setSubjects(subs);
      setLessons(lsns);
      setAssignments(assigns);
      setClasses(cls);
      if (subs.length > 0) {
        if (!selectedSubjectId || !subs.find(s => s.id === selectedSubjectId)) {
          setSelectedSubjectId(subs[0].id);
        }
        if (!batchTargetSubjectId) {
          setBatchTargetSubjectId(subs[0].id);
        }
      }
    } catch (err) {
      if (reqId === loadRef.current) console.error('Failed to load curriculum data:', err);
    } finally {
      if (reqId === loadRef.current) setIsLoading(false);
    }
  }, [activeYear, selectedSubjectId, batchTargetSubjectId]);

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
    () => (selectedSubjectId ? lessons.filter(l => l.subjectId === selectedSubjectId).sort((a, b) => a.orderNo - b.orderNo) : []),
    [lessons, selectedSubjectId]
  );

  const lessonsByModule = useMemo(() => {
    const groups: Record<string, CurriculumLessonRecord[]> = {};
    subjectLessons.forEach(l => {
      const mod = l.module || 'ទូទៅ (General)';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(l);
    });
    return groups;
  }, [subjectLessons]);

  // Available Grades found in class names (e.g., 4, 5, 6, 7, 8, 9, 10)
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    classes.forEach(c => {
      const match = c.name.match(/\d+/);
      if (match) grades.add(match[0]);
    });
    return Array.from(grades).sort((a, b) => Number(a) - Number(b));
  }, [classes]);

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

  // Reordering Lessons: Up / Down
  const moveLesson = async (lesson: CurriculumLessonRecord, direction: 'up' | 'down') => {
    const currentIdx = subjectLessons.findIndex(l => l.id === lesson.id);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= subjectLessons.length) return;

    const targetLesson = subjectLessons[targetIdx];
    setIsSaving(true);
    try {
      const db = await initDB();
      const updatedLesson = { ...lesson, orderNo: targetLesson.orderNo };
      const updatedTarget = { ...targetLesson, orderNo: lesson.orderNo };

      await Promise.all([
        db.put('curriculumLessons', updatedLesson),
        db.put('curriculumLessons', updatedTarget),
      ]);
      await loadData();
    } catch (err) {
      console.error('Failed to reorder lessons:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // CRUD: Subject
  const openAddSubject = () => {
    setEditingSubject({ name: '', color: '#3B82F6', icon: 'book' });
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
        color: editingSubject.color || '#3B82F6',
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

  // Assign / Unassign a single class-subject pair
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

  // Batch Assign / Remove by Grade or All Classes
  const handleBatchSubjectToGrade = async (gradeNumber?: string, action: 'add' | 'remove' = 'add') => {
    if (!activeYear || !batchTargetSubjectId) return;
    const targetSubject = subjects.find(s => s.id === batchTargetSubjectId);
    if (!targetSubject) return;

    const targetClasses = classes.filter(c => {
      if (!gradeNumber) return true;
      return c.name.includes(gradeNumber);
    });

    if (targetClasses.length === 0) return;

    setIsSaving(true);
    try {
      const db = await initDB();
      for (const cls of targetClasses) {
        const existing = assignments.find(a => a.classId === cls.id && a.subjectId === batchTargetSubjectId);
        if (action === 'add' && !existing) {
          await db.add('classCurriculums', {
            id: crypto.randomUUID(),
            classId: cls.id,
            subjectId: batchTargetSubjectId,
            startDate: new Date().toISOString().split('T')[0],
            academicYear: activeYear,
          });
        } else if (action === 'remove' && existing) {
          await db.delete('classCurriculums', existing.id);
        }
      }
      await loadData();
    } catch (err) {
      console.error('Batch assign failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 1-Click: Link all subjects to a single class OR clear all
  const handleClassBatchAction = async (classId: string, action: 'link_all' | 'clear_all') => {
    if (!activeYear) return;
    setIsSaving(true);
    try {
      const db = await initDB();
      if (action === 'clear_all') {
        const classAssigns = assignments.filter(a => a.classId === classId);
        for (const ca of classAssigns) {
          await db.delete('classCurriculums', ca.id);
        }
      } else {
        for (const sub of subjects) {
          const exists = assignments.some(a => a.classId === classId && a.subjectId === sub.id);
          if (!exists) {
            await db.add('classCurriculums', {
              id: crypto.randomUUID(),
              classId,
              subjectId: sub.id,
              startDate: new Date().toISOString().split('T')[0],
              academicYear: activeYear,
            });
          }
        }
      }
      await loadData();
    } catch (err) {
      console.error('Failed class batch action:', err);
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

  if (!activeYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Library size={48} className="mb-4 opacity-50 text-blue-500" />
        <p className="text-lg font-medium text-gray-600">សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន</p>
      </div>
    );
  }

  return (
    <div className="curriculum-page">
      {/* Header */}
      <header className="curriculum-page-header">
        <div className="header-title-group">
          <h1>
            <Library size={26} className="title-icon" />
            <span>រៀបចំមេរៀន</span>
            <span className="title-latin">(Curriculum Library)</span>
          </h1>
          <p>គ្រប់គ្រងមុខវិជ្ជា រៀបចំលំដាប់មេរៀន និងភ្ជាប់ទៅកាន់ថ្នាក់រៀនដោយងាយស្រួល។</p>
        </div>

        {/* Step Tabs */}
        <div className="curriculum-step-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'curriculum'}
            className={`curriculum-tab ${activeTab === 'curriculum' ? 'active' : ''}`}
            onClick={() => setActiveTab('curriculum')}
          >
            <span className="step-number">១</span>
            <BookOpen size={16} />
            <span>រៀបចំមុខវិជ្ជា និងមេរៀន</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'assign'}
            className={`curriculum-tab ${activeTab === 'assign' ? 'active' : ''}`}
            onClick={() => setActiveTab('assign')}
          >
            <span className="step-number">២</span>
            <ListChecks size={16} />
            <span>ភ្ជាប់ទៅថ្នាក់រៀន</span>
            <span className="tab-count">{assignments.length}</span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="curriculum-loading-card">
          <div className="loading-spinner" />
          <p>កំពុងទាញយកព័ត៌មានមេរៀន...</p>
        </div>
      ) : activeTab === 'curriculum' ? (
        /* ==================================================================
           TAB 1: CURRICULUM & LESSONS
           ================================================================== */
        subjects.length === 0 ? (
          <div className="curriculum-empty-card">
            <div className="empty-icon-wrap">
              <BookOpen size={36} />
            </div>
            <h3>មិនទាន់មានមុខវិជ្ជាបង្រៀននៅឡើយទេ</h3>
            <p>លោកគ្រូ/អ្នកគ្រូ អាចចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកម្មវិធីសិក្សា Word, Excel, PowerPoint និង Typing ដោយស្វ័យប្រវត្តិ។</p>
            <button
              onClick={() => void handleSeedDefaults()}
              disabled={isSaving}
              className="seed-defaults-btn"
            >
              <Sparkles size={16} />
              <span>{isSaving ? 'កំពុងបង្កើត...' : 'បង្កើតមេរៀន Word / Excel / PowerPoint / Typing ស្វ័យប្រវត្តិ'}</span>
            </button>
          </div>
        ) : (
          <div className="curriculum-workspace">
            {/* Left Sidebar: Subjects List */}
            <aside className="curriculum-subject-panel">
              <div className="subject-panel-heading">
                <div>
                  <strong>មុខវិជ្ជា</strong>
                  <span className="subject-count-tag">{subjects.length}</span>
                </div>
                <button
                  onClick={openAddSubject}
                  title="បន្ថែមមុខវិជ្ជាថ្មី"
                  className="add-subject-mini-btn"
                >
                  <Plus size={16} />
                  <span>ថែម</span>
                </button>
              </div>

              <div className="curriculum-subject-list">
                {subjects.map(sub => {
                  const count = lessons.filter(l => l.subjectId === sub.id).length;
                  return (
                    <button
                      key={sub.id}
                      className={`curriculum-subject-item ${selectedSubjectId === sub.id ? 'active' : ''}`}
                      onClick={() => setSelectedSubjectId(sub.id)}
                    >
                      <span className="subject-color-dot" style={{ backgroundColor: sub.color }} />
                      <div className="subject-item-info">
                        <span className="subject-item-name">{sub.name}</span>
                        <span className="subject-item-meta">{count} មេរៀន</span>
                      </div>
                      <ChevronRight size={15} className="subject-chevron" />
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Main Panel: Lessons */}
            {selectedSubject && (
              <section className={`curriculum-lesson-panel ${isSaving ? 'is-saving' : ''}`}>
                <div className="lesson-panel-heading">
                  <div className="lesson-panel-title-group">
                    <span className="subject-pill-color" style={{ backgroundColor: selectedSubject.color }} />
                    <h2>{selectedSubject.name}</h2>
                    <span className="subject-meta-pill">{subjectLessons.length} មេរៀន</span>
                  </div>

                  <div className="lesson-panel-actions">
                    <button
                      className="edit-subject-btn"
                      onClick={() => openEditSubject(selectedSubject)}
                      title="កែសម្រួលឈ្មោះ ឬពណ៌មុខវិជ្ជា"
                    >
                      <Edit size={14} />
                      <span>កែមុខវិជ្ជា</span>
                    </button>
                    <button
                      className="add-lesson-primary-btn"
                      onClick={openAddLesson}
                      disabled={isSaving}
                    >
                      <Plus size={16} />
                      <span>បន្ថែមមេរៀនថ្មី</span>
                    </button>
                  </div>
                </div>

                {subjectLessons.length === 0 ? (
                  <div className="curriculum-empty-card mini">
                    <BookOpen size={30} className="empty-icon-mini" />
                    <h3>មិនទាន់មានមេរៀនក្នុងមុខវិជ្ជានេះទេ</h3>
                    <p>ចុច «បន្ថែមមេរៀនថ្មី» ខាងលើដើម្បីបញ្ចូលមេរៀនដំបូង។</p>
                  </div>
                ) : (
                  <div className="modules-container">
                    {Object.entries(lessonsByModule).map(([moduleName, moduleLessons]) => (
                      <div key={moduleName} className="module-section">
                        <button
                          type="button"
                          className="module-header"
                          onClick={() => toggleModule(moduleName)}
                        >
                          {collapsedModules.has(moduleName) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          <h3>{moduleName}</h3>
                          <span className="module-count">{moduleLessons.length} មេរៀន</span>
                        </button>

                        {!collapsedModules.has(moduleName) && (
                          <div className="module-lessons-list">
                            {moduleLessons.map(lesson => {
                              const lessonIdx = subjectLessons.findIndex(l => l.id === lesson.id);
                              const isFirst = lessonIdx === 0;
                              const isLast = lessonIdx === subjectLessons.length - 1;

                              return (
                                <div key={lesson.id} className="lesson-card">
                                  {/* Lesson Order Badge */}
                                  <div className="lesson-order" style={{ backgroundColor: selectedSubject.color }}>
                                    {String(lesson.orderNo).padStart(2, '0')}
                                  </div>

                                  {/* Lesson Main Content */}
                                  <div className="lesson-content">
                                    <div className="lesson-title-row">
                                      <h4 className="lesson-title">{lesson.title}</h4>
                                      <span className="lesson-module-tag">{lesson.module}</span>
                                    </div>

                                    {lesson.objectives && (
                                      <p className="lesson-objectives">
                                        {lesson.objectives.replace(/[•\n]/g, ' · ').trim()}
                                      </p>
                                    )}

                                    <div className="lesson-meta-chips">
                                      {lesson.exercise && (
                                        <span className="lesson-chip exercise">
                                          📝 {lesson.exercise}
                                        </span>
                                      )}
                                      <span className="lesson-chip period">
                                        ⏱ {lesson.estimatedPeriods} ម៉ោងសិក្សា
                                      </span>
                                    </div>
                                  </div>

                                  {/* Reordering & Edit Controls */}
                                  <div className="lesson-controls">
                                    {/* Quick Reordering Arrows */}
                                    <div className="reorder-group">
                                      <button
                                        type="button"
                                        className="reorder-btn"
                                        title="រំកិលមេរៀនឡើងលើ"
                                        disabled={isFirst || isSaving}
                                        onClick={() => void moveLesson(lesson, 'up')}
                                      >
                                        <ArrowUp size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        className="reorder-btn"
                                        title="រំកិលមេរៀនចុះក្រោម"
                                        disabled={isLast || isSaving}
                                        onClick={() => void moveLesson(lesson, 'down')}
                                      >
                                        <ArrowDown size={14} />
                                      </button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="action-buttons-group">
                                      <button
                                        type="button"
                                        className="ctrl-btn edit"
                                        title="កែសម្រួលមេរៀន"
                                        onClick={() => openEditLesson(lesson)}
                                      >
                                        <Edit size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        className="ctrl-btn delete"
                                        title="លុបមេរៀននេះ"
                                        onClick={() => void deleteLesson(lesson.id)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )
      ) : (
        /* ==================================================================
           TAB 2: ASSIGN CURRICULUM TO CLASSES (WITH BATCH ACTIONS)
           ================================================================== */
        <div className="curriculum-assign-panel">
          {/* Top Panel Heading */}
          <div className="assign-panel-heading">
            <div>
              <h2>ភ្ជាប់មុខវិជ្ជាទៅកាន់ថ្នាក់រៀន</h2>
              <p>ប្រើប្រាស់របារកំណត់រហ័សខាងក្រោម ឬចុចធីកមុខវិជ្ជាតាមថ្នាក់នីមួយៗ (រក្សាទុកដោយស្វ័យប្រវត្តិ)។</p>
            </div>
            <span className="auto-save-pill">✓ រក្សាទុកស្វ័យប្រវត្តិ</span>
          </div>

          {/* Super Fast Batch Toolbar */}
          <div className="batch-assign-toolbar">
            <div className="batch-label-group">
              <Sparkles size={16} className="text-amber-500" />
              <strong>កំណត់រហ័សជាក្រុម (Batch Assign)៖</strong>
            </div>

            <div className="batch-controls-wrap">
              {/* Select target subject for batch */}
              <div className="batch-subject-select-wrap">
                <span className="select-label">មុខវិជ្ជា៖</span>
                <select
                  value={batchTargetSubjectId}
                  onChange={e => setBatchTargetSubjectId(e.target.value)}
                  className="batch-subject-select"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Action buttons for grades */}
              <div className="batch-buttons-row">
                {availableGrades.map(grade => (
                  <button
                    key={grade}
                    type="button"
                    className="batch-btn grade"
                    onClick={() => void handleBatchSubjectToGrade(grade, 'add')}
                    disabled={isSaving || !batchTargetSubjectId}
                    title={`ភ្ជាប់មុខវិជ្ជានេះទៅគ្រប់ថ្នាក់ទី ${grade}`}
                  >
                    + គ្រប់ថ្នាក់ទី {grade}
                  </button>
                ))}

                <button
                  type="button"
                  className="batch-btn all"
                  onClick={() => void handleBatchSubjectToGrade(undefined, 'add')}
                  disabled={isSaving || !batchTargetSubjectId}
                  title="ភ្ជាប់មុខវិជ្ជានេះទៅគ្រប់ថ្នាក់រៀនទាំងអស់"
                >
                  <CheckCheck size={14} />
                  <span>+ ភ្ជាប់គ្រប់ថ្នាក់</span>
                </button>

                <button
                  type="button"
                  className="batch-btn clear"
                  onClick={() => void handleBatchSubjectToGrade(undefined, 'remove')}
                  disabled={isSaving || !batchTargetSubjectId}
                  title="ដកមុខវិជ្ជានេះចេញពីគ្រប់ថ្នាក់"
                >
                  <X size={14} />
                  <span>ដកចេញពីគ្រប់ថ្នាក់</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="assign-filters">
            <div className="assign-search-box">
              <Search size={16} className="search-icon" />
              <input
                value={assignSearch}
                onChange={event => setAssignSearch(event.target.value)}
                placeholder="ស្វែងរកតាមឈ្មោះថ្នាក់..."
              />
              {assignSearch && (
                <button className="clear-btn" onClick={() => setAssignSearch('')}>✕</button>
              )}
            </div>

            <div className="assign-shift-options">
              {([
                ['All', 'គ្រប់វេន'],
                ['Morning', 'ព្រឹក'],
                ['Afternoon', 'រសៀល'],
                ['Evening', 'យប់'],
              ] as Array<[AssignShift, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={assignShift === value ? 'active' : ''}
                  onClick={() => setAssignShift(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="assign-result-count">បង្ហាញ <strong>{filteredClasses.length}</strong> ថ្នាក់</span>
          </div>

          {/* Classes Grid */}
          {classes.length === 0 ? (
            <div className="curriculum-empty-card mini">
              <ListChecks size={32} className="empty-icon-mini" />
              <h3>មិនទាន់មានថ្នាក់រៀននៅឡើយទេ</h3>
              <p>សូមចូលទៅកាន់ផ្ទាំង «ថ្នាក់រៀន» ដើម្បីបង្កើតថ្នាក់ជាមុនសិន។</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="curriculum-empty-card mini">
              <BookOpen size={32} className="empty-icon-mini" />
              <h3>មិនទាន់មានមុខវិជ្ជាទេ</h3>
              <p>សូមបង្កើតមុខវិជ្ជានៅជំហានទី ១ ជាមុនសិន។</p>
            </div>
          ) : (
            <div className={`assign-grid ${isSaving ? 'is-saving' : ''}`}>
              {filteredClasses.map(cls => {
                const assignedSubjects = subjects.filter(s => isAssigned(cls.id, s.id));
                const allAssigned = assignedSubjects.length === subjects.length && subjects.length > 0;

                return (
                  <div key={cls.id} className="assign-card">
                    {/* Class Card Header */}
                    <div className="assign-card-header">
                      <div className="class-title-row">
                        <span className="assign-class-name">{formatClassName(cls.name)}</span>
                        <span className="assign-shift-tag">
                          {cls.shift === 'Morning' ? 'ព្រឹក' : cls.shift === 'Afternoon' ? 'រសៀល' : 'យប់'}
                        </span>
                      </div>

                      {/* 1-Click Quick Batch for this class */}
                      <div className="class-mini-actions">
                        <button
                          type="button"
                          className="mini-action-link"
                          onClick={() => void handleClassBatchAction(cls.id, allAssigned ? 'clear_all' : 'link_all')}
                          title={allAssigned ? 'ដកចេញគ្រប់មុខវិជ្ជា' : 'ភ្ជាប់គ្រប់មុខវិជ្ជាទាំងអស់'}
                        >
                          {allAssigned ? 'ដកទាំងអស់' : '+ ភ្ជាប់ទាំងអស់'}
                        </button>
                      </div>
                    </div>

                    {/* Assigned Summary Badge */}
                    <div className="assigned-status-row">
                      <span className="assigned-count-text">
                        បានភ្ជាប់ <strong>{assignedSubjects.length}</strong> / {subjects.length} មុខវិជ្ជា
                      </span>
                    </div>

                    {/* Subject Checkboxes */}
                    <div className="subject-checkboxes-list">
                      {subjects.map(sub => {
                        const assigned = isAssigned(cls.id, sub.id);
                        return (
                          <div
                            key={sub.id}
                            className={`subject-checkbox-item ${assigned ? 'is-checked' : ''}`}
                            onClick={() => void toggleAssignment(cls.id, sub.id)}
                          >
                            <input
                              type="checkbox"
                              checked={assigned}
                              readOnly
                              tabIndex={-1}
                            />
                            <label className="checkbox-content">
                              <span className="sub-dot" style={{ backgroundColor: sub.color }} />
                              <span className="sub-title">{sub.name}</span>
                            </label>
                            {assigned && <span className="checked-badge">✓ បានភ្ជាប់</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lesson Edit/Add Modal */}
      <Modal
        isOpen={showLessonModal}
        onClose={() => { setShowLessonModal(false); setEditingLesson(null); }}
        title={editingLesson?.id ? 'កែប្រែព័ត៌មានមេរៀន' : 'បន្ថែមមេរៀនថ្មី'}
      >
        {editingLesson && (
          <div className="curriculum-modal-form">
            <div className="form-row-2">
              <label className="modal-field">
                <span className="modal-label">លេខរៀងមេរៀន</span>
                <input
                  type="number"
                  min={1}
                  value={editingLesson.orderNo || 1}
                  onChange={e => setEditingLesson({ ...editingLesson, orderNo: parseInt(e.target.value) || 1 })}
                  className="modal-input"
                />
              </label>

              <label className="modal-field">
                <span className="modal-label">ក្រុមមេរៀន (Module)</span>
                <input
                  type="text"
                  value={editingLesson.module || ''}
                  onChange={e => setEditingLesson({ ...editingLesson, module: e.target.value })}
                  placeholder="ឧ. Introduction, Formatting..."
                  className="modal-input"
                />
              </label>
            </div>

            <label className="modal-field">
              <span className="modal-label">ចំណងជើងមេរៀន <span className="required-star">*</span></span>
              <input
                type="text"
                value={editingLesson.title || ''}
                onChange={e => setEditingLesson({ ...editingLesson, title: e.target.value })}
                placeholder="ឧ. Create & Format Tables"
                className="modal-input"
              />
            </label>

            <label className="modal-field">
              <span className="modal-label">លំហាត់អនុវត្ត (Exercise)</span>
              <input
                type="text"
                value={editingLesson.exercise || ''}
                onChange={e => setEditingLesson({ ...editingLesson, exercise: e.target.value })}
                placeholder="ឧ. បង្កើតតារាងបញ្ជីពិន្ទុសិស្ស និងដាក់ពណ៌ Highlight..."
                className="modal-input"
              />
            </label>

            <label className="modal-field">
              <span className="modal-label">វត្ថុបំណងមេរៀន (Objectives)</span>
              <textarea
                rows={3}
                value={editingLesson.objectives || ''}
                onChange={e => setEditingLesson({ ...editingLesson, objectives: e.target.value })}
                placeholder="• យល់ដឹងអំពី...&#10;• ចេះប្រើប្រាស់...&#10;• អនុវត្តបាន..."
                className="modal-textarea"
              />
            </label>

            <label className="modal-field">
              <span className="modal-label">ចំនួនម៉ោងសិក្សាដែលគ្រោង</span>
              <input
                type="number"
                min={1}
                value={editingLesson.estimatedPeriods || 1}
                onChange={e => setEditingLesson({ ...editingLesson, estimatedPeriods: parseInt(e.target.value) || 1 })}
                className="modal-input"
              />
            </label>

            <div className="modal-action-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => { setShowLessonModal(false); setEditingLesson(null); }}
              >
                បោះបង់
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={() => void saveLesson()}
                disabled={isSaving || !editingLesson.title?.trim()}
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកមេរៀន'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subject Edit/Add Modal */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        title={editingSubject?.id ? 'កែសម្រួលមុខវិជ្ជា' : 'បន្ថែមមុខវិជ្ជាថ្មី'}
      >
        {editingSubject && (
          <div className="curriculum-modal-form">
            <label className="modal-field">
              <span className="modal-label">ឈ្មោះមុខវិជ្ជា <span className="required-star">*</span></span>
              <input
                type="text"
                value={editingSubject.name || ''}
                onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                placeholder="ឧ. Microsoft Word, Scratch, Typing..."
                className="modal-input"
              />
            </label>

            <label className="modal-field">
              <span className="modal-label">ពណ៌សម្គាល់មុខវិជ្ជា</span>
              <div className="color-presets-row">
                {['#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1', '#EAB308'].map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-preset-circle ${editingSubject.color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditingSubject({ ...editingSubject, color: c })}
                  />
                ))}
              </div>
            </label>

            <div className="modal-action-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => { setShowSubjectModal(false); setEditingSubject(null); }}
              >
                បោះបង់
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={() => void saveSubject()}
                disabled={isSaving || !editingSubject.name?.trim()}
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកមុខវិជ្ជា'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CurriculumLibrary;
