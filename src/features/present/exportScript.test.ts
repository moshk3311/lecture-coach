import { describe, expect, it } from 'vitest'
import { scriptFileName, scriptMarkdown } from './exportScript'

describe('scriptMarkdown', () => {
  it('lists every slide with its script and transition line', () => {
    const md = scriptMarkdown('Fertilizer Plant', [
      { position: 1, title: 'Intro', script: 'Good morning. Thanks for coming.\nLet us start.', transitionLine: 'So where does it begin?' },
      { position: 2, title: null, script: '  ', transitionLine: null },
    ])
    expect(md).toBe(
      [
        '# Fertilizer Plant',
        '## 1. Intro',
        'Good morning. Thanks for coming.\n\nLet us start.',
        '> **Before you click:** So where does it begin?',
        '## 2. Untitled slide',
        '_No script yet._',
      ].join('\n\n') + '\n',
    )
  })
})

describe('scriptFileName', () => {
  it('slugs the title, keeping Hebrew letters', () => {
    expect(scriptFileName('Fertilizer Plant — Overview!')).toBe('fertilizer-plant-overview-script.md')
    expect(scriptFileName('שיחת פתיחה')).toBe('שיחת-פתיחה-script.md')
    expect(scriptFileName('***')).toBe('lecture-script.md')
  })
})
