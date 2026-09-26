// Client-side PPTX reader (ARCHITECTURE §5.1): slide order, title, text and speaker notes.
// Works on element local names, so both transitional and strict OOXML namespaces parse.
import JSZip from 'jszip'

export type ParsedSlide = {
  /** 1-based number among the visible slides (hidden slides are skipped). */
  number: number
  title: string | null
  /** Slide text without the title, one paragraph per line; repeated footers removed. */
  text: string
  /** Speaker notes, one paragraph per line. */
  notes: string
}

export type ParsedDeck = { slides: ParsedSlide[]; hiddenCount: number }

/** A PPTX that cannot be read; `message` is Hebrew and safe to show. */
export class PptxError extends Error {
  override name = 'PptxError'
}

const NOT_A_PPTX = 'הקובץ לא נראה כמו מצגת PowerPoint. שמור אותו כ-.pptx ונסה שוב.'

/** Placeholders that never carry slide content. */
const CHROME_PLACEHOLDERS = new Set(['sldNum', 'ftr', 'dt', 'hdr', 'sldImg'])
const TITLE_PLACEHOLDERS = new Set(['title', 'ctrTitle'])

export async function parsePptx(data: ArrayBuffer | Uint8Array | Blob): Promise<ParsedDeck> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    throw new PptxError(NOT_A_PPTX)
  }

  const presentation = await readXml(zip, 'ppt/presentation.xml')
  if (!presentation) throw new PptxError(NOT_A_PPTX)
  const presentationRels = await readRels(zip, 'ppt/presentation.xml')

  const slidePaths = descendants(presentation.documentElement, 'sldId')
    .map((el) => presentationRels.get(relId(el) ?? '')?.target)
    .filter((path): path is string => Boolean(path))

  const raw: { title: string | null; lines: string[]; notes: string }[] = []
  let hiddenCount = 0
  for (const path of slidePaths) {
    const slide = await readXml(zip, path)
    if (!slide) continue
    const show = slide.documentElement.getAttribute('show')
    if (show === '0' || show === 'false') {
      hiddenCount++
      continue
    }
    const { title, lines } = readSlide(slide)
    const rels = await readRels(zip, path)
    const notesPath = [...rels.values()].find((rel) => rel.type.endsWith('/notesSlide'))?.target
    const notesXml = notesPath ? await readXml(zip, notesPath) : null
    raw.push({ title, lines, notes: notesXml ? readNotes(notesXml) : '' })
  }

  const boilerplate = repeatedLines(raw.map((s) => s.lines))
  const slides = raw.map((s, i) => ({
    number: i + 1,
    title: s.title,
    text: s.lines.filter((line) => !boilerplate.has(line) && !isSlideNumber(line)).join('\n'),
    notes: s.notes,
  }))
  return { slides, hiddenCount }
}

// ---------------------------------------------------------------------------
// Slides and notes
// ---------------------------------------------------------------------------

type TextShape = { lines: string[]; placeholder: string | null; fontSize: number; y: number | null }

function readSlide(doc: Document): { title: string | null; lines: string[] } {
  const tree = descendants(doc.documentElement, 'spTree')[0]
  const shapes = tree ? collectShapes(tree, true) : []
  const content = shapes.filter((s) => !CHROME_PLACEHOLDERS.has(s.placeholder ?? ''))
  const titleShape = content.find((s) => TITLE_PLACEHOLDERS.has(s.placeholder ?? '')) ?? guessTitleShape(content)
  return {
    title: titleShape ? titleShape.lines.join(' ').replace(/\s+/g, ' ').trim() || null : null,
    lines: content.filter((s) => s !== titleShape).flatMap((s) => s.lines),
  }
}

/** Speaker notes live in the notes slide's body placeholder. */
function readNotes(doc: Document): string {
  const tree = descendants(doc.documentElement, 'spTree')[0]
  if (!tree) return ''
  const shapes = collectShapes(tree, false)
  const body = shapes.filter((s) => s.placeholder === 'body')
  const source = body.length ? body : shapes.filter((s) => !CHROME_PLACEHOLDERS.has(s.placeholder ?? ''))
  return source.flatMap((s) => s.lines).join('\n')
}

