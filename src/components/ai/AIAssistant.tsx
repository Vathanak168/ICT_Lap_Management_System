import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Send, Bot, Loader2, X, Trash2, Edit, ChevronRight, MessageSquare, AlertTriangle, Check, XCircle, FileText, Minimize2, Maximize2, RefreshCw, Sparkles, UserPlus, Wrench, PlusCircle, BookOpen, CalendarDays, Clock3 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { initDB, type AiHistoryRecord, type JsonValue } from '../../store/db';
import { generateAIResponse, hasApiKey } from '../../lib/ai/core';
import { handleAction } from '../../lib/ai/actions';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { useAuth } from '../../contexts/AuthContext';

type Message = {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  pendingActions?: any[];
};

const renderInlineText = (text: string): ReactNode[] => text
  .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  .filter(Boolean)
  .map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="px-1 py-0.5 rounded bg-black/5 text-[0.9em]">{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });

const AssistantMessageContent = ({ text }: { text: string }) => (
  <div className="space-y-2 leading-relaxed">
    {text.split('\n').map((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return <div key={index} className="h-1" />;
      if (/^#{1,3}\s/.test(line)) return <h4 key={index} className="font-bold text-gray-900 mt-3">{renderInlineText(line.replace(/^#{1,3}\s/, ''))}</h4>;
      if (/^[-•]\s+/.test(line)) return <div key={index} className="flex gap-2 pl-1"><span className="text-blue-600">•</span><span>{renderInlineText(line.replace(/^[-•]\s+/, ''))}</span></div>;
      const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
      if (numbered) return <div key={index} className="flex gap-2 pl-1"><span className="font-bold text-blue-700">{numbered[1]}.</span><span>{renderInlineText(numbered[2])}</span></div>;
      return <p key={index}>{renderInlineText(line)}</p>;
    })}
  </div>
);

const dayLabel = (value: unknown) => {
  const labels = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  return labels[Number(value)] || String(value);
};

const shiftLabel = (value: unknown) => value === 'Morning' ? 'ព្រឹក' : value === 'Afternoon' ? 'រសៀល' : value === 'Evening' ? 'យប់' : String(value);

const statusLabel = (value: unknown) => value === 'completed' ? 'បានបង្រៀនរួច' : value === 'partial' ? 'មិនទាន់ចប់' : value === 'skipped' ? 'រំលង' : String(value);

const approvalMeta = (action: string) => {
  const titles: Record<string, string> = {
    ADD_SUBJECT: 'បន្ថែមមុខវិជ្ជា', UPDATE_SUBJECT: 'កែប្រែមុខវិជ្ជា',
    ADD_CURRICULUM_LESSON: 'បន្ថែមមេរៀន', UPDATE_CURRICULUM_LESSON: 'កែប្រែមេរៀន', DELETE_CURRICULUM_LESSON: 'លុបមេរៀន',
    ASSIGN_SUBJECT_TO_CLASS: 'ភ្ជាប់មុខវិជ្ជាទៅថ្នាក់', UNASSIGN_SUBJECT_FROM_CLASS: 'ដកមុខវិជ្ជាចេញពីថ្នាក់',
    RECORD_TEACHING: 'កត់ត្រាការបង្រៀន', SET_TEACHING_SCHEDULE: 'រៀបចំកាលវិភាគ', DELETE_TEACHING_SCHEDULE: 'លុបម៉ោងក្នុងកាលវិភាគ',
    ADD_CLASS: 'បង្កើតថ្នាក់ថ្មី', UPDATE_CLASS: 'កែប្រែថ្នាក់', DELETE_CLASS: 'លុបថ្នាក់',
    ADD_STUDENT: 'បន្ថែមសិស្ស', UPDATE_STUDENT: 'កែប្រែសិស្ស', DELETE_STUDENT: 'លុបសិស្ស',
    UPDATE_ATTENDANCE: 'កត់ត្រាវត្តមាន', UPDATE_GRADES: 'កែប្រែពិន្ទុ',
    ADD_PC_ISSUE: 'រាយការណ៍បញ្ហាកុំព្យូទ័រ', RESOLVE_PC_ISSUE: 'កត់ត្រាដំណោះស្រាយ',
    ADD_LESSON_PLAN: 'បន្ថែមផែនការបង្រៀន', UPDATE_LESSON_PLAN: 'កែផែនការបង្រៀន', DELETE_LESSON_PLAN: 'លុបផែនការបង្រៀន',
    ADD_LESSON_LOG: 'បន្ថែមកំណត់ត្រាបង្រៀន',
  };
  if (action.includes('DELETE') || action.includes('UNASSIGN')) return { title: titles[action] || 'លុបចេញពីប្រព័ន្ធ', icon: Trash2, tone: 'red' };
  if (action === 'RECORD_TEACHING') return { title: titles[action], icon: Clock3, tone: 'indigo' };
  if (action.includes('SCHEDULE')) return { title: titles[action] || 'កែប្រែកាលវិភាគ', icon: CalendarDays, tone: 'purple' };
  if (action.includes('LESSON') || action.includes('SUBJECT')) return { title: titles[action] || 'រៀបចំមេរៀន', icon: BookOpen, tone: 'blue' };
  if (action.includes('STUDENT')) return { title: titles[action] || 'ព័ត៌មានសិស្ស', icon: UserPlus, tone: 'blue' };
  if (action.includes('CLASS')) return { title: titles[action] || 'ព័ត៌មានថ្នាក់', icon: FileText, tone: 'green' };
  if (action.includes('ATTENDANCE')) return { title: titles[action], icon: Check, tone: 'teal' };
  if (action.includes('GRADE')) return { title: titles[action], icon: FileText, tone: 'purple' };
  if (action.includes('PC_ISSUE')) return { title: titles[action] || 'បញ្ហាកុំព្យូទ័រ', icon: Wrench, tone: 'amber' };
  return { title: titles[action] || 'ការផ្លាស់ប្តូរទិន្នន័យ', icon: FileText, tone: 'gray' };
};

const approvalFields = (action: any): Array<{ label: string; value: ReactNode }> => {
  const data = { ...action?.data, ...action?.preview };
  const labels: Record<string, string> = {
    name: action.action === 'ADD_SUBJECT' ? 'មុខវិជ្ជា' : 'ឈ្មោះ',
    className: 'ថ្នាក់', classId: 'ថ្នាក់', subjectName: 'មុខវិជ្ជា', subject: 'មុខវិជ្ជា',
    lessonTitle: 'មេរៀន', lesson: 'មេរៀន', title: 'ចំណងជើង', module: 'ក្រុមមេរៀន',
    orderNo: 'លេខលំដាប់', objectives: 'គោលបំណង', exercise: 'លំហាត់', estimatedPeriods: 'ចំនួនម៉ោង',
    color: 'ពណ៌', shift: 'វេន', dayOfWeek: 'ថ្ងៃ', startTime: 'ចាប់ផ្តើម', endTime: 'បញ្ចប់',
    status: 'ស្ថានភាព', progressPercent: 'ភាគរយ', note: 'កំណត់សម្គាល់',
    studentId: 'អត្តលេខសិស្ស', gender: 'ភេទ', date: 'កាលបរិច្ឆេទ', month: 'ខែ', week: 'សប្តាហ៍',
    pcNumber: 'កុំព្យូទ័រ', description: 'បញ្ហា', resolution: 'ដំណោះស្រាយ',
  };
  const hidden = new Set(['scheduleId', 'planId', 'id', 'reportedBy']);
  if (data.className) hidden.add('classId');
  if (data.subjectName) hidden.add('subject');
  if (data.lessonTitle) {
    hidden.add('lesson');
    hidden.add('title');
  }

  return Object.entries(data)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '' && !hidden.has(key))
    .map(([key, value]) => {
      let display: ReactNode = String(value);
      if (key === 'dayOfWeek') display = dayLabel(value);
      if (key === 'shift') display = shiftLabel(value);
      if (key === 'status') display = statusLabel(value);
      if (key === 'progressPercent') display = `${value}%`;
      if (key === 'gender') display = value === 'F' ? 'ស្រី' : value === 'M' ? 'ប្រុស' : String(value);
      return { label: labels[key] || key, value: display };
    });
};

