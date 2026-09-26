import { describe, expect, it } from 'vitest'
import { toFormValues, toLectureFields } from './lectureFields'

describe('toLectureFields', () => {
  it('trims fields and turns empty optional ones into null', () => {
    expect(toLectureFields({ title: '  Plant tour ', audience: '  ', minutes: '' })).toEqual({
      title: 'Plant tour',
      audience: null,
      target_minutes: null,
    })
    expect(toLectureFields({ title: 'Plant tour', audience: 'McKinsey', minutes: '15' })).toEqual({
      title: 'Plant tour',
      audience: 'McKinsey',
      target_minutes: 15,
    })
  })

  it('rejects a missing title and out-of-range minutes', () => {
    expect(toLectureFields({ title: ' ', audience: '', minutes: '' })).toHaveProperty('error')
    expect(toLectureFields({ title: 'x', audience: '', minutes: '0' })).toHaveProperty('error')
    expect(toLectureFields({ title: 'x', audience: '', minutes: '241' })).toHaveProperty('error')
  })

  it('round-trips through the form values', () => {
    const values = toFormValues({ title: 'Plant tour', audience: null, target_minutes: 20 })
    expect(values).toEqual({ title: 'Plant tour', audience: '', minutes: '20' })
    expect(toLectureFields(values)).toEqual({ title: 'Plant tour', audience: null, target_minutes: 20 })
  })
})
