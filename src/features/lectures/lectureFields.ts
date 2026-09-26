import type { LectureFieldsInput } from './api'

export const MAX_TARGET_MINUTES = 240

export type LectureFormValues = { title: string; audience: string; minutes: string }

export function toFormValues(lecture?: Partial<LectureFieldsInput>): LectureFormValues {
  return {
    title: lecture?.title ?? '',
    audience: lecture?.audience ?? '',
    minutes: lecture?.target_minutes ? String(lecture.target_minutes) : '',
  }
}

/** Validates the lecture form; returns the row fields or a Hebrew error. */
export function toLectureFields(values: LectureFormValues): LectureFieldsInput | { error: string } {
  const title = values.title.trim()
  if (!title) return { error: 'צריך כותרת להרצאה.' }
  const minutesText = values.minutes.trim()
  const minutes = minutesText ? Number(minutesText) : null
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_TARGET_MINUTES)) {
    return { error: `משך היעד צריך להיות מספר שלם של דקות, בין 1 ל-${MAX_TARGET_MINUTES}.` }
  }
  return { title, audience: values.audience.trim() || null, target_minutes: minutes }
}
