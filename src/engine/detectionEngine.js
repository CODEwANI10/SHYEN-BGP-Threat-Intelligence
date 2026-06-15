/**
 * detectAnomaly — simulates the BGP anomaly detection pipeline.
 * In production this would parse real BGP UPDATE messages.
 */
export function detectAnomaly(tickerEntry, indianASNs) {
  if (!tickerEntry.suspicious) return null
  // Parse "⚠ ANOMALY: <prefix> via <foreignASN> [<country>] — expected <indianASN>"
  const match = tickerEntry.text.match(/ANOMALY: (\S+) via (\S+) \[(\w+)\] — expected (\S+)/)
  if (!match) return null
  const [, prefix, foreignASN, country, expectedASN] = match
  const victim = indianASNs.find(a => a.asn === expectedASN)
  return victim ? { prefix, foreignASN, country, victim } : null
}
