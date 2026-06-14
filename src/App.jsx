import { useEffect, useRef, useState } from 'react'
import { useSHYENStore }      from './store/useSHYENStore.js'
import { RIPERISConnection, scoreConfidence } from './api/ripeRIS.js'
import { autonomousDecision } from './api/autonomousAI.js'
import { preCheckRPKI }       from './api/rpkiCheck.js'
import { lookupASCountry, prewarmASCache } from './api/asLookup.js'
import { loadAPNICData, getAPNICStatus, resolveRealASN } from './api/apnic.js'
import { recordAttack, escalateSeverity } from './engine/attackMemory.js'
import { getSeverity }        from './engine/severityEngine.js'
import { hostToVantage }      from './data/vantagePoints.js'

import TopNav             from './components/layout/TopNav.jsx'
import BGPTicker          from './components/layout/BGPTicker.jsx'
import StatsBar           from './components/layout/StatsBar.jsx'
import WhatHappened        from './components/layout/WhatHappened.jsx'
import Footer              from './components/layout/Footer.jsx'
import OperationalTimeline from './components/layout/OperationalTimeline.jsx'
import IncidentList        from './components/incidents/IncidentList.jsx'
import AttackHeatmap       from './components/incidents/AttackHeatmap.jsx'
import ASNHealthGrid       from './components/asns/ASNHealthGrid.jsx'
import DetailPanel         from './components/detail/DetailPanel.jsx'
import BreachSimulator     from './components/breach/BreachSimulator.jsx'
import AINotification      from './components/shared/AINotification.jsx'
import ThreatMap           from './components/map/ThreatMap.jsx'
import Globe3D             from './components/map/Globe3D.jsx'
import CountryHistoryPage  from './components/pages/CountryHistoryPage.jsx'

let incidentIdCounter    = 100

// FIX: Per-prefix cooldown instead of global — different prefixes no longer block each other
// A rapid burst on the same prefix is still rate-limited (prevents duplicate incidents)
const PER_PREFIX_COOLDOWN = 15000  // 15s per unique prefix/origin pair
const prefixCooldowns     = new Map() // key -> last incident timestamp

const activeIncidentKeys = new Map() // `${prefix}|${originAS}` -> incidentId
const anomalyOccurrences = new Map() // `${prefix}|${originAS}` -> sighting count
const recentTickerTexts  = new Map() // ticker text -> last-shown timestamp
const TICKER_DEDUPE_MS   = 45000
const ANOMALY_PERSISTENCE_REQUIRED = 2

