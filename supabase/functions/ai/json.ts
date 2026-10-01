// Reading untrusted JSON (Gemini answers, stored metrics, request payloads) one field at a time.

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** A string with its whitespace collapsed, or '' for anything else. */
export function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** A finite number (numeric columns may arrive as strings), or null. */
export function num(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