const ApprovalListItem = ({ action, index }: { action: any; index: number }) => {
  const meta = approvalMeta(action?.action || '');
  const Icon = meta.icon;
  const fields = approvalFields(action);
  const toneClasses: Record<string, string> = {
    red: 'bg-red-50 text-red-700 border-red-100', blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100', purple: 'bg-purple-50 text-purple-700 border-purple-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100', teal: 'bg-teal-50 text-teal-700 border-teal-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100', gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };

  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-3.5 border-b border-gray-100 last:border-0">
      <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">{index + 1}</span>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${toneClasses[meta.tone]}`}><Icon size={16} /></span>
            <strong className="text-sm text-gray-900 truncate">{meta.title}</strong>
          </div>
          {meta.tone === 'red' && <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full">ត្រូវប្រុងប្រយ័ត្ន</span>}
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-5 gap-y-1.5">
          {fields.map((field, fieldIndex) => (
            <div key={`${field.label}-${fieldIndex}`} className="flex justify-between gap-3 text-xs py-1 border-b border-dashed border-gray-100 last:border-0">
              <dt className="text-gray-500 shrink-0">{field.label}</dt>
              <dd className="font-semibold text-gray-800 text-right break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  );
};

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<AiHistoryRecord[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { activeYear } = useAcademicYear();
  const { branch, user } = useAuth();
  const location = useLocation();

  const getPageContext = () => {
    const path = location.pathname;
    if (path.includes('/teaching/today')) return 'Teaching Today';
    if (path.includes('/teaching/progress')) return 'Teaching Status';
    if (path.includes('/teaching/curriculum')) return 'Curriculum';
    if (path.includes('/teaching/schedule')) return 'Teaching Schedule';
    if (path.includes('/classes')) return 'Classes';
    if (path.includes('/students')) return 'Students';
    if (path.includes('/attendance')) return 'Attendance';
    if (path.includes('/grades')) return 'Gradebook';
    if (path.includes('/lesson-plan')) return 'Lesson Plans';
    if (path.includes('/issues')) return 'PC Issues';
    return 'Dashboard';
  };
  
  const activePage = getPageContext();

  const historyRecordIdRef = useRef<string | null>(null);
  const historySaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const knownHistoryIdsRef = useRef<Set<string>>(new Set());
  const skipNextHistorySaveRef = useRef(false);
  const historyLoadRequestRef = useRef(0);

  const setActiveHistoryId = (id: string | null) => {
    historyRecordIdRef.current = id;
    setHistoryRecordId(id);
  };

  const ensureActiveHistoryId = (): string => {
    const existing = historyRecordIdRef.current;
    if (existing) return existing;
    const id = crypto.randomUUID();
    setActiveHistoryId(id);
    return id;
  };

  const makeHistoryTitle = (snapshot: Message[]): string => {
    const firstUserMessage = snapshot.find(message => message.sender === 'user');
    if (!firstUserMessage) return 'ការសន្ទនាថ្មី';
    const text = firstUserMessage.text.trim();
    if (text.length <= 30) return text || 'ការសន្ទនាថ្មី';
    return `${text.slice(0, 30)}...`;
  };

  const serializeMessages = (snapshot: Message[]): JsonValue => {
    return JSON.parse(JSON.stringify(snapshot)) as JsonValue;
  };

  const updateHistoryListLocally = (record: AiHistoryRecord) => {
    setHistoryList(previous => {
      const others = previous.filter(item => item.id !== record.id);
      return [record, ...others].sort((a, b) => {
        const aTime = Date.parse(a.updatedAt ?? '') || 0;
        const bTime = Date.parse(b.updatedAt ?? '') || 0;
        return bTime - aTime;
      });
    });
  };

  const enqueueHistorySave = (recordId: string, snapshot: Message[]) => {
    const storedMessages = serializeMessages(snapshot);
    const title = makeHistoryTitle(snapshot);
    const updatedAt = new Date().toISOString();

    historySaveQueueRef.current = historySaveQueueRef.current
      .catch(previousError => {
        console.error('Previous history save failed:', previousError);
      })
      .then(async () => {
        const db = await initDB();
        if (knownHistoryIdsRef.current.has(recordId)) {
          await db.update('aiHistory', recordId, {
            messages: storedMessages,
            title,
            updatedAt,
          });
        } else {
          await db.add('aiHistory', {
            id: recordId,
            messages: storedMessages,
            title,
            updatedAt,
          });
          knownHistoryIdsRef.current.add(recordId);
        }
        updateHistoryListLocally({ id: recordId, messages: storedMessages, title, updatedAt });
      })
      .catch(error => {
        console.error('Failed to save chat history:', error);
      });
  };

  useEffect(() => {
    if (!isOpen) return;

    const requestId = ++historyLoadRequestRef.current;

    const loadHistory = async () => {
      try {
        const db = await initDB();
        const records = await db.getAll('aiHistory');

        if (requestId !== historyLoadRequestRef.current) return;

        const sorted = [...records].sort((a, b) => {
          const aTime = Date.parse(a.updatedAt ?? '') || 0;
          const bTime = Date.parse(b.updatedAt ?? '') || 0;
          return bTime - aTime;
        });

        knownHistoryIdsRef.current = new Set(sorted.map(record => record.id));
        setHistoryList(sorted);
      } catch (error) {
        if (requestId === historyLoadRequestRef.current) {
          console.error('Failed to load AI history:', error);
        }
      } finally {
        if (requestId === historyLoadRequestRef.current) {
          setIsDbLoaded(true);
        }
      }
    };

    void loadHistory();

    return () => {
      if (requestId === historyLoadRequestRef.current) {
        historyLoadRequestRef.current++;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isDbLoaded) return;
    if (messages.length === 0) return;

    if (skipNextHistorySaveRef.current) {
      skipNextHistorySaveRef.current = false;
      return;
    }

    const recordId = historyRecordIdRef.current;

    if (!recordId) {
      console.warn('Skipping history save because there is no active history ID.');
      return;
    }

    enqueueHistorySave(recordId, messages);
  }, [messages, isDbLoaded]);

  const handleSelectHistory = (id: string) => {
    const record = historyList.find(item => item.id === id);
    if (!record) return;
    if (!Array.isArray(record.messages)) {
      console.error('Invalid AI history messages:', record);
      return;
    }

    let loadedMessages = record.messages as unknown as Message[];
    if (loadedMessages[0]?.id === '1' && loadedMessages[0]?.sender === 'ai') {
      loadedMessages = loadedMessages.slice(1);
    }

    setActiveHistoryId(id);
    skipNextHistorySaveRef.current = true;
    setMessages(loadedMessages);
  };

  const handleNewChat = () => {
    setActiveHistoryId(null);
    setMessages([]);
    setInput('');
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const db = await initDB();
      await db.delete('aiHistory', id);
      setHistoryList(prev => prev.filter(item => item.id !== id));
      
      if (historyRecordId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to delete history:', error);
      alert('បរាជ័យក្នុងការលុបប្រវត្តិសន្ទនា');
    }
  };

  const handleQuickAction = (text: string, sendImmediately: boolean = false) => {
    setInput(text);
    if (sendImmediately) {
      handleSend(text);
    }
  };

  const handleSend = async (overrideInput?: string | React.MouseEvent) => {
    const textToSend = typeof overrideInput === 'string' ? overrideInput : input;
    if (!textToSend.trim()) return;

    if (!hasApiKey()) {
      alert('សូមបញ្ចូល Gemini API Key នៅក្នុងទំព័រ "ការកំណត់" ជាមុនសិន!');
      return;
    }

    ensureActiveHistoryId();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: textToSend.trim(),
    };

    setMessages(previous => [...previous, userMessage]);
    if (typeof overrideInput !== 'string') setInput('');
    setLoading(true);

    try {
      const history: { role: 'user' | 'model'; text: string }[] = messages.map(
        message => ({
          role: message.sender === 'user' ? 'user' : 'model',
          text: message.text,
        }),
      );

      const context = {
        branch: branch || localStorage.getItem('userBranch') || 'BELTEI IS 1',
        academicYear: activeYear || '',
        userId: user?.id,
        userName: user?.user_metadata?.name || user?.email || undefined,
        activePage: activePage
      };

      const response = await generateAIResponse(history, textToSend, context);

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: response.text || '',
        pendingActions: response.pendingActions,
      };

      setMessages(previous => [...previous, aiMessage]);
    } catch (error: unknown) {
      console.error('[AI Assistant] Request failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      
      let friendlyMessage = `❌ មានបញ្ហាបច្ចេកទេសបន្តិចបន្តួច៖
${message}`;
      if (message.includes('429') || message.toLowerCase().includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
        friendlyMessage = `⚠️ **ធនធានរបស់ AI ឈានដល់កម្រិតកំណត់**
សូមរង់ចាំបន្តិចសិន ចាំសួរម្តងទៀត ព្រោះយើងកំពុងប្រើប្រាស់កញ្ចប់ឥតគិតថ្លៃ ដែលមានការកំណត់ចំនួនសួរក្នុងមួយនាទី។ បើអ្នកចង់ប្រើប្រាស់ដោយគ្មានដែនកំណត់ សូមបញ្ចូល API Key ផ្ទាល់ខ្លួន!`;
      } else if (message.includes('API Key not found')) {
        friendlyMessage = `🔑 **មិនទាន់មាន API Key**
សូមចូលទៅកំណត់វានៅទំព័រ ការកំណត់ ដោយបញ្ចូល Gemini API Key ជាមុនសិន!`;
      }
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: friendlyMessage,
      };

      setMessages(previous => [...previous, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

const handleApproveAllActions = async (msgId: string, actions: any[]) => {
    if (processingActionId === msgId) return;
    setProcessingActionId(msgId);
    
    let successCount = 0;
    let failCount = 0;
    let errors: string[] = [];

    for (const action of actions) {
      try {
        await handleAction(action.action, action.data, activeYear || '2026-2027', { userId: user?.id });
        successCount++;
      } catch (e: any) {
        console.error(e);
        failCount++;
        errors.push(e.message || String(e));
      }
    }

    const statusMessage = `

${successCount === actions.length ? '✅' : '⚠️'} បានយល់ព្រម និងអនុវត្តទិន្នន័យចំនួន ${successCount}/${actions.length} ដោយជោគជ័យ។${failCount > 0 ? ` បរាជ័យ ${failCount} ដោយសារ៖ ${errors.join(', ')}` : ''}`;

    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const { pendingActions: _pendingActions, ...rest } = m;
        return { ...rest, text: m.text + statusMessage };
      }
      return m;
    }));

    window.dispatchEvent(new CustomEvent('appDataChanged'));
    setProcessingActionId(null);
  };

  const handleRejectAllActions = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const { pendingActions: _pendingActions, ...rest } = m;
        return { ...rest, text: m.text + '\n\n❌ អ្នកបានបដិសេធមិនអនុវត្តប្រតិបត្តិការនេះទេ។' };
      }
      return m;
    }));
  };

  const renderActionData = (action: any) => {
    if (!action || !action.data) return null;
    
    const d = action.data;
    
    switch (action.action) {
      case 'ADD_CLASS':
        return (
          <div className="bg-white border border-green-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-green-50 px-3 py-2 border-b border-green-100 text-green-700 font-bold flex items-center gap-2 text-sm">
              <FileText size={16} /> ស្នើសុំបង្កើតថ្នាក់រៀនថ្មី
            </div>
            <div className="p-3 grid grid-cols-[80px_1fr] gap-y-2 text-sm">
              <div className="text-gray-500 text-xs flex items-center">ឈ្មោះថ្នាក់៖</div>
              <div className="font-bold text-green-700 text-base">{d.name}</div>
              <div className="text-gray-500 text-xs flex items-center">វេនសិក្សា៖</div>
              <div className="font-medium text-gray-800">{d.shift}</div>
              {d.notes && (
                <>
                  <div className="text-gray-500 text-xs flex items-center">ចំណាំ៖</div>
                  <div className="font-medium text-gray-800">{d.notes}</div>
                </>
              )}
            </div>
          </div>
        );

      case 'UPDATE_CLASS':
        return (
          <div className="bg-white border border-orange-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 text-orange-700 font-bold flex items-center gap-2 text-sm">
              <Edit size={16} /> ស្នើសុំកែប្រែថ្នាក់រៀន
            </div>
            <div className="p-3 grid grid-cols-[80px_1fr] gap-y-2 text-sm">
              <div className="text-gray-500 text-xs flex items-center">ថ្នាក់ចាស់៖</div>
              <div className="font-medium text-gray-800">{d.classId}</div>
              {d.name && (
                <>
                  <div className="text-gray-500 text-xs flex items-center">ឈ្មោះថ្មី៖</div>
                  <div className="font-bold text-orange-600 text-base">{d.name}</div>
                </>
              )}
              {d.shift && (
                <>
                  <div className="text-gray-500 text-xs flex items-center">វេនថ្មី៖</div>
                  <div className="font-medium text-gray-800">{d.shift}</div>
                </>
              )}
            </div>
          </div>
        );

      case 'ADD_STUDENT':
        return (
          <div className="bg-white border border-blue-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-[#2a5298]/10 px-3 py-2 border-b border-blue-100 text-[#2a5298] font-bold flex items-center gap-2 text-sm">
              <UserPlus size={16} /> ស្នើសុំបន្ថែមសិស្សថ្មី
            </div>
            <div className="p-3 grid grid-cols-[80px_1fr] gap-y-2 text-sm">
              <div className="text-gray-500 text-xs flex items-center">អត្តលេខ៖</div>
              <div className="font-medium text-gray-800">{d.studentId || 'បង្កើតដោយស្វ័យប្រវត្តិ'}</div>
              <div className="text-gray-500 text-xs flex items-center">ឈ្មោះ៖</div>
              <div className="font-bold text-[#2a5298] text-base">{d.name}</div>
              <div className="text-gray-500 text-xs flex items-center">ភេទ៖</div>
              <div className="font-medium text-gray-800">{d.gender === 'F' ? 'ស្រី' : d.gender === 'M' ? 'ប្រុស' : d.gender}</div>
              <div className="text-gray-500 text-xs flex items-center">កូដថ្នាក់៖</div>
              <div className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded w-fit break-all">{d.classId}</div>
              {d.shift && (
                <>
                  <div className="text-gray-500 text-xs flex items-center">វេន៖</div>
                  <div className="font-medium text-gray-800">{d.shift}</div>
                </>
              )}
            </div>
          </div>
        );
        
      case 'UPDATE_STUDENT':
        return (
          <div className="bg-white border border-orange-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 text-orange-700 font-bold flex items-center gap-2 text-sm">
              <Edit size={16} /> ស្នើសុំកែប្រែព័ត៌មានសិស្ស
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="font-bold border-b pb-1 mb-1 border-gray-100">ID: {d.studentId}</div>
              {d.name && <div className="flex justify-between"><span className="text-gray-500">ឈ្មោះថ្មី៖</span> <span className="font-medium text-orange-700">{d.name}</span></div>}
              {d.gender && <div className="flex justify-between"><span className="text-gray-500">ភេទថ្មី៖</span> <span className="font-medium">{d.gender}</span></div>}
              {d.classId && <div className="flex justify-between"><span className="text-gray-500">ថ្នាក់ថ្មី៖</span> <span className="font-medium">{d.classId}</span></div>}
              {d.shift && <div className="flex justify-between"><span className="text-gray-500">វេនថ្មី៖</span> <span className="font-medium">{d.shift}</span></div>}
              {d.status && <div className="flex justify-between"><span className="text-gray-500">ស្ថានភាព៖</span> <span className="font-medium">{d.status}</span></div>}
              {d.isShiftSwitching !== undefined && <div className="flex justify-between"><span className="text-gray-500">សិស្សប្តូរវេន៖</span> <span className="font-medium text-orange-600">{d.isShiftSwitching ? 'បាទ/ចាស' : 'ទេ'}</span></div>}
              {d.alternateClassId && <div className="flex justify-between"><span className="text-gray-500">ថ្នាក់បម្រុង៖</span> <span className="font-medium">{d.alternateClassId}</span></div>}
            </div>
          </div>
        );
        
      case 'DELETE_STUDENT':
        return (
          <div className="bg-white border border-red-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100 text-red-700 font-bold flex items-center gap-2 text-sm">
              <Trash2 size={16} /> ស្នើសុំលុបសិស្ស
            </div>
            <div className="p-3 text-center text-sm text-gray-700">
              តើអ្នកពិតជាចង់លុបសិស្សលេខ <span className="font-bold text-red-600">{d.studentId}</span> មែនទេ?
            </div>
          </div>
        );
        
      case 'ADD_PC_ISSUE':
        return (
          <div className="bg-white border border-yellow-300 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-yellow-50 px-3 py-2 border-b border-yellow-200 text-yellow-800 font-bold flex items-center gap-2 text-sm">
              <AlertTriangle size={16} /> រាយការណ៍កុំព្យូទ័រខូច
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">កុំព្យូទ័រ៖</span> <span className="font-bold text-yellow-700">{d.pcNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">បញ្ហា៖</span> <span className="font-medium">{d.description}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">រាយការណ៍ដោយ៖</span> <span className="font-medium">{d.reportedBy}</span></div>
            </div>
          </div>
        );
        
      case 'RESOLVE_PC_ISSUE':
        return (
          <div className="bg-white border border-green-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-green-50 px-3 py-2 border-b border-green-100 text-green-700 font-bold flex items-center gap-2 text-sm">
              <Wrench size={16} /> ដោះស្រាយបញ្ហាកុំព្យូទ័រ
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">លេខកូដបញ្ហា៖</span> <span className="font-mono text-xs text-gray-500 truncate max-w-[150px]">{d.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ដំណោះស្រាយ៖</span> <span className="font-medium text-green-700">{d.resolution}</span></div>
            </div>
          </div>
        );

      case 'DELETE_CLASS':
        return (
          <div className="bg-white border border-red-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100 text-red-700 font-bold flex items-center gap-2 text-sm">
              <Trash2 size={16} /> ស្នើសុំលុបថ្នាក់រៀន
            </div>
            <div className="p-3 text-center text-sm text-gray-700">
              លុបថ្នាក់ <span className="font-bold text-red-600">{d.classId}</span> មែនទេ?
            </div>
          </div>
        );
        
      case 'ADD_LESSON_PLAN':
        return (
          <div className="bg-white border border-blue-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-blue-50 px-3 py-2 border-b border-blue-100 text-blue-700 font-bold flex items-center gap-2 text-sm">
              <PlusCircle size={16} /> បន្ថែមផែនការបង្រៀនថ្មី
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ថ្នាក់៖</span> <span className="font-bold text-blue-700">{d.classId}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ខែ/សប្តាហ៍៖</span> <span className="font-medium">{d.month} - {d.week}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">មេរៀន៖</span> <span className="font-medium text-blue-700">{d.lessonTitle}</span></div>
            </div>
          </div>
        );
        
      case 'UPDATE_LESSON_PLAN':
        return (
          <div className="bg-white border border-orange-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 text-orange-700 font-bold flex items-center gap-2 text-sm">
              <Edit size={16} /> កែប្រែផែនការបង្រៀន
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ID៖</span> <span className="font-mono text-xs truncate max-w-[150px]">{d.planId}</span></div>
              {d.lessonTitle && <div className="flex justify-between"><span className="text-gray-500">មេរៀនថ្មី៖</span> <span className="font-medium">{d.lessonTitle}</span></div>}
              {d.status && <div className="flex justify-between"><span className="text-gray-500">ស្ថានភាព៖</span> <span className="font-medium">{d.status}</span></div>}
            </div>
          </div>
        );
        
      case 'DELETE_LESSON_PLAN':
        return (
          <div className="bg-white border border-red-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100 text-red-700 font-bold flex items-center gap-2 text-sm">
              <Trash2 size={16} /> លុបផែនការបង្រៀន
            </div>
            <div className="p-3 text-center text-sm text-gray-700">
              តើអ្នកពិតជាចង់លុបផែនការបង្រៀនលេខ <span className="font-mono text-xs text-red-600 truncate max-w-[150px] inline-block align-bottom">{d.planId}</span> មែនទេ?
            </div>
          </div>
        );

      case 'UPDATE_GRADES':
        return (
          <div className="bg-white border border-purple-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-purple-50 px-3 py-2 border-b border-purple-100 text-purple-700 font-bold flex items-center gap-2 text-sm">
              <FileText size={16} /> កែប្រែពិន្ទុសិស្ស
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">សិស្ស៖</span> <span className="font-bold text-purple-700">{d.studentId}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ថ្នាក់៖</span> <span className="font-medium">{d.classId}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ខែ៖</span> <span className="font-medium">{d.month}</span></div>
              {d.practice !== undefined && <div className="flex justify-between"><span className="text-gray-500">ពិន្ទុអនុវត្ត៖</span> <span className="font-medium">{d.practice}</span></div>}
              {d.book !== undefined && <div className="flex justify-between"><span className="text-gray-500">ពិន្ទុសៀវភៅ៖</span> <span className="font-medium">{d.book}</span></div>}
              {d.exam !== undefined && <div className="flex justify-between"><span className="text-gray-500">ពិន្ទុប្រឡង៖</span> <span className="font-medium">{d.exam}</span></div>}
            </div>
          </div>
        );

      case 'UPDATE_ATTENDANCE':
        return (
          <div className="bg-white border border-teal-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-teal-50 px-3 py-2 border-b border-teal-100 text-teal-700 font-bold flex items-center gap-2 text-sm">
              <Check size={16} /> កត់ត្រាអវត្តមាន
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">សិស្ស៖</span> <span className="font-bold text-teal-700">{d.studentId}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ថ្ងៃទី៖</span> <span className="font-medium">{d.date}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ស្ថានភាព៖</span> <span className="font-medium">{d.status === 'P' ? 'វត្តមាន' : d.status === 'A' ? 'អវត្តមាន' : d.status === 'L' ? 'ច្បាប់' : 'យឺត'}</span></div>
            </div>
          </div>
        );

      case 'ADD_LESSON_LOG':
        return (
          <div className="bg-white border border-indigo-200 rounded-md overflow-hidden mb-3 shadow-sm">
            <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-100 text-indigo-700 font-bold flex items-center gap-2 text-sm">
              <FileText size={16} /> បន្ថែមកំណត់ត្រាបង្រៀន
            </div>
            <div className="p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ថ្នាក់៖</span> <span className="font-bold text-indigo-700">{d.classId}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ថ្ងៃទី៖</span> <span className="font-medium">{d.date}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">មេរៀន៖</span> <span className="font-medium">{d.topic}</span></div>
              {d.exercises && <div className="flex justify-between"><span className="text-gray-500">លំហាត់៖</span> <span className="font-medium">{d.exercises}</span></div>}
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-3 shadow-sm text-sm">
            <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 text-gray-700 font-bold flex items-center gap-2 text-sm">
              <FileText size={16} /> ទិន្នន័យ
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              {Object.entries(d || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start border-b border-dashed border-gray-200 last:border-0 pb-1.5 last:pb-0">
                  <span className="text-gray-500 text-xs capitalize">{key}:</span>
                  <span className="font-medium text-right text-gray-800 max-w-[70%] break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-sm animate-in fade-in duration-200 md:p-5">
          <div className={`flex w-full overflow-hidden border border-black/5 bg-white shadow-2xl animate-in zoom-in-95 duration-200 transition-all ${isFullscreen ? 'h-full max-w-none rounded-none' : 'h-[92vh] max-h-[920px] max-w-[1280px] rounded-[22px]'}`}>
            
            {/* Left Sidebar */}
            <div className="hidden w-[270px] shrink-0 flex-col border-r border-slate-200 bg-[#f7f7f8] md:flex">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a5298] text-white shadow-sm"><Sparkles size={18} /></span>
                <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">ជំនួយការគ្រូ AI</p><p className="mt-0.5 text-[10px] text-slate-500">ICT Lab Assistant</p></div>
              </div>
              
              {/* New Chat Button */}
              <button 
                onClick={handleNewChat}
                className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50"
              >
                <MessageSquare size={16} /> ការសន្ទនាថ្មី
              </button>
              

              {/* History */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <h3 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">ការសន្ទនាថ្មីៗ</h3>
                <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto pr-1 md:max-h-none custom-scrollbar">
                  {historyList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-[11px] leading-5 text-slate-400">ការសន្ទនាដែលបានរក្សាទុកនឹងបង្ហាញនៅទីនេះ</div>
                  ) : (
                    historyList.map(rec => (
                      <div key={rec.id} className={`group flex w-full items-center justify-between rounded-lg transition-colors ${historyRecordId === rec.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>
                        <button 
                          onClick={() => handleSelectHistory(rec.id)}
                          className="flex flex-1 items-center gap-2 truncate p-2.5 text-left text-xs font-medium"
                        >
                          <MessageSquare size={14} className={`shrink-0 ${historyRecordId === rec.id ? "text-[#2a5298]" : "text-slate-400"}`} />
                          <span className="truncate">{rec.title || 'ការសន្ទនាថ្មី'}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteHistory(rec.id); }}
                          className="p-2 text-slate-400 opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                          title="លុប"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="border-t border-slate-200 p-3">
                <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#2a5298] shadow-sm"><Bot size={16} /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f7f7f8] bg-emerald-500" /></span>
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700">AI រួចរាល់ប្រើប្រាស់</p><p className="truncate text-[10px] text-slate-400">{branch || 'ICT Lab System'}</p></div>
                </div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="relative flex min-w-0 flex-1 flex-col bg-white">
              {/* Top Window Controls */}
              <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-3 md:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2a5298] text-white md:hidden"><Sparkles size={16} /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">ជំនួយការ AI</p><p className="hidden text-[10px] text-emerald-600 sm:block">● កំពុងប្រើទិន្នន័យ System</p></div>
                </div>
                
                {/* Context Chips */}
                <div className="ml-4 hidden flex-1 items-center gap-2 md:flex">
                  <div className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                    {activePage}
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    ឆ្នាំ {activeYear}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <button onClick={handleNewChat} className="rounded-lg p-2 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden" title="ការសន្ទនាថ្មី"><MessageSquare size={17} /></button>
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="hidden rounded-lg p-2 transition-colors hover:bg-slate-100 hover:text-slate-700 md:block">
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button onClick={() => setIsOpen(false)} className="rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-500">
                    <X size={18} />
                  </button>
                </div>
              </div>
              
              {/* Scrollable Chat Area */}
              <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 md:px-8 md:py-8">
                
                {messages.length === 0 ? (
                  /* Welcome Screen (Empty State) */
                  <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-8">
                    <div className="mb-8 text-center">
                      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2a5298] text-white shadow-lg shadow-blue-900/15">
                        <Sparkles size={25} />
                      </div>
                      <h2 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">តើខ្ញុំអាចជួយអ្វីបាន?</h2>
                      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">សួរអំពីថ្នាក់ សិស្ស កាលវិភាគ កម្មវិធីមេរៀន ឬស្នើឲ្យខ្ញុំរៀបចំការងារនៅក្នុង System។</p>
                    </div>
                    

                    {/* Suggested Prompts */}
                    <div className="w-full">
                      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                        សំណួរណែនាំ <button className="hover:text-blue-500 transition-colors p-1"><RefreshCw size={14} /></button>
                      </h3>
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        {activePage === 'Teaching Today' ? (
                          <>
                            <button onClick={() => handleQuickAction('តើថ្ងៃនេះខ្ញុំត្រូវបង្រៀនថ្នាក់ណាខ្លះ ហើយមេរៀនបន្ទាប់ជាអ្វី?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>បង្ហាញថ្នាក់ និងមេរៀនដែលត្រូវបង្រៀនថ្ងៃនេះ</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('ជួយកត់ត្រាថាខ្ញុំបានបង្រៀនមេរៀនបន្ទាប់រួច។ សួរខ្ញុំតែថ្នាក់ និងមុខវិជ្ជាដែលខ្វះ។', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>កត់ត្រាការបង្រៀនថ្ងៃនេះ</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : activePage === 'Teaching Status' ? (
                          <>
                            <button onClick={() => handleQuickAction('សង្ខេបស្ថានភាពបង្រៀនតាមថ្នាក់ ហើយប្រាប់មេរៀនបន្ទាប់នៃថ្នាក់នីមួយៗ', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>សង្ខេបស្ថានភាព និងមេរៀនបន្ទាប់</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('បង្ហាញប្រវត្តិបង្រៀនចុងក្រោយរបស់ខ្ញុំ', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>មើលប្រវត្តិបង្រៀនថ្មីៗ</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : activePage === 'Curriculum' ? (
                          <>
                            <button onClick={() => handleQuickAction('បង្ហាញមុខវិជ្ជា មេរៀន និងថ្នាក់ដែលបានភ្ជាប់បច្ចុប្បន្ន', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>ពិនិត្យកម្មវិធីមេរៀនបច្ចុប្បន្ន</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('ជួយបង្កើតមេរៀនថ្មី ហើយភ្ជាប់ទៅថ្នាក់។ សួរខ្ញុំតែព័ត៌មានដែលខ្វះ។', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>បង្កើតមេរៀន និងភ្ជាប់ទៅថ្នាក់</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : activePage === 'Teaching Schedule' ? (
                          <>
                            <button onClick={() => handleQuickAction('បង្ហាញកាលវិភាគបង្រៀនរបស់ខ្ញុំតាមថ្ងៃ និងវេន', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>មើលកាលវិភាគតាមថ្ងៃ និងវេន</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('ជួយរៀបចំម៉ោងបង្រៀនថ្មី។ សួរខ្ញុំអំពីថ្ងៃ ម៉ោង ថ្នាក់ និងមុខវិជ្ជាដែលខ្វះ។', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>រៀបចំម៉ោងបង្រៀនថ្មី</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : activePage === 'Students' ? (
                          <>
                            <button onClick={() => handleQuickAction('តើសិស្សក្នុងថ្នាក់ 6A1 មានចំនួនប៉ុន្មាននាក់?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>តើសិស្សក្នុងថ្នាក់ 6A1 មានចំនួនប៉ុន្មាននាក់?</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('រកសិស្សដែលប្តូរវេនបណ្តោះអាសន្ន', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>រកសិស្សដែលប្តូរវេនបណ្តោះអាសន្ន</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : activePage === 'Gradebook' ? (
                          <>
                            <button onClick={() => handleQuickAction('សង្ខេបពិន្ទុថ្នាក់ 6A1 ខែនេះ', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>សង្ខេបពិន្ទុថ្នាក់ 6A1 ខែនេះ</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('រកសិស្សមានពិន្ទុទាបជាង 50', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>រកសិស្សមានពិន្ទុទាបជាង 50</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : activePage === 'PC Issues' ? (
                          <>
                            <button onClick={() => handleQuickAction('រាយការណ៍បញ្ហាកុំព្យូទ័រលេខ PC-10 ដែលខូច Mouse', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>រាយការណ៍កុំព្យូទ័រខូច (ឧទាហរណ៍ PC-10 ខូច Mouse)</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('តើមានកុំព្យូទ័រប៉ុន្មានគ្រឿងកំពុងខូច?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>តើមានកុំព្យូទ័រប៉ុន្មានគ្រឿងកំពុងខូច?</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleQuickAction('តើយើងមានថ្នាក់រៀនសរុបចំនួនប៉ុន្មាន?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>តើយើងមានថ្នាក់រៀនសរុបចំនួនប៉ុន្មាន?</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('ជួយរាយការណ៍បញ្ហាកុំព្យូទ័រលេខ PC-10 ដែលខូច Mouse', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>ជួយរាយការណ៍បញ្ហាកុំព្យូទ័រលេខ PC-10 ដែលខូច Mouse</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                            <button onClick={() => handleQuickAction('តើសិស្សក្នុងថ្នាក់ 6A1 មានចំនួនប៉ុន្មាននាក់?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                              <Sparkles size={16} className="text-blue-500 shrink-0" /><span>តើសិស្សក្នុងថ្នាក់ 6A1 មានចំនួនប៉ុន្មាននាក់?</span><ChevronRight size={16} className="text-gray-400 ml-auto" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Chat Bubbles */
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 pb-6">
                    {messages.map((msg) => {
                      const isUser = msg.sender === 'user';
                      
                      return (
                        <div key={msg.id} className={`flex w-full gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          {!isUser && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2a5298] text-white shadow-sm"><Sparkles size={15} /></div>}
                          <div className={`flex min-w-0 flex-col gap-1 ${isUser ? 'max-w-[82%] items-end' : 'max-w-[calc(100%-3rem)] flex-1 items-start'}`}>
                            <div className="mb-0.5 px-1 text-[10px] font-semibold text-slate-400">
                              {isUser ? 'អ្នក' : 'ជំនួយការ AI'}
                          </div>
                            <div className={`text-sm leading-7 ${isUser ? 'rounded-3xl bg-[#f1f1f1] px-4 py-2.5 text-slate-800' : 'w-full px-1 py-1 text-slate-800'}`}>
                              {isUser ? <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p> : <AssistantMessageContent text={msg.text} />}
                              
                              {/* Approval Request Cards (Multiple) */}
                              {msg.pendingActions && msg.pendingActions.length > 0 && (
                                <div className="mt-4 bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden text-gray-800">
                                  <div className="px-4 py-3 bg-[#f8fafc] border-b border-gray-200 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><AlertTriangle size={16} /></span>
                                      <div className="min-w-0"><p className="font-bold text-sm text-gray-900">សូមពិនិត្យមុនអនុម័ត</p><p className="text-[11px] text-gray-500">AI មិនទាន់អនុវត្តការផ្លាស់ប្តូរទាំងនេះទេ</p></div>
                                    </div>
                                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">{msg.pendingActions.length} ការងារ</span>
                                  </div>

                                  <ol className="max-h-[360px] overflow-y-auto">
                                    {msg.pendingActions.map((action, idx) => approvalFields(action).length > 0
                                      ? <ApprovalListItem key={idx} action={action} index={idx} />
                                      : <li key={idx} className="p-3">{renderActionData(action)}</li>)}
                                  </ol>

                                  <div className="p-3 bg-[#f8fafc] border-t border-gray-200">
                                    <p className="text-[11px] text-gray-500 mb-2.5">ចុច «អនុម័ត និងអនុវត្ត» ដើម្បីឲ្យ System រក្សាទុកការងារខាងលើទាំងអស់។</p>
                                    <div className="flex flex-col sm:flex-row gap-2.5">
                                          <button 
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 text-sm shadow-sm"
                                            onClick={() => handleApproveAllActions(msg.id, msg.pendingActions!)}
                                            disabled={processingActionId === msg.id}
                                          >
                                            {processingActionId === msg.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                                            អនុម័ត និងអនុវត្ត
                                          </button>
                                          <button 
                                            className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 py-2 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 text-sm"
                                            onClick={() => handleRejectAllActions(msg.id)}
                                            disabled={!!processingActionId}
                                          >
                                            <XCircle size={16} /> បោះបង់
                                          </button>
                                        </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {loading && (
                      <div className="flex w-full gap-3.5 self-start">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2a5298] text-white shadow-sm"><Sparkles size={15} /></div>
                        <div className="flex flex-col items-start gap-1">
                          <div className="mb-0.5 px-1 text-[10px] font-semibold text-slate-400">ជំនួយការ AI</div>
                          <div className="flex items-center gap-3 px-1 py-2">
                            <div className="flex gap-1.5">
                              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0ms' }} />
                              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '150ms' }} />
                              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs font-medium text-slate-500">កំពុងរៀបចំចម្លើយ...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                )}
              </div>
              
              {/* Input Area */}
              <div className="z-10 shrink-0 bg-white px-4 pb-4 pt-2 md:px-8 md:pb-5">
                <div className="mx-auto w-full max-w-3xl">
                  <div className="relative flex flex-col rounded-[26px] border border-slate-200 bg-[#f4f4f4] p-2 shadow-sm transition-all focus-within:border-slate-300 focus-within:shadow-md">
                    <textarea 
                      className="max-h-[180px] min-h-[52px] w-full resize-none border-none bg-transparent px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="ផ្ញើសារទៅជំនួយការ AI..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={loading}
                      rows={1}
                    />
                    <div className="flex items-center justify-between px-1 pb-1 pt-1">
                      <span className="px-2 text-[10px] text-slate-400">Enter ដើម្បីផ្ញើ · Shift+Enter ដើម្បីចុះបន្ទាត់</span>
                      <button 
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a5298] text-white shadow-sm transition-colors hover:bg-[#1f427d] disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-60"
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                      >
                        <Send size={16} className="ml-0.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[10px] text-slate-400">AI អាចមានកំហុស។ សូមពិនិត្យបញ្ជីមុនចុចអនុម័តការផ្លាស់ប្តូរ។</p>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Topbar Button */}
      <button 
        className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/95 hover:bg-white text-indigo-900 px-3.5 py-1.5 text-xs font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <Sparkles size={15} className="text-indigo-600" />
        <span>ជំនួយការ AI</span>
      </button>
    </>
  );
};

export default AIAssistant;
