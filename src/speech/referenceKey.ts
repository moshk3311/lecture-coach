/**
 * The cache key of a reference clip (ARCHITECTURE §5.2): hex sha256 of "text|voice|rate", with the
 * text's whitespace collapsed so the same phrase always maps to the same file.
 */
export async function referenceKey(text: string, voice: string, rate = ''): Promise<string> {
  const input = `${text.replace(/\s+/g, ' ').trim()}|${voice}|${rate}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
