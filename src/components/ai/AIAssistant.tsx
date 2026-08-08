import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Paperclip, LayoutGrid, Mic, Loader2, X, Trash2, Edit, ChevronRight, MessageSquare, AlertTriangle, Check, XCircle, FileText, User, Pin, Minimize2, Maximize2, RefreshCw, Sparkles, Settings, UserPlus, Wrench, PlusCircle } from 'lucide-react';
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
  const { branch } = useAuth();

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
      alert('សូមបញ្ចូល Gemini API Key នៅក្នុងទំព័រ "ការកំណត់ (Settings)" ជាមុនសិន!');
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
        friendlyMessage = `⚠️ **ធនធានរបស់ AI ឈានដល់កម្រិតកំណត់ (Limit Reached)**
សូមរង់ចាំបន្តិចសិន ចាំសួរម្តងទៀត ព្រោះយើងកំពុងប្រើប្រាស់កញ្ចប់ឥតគិតថ្លៃ (Free Tier) ដែលមានការកំណត់ចំនួនសួរក្នុងមួយនាទី។ បើអ្នកចង់ប្រើប្រាស់ដោយគ្មានដែនកំណត់ សូមបញ្ចូល API Key ផ្ទាល់ខ្លួន!`;
      } else if (message.includes('API Key not found')) {
        friendlyMessage = `🔑 **មិនទាន់មាន API Key**
សូមចូលទៅកំណត់វានៅទំព័រ ការកំណត់ (Settings) ដោយបញ្ចូល Gemini API Key ជាមុនសិន!`;
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
        await handleAction(action.action, action.data, activeYear || '2026-2027');
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
        const { pendingActions, ...rest } = m;
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
        const { pendingActions, ...rest } = m;
        return { ...rest, text: m.text + '\\n\\n❌ អ្នកបានបដិសេធមិនអនុវត្តប្រតិបត្តិការនេះទេ។' };
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

      default:
        return (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-3 shadow-sm text-sm">
            <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 text-gray-700 font-bold flex items-center gap-2 text-sm">
              <FileText size={16} /> ទិន្នន័យ (Data)
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
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 lg:p-8 animate-in fade-in duration-200">
          <div className={`w-full bg-white rounded-2xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-300 transition-all ${isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-6xl h-[90vh] max-h-[900px]'}`}>
            
            {/* Left Sidebar */}
            <div className="hidden md:flex w-64 bg-[#f8f9fa] border-r border-gray-200 flex-col">
              {/* Header */}
              <div className="p-4 flex items-center gap-3 text-[#1a73e8] font-bold text-lg border-b border-gray-100">
                <Bot size={24} /> ជំនួយការគ្រូ AI
              </div>
              
              {/* New Chat Button */}
              <button 
                onClick={handleNewChat}
                className="mx-4 mt-5 mb-3 bg-white hover:bg-gray-50 border border-gray-200 text-[#1a73e8] font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-sm transition-all hover:shadow-md"
              >
                <MessageSquare size={18} /> សំណួរថ្មី
              </button>
              

              {/* History */}
              <div className="px-4 py-3 flex-1 overflow-y-auto">
                <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">ប្រវត្តិខាងក្រោយ</h3>
                <div className="flex flex-col gap-1 max-h-[200px] md:max-h-none overflow-y-auto pr-1 custom-scrollbar">
                  {historyList.length === 0 ? (
                    <div className="text-xs text-gray-400 p-2 text-center">មិនទាន់មានប្រវត្តិទេ</div>
                  ) : (
                    historyList.map(rec => (
                      <div key={rec.id} className={`group w-full flex items-center justify-between rounded-lg transition-colors ${historyRecordId === rec.id ? 'bg-blue-50 text-[#1a73e8]' : 'text-gray-700 hover:bg-gray-100'}`}>
                        <button 
                          onClick={() => handleSelectHistory(rec.id)}
                          className="flex-1 text-left p-2.5 text-sm font-medium flex items-center gap-2 truncate"
                        >
                          <MessageSquare size={14} className={`shrink-0 ${historyRecordId === rec.id ? "text-[#1a73e8]" : "text-gray-400"}`} /> 
                          <span className="truncate">{rec.title || 'ការសន្ទនាថ្មី'}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteHistory(rec.id); }}
                          className={`p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity focus:opacity-100 ${historyRecordId === rec.id ? "text-[#1a73e8]" : "text-gray-400"}`}
                          title="លុប"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="flex-1" />
              
              {/* Settings */}
              <button className="p-4 border-t border-gray-200 text-sm font-bold text-gray-600 flex items-center gap-3 hover:bg-gray-100 w-full text-left transition-colors">
                <Settings size={18} /> ការកំណត់
              </button>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white relative">
              {/* Top Window Controls */}
              <div className="h-14 flex items-center justify-between md:justify-end px-4 border-b border-gray-100 bg-white z-10 shrink-0">
                <div className="md:hidden flex items-center gap-2 text-[#1a73e8] font-bold">
                  <Bot size={20} /> AI
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors" title="Pin window">
                    <Pin size={16} />
                  </button>
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="hidden md:block p-1.5 hover:bg-gray-100 rounded-md transition-colors">
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors ml-1">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              {/* Scrollable Chat Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
                
                {messages.length === 0 ? (
                  /* Welcome Screen (Empty State) */
                  <div className="flex-1 flex flex-col justify-center items-center max-w-3xl mx-auto w-full py-10">
                    <div className="bg-[#f0f4f9] rounded-3xl p-6 md:p-10 text-center w-full mb-10 shadow-sm border border-gray-100">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md mx-auto mb-6 text-[#1a73e8]">
                        <Bot size={40} />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 leading-tight">សួស្តី! ខ្ញុំជាជំនួយការគ្រូកុំព្យូទ័រ</h2>
                      <p className="text-gray-600 text-lg">តើខ្ញុំអាចជួយអ្វីបានសម្រាប់អ្នកនៅថ្ងៃនេះ?</p>
                    </div>
                    

                    {/* Suggested Prompts */}
                    <div className="w-full">
                      <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                        សំណួរណែនាំ <button className="hover:text-blue-500 transition-colors p-1"><RefreshCw size={14} /></button>
                      </h3>
                      <div className="space-y-2">
                        <button onClick={() => handleQuickAction('តើយើងមានថ្នាក់រៀនសរុបចំនួនប៉ុន្មាន?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                          <Sparkles size={16} className="text-blue-500 shrink-0" />
                          <span>តើយើងមានថ្នាក់រៀនសរុបចំនួនប៉ុន្មាន?</span>
                          <ChevronRight size={16} className="text-gray-400 ml-auto" />
                        </button>
                        <button onClick={() => handleQuickAction('ជួយរាយការណ៍បញ្ហាកុំព្យូទ័រលេខ PC-10 ដែលខូច Mouse', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                          <Sparkles size={16} className="text-blue-500 shrink-0" />
                          <span>ជួយរាយការណ៍បញ្ហាកុំព្យូទ័រលេខ PC-10 ដែលខូច Mouse</span>
                          <ChevronRight size={16} className="text-gray-400 ml-auto" />
                        </button>
                        <button onClick={() => handleQuickAction('តើសិស្សក្នុងថ្នាក់ 6A1 មានចំនួនប៉ុន្មាននាក់?', true)} className="w-full text-left bg-[#f8f9fa] hover:bg-[#f0f4f9] border border-gray-100 p-3.5 rounded-xl text-sm text-gray-700 flex items-center gap-3 transition-colors">
                          <Sparkles size={16} className="text-blue-500 shrink-0" />
                          <span>តើសិស្សក្នុងថ្នាក់ 6A1 មានចំនួនប៉ុន្មាននាក់?</span>
                          <ChevronRight size={16} className="text-gray-400 ml-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Chat Bubbles */
                  <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-6">
                    {messages.map((msg) => {
                      const isUser = msg.sender === 'user';
                      
                      return (
                        <div key={msg.id} className={`flex gap-3 max-w-[90%] md:max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}>
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ${isUser ? 'bg-[#1a73e8] text-white' : 'bg-white border border-gray-200 text-[#1a73e8]'}`}>
                            {isUser ? <User size={isUser ? 16 : 20} /> : <Bot size={20} />}
                          </div>
                          
                          <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className="text-xs text-gray-400 font-medium px-1 mb-0.5">
                              {isUser ? 'អ្នក' : 'AI'}
                            </div>
                            <div className={`p-3.5 md:p-4 text-sm md:text-base ${isUser ? 'bg-[#1a73e8] text-white rounded-2xl rounded-tr-sm shadow-sm' : 'bg-[#f0f4f9] text-gray-800 rounded-2xl rounded-tl-sm'}`}>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              
                              {/* Approval Request Cards (Multiple) */}
                              {msg.pendingActions && msg.pendingActions.length > 0 && (
                                <div className="mt-4 flex flex-col gap-3">
                                  <div className="bg-yellow-50 px-4 py-2.5 border border-yellow-200 rounded-xl mb-1 shadow-sm">
                                    <p className="font-bold text-xs text-yellow-800 uppercase flex items-center gap-1.5">
                                      <AlertTriangle size={14} /> ទាមទារការអនុម័តចំនួន {msg.pendingActions.length} កំណត់ត្រា
                                    </p>
                                  </div>
                                  
                                  <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                                      <div className="p-4 flex flex-col gap-4">
                                        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                                          {msg.pendingActions.map((action, idx) => (
                                            <div key={idx} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                                               {renderActionData(action)}
                                            </div>
                                          ))}
                                        </div>

                                        <div className="flex gap-2.5 mt-2 pt-3 border-t border-gray-100">
                                          <button 
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 text-sm shadow-sm"
                                            onClick={() => handleApproveAllActions(msg.id, msg.pendingActions!)}
                                            disabled={processingActionId === msg.id}
                                          >
                                            {processingActionId === msg.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                                            យល់ព្រមទាំងអស់
                                          </button>
                                          <button 
                                            className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 py-2 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 text-sm"
                                            onClick={() => handleRejectAllActions(msg.id)}
                                            disabled={!!processingActionId}
                                          >
                                            <XCircle size={16} /> បដិសេធទាំងអស់
                                          </button>
                                        </div>
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
                      <div className="self-start flex gap-3 max-w-[90%] md:max-w-[85%]">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 bg-white border border-gray-200 text-[#1a73e8] flex items-center justify-center shadow-sm">
                          <Bot size={20} />
                        </div>
                        <div className="flex flex-col gap-1 items-start">
                          <div className="text-xs text-gray-400 font-medium px-1 mb-0.5">AI</div>
                          <div className="bg-[#f0f4f9] p-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
                            <div className="flex gap-1.5">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-sm font-medium text-gray-500">កំពុងគិត...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                )}
              </div>
              
              {/* Input Area */}
              <div className="p-4 md:p-6 bg-white border-t border-gray-50 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] shrink-0 z-10">
                <div className="max-w-4xl mx-auto w-full">
                  <div className="bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all rounded-2xl p-2 flex flex-col relative focus-within:shadow-md focus-within:border-blue-400">
                    <textarea 
                      className="w-full bg-transparent border-none outline-none resize-none px-4 py-3 text-gray-800 placeholder:text-gray-400 min-h-[60px] max-h-[200px] text-base"
                      placeholder="សួរអ្វីមួយ..."
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
                    <div className="flex items-center justify-between px-2 pt-2 pb-1">
                      <div className="flex items-center gap-1 text-gray-500">
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="ភ្ចាប់ឯកសារ">
                          <Paperclip size={18} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="មុខងារបន្ថែម">
                          <LayoutGrid size={18} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="និយាយបញ្ចូលសំឡេង">
                          <Mic size={18} />
                        </button>
                      </div>
                      <button 
                        className="w-10 h-10 flex items-center justify-center bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full transition-colors shadow-sm disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500"
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                      >
                        <Send size={18} className="ml-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Topbar Button */}
      <button 
        className={`hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm border transition-all text-sm font-bold bg-white text-[#2a5298] hover:bg-blue-50 border-white/20`}
        onClick={() => setIsOpen(true)}
      >
        <Bot size={18} />
        <span>Gemini AI</span>
      </button>
    </>
  );
};

export default AIAssistant;
