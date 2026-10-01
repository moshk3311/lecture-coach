// Gemini REST calls for the ai function (ARCHITECTURE §7): JSON answers that follow a response
// schema, audio through the Files API, and up to 2 retries with backoff on 429 and 5xx.
import { InvalidAnswer } from './contract.ts'

const API = 'https://generativelanguage.googleapis.com'
const RETRY_DELAYS_MS = [1000, 3000]

export type GeminiConfig = { key: string; model: string }

/** The key and model from the function secrets, or null when either is missing. */
export function geminiConfig(): GeminiConfig | null {
  const key = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('GEMINI_MODEL')
  return key && model ? { key, model } : null
}

/** Gemini refused or failed after the retries; `status` is its HTTP status (0: no answer at all). */
export class GeminiError extends Error {
  override name = 'GeminiError'
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type Part = { text: string } | { file_data: { mime_type: string; file_uri: string } }

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

/** One generateContent call whose answer must be JSON that follows `schema`; returns it parsed. */
export async function generateJson(
  config: GeminiConfig,
  request: { system: string; parts: Part[]; schema: unknown; temperature?: number },
): Promise<unknown> {
  const res = await withRetries('generateContent', () =>
    fetch(`${API}/v1beta/models/${config.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': config.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: request.parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: request.schema,
          temperature: request.temperature ?? 0.4,
        },
      }),
    }),
  )
  const data = (await res.json()) as GenerateResponse
  const candidate = data.candidates?.[0]
  const answer = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? 'unknown'
  if (!answer) throw new InvalidAnswer(`no answer (${reason})`)
  try {
    return JSON.parse(answer) as unknown
  } catch {
    throw new InvalidAnswer(`the answer is not JSON (${reason})`)
  }
}

type GeminiFile = { name?: string; uri?: string; mimeType?: string; state?: string }

/**
 * Uploads a file with the Files API (resumable protocol, all bytes in one request) and waits until
 * Gemini can use it. Google deletes uploaded files after 48 hours.
 */
export async function uploadFile(
  config: GeminiConfig,
  bytes: ArrayBuffer,
  mimeType: string,
  displayName: string,
): Promise<{ mime_type: string; file_uri: string }> {
  const start = await withRetries('upload start', () =>
    fetch(`${API}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': config.key,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }),
  )
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new GeminiError('upload start: no upload URL', start.status)

  // Not retried: a resumable session that failed half way is not resent from byte 0.
  const done = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  })
  if (!done.ok) throw new GeminiError(`upload: ${done.status} ${(await done.text()).slice(0, 500)}`, done.status)
  let file = ((await done.json()) as { file?: GeminiFile }).file

  // Audio is usually ACTIVE at once; a file still PROCESSING gets up to 10 seconds.
  for (let i = 0; file?.name && file.state === 'PROCESSING' && i < 10; i++) {
    await sleep(1000)
    const name = file.name
    file = (await (await withRetries('file state', () => fetch(`${API}/v1beta/${name}`, { headers: { 'x-goog-api-key': config.key } }))).json()) as GeminiFile
  }
  if (!file?.uri || (file.state && file.state !== 'ACTIVE')) {
    throw new GeminiError(`upload: the file is not usable (${file?.state ?? 'missing'})`, 0)
  }
  return { mime_type: file.mimeType || mimeType, file_uri: file.uri }
}

/** Sends a request, retrying 429 and 5xx answers and network errors with backoff. */
async function withRetries(label: string, send: () => Promise<Response>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === RETRY_DELAYS_MS.length
    let res: Response
    try {
      res = await send()
    } catch (err) {
      if (last) throw new GeminiError(`${label}: ${err instanceof Error ? err.message : String(err)}`, 0)
      await sleep(RETRY_DELAYS_MS[attempt]!)
      continue
    }
    if (res.ok) return res
    if (last || !(res.status === 429 || res.status >= 500)) {
      throw new GeminiError(`${label}: ${res.status} ${(await res.text()).slice(0, 500)}`, res.status)
    }
    await res.body?.cancel()
    await sleep(RETRY_DELAYS_MS[attempt]!)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
