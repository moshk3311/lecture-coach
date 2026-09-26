// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { parsePptx, PptxError } from './pptx'

// ---------------------------------------------------------------------------
// A tiny PPTX builder: just the parts the parser reads.
// ---------------------------------------------------------------------------

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

type Shape = { text: string | string[]; ph?: string; sz?: number; y?: number }

function sp({ text, ph, sz, y }: Shape): string {
  const paras = (Array.isArray(text) ? text : [text])
    .map((t) => `<a:p><a:r><a:rPr lang="en-US"${sz ? ` sz="${sz}"` : ''}/><a:t>${t}</a:t></a:r></a:p>`)
    .join('')
  const nvPr = ph === undefined ? '<p:nvPr/>' : `<p:nvPr><p:ph${ph ? ` type="${ph}"` : ''}/></p:nvPr>`
  const xfrm = y === undefined ? '' : `<a:xfrm><a:off x="0" y="${y}"/><a:ext cx="100" cy="100"/></a:xfrm>`
  return `<p:sp><p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/>${nvPr}</p:nvSpPr><p:spPr>${xfrm}</p:spPr><p:txBody><a:bodyPr/>${paras}</p:txBody></p:sp>`
}

const group = (inner: string) => `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${inner}</p:grpSp>`

const table = (rows: string[][]) =>
  `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${rows
    .map((r) => `<a:tr>${r.map((c) => `<a:tc><a:txBody><a:p><a:r><a:t>${c}</a:t></a:r></a:p></a:txBody></a:tc>`).join('')}</a:tr>`)
    .join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`

type SlideSpec = { shapes: string[]; notes?: string[]; hidden?: boolean }

/** `order` lists file slide numbers in presentation order (defaults to 1..n). */
async function buildPptx(slides: SlideSpec[], order?: number[]): Promise<Uint8Array> {
  const zip = new JSZip()
  const ids = (order ?? slides.map((_, i) => i + 1)).map((n, i) => `<p:sldId id="${256 + i}" r:id="rId${n}"/>`)
  zip.file('ppt/presentation.xml', `<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst>${ids.join('')}</p:sldIdLst></p:presentation>`)
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
  )
  slides.forEach((slide, i) => {
    const n = i + 1
    zip.file(
      `ppt/slides/slide${n}.xml`,
      `<?xml version="1.0"?><p:sld ${NS}${slide.hidden ? ' show="0"' : ''}><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>${slide.shapes.join('')}</p:spTree></p:cSld></p:sld>`,
    )
    if (slide.notes) {
      zip.file(
        `ppt/slides/_rels/slide${n}.xml.rels`,
        `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/></Relationships>`,
      )
      zip.file(
        `ppt/notesSlides/notesSlide${n}.xml`,
        `<?xml version="1.0"?><p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>${sp({ text: 'slide image', ph: 'sldImg' })}${sp({ text: slide.notes, ph: 'body' })}${sp({ text: String(n), ph: 'sldNum' })}</p:spTree></p:cSld></p:notes>`,
      )
    }
  })
  return zip.generateAsync({ type: 'uint8array' })
}

// ---------------------------------------------------------------------------

