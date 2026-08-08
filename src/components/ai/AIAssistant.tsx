import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Check, XCircle, Loader2 } from 'lucide-react';
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
      
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: `❌ AI Error\n${message}`
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
      alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ: ' + e.message);
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

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-[350px] md:w-[400px] h-[500px] flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-[#2a5298] text-white p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <span className="font-bold text-sm">ជំនួយការ AI</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
              <X size={18} />
            </button>
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
                      <div className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200 mb-3 overflow-x-auto">
                        <pre>{JSON.stringify(msg.pendingAction.data, null, 2)}</pre>
                      </div>
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
