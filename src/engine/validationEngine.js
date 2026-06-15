/**
 * validateIncident — confirms an incident is real by checking how many
 * vantage points observed it. Minimum 4 confirmations required.
 */
export function validateIncident(incident, vantagePoints) {
  const confidenceMap = { 4: 70, 5: 80, 6: 88, 7: 94, 8: 99 }
  const n = (incident.confirmedPoints ?? []).length

  if (n < 4) return null   // not enough confirmations — discard

  return {
    ...incident,
    confidence: confidenceMap[n] ?? 70,
  }
}
