import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env } from './env'

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  auth: {
    // PKCE keeps the magic-link callback in the query string (?code=…),
    // which does not collide with HashRouter's #/ routes.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})

/** Where magic links should land: the app root on this origin (GitHub Pages base or localhost). */
export function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}
