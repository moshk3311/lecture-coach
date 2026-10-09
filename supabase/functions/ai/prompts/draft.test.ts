import { describe, expect, it } from 'vitest'
import { draftPrompt, type DraftInput } from './draft.ts'

const input: DraftInput = {
  title: 'Fertilizer Plants',
  audience: 'Consultants',
  targetSeconds: 720,
  position: 2,
  slideCount: 3,
  slideTitle: 'Agenda',
  slideText: 'Scale · Process · Safety',
  notes: 'Mention the three plants.',
  intent: 'להדגיש בטיחות',
  currentScript: '',
  previous: [{ position: 1, title: 'Intro', script: 'Welcome everyone.' }],
  next: { title: 'At a glance', text: 'Output by plant' },
  budgetSeconds: 60,
  hasImage: true,
}

describe('draftPrompt', () => {
  it('states the talk, the slide, whether its picture is attached and the time budget', () => {
    const prompt = draftPrompt(input)
    expect(prompt).toContain('Talk: "Fertilizer Plants" · audience: Consultants · target length: 12:00')
    expect(prompt).toContain("This is slide 2 of 3. The slide's picture is attached.")
    expect(prompt).toContain('Time budget for this slide: 1:00, about 140 words.')
    expect(draftPrompt({ ...input, hasImage: false })).toContain('not available: use the text below')
    expect(draftPrompt({ ...input, budgetSeconds: null })).toContain('No time budget is set: aim for 40 to 90 words.')
  })

  it('passes the slide text, notes, the speaker\'s intent and the current script', () => {
    const prompt = draftPrompt({ ...input, currentScript: 'We run three plants.' })
    expect(prompt).toContain('Scale · Process · Safety')
    expect(prompt).toContain('Mention the three plants.')
    expect(prompt).toContain('להדגיש בטיחות')
    expect(prompt).toContain('We run three plants.')
    expect(draftPrompt(input)).toContain('(none yet)')
  })

  it('continues from the previous scripts, or starts the talk on the first one', () => {
    expect(draftPrompt(input)).toContain('- slide 1 "Intro": Welcome everyone.')
    expect(draftPrompt({ ...input, previous: [] })).toContain('This is the first slide with a script: start the talk.')
  })

  it('names the next slide for the bridge sentence, or closes the talk on the last one', () => {
    expect(draftPrompt(input)).toContain('Next slide: "At a glance" — Output by plant')
    expect(draftPrompt({ ...input, next: null })).toContain('This is the last slide: close the talk and give no bridge sentence.')
  })
})
