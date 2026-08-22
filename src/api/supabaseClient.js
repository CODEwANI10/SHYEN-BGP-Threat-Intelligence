/**
 * Supabase client — lightweight fetch wrapper, no @supabase/supabase-js
 * dependency needed. Talks directly to Supabase's PostgREST REST API.
 *
 * Mirrors the fail-soft pattern used elsewhere in src/api/ (apnic.js,
 * ripeRIS.js): every write is fire-and-forget from the caller's point of
 * view — a network hiccup or misconfigured key must never break the live
 * dashboard or the demo. Failures are logged to console and swallowed.
 *
 * Tables (see supabase-schema.sql):
 *   incidents      — every detected/demo incident
 *   change_log     — structured before/after diffs (actions, AI decisions, sessions)
 *   chat_messages  — Admin AI chat history
 *   activity_log   — human-readable activity feed entries
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)

if (!supabaseEnabled) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — backend sync disabled, app runs local-only.')
}

function headers(extra = {}) {
  return {
    apikey:        SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

/**
 * Fire-and-forget insert. Never throws — logs a warning and resolves
 * false on failure so callers can call this without awaiting or
 * try/catching every time.
 */
export async function sbInsert(table, row) {
  if (!supabaseEnabled) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body:    JSON.stringify(row),
      signal:  AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      console.warn(`[supabase] insert into ${table} failed: HTTP ${res.status} ${await res.text().catch(() => '')}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[supabase] insert into ${table} failed:`, err?.message ?? err)
    return false
  }
}

/** Same as sbInsert but for multiple rows in one request (used for bulk demo seeding). */
export async function sbInsertMany(table, rows) {
  if (!supabaseEnabled || !rows?.length) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body:    JSON.stringify(rows),
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[supabase] bulk insert into ${table} failed: HTTP ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[supabase] bulk insert into ${table} failed:`, err?.message ?? err)
    return false
  }
}

/** Update row(s) matching `match` (e.g. { id: 'abc' }) with `patch` fields. */
export async function sbUpdate(table, match, patch) {
  if (!supabaseEnabled) return false
  try {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(match)) qs.set(k, `eq.${v}`)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs.toString()}`, {
      method:  'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body:    JSON.stringify(patch),
      signal:  AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      console.warn(`[supabase] update on ${table} failed: HTTP ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[supabase] update on ${table} failed:`, err?.message ?? err)
    return false
  }
}

/** Read rows, optionally ordered/limited. order example: 'created_at.desc' */
export async function sbSelect(table, { order, limit, select = '*' } = {}) {
  if (!supabaseEnabled) return []
  try {
    const qs = new URLSearchParams({ select })
    if (order) qs.set('order', order)
    if (limit) qs.set('limit', String(limit))
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs.toString()}`, {
      method:  'GET',
      headers: headers(),
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[supabase] select on ${table} failed: HTTP ${res.status}`)
      return []
    }
    return await res.json()
  } catch (err) {
    console.warn(`[supabase] select on ${table} failed:`, err?.message ?? err)
    return []
  }
}