async function enrichAndAdd(incident, store) {
  const { addIncident, markAIDecided, markAIAnalyzing, setIncidentRPKI,
          setIncidentAttackerCountry, addActivityLog,
          setIncidentVictim, setIncidentConfidence } = store
  const memory = recordAttack(incident)
  const enriched = {
    ...incident,
    severity:         escalateSeverity(incident.severity, memory.isRepeat),
    isRepeatAttacker: memory.isRepeat,
    repeatCount:      memory.attackCount,
  }
  addIncident(enriched)

  preCheckRPKI(enriched).then(rpki => {
    if (rpki) {
      setIncidentRPKI(enriched.id, rpki)
      const label = rpki.valid ? 'RPKI VALID' : rpki.invalid ? 'RPKI INVALID — vulnerable' : 'RPKI UNKNOWN'
      addActivityLog?.(rpki.valid ? 'SUCCESS' : 'INFO', `RPKI check (${enriched.prefix}): ${label}`, enriched.id)

      // FIX: Re-score confidence now that we have real RPKI data
      // RPKI invalid = very high confidence it's a hijack
      // RPKI valid   = lower confidence (may be legitimate)
      const rpkiState = rpki.invalid ? 'invalid' : rpki.valid ? 'valid' : 'not-found'
      const updatedConf = Math.min(99, Math.round(
        scoreConfidence(
          { pathAnomaly: enriched.pathAnomaly, prependCount: 0,
            isExpectedOrigin: false, prefix: enriched.prefix,
            matchedASN: enriched.victim,
            hasSuspiciousCommunity: false, hasBlackholeComm: false },
          rpkiState
        ) + (enriched.confirmedPoints?.length > 1 ? 10 : 0)
      ))
      if (updatedConf !== enriched.confidence) {
        store.setIncidentConfidence?.(enriched.id, updatedConf)
        addActivityLog?.('INFO', `Confidence updated: ${enriched.confidence}% → ${updatedConf}% (RPKI ${rpkiState})`, enriched.id)
      }
    }
  })

  // Resolve attacker country if unknown (real incidents come in with '??')
  if (enriched.attacker?.country === '??') {
    lookupASCountry(enriched.attacker.asn).then(result => {
      if (result?.country && result.country !== 'XX') {
        setIncidentAttackerCountry(enriched.id, result.country)
        addActivityLog?.('INFO', `Resolved attacker origin: ${enriched.attacker.asn} → ${result.country}`, enriched.id)
      }
    })
  }

  // FIX: Resolve unknown victim ASN via RIPE Stat prefix-overview
  // This prevents "Unknown Indian ISP" / "Indian Network" from sticking as the victim name
  if (enriched.victim?.isUnknown && enriched.prefix) {
    resolveRealASN(enriched.prefix).then(result => {
      if (result) {
        const resolvedVictim = {
          ...enriched.victim,
          asn:  result.asn,
          name: result.holder || enriched.victim.name,
          isUnknown: false,
        }
        store.setIncidentVictim?.(enriched.id, resolvedVictim)
        addActivityLog?.('INFO', `Resolved victim: ${enriched.prefix} → ${result.asn} (${result.holder})`, enriched.id)
      }
    })
  }

  // Fire autonomous AI for all real incidents
  // - >= 60% confidence + 2+ vantage points: full autonomous mode (decides AND acts)
  // - < 60%: alert mode (warns and recommends safeguards)
  // Simulated incidents skip AI to avoid wasting Groq tokens
  const threshold = enriched.isSimulated ? 999 : 1 // all real incidents get AI
  if (enriched.confidence >= threshold) {
    autonomousDecision(enriched, () => markAIAnalyzing(enriched.id))
      .then(d => { if (d) markAIDecided(enriched.id, d) })
  }

  return enriched.id
}

