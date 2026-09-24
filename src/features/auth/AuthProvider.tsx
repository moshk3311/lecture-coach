import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { clearAzureToken } from '../../speech/tokenClient'
import { AuthContext, type AuthState } from './authContext'
import { authErrorFromUrl } from './authErrors'

const AUTH_URL_PARAMS = ['code', 'error', 'error_code', 'error_description']

/** Removes magic-link leftovers (?code=…, ?error=…) so a reload or bookmark stays clean. */
function stripAuthParams(): void {
  const url = new URL(window.location.href)
  if (!AUTH_URL_PARAMS.some((key) => url.searchParams.has(key))) return
  for (const key of AUTH_URL_PARAMS) url.searchParams.delete(key)
  window.history.replaceState(window.history.state, '', url.toString())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [urlError] = useState(() => authErrorFromUrl(window.location.search, window.location.hash))

  useEffect(() => {
    let active = true
    // getSession() resolves after supabase-js has exchanged a magic-link ?code= (PKCE).
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
      stripAuthParams()
    })

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      if (event === 'SIGNED_OUT') {
        clearAzureToken()
        queryClient.clear()
      }
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, loading, urlError, signOut }),
    [session, loading, urlError, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
