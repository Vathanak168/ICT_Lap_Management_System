import { GoogleGenAI } from '@google/genai';
import { tools, executeTool } from './tools';
import { 
  getProviderChain, 
  reportSuccess, 
  reportFailure, 
  withRetry, 
  isAIAvailable,
  type ProviderInfo 
} from './providers';
import { sendGroqRequest } from './groqAdapter';

// ============================================================
// Public API
// ============================================================
export const hasApiKey = () => isAIAvailable();

export const systemInstruction = `
You are a warm, natural conversational assistant for teachers using an ICT Lab Management System.

CONVERSATION STYLE — THESE RULES APPLY TO EVERY FINAL ANSWER:

- Speak like a helpful human colleague in a chat conversation, not like a database report.
- Default to 1–3 short, flowing Khmer paragraphs.
- NEVER use numbered lists, bullet points, headings, tables, labels such as "Student ID:", or report-style formatting unless the user explicitly asks for a list, table, report, or detailed breakdown.
- When tool results contain structured JSON, treat that JSON as private source data. DO NOT mirror its structure in your answer.
- Do not describe every field returned by a tool.
- Answer only the information the user actually asked for.
- Convert database records into normal spoken language.
- Prefer names and human-readable information over UUIDs, database IDs, internal statuses, or technical field names.
- Do not expose IDs unless the user specifically asks for them or they are genuinely required.
- If there are only a few people/items, mention them naturally in one sentence.
- If there are many items, summarize the count first and mention only the most relevant details, then offer to show the full list.
- Avoid phrases that sound like a generated report such as "Based on the retrieved data", "The results are as follows", or "1. Student...".
- Keep the answer concise unless the user asks for details.
- End naturally. Do not mechanically ask "Would you like anything else?" after every response.

EXAMPLE:

User: "ថ្នាក់ 6A1 មានសិស្សប៉ុន្មាននាក់?"

Tool result:
{
  "count": 3,
  "students": [
    {"name":"ពិសី","studentId":"ST001"},
    {"name":"លីលី","studentId":"ST002"},
    {"name":"សុខសាន្ត","studentId":"ST003"}
  ]
}

GOOD:
"ថ្នាក់ 6A1 មានសិស្ស ៣ នាក់បាទ គឺ ពិសី លីលី និងសុខសាន្ត។"

BAD:
"ថ្នាក់ 6A1 មានសិស្សដូចខាងក្រោម៖
1. ពិសី - ID: ST001
2. លីលី - ID: ST002
3. សុខសាន្ត - ID: ST003"

The GOOD example is the required default style.

TOOL RULES:

- Use get... tools whenever current system data is needed.
- Tool results are evidence, not a formatting template.
- After receiving a tool result, silently decide what information answers the user's question, then phrase only that information conversationally.
- Use propose... tools for requested changes. Never modify data directly.
- Respect the current Branch and Academic Year.
`;

