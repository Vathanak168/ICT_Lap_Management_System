import { GoogleGenAI, Type } from '@google/genai';
import { initDB } from '../store/db';

let ai: GoogleGenAI | null = null;

export const initAI = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) return false;
  ai = new GoogleGenAI({ apiKey });
  return true;
};

export const hasApiKey = () => !!localStorage.getItem('GEMINI_API_KEY');

// Define tools
export const systemInstruction = `
You are a highly capable ICT Lab Management Assistant. Your job is to help the user manage their school database (classes, students, attendance, grades, etc.).
You have access to tools to read data and propose changes.

RULES FOR USING TOOLS:
1. When asked for information, use the 'getClasses' or 'getStudents' tools to fetch it.
2. When asked to add/update/delete data, use the appropriate 'propose...' tools. YOU CANNOT MODIFY DATA DIRECTLY. You can only propose changes. 
3. Always respond in Khmer (Cambodian) language, as the system is for a Cambodian school. Be polite and professional.
4. If a user asks to add a student, use proposeAddStudent. Make sure to find the correct classId first by using getClasses if you don't know it.
`;

const tools: any = [{
  functionDeclarations: [
    {
      name: 'getClasses',
      description: 'Get a list of all classes in the system',
      parameters: {
        type: Type.OBJECT,
        properties: {
          dummy: { type: Type.STRING, description: 'Ignore this' }
        },
      },
    },
    {
      name: 'getStudents',
      description: 'Get a list of students, optionally filtered by classId',
      parameters: {
        type: Type.OBJECT,
        properties: {
          classId: { type: Type.STRING, description: 'Optional. The ID of the class to filter by.' }
        },
      },
    },
    {
      name: 'proposeAddStudent',
      description: 'Propose to add a new student to a class. The user will review and approve this action.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING, description: 'The student ID (e.g., STU-8A1-001)' },
          name: { type: Type.STRING, description: 'The student name in Khmer' },
          gender: { type: Type.STRING, description: 'Gender: M or F' },
          classId: { type: Type.STRING, description: 'The ID of the class (must exist)' }
        },
        required: ['studentId', 'name', 'gender', 'classId']
      }
    }
  ]
}];

// Tool execution logic
export const executeTool = async (name: string, args: any) => {
  const db = await initDB();
  
  if (name === 'getClasses') {
    return await db.getAll('classes');
  }
  
  if (name === 'getStudents') {
    const students = await db.getAll('students');
    if (args.classId) {
      return students.filter(s => s.class === args.classId);
    }
    return students;
  }
  
  // Propose functions don't execute DB changes, they just return the intended action to the UI
  if (name === 'proposeAddStudent') {
    return {
      action: 'ADD_STUDENT',
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
  
  throw new Error(`Tool ${name} not found`);
};

export const generateAIResponse = async (_history: any[], prompt: string) => {
  if (!ai) {
    if (!initAI()) throw new Error('API Key not found. Please add it in Settings.');
  }

  try {
    const chat = ai!.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction,
        tools,
        temperature: 0.2
      }
    });
    
    // We can't pass history directly if we are handling function calling in a specific way, 
    // but for simplicity, we'll send the new message and let the SDK handle tool calls if any.
    // In a real app, you'd maintain the chat session object, but here we'll just send the prompt.
    // To support history, we'd need to re-instantiate chat with history.
    
    const response = await chat.sendMessage({ message: prompt });
    
    // Handle function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const calls = response.functionCalls;
      const callResults: any[] = [];
      let pendingAction = null;
      
      for (const call of calls) {
        try {
          const result: any = await executeTool(call.name || '', call.args);
          callResults.push({
            functionResponse: {
              name: call.name || '',
              response: result || {}
            }
          });
          
          if (result && result.status === 'PENDING_APPROVAL') {
            pendingAction = result;
          }
        } catch (e: any) {
           callResults.push({
            functionResponse: {
              name: call.name || '',
              response: { error: e.message }
            }
          });
        }
      }
      
      // If there's an action pending approval, we can stop and return it to the UI
      if (pendingAction) {
        return {
          text: response.text || 'ខ្ញុំបានរៀបចំទិន្នន័យរួចរាល់ហើយ។ សូមលោកគ្រូពិនិត្យ និងយល់ព្រម (Approve) ខាងក្រោមនេះ៖',
          pendingAction
        };
      }
      
      // Send the tool results back to the model
      const followUp = await chat.sendMessage({ message: callResults as any });
      return { text: followUp.text };
    }
    
    return { text: response.text };
  } catch (error: any) {
    console.error('AI Error:', error);
    throw new Error('មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ AI: ' + error.message);
  }
};