describe('parsePptx', () => {
  it('follows the presentation order, not the file names', async () => {
    const file = await buildPptx(
      [{ shapes: [sp({ text: 'First file', ph: 'title' })] }, { shapes: [sp({ text: 'Second file', ph: 'title' })] }],
      [2, 1],
    )
    const deck = await parsePptx(file)
    expect(deck.slides.map((s) => [s.number, s.title])).toEqual([
      [1, 'Second file'],
      [2, 'First file'],
    ])
  })

  it('takes the title placeholder as title and keeps it out of the text', async () => {
    const file = await buildPptx([
      {
        shapes: [
          sp({ text: 'Why granulation matters', ph: 'ctrTitle' }),
          sp({ text: ['Uniform size', 'Less dust'], ph: '' }),
          sp({ text: 'Confidential', ph: 'ftr' }),
          sp({ text: '7', ph: 'sldNum' }),
        ],
      },
    ])
    const [slide] = (await parsePptx(file)).slides
    expect(slide?.title).toBe('Why granulation matters')
    expect(slide?.text).toBe('Uniform size\nLess dust')
  })

  it('guesses the title from the largest short text when there are no placeholders', async () => {
    const file = await buildPptx([
      {
        shapes: [
          sp({ text: 'ICL · Fertilizers', sz: 1400, y: 400 }),
          sp({ text: 'Fertilizer Plant', sz: 3600, y: 1800 }),
          sp({ text: '95%', sz: 6000, y: 3000 }),
          sp({ text: 'How phosphate rock becomes fertilizer', sz: 1800, y: 2400 }),
        ],
      },
      { shapes: [sp({ text: 'Agenda', y: 200 }), sp({ text: 'Scale and output', y: 900 })] },
    ])
    const [first, second] = (await parsePptx(file)).slides
    expect(first?.title).toBe('Fertilizer Plant')
    expect(first?.text).toBe('ICL · Fertilizers\n95%\nHow phosphate rock becomes fertilizer')
    // No font sizes: the topmost text wins.
    expect(second?.title).toBe('Agenda')
  })

  it('skips hidden slides and numbers the rest without gaps', async () => {
    const file = await buildPptx([
      { shapes: [sp({ text: 'One', ph: 'title' })] },
      { shapes: [sp({ text: 'Backup', ph: 'title' })], hidden: true },
      { shapes: [sp({ text: 'Three', ph: 'title' })] },
    ])
    const deck = await parsePptx(file)
    expect(deck.hiddenCount).toBe(1)
    expect(deck.slides.map((s) => [s.number, s.title])).toEqual([
      [1, 'One'],
      [2, 'Three'],
    ])
  })

  it('reads speaker notes from the body placeholder, one paragraph per line', async () => {
    const file = await buildPptx([
      { shapes: [sp({ text: 'Intro', ph: 'title' })], notes: ['Open with the plant purpose.', 'Keep it to 20 seconds.'] },
      { shapes: [sp({ text: 'No notes', ph: 'title' })] },
    ])
    const [withNotes, without] = (await parsePptx(file)).slides
    expect(withNotes?.notes).toBe('Open with the plant purpose.\nKeep it to 20 seconds.')
    expect(without?.notes).toBe('')
  })

  it('includes text from groups and table cells', async () => {
    const file = await buildPptx([
      {
        shapes: [
          sp({ text: 'Plants', ph: 'title' }),
          group(sp({ text: 'Grouped note' })),
          table([
            ['Plant', 'Output'],
            ['Rotem', '1 Mt'],
          ]),
        ],
      },
    ])
    const [slide] = (await parsePptx(file)).slides
    expect(slide?.text).toBe('Grouped note\nPlant\nOutput\nRotem\n1 Mt')
  })

  it('drops footers repeated on most slides and bare slide numbers', async () => {
    const footer = sp({ text: 'CONFIDENTIAL | internal' })
    const file = await buildPptx(
      [1, 2, 3, 4].map((n) => ({
        shapes: [sp({ text: `Slide ${n}`, ph: 'title' }), sp({ text: `Point ${n}` }), footer, sp({ text: `${n} / 4` })],
      })),
    )
    const deck = await parsePptx(file)
    expect(deck.slides.map((s) => s.text)).toEqual(['Point 1', 'Point 2', 'Point 3', 'Point 4'])
  })

  it('splits line breaks and normalizes spaces', async () => {
    const zip = await JSZip.loadAsync(await buildPptx([{ shapes: [sp({ text: 'Title', ph: 'title' })] }]))
    const path = 'ppt/slides/slide1.xml'
    const xml = (await zip.file(path)!.async('string')).replace(
      '</p:spTree>',
      '<p:sp><p:nvSpPr><p:cNvPr id="3" name="b"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>Line one</a:t></a:r><a:br/><a:r><a:t>  line   two </a:t></a:r></a:p></p:txBody></p:sp></p:spTree>',
    )
    zip.file(path, xml)
    const [slide] = (await parsePptx(await zip.generateAsync({ type: 'uint8array' }))).slides
    expect(slide?.text).toBe('Line one\nline two')
  })

  it('rejects files that are not a PPTX', async () => {
    await expect(parsePptx(new TextEncoder().encode('not a zip'))).rejects.toBeInstanceOf(PptxError)
    const emptyZip = await new JSZip().generateAsync({ type: 'uint8array' })
    await expect(parsePptx(emptyZip)).rejects.toBeInstanceOf(PptxError)
  })
})

// Real decks live in private/decks (gitignored), so this only runs on a machine that has them.
const DECKS = 'private/decks'
const decks = existsSync(DECKS) ? readdirSync(DECKS).filter((f) => f.endsWith('.pptx')) : []

describe.skipIf(decks.length === 0)('parsePptx on real decks', () => {
  it.each(decks)('%s', async (name) => {
    const deck = await parsePptx(new Uint8Array(readFileSync(`${DECKS}/${name}`)))
    expect(deck.slides.length).toBeGreaterThan(0)
    for (const slide of deck.slides) {
      expect(slide.title, `slide ${slide.number} has a title`).toBeTruthy()
    }
    console.info(
      `${name}: ${deck.slides.length} slides, ${deck.hiddenCount} hidden\n` +
        deck.slides
          .map((s) => `  ${s.number}. ${s.title} | text ${s.text.split('\n').length} lines | notes ${s.notes.length} chars`)
          .join('\n'),
    )
  })
})
