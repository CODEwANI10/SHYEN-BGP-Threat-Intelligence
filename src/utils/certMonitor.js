// Feature #76 #77 — Certificate Transparency monitoring via crt.sh
const INDIAN_BANK_DOMAINS = [
  'sbi.co.in','hdfcbank.com','icicibank.com','axisbank.com',
  'pnb.co.in','bankofbaroda.com','uidai.gov.in','rbi.org.in',
  'npci.org.in','incometax.gov.in',
]
const TRUSTED_CAS = ['DigiCert','Let\'s Encrypt','GlobalSign','Sectigo','GoDaddy','Amazon','Google Trust','Comodo','Entrust']

export async function fetchCertEvents(domain) {
  try {
    const r = await fetch(
      `https://crt.sh/?q=${encodeURIComponent('%25.' + domain)}&output=json&limit=8`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return []
    const certs = await r.json()
    const cutoff = Date.now() - 7 * 86400000 // last 7 days
    return certs
      .filter(c => new Date(c.not_before).getTime() > cutoff)
      .map(c => {
        const trusted = TRUSTED_CAS.some(ca => (c.issuer_name || '').includes(ca))
        return {
          domain, id: c.id,
          commonName: c.common_name,
          issuer:     (c.issuer_name || 'Unknown').slice(0, 80),
          issuedAt:   c.not_before,
          suspicious: !trusted,
          severity:   !trusted ? 'HIGH' : 'LOW',
        }
      })
  } catch { return [] }
}

export async function runCertSentinel() {
  const results = []
  for (const domain of INDIAN_BANK_DOMAINS.slice(0, 5)) {
    const certs = await fetchCertEvents(domain)
    results.push(...certs)
    await new Promise(r => setTimeout(r, 400))
  }
  return results
}

// Feature #77 — Coordinated attack: BGP hijack + fraudulent cert on same domain
export function detectCoordinatedAttack(incidents, certEvents) {
  const coordinated = []
  for (const inc of incidents.filter(i => i.status === 'DETECTED')) {
    const sectorDomains = {
      Financial:  ['sbi.co.in','hdfcbank.com','icicibank.com','npci.org.in'],
      Government: ['uidai.gov.in','incometax.gov.in','rbi.org.in'],
    }
    const domains = sectorDomains[inc.victim.sector] || []
    const suspCert = certEvents.find(c => c.suspicious && domains.includes(c.domain))
    if (suspCert) {
      coordinated.push({
        incidentId:  inc.id,
        victim:      inc.victim,
        prefix:      inc.prefix,
        domain:      suspCert.domain,
        certIssuer:  suspCert.issuer,
        severity:    'CRITICAL',
        detectedAt:  new Date(),
        type:        'COORDINATED_ATTACK',
      })
    }
  }
  return coordinated
}
