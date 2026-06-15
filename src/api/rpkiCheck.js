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
  // Guard: skip RPKI for unknown/placeholder ASNs — they produce junk URLs
  // e.g. asn='AS-IN-UNKNOWN' → URL becomes /validity/-IN-UNKNOWN/... → 404 spam
  const asnStr = String(asn)
  if (!asn || asnStr.includes('UNKNOWN') || asnStr.includes('AS-IN') || asnStr === 'AS-UNKNOWN-IN') {
    return null
  }

  // Plain ASN number (no "AS" prefix) + literal slash in prefix path
  const asnNum = asnStr.replace(/^AS/i, '')
  // Must be a pure numeric ASN — reject anything else
  if (!/^\d+$/.test(asnNum)) {
    console.warn(`[SHYEN RPKI] Skipping invalid ASN: ${asn}`)
    return null
  }
  const url    = `https://rpki.cloudflare.com/api/v1/validity/${asnNum}/${prefix}`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      // mode:'cors' is default; if CORS blocks (e.g. some Cloudflare RPKI paths),
      // the browser logs a network error regardless of JS catch. We silence this
      // by checking the cache first (done above) and only fetching on cache miss.
    })

    // 404 = no ROA entry for this prefix in Cloudflare's database.
    // This is DOCUMENTED behavior — treat as "not-found" / unknown.
    // Cache for 15 min (longer than valid results) to prevent repeat network requests.
    if (res.status === 404) {
      const result = {
        valid: false, invalid: false, unknown: true,
        state: 'not-found',
        reason: 'No Route Origin Authorization found for this prefix',
        asn, prefix,
      }
      CACHE.set(key, result)
      setTimeout(() => CACHE.delete(key), 15 * 60 * 1000)  // 15 min cache for 404s
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
