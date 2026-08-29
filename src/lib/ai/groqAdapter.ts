/**
 * Groq Adapter - Translates Google GenAI tool format to OpenAI-compatible format
 * Groq uses OpenAI-compatible API, so we need to convert our tools and messages.
 */

import { systemInstruction, type AIContext } from './core';
import { tools as geminiTools, executeTool } from './tools';

// Convert Google tool format → OpenAI tool format
function convertToolsToOpenAI(gTools: any[]): any[] {
  const declarations = gTools[0]?.functionDeclarations || [];
  return declarations.map((decl: any) => ({
    type: 'function',
    function: {
      name: decl.name,
      description: decl.description,
      parameters: convertSchemaToOpenAI(decl.parameters)
    }
  }));
}

function convertSchemaToOpenAI(schema: any): any {
  if (!schema) return { type: 'object', properties: {} };
  
  const result: any = {};
  
  // Map Type enum values to string
  const typeMap: Record<string, string> = {
    'STRING': 'string',
    'NUMBER': 'number',
    'INTEGER': 'integer',
    'BOOLEAN': 'boolean',
    'OBJECT': 'object',
    'ARRAY': 'array'
  };
  
  const typeValue = typeof schema.type === 'string' ? schema.type : String(schema.type || 'OBJECT');
  result.type = typeMap[typeValue] || typeValue.toLowerCase();
  
  if (schema.description) result.description = schema.description;
  
  if (schema.properties) {
    result.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      result.properties[key] = convertSchemaToOpenAI(val);
    }
  }
  
  if (schema.required) {
    result.required = schema.required;
  }
  
  return result;
}

// Convert our history format → OpenAI messages format
function convertHistoryToOpenAI(
  history: { role: 'user' | 'model', text: string }[],
  instruction: string
): any[] {
  const messages: any[] = [
    { role: 'system', content: instruction }
  ];
  
  for (const h of history) {
    if (!h.text || h.text.trim() === '') continue;
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text
    });
  }
  
  return messages;
}

/**
 * Send a chat request to Groq API (OpenAI-compatible)
 */
export async function sendGroqRequest(
  apiKey: string,
  model: string,
  history: { role: 'user' | 'model', text: string }[],
  prompt: string,
  context?: AIContext
): Promise<{ text: string; pendingActions?: any[] }> {
  
  let instruction = systemInstruction;
  if (context) {
    instruction += `\n\n<runtime_context>\n`;
    instruction += `Current branch: ${context.branch}\n`;
    instruction += `Academic year: ${context.academicYear}\n`;
    if (context.semester) instruction += `Semester: ${context.semester}\n`;
    if (context.activeClass) instruction += `Active class: ${context.activeClass}\n`;
    if (context.activeStudent) instruction += `Active student: ${context.activeStudent}\n`;
    if (context.activePage) instruction += `Current application screen: ${context.activePage}\n`;
    instruction += `\nThese values are private application context.\nDo not mention them unless relevant to the user's request.\n</runtime_context>`;
  }
  
  const openAITools = convertToolsToOpenAI(geminiTools);
  const messages = convertHistoryToOpenAI(history, instruction);
  messages.push({ role: 'user', content: prompt });
  
  // Tool loop (same concept as Gemini but with OpenAI format)
  let maxIterations = 10;
  
  while (maxIterations-- > 0) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        tools: openAITools,
        tool_choice: 'auto',
        temperature: 0.5,
        max_tokens: 4096
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      const error: any = new Error(`Groq API Error: ${response.status} ${errorBody}`);
      error.status = response.status;
      throw error;
    }
    
    const data = await response.json();
    const choice = data.choices?.[0];
    
    if (!choice) {
      throw new Error('No response from Groq');
    }
    
    const message = choice.message;
    
    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add assistant message with tool calls to conversation
      messages.push(message);
      
      let pendingActions: any[] = [];
      
      for (const toolCall of message.tool_calls) {
        const funcName = toolCall.function.name;
        const funcArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        try {
          const result: any = await executeTool(funcName, funcArgs, context?.academicYear);
          
          const safeResponse = Array.isArray(result)
            ? {
                data: result,
                presentationHint: 'Answer the original user question naturally in conversational Khmer. Do not reproduce this data as a list unless explicitly requested.'
              }
            : {
                ...result,
                presentationHint: 'Use this only as factual source data. Respond in natural flowing Khmer paragraphs. Do not mirror the JSON structure.'
              };
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(safeResponse)
          });
          
          if (result && result.status === 'PENDING_APPROVAL') {
            pendingActions.push(result);
          }
        } catch (e: any) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: e.message })
          });
        }
      }
      
      // If there's a pending action, return it immediately
      if (pendingActions.length > 0) {
        return {
          text: message.content || 'ខ្ញុំបានរៀបចំទិន្នន័យរួចរាល់ហើយ។ សូមលោកគ្រូពិនិត្យ និងយល់ព្រម (Approve) ខាងក្រោមនេះ：',
          pendingActions
        };
      }
      
      // Continue the loop to get the model's final response with tool results
      continue;
    }
    
    // No tool calls — this is the final text response
    return { text: message.content || '' };
  }
  
  throw new Error('Too many tool iterations');
}
