/**
 * AI Provider Management System
 * Handles: DB Key Loading, Retry (Exponential Backoff), Key Rotation, Groq Fallback, Circuit Breaker
 */
import { initDB } from '../../store/db';


// ============================================================
// State Tracking (Dynamic from DB)
// ============================================================
let GEMINI_KEYS: string[] = [];
let GROQ_KEYS: string[] = [];
let keysLoaded = false;
let lastLoadTime = 0;
const KEY_CACHE_TTL = 5 * 60 * 1000; // Reload from DB every 5 minutes

let currentGeminiKeyIndex = 0;
let currentGroqKeyIndex = 0;

// Circuit breaker state
let geminiFailCount = 0;
let geminiUnavailableUntil = 0;
const CIRCUIT_BREAK_THRESHOLD = 3;    // Fail 3 times before breaking
const CIRCUIT_BREAK_DURATION = 60_000; // 60 seconds cooldown

// ============================================================
// Dynamic DB Key Loading
// ============================================================
export async function loadApiKeysFromDB(): Promise<void> {
  const now = Date.now();
  // Don't reload if we just loaded recently, unless explicitly forced
  if (keysLoaded && now - lastLoadTime < KEY_CACHE_TTL) {
    return;
  }

  try {
    const db = await initDB();
    const aiConfig = await db.get('settings', 'ai_keys');
    if (aiConfig && aiConfig.config) {
      const config = aiConfig.config as any;
      GEMINI_KEYS = Array.isArray(config.geminiKeys) ? config.geminiKeys : [];
      GROQ_KEYS = config.groqKey ? [config.groqKey] : [];
    }
    keysLoaded = true;
    lastLoadTime = now;
  } catch (error) {
    console.error('[AI Providers] Failed to load keys from DB:', error);
    // If DB fails, we still consider it "loaded" so we don't spam the DB
    keysLoaded = true;
    lastLoadTime = now;
  }
}

// ============================================================
// Retry Logic (Exponential Backoff with Jitter)
// ============================================================
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.error?.code;
  const message = String(error?.message || '');
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('overloaded') ||
    message.includes('high demand')
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  label = 'AI'
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error; // Not retryable, fail immediately
      }

      if (attempt === maxAttempts - 1) {
        break; // Last attempt, don't wait
      }

      const baseDelay = 600;
      const maxDelay = 4000;
      const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
      const delay = Math.random() * exponentialDelay; // Jitter

      console.warn(
        `[${label}] Request failed (attempt ${attempt + 1}/${maxAttempts}). Retrying in ${Math.round(delay)}ms...`,
        error
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================================
// Provider Selection
// ============================================================
export type ProviderType = 'gemini' | 'groq';

export interface ProviderInfo {
  type: ProviderType;
  apiKey: string;
  model: string;
}

function canUseGemini(): boolean {
  if (GEMINI_KEYS.length === 0) return false;
  return Date.now() >= geminiUnavailableUntil;
}

function markGeminiFailure(): void {
  geminiFailCount++;
  if (geminiFailCount >= CIRCUIT_BREAK_THRESHOLD) {
    geminiUnavailableUntil = Date.now() + CIRCUIT_BREAK_DURATION;
    console.warn(`[Circuit Breaker] Gemini disabled for ${CIRCUIT_BREAK_DURATION / 1000}s after ${geminiFailCount} failures.`);
    geminiFailCount = 0;
  }
}

function markGeminiSuccess(): void {
  geminiFailCount = 0;
}

function rotateGeminiKey(): string | null {
  if (GEMINI_KEYS.length === 0) return null;
  currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_KEYS.length;
  return GEMINI_KEYS[currentGeminiKeyIndex];
}

function rotateGroqKey(): string | null {
  if (GROQ_KEYS.length === 0) return null;
  currentGroqKeyIndex = (currentGroqKeyIndex + 1) % GROQ_KEYS.length;
  return GROQ_KEYS[currentGroqKeyIndex];
}

export function getCurrentGeminiKey(): string | null {
  if (GEMINI_KEYS.length === 0) {
    const lsKey = localStorage.getItem('GEMINI_API_KEY');
    if (lsKey) return lsKey;
    return null;
  }
  return GEMINI_KEYS[currentGeminiKeyIndex];
}

export function getCurrentGroqKey(): string | null {
  if (GROQ_KEYS.length === 0) return null;
  return GROQ_KEYS[currentGroqKeyIndex];
}

/**
 * Get the full ordered list of providers to try.
 * Gemini keys first (with rotation), then Groq keys as fallback.
 */
export async function getProviderChain(): Promise<ProviderInfo[]> {
  // Ensure keys are loaded before building the chain
  await loadApiKeysFromDB();

  const chain: ProviderInfo[] = [];

  // Add all Gemini keys if circuit breaker allows
  if (canUseGemini()) {
    // Start from current index and rotate through all keys
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const idx = (currentGeminiKeyIndex + i) % GEMINI_KEYS.length;
      chain.push({
        type: 'gemini',
        apiKey: GEMINI_KEYS[idx],
        model: 'gemini-3.5-flash-lite'
      });
    }
  }

  // Also check localStorage fallback for Gemini
  if (chain.length === 0) {
    const lsKey = localStorage.getItem('GEMINI_API_KEY');
    if (lsKey && canUseGemini()) {
      chain.push({
        type: 'gemini',
        apiKey: lsKey,
        model: 'gemini-3.5-flash-lite'
      });
    }
  }

  // Add Groq keys as fallback
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const idx = (currentGroqKeyIndex + i) % GROQ_KEYS.length;
    chain.push({
      type: 'groq',
      apiKey: GROQ_KEYS[idx],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct'
    });
  }

  return chain;
}

/**
 * Report success for a provider (resets circuit breaker for Gemini)
 */
export function reportSuccess(provider: ProviderInfo): void {
  if (provider.type === 'gemini') {
    markGeminiSuccess();
    const idx = GEMINI_KEYS.indexOf(provider.apiKey);
    if (idx >= 0) currentGeminiKeyIndex = idx;
  }
}

/**
 * Report failure for a provider
 */
export function reportFailure(provider: ProviderInfo): void {
  if (provider.type === 'gemini') {
    markGeminiFailure();
    rotateGeminiKey();
  } else if (provider.type === 'groq') {
    rotateGroqKey();
  }
}

/**
 * Check if AI is available
 */
export async function isAIAvailable(): Promise<boolean> {
  await loadApiKeysFromDB();
  const lsKey = localStorage.getItem('GEMINI_API_KEY');
  return GEMINI_KEYS.length > 0 || GROQ_KEYS.length > 0 || !!lsKey;
}
