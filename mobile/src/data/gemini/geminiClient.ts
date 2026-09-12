import { ApiError } from '../api';

/**
 * A minimal Gemini client.
 *
 * Hand-rolled rather than pulled from `@google/generative-ai`, for two reasons:
 * we need exactly two call shapes (a vision call and a tool-calling loop), and
 * the SDK's Node-oriented file handling doesn't map cleanly onto a React Native
 * image URI. This is ~100 lines against a documented REST endpoint.
 *
 * The key comes from `EXPO_PUBLIC_GEMINI_API_KEY`. Note the `EXPO_PUBLIC_`
 * prefix: that means it is **bundled into the app** and readable by anyone with
 * the binary. Fine for a demo; before this ships anywhere real the calls belong
 * behind the server that `../http/httpApi.ts` already describes, with the key
 * held there instead.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Override with `EXPO_PUBLIC_GEMINI_MODEL` if this id has moved on — Google
 * rotates them faster than a semester. `npm run gemini:doctor` lists the ids
 * your key can actually reach.
 */
export const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.5-flash';

export const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || null;

/** Whether the AI paths are live. Every one of them degrades without this. */
export const hasGemini = Boolean(geminiKey);

/** The subset of OpenAPI schema Gemini accepts for structured output. */
export interface GeminiSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
  nullable?: boolean;
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiSchema;
}

interface GenerateRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  tools?: [{ functionDeclarations: GeminiFunctionDeclaration[] }];
  generationConfig?: {
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: GeminiSchema;
    /** Cap the reply so a chat bubble stays a chat bubble. */
    maxOutputTokens?: number;
  };
}

interface GenerateResponse {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Slow networks are the norm at a hackathon; a hung request is worse than a miss. */
const TIMEOUT_MS = 20000;

export async function generate(
  model: string,
  request: GenerateRequest,
  timeoutMs = TIMEOUT_MS,
): Promise<GenerateResponse> {
  if (!geminiKey) throw new ApiError('No Gemini key: set EXPO_PUBLIC_GEMINI_API_KEY');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const response = await fetch(`${ENDPOINT}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(request),
      signal: abort.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(`Gemini ${response.status}: ${body.slice(0, 300)}`, response.status);
    }
    return (await response.json()) as GenerateResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Gemini timed out');
    }
    throw new ApiError(error instanceof Error ? error.message : 'Gemini request failed');
  } finally {
    clearTimeout(timer);
  }
}

/** The first candidate's parts, or an empty list if the model returned nothing. */
export function partsOf(response: GenerateResponse): GeminiPart[] {
  return response.candidates?.[0]?.content?.parts ?? [];
}

/** Concatenated text across parts — Gemini can split a reply over several. */
export function textOf(response: GenerateResponse): string {
  return partsOf(response)
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

/**
 * Parse a structured-output reply.
 *
 * `responseMimeType: 'application/json'` makes this reliable in practice, but a
 * model that hits its token cap can still hand back a truncated object, so this
 * never throws raw JSON errors at a screen.
 */
export function jsonOf<T>(response: GenerateResponse): T {
  const text = textOf(response);
  if (!text) throw new ApiError('Gemini returned an empty response');
  try {
    return JSON.parse(text) as T;
  } catch {
    // Occasionally a model fences JSON despite the mime type. Salvage it.
    const fenced = text.match(/\{[\s\S]*\}/);
    if (fenced) {
      try {
        return JSON.parse(fenced[0]) as T;
      } catch {
        /* fall through to the error below */
      }
    }
    throw new ApiError(`Gemini returned malformed JSON: ${text.slice(0, 200)}`);
  }
}
