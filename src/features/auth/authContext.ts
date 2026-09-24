import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState = {
  session: Session | null
  /** True until supabase-js has restored the session (and exchanged any ?code= from a magic link). */
  loading: boolean
  /** Hebrew message when the page was opened from a failed magic link. */
  urlError: string | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
