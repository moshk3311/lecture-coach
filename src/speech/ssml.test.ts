import { describe, expect, it } from 'vitest'
import { buildSsml, escapeXml } from './ssml'

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`R&D <team> said "it's" fine`)).toBe('R&amp;D &lt;team&gt; said &quot;it&apos;s&quot; fine')
  })
})

describe('buildSsml', () => {
  it('wraps text in the requested voice and locale', () => {
    const ssml = buildSsml({ text: 'Hello there.', voice: 'en-US-AndrewNeural', locale: 'en-US' })
    expect(ssml).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' +
        '<voice name="en-US-AndrewNeural">Hello there.</voice></speak>',
    )
  })

  it('adds a prosody rate for the slow variant', () => {
    const ssml = buildSsml({ text: 'Slow & steady', voice: 'v', locale: 'en-US', rate: '-25%' })
    expect(ssml).toContain('<prosody rate="-25%">Slow &amp; steady</prosody>')
  })
})
