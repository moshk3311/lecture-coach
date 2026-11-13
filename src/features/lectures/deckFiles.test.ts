import { describe, expect, it } from 'vitest'
import { splitDeckFiles } from './deckFiles'

const file = (name: string) => new File(['x'], name)

describe('splitDeckFiles', () => {
  it('takes a pptx alone', () => {
    const pptx = file('Deck.pptx')
    expect(splitDeckFiles([pptx])).toEqual({ pptx, rejected: [], extraPptx: false })
  })

  it('pairs a pptx with its pdf in either order, case-insensitive', () => {
    const pptx = file('Deck.PPTX')
    const pdf = file('Deck.Pdf')
    expect(splitDeckFiles([pdf, pptx])).toEqual({ pptx, pdf, rejected: [], extraPptx: false })
    expect(splitDeckFiles([pptx, pdf])).toEqual({ pptx, pdf, rejected: [], extraPptx: false })
  })

  it('keeps a pdf alone without a pptx', () => {
    const pdf = file('Deck.pdf')
    expect(splitDeckFiles([pdf])).toEqual({ pdf, rejected: [], extraPptx: false })
  })

  it('flags a second pptx and keeps the first', () => {
    const a = file('a.pptx')
    const b = file('b.pptx')
    expect(splitDeckFiles([a, b])).toEqual({ pptx: a, rejected: [], extraPptx: true })
  })

  it('rejects other types', () => {
    const key = file('Deck.key')
    const pptx = file('Deck.pptx')
    expect(splitDeckFiles([key, pptx])).toEqual({ pptx, rejected: [key], extraPptx: false })
  })
})
