/**
 * RPKI Validation via Cloudflare RPKI API
 *
 * API: GET https://rpki.cloudflare.com/api/v1/validity/{asn}/{prefix}
 *   - 200 + JSON  → valid/invalid state from Cloudflare's ROA database
 *   - 404         → no ROA found for this prefix = "not-found" (unknown, not an error)
 *   - 403/5xx     → Cloudflare unavailable (CORS or server-side block) → return unknown
 *
 * Key fix: 404 is EXPECTED for prefixes not in the RPKI database and must
 * be treated as state="not-found" (unknown), NOT retried as a failure.
 * Retrying 404s causes the console spam seen in production.
 */

const CACHE   = new Map()   // key -> result
const PENDING = new Map()   // key -> promise (dedup in-flight requests)

export async function checkRPKI(asn, prefix) {
  const key = `${asn}:${prefix}`
  if (CACHE.has(key))   return CACHE.get(key)
  if (PENDING.has(key)) return PENDING.get(key)

  const promise = _fetchRPKI(asn, prefix, key)
  PENDING.set(key, promise)

  try {
    const result = await promise
    PENDING.delete(key)
    return result
  } catch {
    PENDING.delete(key)
    return null
  }
}

async function _fetchRPKI(asn, prefix, key) {
  // Plain ASN number (no "AS" prefix) + literal slash in prefix path
  const asnNum = String(asn).replace(/^AS/i, '')
  const url    = `https://rpki.cloudflare.com/api/v1/validity/${asnNum}/${prefix}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

    // 404 = no ROA entry for this prefix in Cloudflare's database.
    // This is DOCUMENTED behavior — treat as "not-found" / unknown.
    // Do NOT retry; do NOT log as an error.
    if (res.status === 404) {
      const result = {
        valid: false, invalid: false, unknown: true,
        state: 'not-found',
        reason: 'No Route Origin Authorization found for this prefix',
        asn, prefix,
      }
      CACHE.set(key, result)
      setTimeout(() => CACHE.delete(key), 5 * 60 * 1000)
      return result
    }

    // Other non-OK responses (403 CORS block, 5xx server error) — log once, return null
    if (!res.ok) {
      console.warn(`[SHYEN RPKI] ${prefix}: HTTP ${res.status} — skipping RPKI check`)
      return null
    }

    const data  = await res.json()
    const state = data?.result?.validity?.state ?? 'unknown'

    const result = {
      valid:   state === 'valid',
      invalid: state === 'invalid',
      unknown: state === 'unknown' || state === 'not-found',
      state,
      reason:  data?.result?.validity?.reason ?? null,
      asn, prefix,
    }

    // Cache successful results for 5 minutes
    CACHE.set(key, result)
    setTimeout(() => CACHE.delete(key), 5 * 60 * 1000)
    return result

  } catch (err) {
    // Network error / timeout — don't retry, just return null silently
    if (err.name !== 'AbortError') {
      console.warn(`[SHYEN RPKI] ${prefix}: network error — ${err.message}`)
    }
    return null
  }
}

/**
 * Pre-check RPKI for an incident immediately on creation.
 * Called from App.jsx after enrichAndAdd.
 */
export async function preCheckRPKI(incident) {
  return checkRPKI(incident.victim.asn, incident.prefix)
}
