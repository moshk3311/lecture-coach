import { describe, expect, it } from 'vitest'
import { recordingsToPrune, type TakeAudio } from './retention'

/** Take n was recorded n minutes after the first one. */
function take(n: number, fields: Partial<TakeAudio> = {}): TakeAudio {
  return {
    id: `take-${n}`,
    lecture_id: 'lecture-a',
    audio_path: `user/take-${n}.wav`,
    created_at: new Date(Date.UTC(2026, 9, 1, 9, n)).toISOString(),
    ...fields,
  }
}

const ids = (takes: TakeAudio[]) => takes.map((t) => t.id).sort()

describe('recordingsToPrune', () => {
  it('keeps everything up to the limit', () => {
    expect(recordingsToPrune([1, 2, 3].map((n) => take(n)), 3)).toEqual([])
  })

  it('picks the oldest recordings beyond the newest ones, in any order', () => {
    const takes = [5, 1, 4, 2, 3].map((n) => take(n))
    expect(ids(recordingsToPrune(takes, 3))).toEqual(['take-1', 'take-2'])
  })

  it('keeps 10 by default, across lectures', () => {
    const takes = Array.from({ length: 12 }, (_, n) => take(n + 1, { lecture_id: n % 2 ? 'lecture-a' : 'lecture-b' }))
    expect(ids(recordingsToPrune(takes))).toEqual(['take-1', 'take-2'])
  })

  it('ignores takes whose recording is already gone', () => {
    const takes = [take(1, { audio_path: null }), take(2, { audio_path: null }), take(3), take(4)]
    expect(recordingsToPrune(takes, 2)).toEqual([])
  })

  it('drops the recordings of deleted lectures without using a slot', () => {
    const takes = [take(1), take(2), take(3, { lecture_id: null }), take(4, { lecture_id: null })]
    expect(ids(recordingsToPrune(takes, 2))).toEqual(['take-3', 'take-4'])
  })
})
