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

// Action Types
export type AddStudentAction = {
  action: 'ADD_STUDENT';
  data: {
    studentId: string;
    name: string;
    gender: 'M' | 'F';
    classId: string;
  };
};

export type PendingAction = AddStudentAction; // Expand this later


// Define tools
export const systemInstruction = `
You are a highly capable ICT Lab Management Assistant. Your job is to help the user manage their school database (classes, students, attendance, grades, etc.).
You have access to tools to read data and propose changes.

RULES FOR USING TOOLS:
1. When asked for information, use the 'getClasses' or 'getStudents' tools to fetch it.
2. When asked to add/update/delete data, use the appropriate 'propose...' tools. YOU CANNOT MODIFY DATA DIRECTLY. You can only propose changes. 
3. Always respond in Khmer (Cambodian) language, as the system is for a Cambodian school. Be polite and professional.
4. If a user asks to add a student, use proposeAddStudent. Make sure to find the correct classId first by using getClasses if you don't know it.
5. Pay attention to the user's current context (Branch, Academic Year) and only fetch data relevant to their context unless they ask otherwise.
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
    },
    {
      name: 'getPcIssues',
      description: 'Get a list of PC issues or broken computers',
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, description: 'Optional. Filter by status (e.g. pending, resolved)' }
        }
      }
    },
    {
      name: 'getAttendance',
      description: 'Get attendance records',
      parameters: {
        type: Type.OBJECT,
        properties: {
          classId: { type: Type.STRING, description: 'Optional. Filter by class ID' },
          date: { type: Type.STRING, description: 'Optional. Filter by date (YYYY-MM-DD)' }
        }
      }
    },
    {
      name: 'getGrades',
      description: 'Get student grades/scores',
      parameters: {
        type: Type.OBJECT,
        properties: {
          classId: { type: Type.STRING, description: 'Optional. Filter by class ID' },
          month: { type: Type.STRING, description: 'Optional. Filter by month (e.g. October)' }
        }
      }
    },
    {
      name: 'getLessonLogs',
      description: 'Get lesson logs or teaching history',
      parameters: {
        type: Type.OBJECT,
        properties: {
          classId: { type: Type.STRING, description: 'Optional. Filter by class ID' },
          date: { type: Type.STRING, description: 'Optional. Filter by date' }
        }
      }
    },
    {
      name: 'proposeUpdateStudent',
      description: 'Propose to update an existing student. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING, description: 'The student ID to update' },
          name: { type: Type.STRING, description: 'New name' },
          gender: { type: Type.STRING, description: 'New gender (M or F)' },
          classId: { type: Type.STRING, description: 'New class ID' },
          status: { type: Type.STRING, description: 'New status (e.g., Active, Dropped)' }
        },
        required: ['studentId']
      }
    },
    {
      name: 'proposeDeleteStudent',
      description: 'Propose to delete a student. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING, description: 'The student ID to delete' }
        },
        required: ['studentId']
      }
    },
    {
      name: 'proposeAddPcIssue',
      description: 'Propose to report a broken PC or issue. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pcNumber: { type: Type.STRING, description: 'The PC number (e.g., PC-01)' },
          description: { type: Type.STRING, description: 'Description of the problem' },
          reportedBy: { type: Type.STRING, description: 'Name of person reporting' }
        },
        required: ['pcNumber', 'description']
      }
    },
    {
      name: 'proposeResolvePcIssue',
      description: 'Propose to mark a PC issue as resolved. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'The ID of the issue to resolve' },
          resolution: { type: Type.STRING, description: 'How it was fixed' }
        },
        required: ['id']
      }
    },
    {
      name: 'proposeDeleteClass',
      description: 'Propose to delete a class. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          classId: { type: Type.STRING, description: 'The class ID to delete' }
        },
        required: ['classId']
      }
    },
    {
      name: 'proposeAddClass',
      description: 'Propose to add a new class. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'The name of the class (e.g. 6A1)' },
          shift: { type: Type.STRING, description: 'The shift (Morning, Afternoon, Evening)' },
          notes: { type: Type.STRING, description: 'Optional notes' }
        },
        required: ['name', 'shift']
      }
    },
    {
      name: 'proposeUpdateClass',
      description: 'Propose to update an existing class. User will review and approve.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          classId: { type: Type.STRING, description: 'The class ID to update' },
          name: { type: Type.STRING, description: 'New name of the class' },
          shift: { type: Type.STRING, description: 'New shift' },
          notes: { type: Type.STRING, description: 'New notes' }
        },
        required: ['classId']
      }
    }
  ]
}];

// Tool execution logic
export const executeTool = async (name: string, args: any, academicYear?: string) => {
  const db = await initDB();
  
  if (name === 'getClasses') {
    return await db.getAll('classes', academicYear);
  }
  
  if (name === 'getStudents') {
    const students = await db.getAll('students', academicYear);
    if (args.classId) {
      return students.filter(s => s.class === args.classId);
    }
    return students;
  }
  
  if (name === 'getPcIssues') {
    const issues = await db.getAll('pcIssues', academicYear);
    if (args.status) {
      return issues.filter(i => i.status.toLowerCase() === args.status.toLowerCase());
    }
    return issues;
  }
  
  if (name === 'getAttendance') {
    const records = await db.getAll('attendance', academicYear);
    return records.filter(r => 
      (!args.classId || r.classId === args.classId) && 
      (!args.date || r.date === args.date)
    );
  }

  if (name === 'getGrades') {
    const records = await db.getAll('grades', academicYear);
    return records.filter(r => 
      (!args.classId || r.classId === args.classId) && 
      (!args.month || r.month === args.month)
    );
  }

  if (name === 'getLessonLogs') {
    const records = await db.getAll('lessonLogs', academicYear);
    return records.filter(r => 
      (!args.classId || r.classId === args.classId) && 
      (!args.date || r.date === args.date)
    );
  }
  
  // Propose functions don't execute DB changes, they just return the intended action to the UI
  const proposeActions = [
    'proposeAddStudent',
    'proposeUpdateStudent',
    'proposeDeleteStudent',
    'proposeAddPcIssue',
    'proposeResolvePcIssue',
    'proposeDeleteClass',
    'proposeAddClass',
    'proposeUpdateClass'
  ];
  
  if (proposeActions.includes(name)) {
    const actionMap: Record<string, string> = {
      'proposeAddStudent': 'ADD_STUDENT',
      'proposeUpdateStudent': 'UPDATE_STUDENT',
      'proposeDeleteStudent': 'DELETE_STUDENT',
      'proposeAddPcIssue': 'ADD_PC_ISSUE',
      'proposeResolvePcIssue': 'RESOLVE_PC_ISSUE',
      'proposeDeleteClass': 'DELETE_CLASS',
      'proposeAddClass': 'ADD_CLASS',
      'proposeUpdateClass': 'UPDATE_CLASS'
    };
    
    return {
      action: actionMap[name],
      data: args,
      status: 'PENDING_APPROVAL'
    };
  }
};

export const generateAIResponse = async (
  history: { role: 'user' | 'model', text: string }[], 
  prompt: string,
  context?: { branch: string; academicYear: string }
) => {
  if (!ai) {
    if (!initAI()) throw new Error('API Key not found. Please add it in Settings.');
  }

  try {
    const formattedHistory = history
      .filter(h => h.text && h.text.trim() !== '')
      .map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));

    let instruction = systemInstruction;
    if (context) {
      instruction += `\n\nCURRENT CONTEXT:\n- Branch: ${context.branch}\n- Academic Year: ${context.academicYear}`;
    }

    const chat = ai!.chats.create({
      model: 'gemini-3.6-flash',
      history: formattedHistory,
      config: {
        systemInstruction: instruction,
        tools,
        temperature: 0.2
      }
    });
    
    // We can't pass history directly if we are handling function calling in a specific way, 
    // but for simplicity, we'll send the new message and let the SDK handle tool calls if any.
    // In a real app, you'd maintain the chat session object, but here we'll just send the prompt.
    // To support history, we'd need to re-instantiate chat with history.
    
    let currentResponse = await chat.sendMessage({ message: prompt });
    
    // Handle function calls in a loop (for multi-step reasoning)
    while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0) {
      const calls = currentResponse.functionCalls;
      const callResults: any[] = [];
      let pendingAction = null;
      
      for (const call of calls) {
        try {
          const result: any = await executeTool(call.name || '', call.args, context?.academicYear);
          // Gemini functionResponse expects a JSON object (Struct), not a JSON array.
          // If the tool returns an array, wrap it in an object.
          const safeResponse = Array.isArray(result) ? { items: result } : (result || {});
          
          callResults.push({
            functionResponse: {
              name: call.name || '',
              response: safeResponse
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
        let textPart = '';
        try { textPart = currentResponse.text; } catch (e) {}
        
        return {
          text: textPart || 'ខ្ញុំបានរៀបចំទិន្នន័យរួចរាល់ហើយ។ សូមលោកគ្រូពិនិត្យ និងយល់ព្រម (Approve) ខាងក្រោមនេះ៖',
          pendingAction
        };
      }
      
      // Send the tool results back to the model for the next turn
      currentResponse = await chat.sendMessage({ message: callResults as any });
    }
    
    let finalText = '';
    try { finalText = currentResponse.text; } catch(e) {}
    return { text: finalText };
  } catch (error: any) {
    console.error('AI Error:', error);
    throw new Error('មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ AI: ' + error.message);
  }
};

export const extractLessonPlanFromImage = async (base64Image: string, mimeType: string) => {
  if (!ai) {
    if (!initAI()) throw new Error('API Key not found. Please add it in Settings.');
  }

  try {
    const prompt = `
