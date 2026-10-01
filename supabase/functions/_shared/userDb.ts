// The database and Storage as the calling user: every request carries the user's token, so RLS and
// the storage policies apply exactly as they do in the app.
import { type AuthedUser, projectApiKey } from './auth.ts'

export type UserDb = ReturnType<typeof userDb>

export function userDb(user: AuthedUser) {
  const base = Deno.env.get('SUPABASE_URL') ?? ''
  const headers = { Authorization: `Bearer ${user.token}`, apikey: projectApiKey() }

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } })
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} failed: ${res.status} ${await res.text()}`)
    return res
  }

  return {
    /** The first row a PostgREST query returns, or null. `query` is "table?filters&select=…". */
    async one<T>(query: string): Promise<T | null> {
      const rows = (await (await send(`/rest/v1/${query}`)).json()) as T[]
      return rows[0] ?? null
    },

    async update(query: string, values: Record<string, unknown>): Promise<void> {
      await send(`/rest/v1/${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(values),
      })
    },

    /** A whole Storage object (private buckets; recordings stay under the 50 MB upload cap). */
    async download(bucket: string, path: string): Promise<ArrayBuffer> {
      const encoded = path.split('/').map(encodeURIComponent).join('/')
      return (await send(`/storage/v1/object/${bucket}/${encoded}`)).arrayBuffer()
    },
  }
}
