/** "Export script" (ARCHITECTURE §5.7): every slide's title, script and transition line as Markdown. */
export type ExportSlide = { position: number; title: string | null; script: string; transitionLine: string | null }

export function scriptMarkdown(lectureTitle: string, slides: ExportSlide[]): string {
  const parts = [`# ${lectureTitle}`]
  for (const slide of slides) {
    parts.push(`## ${slide.position}. ${slide.title?.trim() || 'Untitled slide'}`)
    parts.push(slide.script.trim() ? slide.script.trim().split('\n').join('\n\n') : '_No script yet._')
    if (slide.transitionLine?.trim()) parts.push(`> **Before you click:** ${slide.transitionLine.trim()}`)
  }
  return `${parts.join('\n\n')}\n`
}

/** A safe file name from the lecture title, e.g. "fertilizer-plant-script.md". */
export function scriptFileName(lectureTitle: string): string {
  const slug = lectureTitle
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'lecture'}-script.md`
}