export default function App() {
  const store = useSHYENStore()
  const {
    incidents, selectedIncidentId,
    addIncident, selectIncident,
    addTickerEntry, setSystemTime,
    setActiveTab, activeTab,
    setRisStatus, setRisError, incrementRisStats,
    markAIDecided, markAIAnalyzing, setIncidentRPKI, setIncidentAttackerCountry, addActivityLog,
    addVantageConfirmation,
    setAPNICLoaded,
    setIncidentVictim,
  } = store

  const [showBreach,      setShowBreach]      = useState(false)
  const [apnicReady,      setApnicReady]       = useState(false)
  const [selectedCountry, setSelectedCountry]  = useState(null)
  const [historyCountry,  setHistoryCountry]   = useState(null)
  const [view3D,          setView3D]           = useState(true) // 2D/3D map toggle

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId) ?? null
  const risRef = useRef(null)

  const filteredIncidents = selectedCountry
    ? incidents.filter(i => i.attacker?.country === selectedCountry)
    : incidents

  useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) selectIncident(incidents[0].id)
  }, [incidents.length])

  // Garbage-collect activeIncidentKeys once their incident is mitigated
  useEffect(() => {
    for (const [key, id] of activeIncidentKeys.entries()) {
      const inc = incidents.find(i => i.id === id)
      if (!inc || inc.status === 'MITIGATED') activeIncidentKeys.delete(key)
    }
  }, [incidents])

  useEffect(() => {
    loadAPNICData().then(() => {
      const { prefixCount } = getAPNICStatus()
      setAPNICLoaded(prefixCount)
      setApnicReady(true)
    })
    // Pre-warm AS country cache so demo lookups feel instant
    prewarmASCache()
  }, [])

  useEffect(() => {
    if (!apnicReady) return
    const ris = new RIPERISConnection({
      onStatusChange: setRisStatus,
      onError: msg => { setRisError(msg); console.warn('[SHYEN RIS]', msg) },
      onEntry: entry => {
        // Ticker dedupe — don't spam identical "ANOMALY: ..." lines every few seconds
        const lastShown = recentTickerTexts.get(entry.text)
        const now = Date.now()
        const isDuplicateTicker = lastShown && (now - lastShown < TICKER_DEDUPE_MS)
        if (!isDuplicateTicker) {
          recentTickerTexts.set(entry.text, now)
          addTickerEntry({ text: entry.text, suspicious: entry.isSuspicious, timestamp: entry.timestamp, realData: true })
        }
        incrementRisStats()
        if (!entry.isSuspicious || !entry.matchedASN) return

        const key = `${entry.prefix}|${entry.originAS}`

        // If this prefix/origin combo already has an active incident,
        // treat this as ANOTHER real RIS collector confirming it —
        // grow the vantage matrix instead of spamming new incidents.
        if (activeIncidentKeys.has(key)) {
          addVantageConfirmation(activeIncidentKeys.get(key), hostToVantage(entry.host))
          return
        }

        // Path anomalies (too short/too long AS path) are rare and
        // meaningful per-message — act immediately. Plain origin
        // mismatches are common with multi-homed/customer routes, so
        // require the SAME mismatch to be seen more than once before
        // raising an incident (cuts false-positive noise).
        if (!entry.pathAnomaly) {
          const seen = (anomalyOccurrences.get(key) ?? 0) + 1
          anomalyOccurrences.set(key, seen)
          if (seen < ANOMALY_PERSISTENCE_REQUIRED) return
        }

        // Per-prefix rate limit — different prefixes can create incidents simultaneously
        const lastForPrefix = prefixCooldowns.get(key) ?? 0
        if (now - lastForPrefix < PER_PREFIX_COOLDOWN) return
        prefixCooldowns.set(key, now)

        // FIX: Deterministic attack type from real BGP data, not random
        // ORIGIN_HIJACK: different AS announces our prefix
        // SUBPREFIX_HIJACK: more specific prefix announced (hijackers win routing)
        // ROUTE_LEAK: unexpected origin but not clearly hijack (multi-homed case)
        // PATH_MANIPULATION: abnormal AS path length
        function detectAttackType(entry) {
          if (entry.pathAnomaly === 'PATH_TOO_SHORT') return 'ORIGIN_HIJACK'   // missing hops = spoofed
          if (entry.pathAnomaly === 'PATH_TOO_LONG')  return 'PATH_MANIPULATION'
          const prefixBits = parseInt(entry.prefix?.split('/')[1] ?? '0')
          const expectedBits = parseInt(entry.matchedASN?.prefixes?.[0]?.split('/')[1] ?? '0')
          if (prefixBits > expectedBits + 4) return 'SUBPREFIX_HIJACK'  // more specific = hijack wins
          return 'ORIGIN_HIJACK'  // different origin AS = classic hijack
        }
        const type = detectAttackType(entry)

        const newId = ++incidentIdCounter
        activeIncidentKeys.set(key, newId)

        enrichAndAdd({
          id: newId, type,
          severity: getSeverity(type, entry.matchedASN.sector),
          victim: entry.matchedASN,
          attacker: { asn: entry.originAS, name: entry.originAS, country: '??' },
          prefix: entry.prefix,
          confirmedPoints: [hostToVantage(entry.host)],
          timestamp: entry.timestamp,
          status: 'DETECTED',
          rpkiPushed: false, ixpAlerted: false, forensicsReady: false,
          affectedIPs: (() => {
            // FIX: Calculate real IP count from prefix size
            const bits = parseInt(entry.prefix?.split('/')[1] ?? '24')
            return Math.pow(2, 32 - bits) // e.g. /24 = 256, /16 = 65536
          })(),
          // FIX: Real confidence from BGP signals — not random
          confidence: Math.min(99, Math.round(
            (entry.rawConfidence ?? 55) +
            (entry.confirmedPoints?.length > 1 ? 10 : 0)
          )),
          isRealData: true, isSimulated: false,
          pathAnomaly: entry.pathAnomaly ?? null,
        }, { addIncident, markAIDecided, markAIAnalyzing, setIncidentRPKI, setIncidentAttackerCountry, addActivityLog })
      },
      onWithdrawal: entry => {
        addTickerEntry({ text: entry.text, suspicious: false, timestamp: entry.timestamp, realData: true, isWithdrawal: true })
        incrementRisStats()
      },
    })
    risRef.current = ris
    ris.connect()
    return () => ris.disconnect()
  }, [apnicReady])

  useEffect(() => {
    const t = setInterval(() => setSystemTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const fn = e => { if ((e.key==='b'||e.key==='B') && e.target.tagName!=='INPUT') setShowBreach(true) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  function onBreachIncident(inc) {
    const sim = { ...inc, id: ++incidentIdCounter, isRealData:false, isSimulated:true, status:'DETECTED', rpkiPushed:false, ixpAlerted:false, forensicsReady:false }
    enrichAndAdd(sim, { addIncident, markAIDecided, markAIAnalyzing, setIncidentRPKI, setIncidentAttackerCountry, addActivityLog })
    setTimeout(() => selectIncident(sim.id), 100)
  }

  return (
    <div style={{
      height:'100vh', display:'flex', flexDirection:'column',
      position:'relative', overflow:'hidden',
      background:`radial-gradient(ellipse at 20% 50%, rgba(0,255,136,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,45,85,0.05) 0%, transparent 50%), #060a0f`,
    }}>
      <div style={{ position:'fixed', inset:0, opacity:0.05, pointerEvents:'none', zIndex:0,
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='%2300ff88' stroke-width='0.5'/%3E%3C/svg%3E")`,
      }} />

      <TopNav onBreachClick={() => setShowBreach(true)} />
      <BGPTicker />
      <StatsBar />
      <WhatHappened />

      <main style={{ flex:1, display:'grid', gridTemplateColumns:'330px 1fr 360px', overflow:'hidden', position:'relative', zIndex:5 }}>

        {/* LEFT — Incident list + heatmap */}
        <div style={{ borderRight:'1px solid var(--border-subtle)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ flex:'1 1 60%', minHeight:0, borderBottom:'1px solid var(--border-subtle)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'10px 10px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:12, fontWeight:700 }}>LIVE THREAT FEED</div>
              {selectedCountry && (
                <button onClick={() => setSelectedCountry(null)} style={{
                  fontFamily:'var(--font-mono)', fontSize:8, color:'var(--accent-red)',
                  background:'rgba(255,45,85,0.08)', border:'1px solid rgba(255,45,85,0.25)',
                  borderRadius:3, padding:'2px 8px', cursor:'pointer', letterSpacing:1,
                }}>
                  {selectedCountry} ✕
                </button>
              )}
            </div>
            <IncidentList filteredIncidents={filteredIncidents} />
          </div>
          <div style={{ flex:'0 0 auto', maxHeight:'40%', overflowY:'auto' }}>
            <AttackHeatmap />
          </div>
        </div>

        {/* CENTER — Map/Globe + ASN health + timeline */}
        <div style={{ overflowY:'auto', borderRight:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:12 }}>
            <div style={{ background: 'rgba(6,10,15,0.9)', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>

              {/* Header with 2D/3D toggle */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700 }}>
                    {view3D ? 'GLOBAL BGP THREAT GLOBE' : 'GLOBAL BGP THREAT MAP'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
                    {view3D ? 'Drag to rotate · click a marker for recent attacks & full history' : 'Live attack visualization · click a node to filter incidents'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  {[
                    { key: true,  label: '🌐 3D' },
                    { key: false, label: '🗺 2D' },
                  ].map(opt => (
                    <button key={String(opt.key)} onClick={() => setView3D(opt.key)} style={{
                      fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.05em',
                      padding:'4px 10px', borderRadius:3, cursor:'pointer',
                      background: view3D === opt.key ? 'var(--accent-green)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${view3D === opt.key ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                      color: view3D === opt.key ? '#000' : 'var(--text-muted)',
                      transition:'all 0.15s',
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Map / Globe body */}
              {view3D
                ? <Globe3D onViewHistory={setHistoryCountry} onCountryClick={setSelectedCountry} />
                : <ThreatMap onCountryClick={setSelectedCountry} selectedCountry={selectedCountry} />
              }

              {view3D && <GlobeStats incidents={incidents} />}
            </div>
          </div>
          <div style={{ borderTop:'1px solid var(--border-subtle)' }}>
            <ASNHealthGrid />
          </div>
          <OperationalTimeline />
        </div>

        {/* RIGHT — AI SOC Analyst detail panel */}
        <div style={{ overflowY:'auto', padding:16, background:'rgba(6,10,15,0.3)' }}>
          {selectedIncident ? <DetailPanel incident={selectedIncident} /> : <EmptyState apnicReady={apnicReady} />}
        </div>
      </main>

      <Footer />
      <AINotification />
      {showBreach && <BreachSimulator onClose={() => setShowBreach(false)} onIncidentGenerated={onBreachIncident} />}
      {historyCountry && (
        <CountryHistoryPage countryCode={historyCountry} onBack={() => setHistoryCountry(null)} />
      )}
    </div>
  )
}

// Stats strip below the globe — mirrors the 2D map's footer stats
function GlobeStats({ incidents }) {
  const SEV_ORDER = ['CRITICAL','HIGH','MEDIUM','LOW']
  const attackMap = new Map()
  let unresolved = 0
  for (const inc of incidents) {
    if (inc.status === 'MITIGATED') continue
    const c = inc.attacker?.country
    if (!c || c === '??') { unresolved++; continue }
    const ex = attackMap.get(c)
    if (!ex || SEV_ORDER.indexOf(inc.severity) < SEV_ORDER.indexOf(ex.severity)) attackMap.set(c, inc)
  }
  const attacks = Array.from(attackMap.entries())
  const avgConf = attacks.length ? Math.round(attacks.reduce((s,[,a]) => s + a.confidence, 0) / attacks.length) : 0

  return (
    <>
      <div style={{ display:'flex', borderTop:'1px solid var(--border-subtle)' }}>
        {[
          ['Attack Origins', attacks.length],
          ['Active Attacks', attacks.length + unresolved],
          ['Avg Confidence', attacks.length ? `${avgConf}%` : '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ flex:1, padding:'8px 0', textAlign:'center', borderRight:'1px solid var(--border-subtle)' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{value}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', letterSpacing:1 }}>{label}</div>
          </div>
        ))}
      </div>
      {unresolved > 0 && (
        <div style={{ padding:'5px 16px', borderTop:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#ffd60a', animation:'termBlink 1.2s ease infinite' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
            Resolving origin for {unresolved} incident{unresolved > 1 ? 's' : ''} via RIPE STAT...
          </span>
        </div>
      )}
    </>
  )
}

function EmptyState({ apnicReady }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16 }}>
      <div style={{ width:48, height:48, border:'1px solid rgba(0,255,136,0.15)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background: apnicReady ? 'var(--accent-green)' : '#ffd60a', animation:'pulse 2s ease infinite', boxShadow:`0 0 8px ${apnicReady ? 'var(--accent-green)' : '#ffd60a'}` }} />
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', letterSpacing:2, marginBottom:6 }}>
          {apnicReady ? 'MONITORING LIVE BGP FEED' : 'LOADING PREFIX DATABASE...'}
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#222', letterSpacing:1, lineHeight:1.8 }}>
          {apnicReady ? <>Select an incident · Press <span style={{color:'#ff2d55'}}>B</span> to simulate</> : 'Fetching APNIC delegation file...'}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
