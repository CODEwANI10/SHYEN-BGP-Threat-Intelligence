import { INDIAN_ASNS } from './indianASNs.js'
import { FOREIGN_ASNS } from './foreignASNs.js'
import { VANTAGE_POINTS } from './vantagePoints.js'
import { getSeverity } from '../engine/severityEngine.js'

const ATTACK_TYPES = ['ORIGIN_HIJACK', 'SUBPREFIX_HIJACK', 'ROUTE_LEAK', 'PATH_MANIPULATION']

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function pick(arr)   { return arr[rand(0, arr.length - 1)] }

function getConfidenceFromPoints(n) {
  const map = { 4: 70, 5: 80, 6: 88, 7: 94, 8: 99 }
  return map[n] ?? 70
}

export function generateTickerEntry() {
  const suspicious = Math.random() < 0.15
  const ia = pick(INDIAN_ASNS)
  const fa = pick(FOREIGN_ASNS)
  if (suspicious) {
    return {
      text: `⚠ ANOMALY: ${pick(ia.prefixes)} via ${fa.asn} [${fa.country}] — expected ${ia.asn}`,
      suspicious: true,
      timestamp: new Date(),
    }
  }
  return {
    text: `BGP UPDATE: ${ia.asn} announces ${pick(ia.prefixes)} — ${rand(8, 12)} AS hops`,
    suspicious: false,
    timestamp: new Date(),
  }
}

let _idCounter = 0
export function generateIncident(id, tsOverride) {
  const victim   = pick(INDIAN_ASNS)
  const attacker = pick(FOREIGN_ASNS)
  const type     = pick(ATTACK_TYPES)
  const nPts     = rand(4, 8)
  const confirmedPoints = [...VANTAGE_POINTS].sort(() => Math.random() - 0.5).slice(0, nPts)

  return {
    id: id ?? ++_idCounter,
    type,
    severity:        getSeverity(type, victim.sector),
    victim,
    attacker,
    prefix:          pick(victim.prefixes),
    confirmedPoints,
    timestamp:       tsOverride ?? new Date(),
    status:          'DETECTED',
    rpkiPushed:      false,
    ixpAlerted:      false,
    forensicsReady:  false,
    affectedIPs:     rand(256, 65000),
    confidence:      getConfidenceFromPoints(nPts),
  }
}

export function resetIdCounter(n = 0) { _idCounter = n }
