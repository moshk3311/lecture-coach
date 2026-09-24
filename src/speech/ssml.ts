export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type SsmlOptions = {
  text: string
  voice: string
  locale: string
  /** Optional prosody rate, e.g. "-25%". */
  rate?: string
}

export function buildSsml({ text, voice, locale, rate }: SsmlOptions): string {
  const spoken = escapeXml(text)
  const body = rate ? `<prosody rate="${escapeXml(rate)}">${spoken}</prosody>` : spoken
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(locale)}">` +
    `<voice name="${escapeXml(voice)}">${body}</voice></speak>`
  )
}
