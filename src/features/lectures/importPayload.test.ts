import { describe, expect, it } from 'vitest'
import type { ParsedDeck } from '../../lib/pptx'
import { suggestTitle, toImportSlides } from './importPayload'

const deck: ParsedDeck = {
  hiddenCount: 0,
  slides: [
    { number: 1, title: 'Fertilizer Plant', text: 'Operational briefing', notes: 'Open with the purpose. Keep it short.\nThen move on.' },
    { number: 2, title: null, text: '', notes: '' },
  ],
}

describe('toImportSlides', () => {
  it('turns speaker notes into the first script, split into sentences', () => {
    expect(toImportSlides(deck)).toEqual([
      {
        title: 'Fertilizer Plant',
        source_text: 'Operational briefing',
        source_notes: 'Open with the purpose. Keep it short.\nThen move on.',
        sentences: [
          { text: 'Open with the purpose.', starts_paragraph: true },
          { text: 'Keep it short.', starts_paragraph: false },
          { text: 'Then move on.', starts_paragraph: true },
        ],
      },
      { title: null, source_text: '', source_notes: '', sentences: [] },
    ])
  })
})

describe('suggestTitle', () => {
  it('prefers the first slide title, else a cleaned file name', () => {
    expect(suggestTitle('deck.pptx', deck)).toBe('Fertilizer Plant')
    expect(suggestTitle('ICL_Fertilizer_Plants.PPTX', { hiddenCount: 0, slides: [] })).toBe('ICL Fertilizer Plants')
  })
})
