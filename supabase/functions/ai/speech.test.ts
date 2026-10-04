import { describe, expect, it } from 'vitest'
import { InvalidAnswer } from './contract.ts'
import { audioFromInteraction } from './speech.ts'

describe('audioFromInteraction', () => {
  it('reads the last audio block of the model output', () => {
    const answer = {
      steps: [
        { type: 'user_input', content: [{ type: 'text', text: 'hi' }] },
        { type: 'model_output', content: [{ type: 'audio', data: 'AAAA', mime_type: 'audio/wav' }] },
      ],
    }
    expect(audioFromInteraction(answer)).toEqual({ audio_base64: 'AAAA', mime_type: 'audio/wav' })
  })

  it('assumes WAV when the block names no type', () => {
    const answer = { steps: [{ type: 'model_output', content: [{ type: 'audio', data: 'AAAA' }] }] }
    expect(audioFromInteraction(answer).mime_type).toBe('audio/wav')
  })

  it('fails on an answer without audio', () => {
    expect(() => audioFromInteraction({ steps: [{ type: 'model_output', content: [{ type: 'text' }] }] })).toThrow(InvalidAnswer)
    expect(() => audioFromInteraction(null)).toThrow(InvalidAnswer)
  })
})