/** Text shapes in document order; groups are flattened, tables become one line per cell. */
function collectShapes(tree: Element, topLevel: boolean): TextShape[] {
  const shapes: TextShape[] = []
  for (const el of elementChildren(tree)) {
    switch (el.localName) {
      case 'sp': {
        const body = child(el, 'txBody')
        const lines = body ? paragraphs(body) : []
        if (!body || !lines.length) break
        const ph = descendants(el, 'ph')[0]
        shapes.push({
          lines,
          // A <p:ph> without a type is a body placeholder.
          placeholder: ph ? (ph.getAttribute('type') ?? 'body') : null,
          fontSize: Math.max(0, ...descendants(body, 'rPr').map((r) => Number(r.getAttribute('sz')) || 0)),
          y: topLevel ? offsetY(el) : null,
        })
        break
      }
      case 'grpSp':
        // Group coordinates are relative to the group, so they never compete for the title.
        shapes.push(...collectShapes(el, false))
        break
      case 'AlternateContent': {
        // Newer shape types come with a fallback that older readers understand.
        const branch = child(el, 'Fallback') ?? child(el, 'Choice')
        if (branch) shapes.push(...collectShapes(branch, topLevel))
        break
      }
      case 'graphicFrame': {
        const lines = descendants(el, 'tc').flatMap((cell) => paragraphs(cell))
        if (lines.length) shapes.push({ lines, placeholder: null, fontSize: 0, y: null })
        break
      }
    }
  }
  return shapes
}

/** Without a title placeholder: the short text in the largest font, then the topmost one. */
function guessTitleShape(shapes: TextShape[]): TextShape | undefined {
  const candidates = shapes.filter((s) => {
    const text = s.lines.join(' ')
    // Titles are short and made of words, not a lone number like "95%".
    return s.y !== null && s.placeholder === null && text.length <= 120 && (text.match(/\p{L}/gu)?.length ?? 0) >= 3
  })
  return candidates.reduce<TextShape | undefined>((best, s) => {
    if (!best) return s
    if (s.fontSize !== best.fontSize) return s.fontSize > best.fontSize ? s : best
    return (s.y ?? Infinity) < (best.y ?? Infinity) ? s : best
  }, undefined)
}

function paragraphs(container: Element): string[] {
  const lines: string[] = []
  for (const p of descendants(container, 'p')) {
    let text = ''
    for (const node of elementChildren(p)) {
      if (node.localName === 'r' || node.localName === 'fld') text += child(node, 't')?.textContent ?? ''
      else if (node.localName === 'br') text += '\n'
    }
    for (const line of text.replace(/ /g, ' ').split('\n')) {
      const clean = line.replace(/[ \t]+/g, ' ').trim()
      if (clean) lines.push(clean)
    }
  }
  return lines
}

function offsetY(shape: Element): number | null {
  const off = descendants(shape, 'off')[0]
  const y = off ? Number(off.getAttribute('y')) : NaN
  return Number.isFinite(y) ? y : null
}

/** Lines that repeat on most slides (footers, confidentiality marks) are layout, not content. */
function repeatedLines(slides: string[][]): Set<string> {
  const counts = new Map<string, number>()
  for (const lines of slides) for (const line of new Set(lines)) counts.set(line, (counts.get(line) ?? 0) + 1)
  const threshold = Math.max(3, Math.ceil(slides.length / 2))
  return new Set([...counts].filter(([, n]) => n >= threshold).map(([line]) => line))
}

function isSlideNumber(line: string): boolean {
  return /^\d{1,3}(\s*\/\s*\d{1,3})?$/.test(line)
}

// ---------------------------------------------------------------------------
// Zip + XML helpers
// ---------------------------------------------------------------------------

type Rel = { type: string; target: string }

async function readXml(zip: JSZip, path: string): Promise<Document | null> {
  const file = zip.file(path)
  if (!file) return null
  const doc = new DOMParser().parseFromString(await file.async('string'), 'application/xml')
  return doc.getElementsByTagName('parsererror').length ? null : doc
}

/** Relationships of a part, with targets resolved to zip paths. */
async function readRels(zip: JSZip, partPath: string): Promise<Map<string, Rel>> {
  const slash = partPath.lastIndexOf('/')
  const dir = partPath.slice(0, slash + 1)
  const doc = await readXml(zip, `${dir}_rels/${partPath.slice(slash + 1)}.rels`)
  const rels = new Map<string, Rel>()
  if (!doc) return rels
  for (const el of descendants(doc.documentElement, 'Relationship')) {
    if (el.getAttribute('TargetMode') === 'External') continue
    const id = el.getAttribute('Id')
    const target = el.getAttribute('Target')
    if (id && target) rels.set(id, { type: el.getAttribute('Type') ?? '', target: resolvePath(dir, target) })
  }
  return rels
}

function resolvePath(dir: string, target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : dir + target).split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part !== '.' && part !== '') out.push(part)
  }
  return out.join('/')
}

/** The relationship id (r:id) of an element, whatever prefix the file uses. */
function relId(el: Element): string | null {
  return Array.from(el.attributes).find((a) => a.localName === 'id' && a.namespaceURI !== null)?.value ?? null
}

function descendants(el: Element, localName: string): Element[] {
  return Array.from(el.getElementsByTagNameNS('*', localName))
}

function elementChildren(el: Element): Element[] {
  return Array.from(el.children)
}

function child(el: Element, localName: string): Element | null {
  return elementChildren(el).find((c) => c.localName === localName) ?? null
}
