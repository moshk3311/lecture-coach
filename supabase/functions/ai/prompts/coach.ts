// Prompt pieces shared by the `ai` actions (ARCHITECTURE §8). PROMPT_VERSION is saved with every
// report, so an answer can be traced to the prompts that produced it: bump it when a prompt changes.
export const PROMPT_VERSION = '2026-10-01'

export const COACH = `You are an American English presentation coach for a Hebrew-native speaker who presents technical topics in English. Write explanations in Hebrew. Write every English word, quote, example and drill in English. Be concise, specific and honest; encourage without flattery.`

export const HEBREW_SPEAKER_PATTERNS = `Known Hebrew-speaker patterns: /θ/ /ð/ → t, d, s, z · /w/ vs /v/ · American /ɹ/ vs Hebrew uvular r · /ɪ/ vs /iː/ (ship/sheep) · /æ/ vs /ɛ/ · schwa and vowel reduction · wrong word stress · final consonant clusters · flap t (water, better) · dark l.`

/** Seconds as m:ss. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
