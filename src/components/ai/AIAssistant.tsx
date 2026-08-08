import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Check, XCircle, Loader2, UserPlus, FileText, Edit, Trash2, AlertTriangle, Wrench } from 'lucide-react';
import { generateAIResponse, hasApiKey } from '../../lib/aiService';
import { initDB } from '../../store/db';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { useAuth } from '../../contexts/AuthContext';

type Message = {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  pendingAction?: any;
};

const AIAssistant = () => {
  const { activeYear } = useAcademicYear();
  const { branch } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: 'សួស្តីលោកគ្រូ! តើមានអ្វីឲ្យខ្ញុំជួយថ្ងៃនេះ?' }
  ]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const db = await initDB();
        const records = await db.getAll('aiHistory');
        if (records && records.length > 0) {
          const rec = records[0];
          setHistoryRecordId(rec.id);
          if (rec.messages && Array.isArray(rec.messages) && rec.messages.length > 0) {
            setMessages(rec.messages as Message[]);
          }
        }
      } catch (e) {
        console.error('Failed to load chat history from Supabase DB', e);
      } finally {
        setIsDbLoaded(true);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (!isDbLoaded) return;
    const saveHistory = async () => {
      try {
        const db = await initDB();
        if (historyRecordId) {
          await db.update('aiHistory', historyRecordId, { messages });
        } else {
          const newId = crypto.randomUUID();
          await db.put('aiHistory', { id: newId, messages });
          setHistoryRecordId(newId);
        }
      } catch (e) {
        console.error('Failed to save chat history to Supabase DB', e);
      }
    };
    saveHistory();
  }, [messages, isDbLoaded, historyRecordId]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (!hasApiKey()) {
      alert('សូមបញ្ចូល Gemini API Key នៅក្នុងទំព័រ "ការកំណត់ (Settings)" ជាមុនសិន!');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: { role: 'user' | 'model'; text: string }[] = messages.map(m => ({ 
        role: m.sender === 'user' ? 'user' : 'model', 
        text: m.text 
      }));
      
      const context = {
        branch: branch || localStorage.getItem('userBranch') || 'BELTEI IS 1',
        academicYear: activeYear || ''
      };

      const response = await generateAIResponse(history, userMsg.text, context);
      
      const aiMsg: Message = { 
        id: crypto.randomUUID(), 
        sender: 'ai', 
        text: response.text || '',
        pendingAction: response.pendingAction
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: unknown) {
      console.error('[AI Assistant] Request failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      
      let friendlyMessage = `❌ មានបញ្ហាបច្ចេកទេសបន្តិចបន្តួច៖\n${message}`;
      
      if (message.includes('429') || message.toLowerCase().includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
        friendlyMessage = `⚠️ **ប្រព័ន្ធ AI កំពុងរវល់ខ្លាំង (Limit Reached)**\nសូមមេត្តារង់ចាំប្រហែល ១ ទៅ ២ នាទី រួចសាកល្បងសួរម្តងទៀត។\n\n*(បញ្ជាក់៖ ដោយសារនេះជាគម្រោងសាកល្បងឥតគិតថ្លៃ (Free Tier) វាមានការកំណត់ចំនួនដងនៃការប្រើប្រាស់។ បើអ្នកឃើញសារនេះញឹកញាប់ សូមពិចារណាដូរ API Key ថ្មី។)*`;
      } else if (message.includes('API Key not found')) {
        friendlyMessage = `🔑 **មិនទាន់មាន API Key**\nសូមចូលទៅកាន់ទំព័រការកំណត់ (Settings) ដើម្បីបញ្ចូល Gemini API Key ជាមុនសិន។`;
      }
      
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: friendlyMessage
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAction = async (msgId: string, action: any) => {
    if (processingActionId) return;
    setProcessingActionId(msgId);
    
    try {
      const db = await initDB();
      
      switch (action.action) {
        case 'ADD_STUDENT':
          if (!action.data.studentId || !action.data.classId) {
            throw new Error('ទិន្នន័យមិនពេញលេញ (Missing studentId or classId)');
          }
          const existing = await db.getAllFromIndex('students', 'studentId', action.data.studentId);
          if (existing && existing.length > 0) {
            throw new Error('លេខអត្តសញ្ញាណសិស្សនេះមានរួចហើយ (Student ID already exists)');
          }
          const newStudent = {
            id: crypto.randomUUID(),
            studentId: action.data.studentId,
            name: action.data.name,
            gender: action.data.gender,
            class: action.data.classId,
            shift: 'Morning', // Should ideally come from the class info
            status: 'Active',
            academicYear: action.data.academicYear || '2026-2027'
          };
          await db.put('students', newStudent);
          break;
          
        case 'UPDATE_STUDENT':
          const studentsToUpdate = await db.getAllFromIndex('students', 'studentId', action.data.studentId);
          if (!studentsToUpdate || studentsToUpdate.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ (Student not found)');
          const studentToUpdate = studentsToUpdate[0];
          await db.update('students', studentToUpdate.id, {
            name: action.data.name || studentToUpdate.name,
            gender: action.data.gender || studentToUpdate.gender,
            class: action.data.classId || studentToUpdate.class,
            status: action.data.status || studentToUpdate.status
          });
          break;
          
        case 'DELETE_STUDENT':
          const studentsToDelete = await db.getAllFromIndex('students', 'studentId', action.data.studentId);
          if (!studentsToDelete || studentsToDelete.length === 0) throw new Error('រកមិនឃើញសិស្សនេះទេ (Student not found)');
          await db.delete('students', studentsToDelete[0].id);
          break;
          
        case 'ADD_PC_ISSUE':
          if (!action.data.pcNumber) throw new Error('បញ្ជាក់លេខកុំព្យូទ័រ (Missing PC Number)');
          const newIssue = {
            id: crypto.randomUUID(),
            pcNumber: action.data.pcNumber,
            description: action.data.description || '',
            status: 'Pending',
            reportedBy: action.data.reportedBy || 'AI Assistant',
            reportedDate: new Date().toISOString(),
            academicYear: action.data.academicYear || '2026-2027'
          };
          await db.put('pcIssues', newIssue);
          break;
          
        case 'RESOLVE_PC_ISSUE':
          if (!action.data.id) throw new Error('បញ្ជាក់លេខកូដបញ្ហា (Missing Issue ID)');
          await db.update('pcIssues', action.data.id, {
            status: 'Resolved',
            resolution: action.data.resolution || 'Resolved by AI',
            resolvedDate: new Date().toISOString()
          });
          break;
          
        case 'DELETE_CLASS':
          if (!action.data.classId) throw new Error('បញ្ជាក់លេខកូដថ្នាក់ (Missing classId)');
          const classRecs = await db.getAll('classes');
          const classToDelete = classRecs.find(c => c.id === action.data.classId || c.name === action.data.classId);
          if (!classToDelete) throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
          await db.delete('classes', classToDelete.id);
          break;
          
        case 'ADD_CLASS':
          if (!action.data.name || !action.data.shift) throw new Error('ទិន្នន័យមិនពេញលេញ (Missing class name or shift)');
          const newClass = {
            id: crypto.randomUUID(),
            name: action.data.name,
            shift: action.data.shift,
            academicYear: activeYear || '2026-2027',
            notes: action.data.notes || ''
          };
          await db.put('classes', newClass);
          break;

        case 'UPDATE_CLASS':
          if (!action.data.classId) throw new Error('បញ្ជាក់លេខកូដថ្នាក់ (Missing classId)');
          const classesToUpdate = await db.getAll('classes');
          const classToUpdate = classesToUpdate.find(c => c.id === action.data.classId || c.name === action.data.classId);
          if (!classToUpdate) throw new Error('រកមិនឃើញថ្នាក់នេះទេ (Class not found)');
          
          await db.update('classes', classToUpdate.id, {
            name: action.data.name || classToUpdate.name,
            shift: action.data.shift || classToUpdate.shift,
            notes: action.data.notes !== undefined ? action.data.notes : classToUpdate.notes
          });
          break;

        default:
          throw new Error(`មិនគាំទ្រសកម្មភាពប្រភេទនេះទេ (Unsupported action: ${action.action})`);
      }
      
      // Update message to remove the pending action and add success text
      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return { ...m, pendingAction: undefined, text: m.text + '\n\n✅ បានអនុម័ត និងរក្សាទុករួចរាល់!' };
        }
        return m;
      }));
      
    } catch (e: any) {
      console.error(e);
      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return { ...m, pendingAction: undefined, text: m.text + '\n\n❌ បរាជ័យក្នុងការអនុម័ត៖ ' + e.message };
        }
        return m;
      }));
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleRejectAction = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return { ...m, pendingAction: undefined, text: m.text + '\n\n❌ ការស្នើសុំត្រូវបានបដិសេធ។' };
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
              {d.status && <div className="flex justify-between"><span className="text-gray-500">ស្ថានភាព៖</span> <span className="font-medium">{d.status}</span></div>}
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
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-[95vw] md:w-[600px] lg:w-[800px] h-[85vh] max-h-[850px] flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-[#2a5298] text-white p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <span className="font-bold text-sm">ជំនួយការ AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  if (confirm('តើអ្នកពិតជាចង់លុបប្រវត្តិសារជជែកនេះមែនទេ?')) {
                    setMessages([{ id: '1', sender: 'ai', text: 'សួស្តីលោកគ្រូ! តើមានអ្វីឲ្យខ្ញុំជួយថ្ងៃនេះ?' }]);
                  }
                }} 
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors flex items-center justify-center"
                title="លុបប្រវត្តិ (Clear History)"
              >
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-[#48b5c9] text-white' : 'bg-orange-100 text-orange-600'}`}>
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-lg text-sm ${msg.sender === 'user' ? 'bg-[#48b5c9] text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  
                  {/* Approval Request Card */}
                  {msg.pendingAction && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                      <p className="font-bold text-xs text-yellow-800 uppercase mb-2">ទាមទារការអនុម័ត</p>
                      
                      {renderActionData(msg.pendingAction)}

                      <div className="flex gap-2">
                        <button 
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-sm flex items-center justify-center gap-1 font-bold transition-colors disabled:opacity-50"
                          onClick={() => handleApproveAction(msg.id, msg.pendingAction)}
                          disabled={processingActionId === msg.id}
                        >
                          {processingActionId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 
                          យល់ព្រម
                        </button>
                        <button 
                          className="flex-1 bg-red-100 text-red-600 hover:bg-red-200 py-1.5 rounded-sm flex items-center justify-center gap-1 font-bold transition-colors disabled:opacity-50"
                          onClick={() => handleRejectAction(msg.id)}
                          disabled={!!processingActionId}
                        >
                          <XCircle size={14} /> បដិសេធ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="self-start flex gap-2">
                 <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-lg rounded-tl-none shadow-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                  <span className="text-xs text-gray-500">កំពុងគិត...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2 relative">
              <input 
                type="text" 
                className="flex-1 bg-gray-100 text-gray-900 border-none rounded-full pl-4 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#48b5c9]/50 transition-all"
                placeholder="សួរអ្វីមួយ..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={loading}
              />
              <button 
                className="absolute right-1 w-8 h-8 flex items-center justify-center bg-[#48b5c9] hover:bg-[#3aa3b7] text-white rounded-full transition-colors disabled:opacity-50"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                <Send size={14} className="ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar Button */}
      <button 
        className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-sm border transition-all text-sm font-medium bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40`}
        onClick={() => setIsOpen(true)}
      >
        <Bot size={16} />
        <span>Gemini AI</span>
      </button>
    </>
  );
};

export default AIAssistant;