អ្នកគឺជាជំនួយការគ្រូបង្រៀនដ៏ចំណាននៅកម្ពុជា។
ខ្ញុំមានរូបភាពកាលវិភាគបង្រៀន ឬកម្មវិធីសិក្សា។
សូមទាញយកទិន្នន័យមេរៀនទាំងនោះ រួចរៀបចំជា JSON array។ 
Object នីមួយៗត្រូវមាន keys ដូចខាងក្រោម៖
- "month": ខែបង្រៀន (ឧទាហរណ៍៖ "តុលា", "វិច្ឆិកា")
- "week": សប្តាហ៍ទីប៉ុន្មាន (ឧទាហរណ៍៖ "សប្តាហ៍ទី១", "សប្តាហ៍ទី២")
- "lessonTitle": ចំណងជើងមេរៀន ឬជំពូក
- "topics": ចំណុចសំខាន់ៗដែលត្រូវបង្រៀន
- "exercises": លំហាត់ដែលត្រូវធ្វើ ឬឆែក (បើគ្មានដាក់ "")

Please respond with ONLY a valid JSON array, no markdown blocks.
`;

    const response = await ai!.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from AI");
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error('AI Vision Error:', error);
    throw new Error('មានបញ្ហាក្នុងការអានរូបភាព: ' + error.message);
  }
};
