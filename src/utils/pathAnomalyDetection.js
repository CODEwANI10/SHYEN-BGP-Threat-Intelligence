// BGP path anomaly detection — uses REAL path data, not simulated
// Called with the actual AS path array from RIPE RIS messages

const NORMAL_MAX_HOPS = 7
const SUSPICIOUS_MAX  = 10

export function checkPathAnomaly(incident) {
  // Use the real path length from RIS data if available
  const realPath = incident.path ?? []
  const hopCount = realPath.length > 0
    ? realPath.length
    : incident.confirmedPoints?.length ?? 0

  if (hopCount > SUSPICIOUS_MAX) {
    return {
      anomaly:   true,
      severity:  'HIGH',
      hopCount,
      reason:    `Abnormal AS path length: ${hopCount} hops (normal ≤ ${NORMAL_MAX_HOPS})`,
      type:      'PATH_LENGTH_ANOMALY',
    }
  }
  if (hopCount > NORMAL_MAX_HOPS) {
    return {
      anomaly:   true,
      severity:  'MEDIUM',
      hopCount,
      reason:    `Suspicious path length: ${hopCount} hops (normal ≤ ${NORMAL_MAX_HOPS})`,
      type:      'PATH_LENGTH_ANOMALY',
    }
  }
  return { anomaly: false, hopCount }
}

// Detect coordinated multi-target attacks within a time window
export function detectCoordinatedFire(incidents, windowMs = 60000) {
  const now    = Date.now()
  const recent = incidents.filter(i =>
    i.status === 'DETECTED' && now - new Date(i.timestamp).getTime() < windowMs
  )
  const byVictim = {}
  recent.forEach(i => {
    const k = i.victim.asn
    byVictim[k] = byVictim[k] || { incidents: [], victim: i.victim }
    byVictim[k].incidents.push(i)
  })
  return Object.values(byVictim)
    .filter(g => g.incidents.length >= 2)
    .map(g => ({
      victimASN:     g.victim.asn,
      victimName:    g.victim.name,
      incidentCount: g.incidents.length,
      severity:      'CRITICAL',
      type:          'COORDINATED_ATTACK',
      prefixes:      g.incidents.map(i => i.prefix),
      detectedAt:    new Date(),
    }))
}
