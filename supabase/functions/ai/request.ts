// Request payloads of the ai function, read field by field, with Hebrew errors the app shows as-is.
import { isObject } from './json.ts'

/** A bad request (400) or a row that is not there (404). */
export class RequestError extends Error {
  override name = 'RequestError'
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/** A trimmed string field, cut at `maxLength`; '' when missing. */
export function stringField(payload: unknown, name: string, maxLength: number): string {
  const value = isObject(payload) ? payload[name] : undefined
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A uuid field (it goes into a PostgREST filter, so nothing else may pass). */
export function idField(payload: unknown, name: string): string {
  const value = stringField(payload, name, 36)
  if (!UUID.test(value)) throw new RequestError('מזהה לא תקין בבקשה.')
  return value
}