// ============================================================
// Gemini-specific request handler
// ============================================================
async function sendGeminiRequest(
  provider: ProviderInfo,
  history: { role: 'user' | 'model', text: string }[],
  prompt: string,
  context?: { branch: string; academicYear: string }
): Promise<{ text: string; pendingActions?: any[] }> {
  const ai = new GoogleGenAI({ apiKey: provider.apiKey });

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

  const chat = ai.chats.create({
    model: provider.model,
    history: formattedHistory,
    config: {
      systemInstruction: instruction,
      tools,
      temperature: 0.5
    }
  });

  // Send with retry
  let currentResponse = await withRetry(
    () => chat.sendMessage({ message: prompt }),
    3,
    `Gemini[${provider.model}]`
  );

  // Handle function calls in a loop
  while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0) {
    const calls = currentResponse.functionCalls;
    const callResults: any[] = [];
    let pendingActions: any[] = [];

    for (const call of calls) {
      try {
        const result: any = await executeTool(call.name || '', call.args, context?.academicYear);
        const safeResponse = Array.isArray(result)
          ? {
              data: result,
              presentationHint: 'Answer the original user question naturally in conversational Khmer. Do not reproduce this data as a list unless explicitly requested.'
            }
          : {
              ...result,
              presentationHint: 'Use this only as factual source data. Respond in natural flowing Khmer paragraphs. Do not mirror the JSON structure.'
            };

        callResults.push({
          functionResponse: {
            name: call.name || '',
            response: safeResponse
          }
        });

        if (result && result.status === 'PENDING_APPROVAL') {
          pendingActions.push(result);
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

    if (pendingActions.length > 0) {
      let textPart: string = '';
      try { textPart = currentResponse.text || ''; } catch (e) {}

      return {
        text: textPart || 'ខ្ញុំបានរៀបចំទិន្នន័យរួចរាល់ហើយ។ សូមលោកគ្រូពិនិត្យ និងយល់ព្រម (Approve) ខាងក្រោមនេះ៖',
        pendingActions
      };
    }

    // Send tool results back with retry
    currentResponse = await withRetry(
      () => chat.sendMessage({ message: callResults as any }),
      3,
      `Gemini[tool-response]`
    );
  }

  let finalText: string = '';
  try { finalText = currentResponse.text || ''; } catch (e) {}
  return { text: finalText };
}

// ============================================================
// Main Entry Point — Tries all providers in order
// ============================================================
export const generateAIResponse = async (
  history: { role: 'user' | 'model', text: string }[],
  prompt: string,
  context?: { branch: string; academicYear: string }
) => {
  const chain = await getProviderChain();

  if (chain.length === 0) {
    throw new Error('មិនមាន AI API Key ត្រូវបានកំណត់ទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ។');
  }

  let lastError: any = null;

  for (const provider of chain) {
    try {
      console.log(`[AI] Trying ${provider.type} (model: ${provider.model})...`);

      let result;

      if (provider.type === 'gemini') {
        result = await sendGeminiRequest(provider, history, prompt, context);
      } else if (provider.type === 'groq') {
        result = await withRetry(
          () => sendGroqRequest(provider.apiKey, provider.model, history, prompt, context),
          3,
          'Groq'
        );
      } else {
        continue;
      }

      // Success!
      reportSuccess(provider);
      console.log(`[AI] ✅ Success with ${provider.type} (model: ${provider.model})`);
      return result;

    } catch (error: any) {
      lastError = error;
      console.warn(`[AI] ❌ Failed with ${provider.type}: ${error.message}`);
      reportFailure(provider);
      // Continue to next provider
    }
  }

  // All providers failed
  console.error('[AI] All providers exhausted:', lastError);
  throw new Error('មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ AI: ' + (lastError?.message || 'All providers unavailable'));
};

// ============================================================
// Image extraction (Gemini only — falls back through Gemini keys)
// ============================================================
export const extractLessonPlanFromImage = async (base64Image: string, mimeType: string) => {
  const providers = await getProviderChain();
  const chain = providers.filter(p => p.type === 'gemini');

  if (chain.length === 0) {
    throw new Error('មុខងារស្កេនរូបភាពត្រូវការ Gemini API Key។');
  }

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

  let lastError: any = null;

  for (const provider of chain) {
    try {
      const ai = new GoogleGenAI({ apiKey: provider.apiKey });

      const response = await withRetry(
        () => ai.models.generateContent({
          model: provider.model,
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
        }),
        3,
        'Gemini[Vision]'
      );

      const text = response.text;
      if (!text) throw new Error("No text returned from AI");

      reportSuccess(provider);
      return JSON.parse(text);
    } catch (error: any) {
      lastError = error;
      reportFailure(provider);
    }
  }

  throw new Error('មានបញ្ហាក្នុងការអានរូបភាព: ' + (lastError?.message || 'Unknown'));
};
