// Shared HTTP helpers for Edge Functions.

// Mirrors the headers supabase-js sends (see @supabase/supabase-js/cors), so preflights pass.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** Error body shape shared by all functions: a Hebrew message the UI can show as-is. */
export function errorJson(message_he: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ message_he, ...extra }, status)
}
