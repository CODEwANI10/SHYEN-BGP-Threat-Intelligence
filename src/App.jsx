import { useEffect, useState } from 'react'
import { useSHYENStore }      from './store/useSHYENStore.js'
import { RIPERISConnection, scoreConfidence } from './api/ripeRIS.js'
import { autonomousDecision } from './api/autonomousAI.js'
import { preCheckRPKI }       from './api/rpkiCheck.js'
import { lookupASCountry, prewarmASCache } from './api/asLookup.js'
import { loadAPNICData, getAPNICStatus, resolveRealASN } from './api/apnic.js'
import { recordAttack, escalateSeverity } from './engine/attackMemory.js'
import { getMitigationDelay, executeDeterministicMitigation, buildDeterministicSummary } from './engine/autonomousActions.js'
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
import PanelErrorBoundary  from './components/shared/PanelErrorBoundary.jsx'
import ThreatMap           from './components/map/ThreatMap.jsx'
import Globe3D             from './components/map/Globe3D.jsx'
import CountryHistoryPage  from './components/pages/CountryHistoryPage.jsx'

let incidentIdCounter    = 100

// ── Incident rate limiting ────────────────────────────────────────────────
const PER_PREFIX_COOLDOWN        = 10000   // 10s per unique prefix/origin pair (fast churn)
const MIN_CONFIDENCE_TO_INCIDENT = 30      // lower gate — show more real signals
const ANOMALY_PERSISTENCE_REQUIRED = 1     // act on first sighting — no suppression

// Global rolling-window cap: max 150 new incidents per 60s across ALL prefixes.
// As soon as one is resolved (MITIGATED), it frees a slot for the next.
const GLOBAL_RATE_WINDOW = 60000
const GLOBAL_RATE_MAX    = 150            // 150 attacks per minute
const globalIncidentTimes = []  // rolling timestamp buffer

const prefixCooldowns    = new Map() // key -> last incident timestamp

const activeIncidentKeys = new Map() // `${prefix}|${originAS}` -> incidentId
const anomalyOccurrences = new Map() // `${prefix}|${originAS}` -> sighting count
const recentTickerTexts  = new Map() // ticker text -> last-shown timestamp
const TICKER_DEDUPE_MS   = 45000

async function enrichAndAdd(incident) {
  // Always pull fresh store state — never rely on a passed-in object that may be stale
  const store                      = useSHYENStore.getState()
  const addIncident                = store.addIncident
  const markAIDecided              = store.markAIDecided
  const markAIAnalyzing            = store.markAIAnalyzing
  const setIncidentRPKI            = store.setIncidentRPKI
  const setIncidentAttackerCountry = store.setIncidentAttackerCountry
  const addActivityLog             = store.addActivityLog
  const setIncidentVictim          = store.setIncidentVictim
  const setIncidentConfidence      = store.setIncidentConfidence

  const memory  = recordAttack(incident)
  const enriched = {
    ...incident,
    severity:             escalateSeverity(incident.severity, memory.isRepeat),
    isRepeatAttacker:     memory.isRepeat,
    repeatCount:          memory.attackCount,
    deterministicSummary: buildDeterministicSummary(incident),
  }

  // Add incident as ACTIVE — appears on dashboard immediately
  addIncident(enriched)

  // ── AUTONOMOUS PLAYBOOK — fires after a realistic response delay ──────────
  const delay = getMitigationDelay(enriched.severity, enriched.isRepeatAttacker)
  setTimeout(() => {
    const freshStore = useSHYENStore.getState()
    const current    = freshStore.incidents.find(i => i.id === enriched.id)
    if (!current || current.status === 'MITIGATED') return  // already handled (e.g. by AI)
    const { updated, actions } = executeDeterministicMitigation(current)
    useSHYENStore.setState(s => ({
      incidents: s.incidents.map(i => i.id === enriched.id ? updated : i),
      activityLog: [...s.activityLog, {
        id: Date.now(), level: 'SUCCESS',
        message: `AUTONOMOUS MITIGATION [${actions.map(a => a.label).join(' + ')}] · ${enriched.victim?.name} · TTM ${(delay / 1000).toFixed(1)}s`,
        incidentId: enriched.id,
        timestamp: new Date().toISOString(),
      }].slice(-80),
    }))
  }, delay)

  // ── RPKI check — skip for simulated or unknown ASNs ──────────────────────
  if (!enriched.isSimulated && enriched.victim?.asn && !enriched.victim.asn.includes('UNKNOWN') && !enriched.victim?.isUnknown) {
    preCheckRPKI(enriched).then(rpki => {
      if (!rpki) return
      // Use fresh store ref — enriched.id is stable, store refs may have changed
      useSHYENStore.getState().setIncidentRPKI(enriched.id, rpki)
      const label = rpki.valid ? 'RPKI VALID' : rpki.invalid ? 'RPKI INVALID — vulnerable' : 'RPKI UNKNOWN'
      useSHYENStore.getState().addActivityLog?.(rpki.valid ? 'SUCCESS' : 'INFO', `RPKI check (${enriched.prefix}): ${label}`, enriched.id)

      const rpkiState   = rpki.invalid ? 'invalid' : rpki.valid ? 'valid' : 'not-found'
      const vantageBonus = Math.min((enriched.confirmedPoints?.length ?? 1) - 1, 4) * 5
      const updatedConf = Math.min(99, Math.round(
        scoreConfidence(
          {
            pathAnomaly:           enriched.pathAnomaly,
            prependCount:          enriched.prependCount ?? 0,
            isExpectedOrigin:      enriched.victim?.asn === enriched.attacker?.asn,
            prefix:                enriched.prefix,
            matchedASN:            enriched.victim,
            hasSuspiciousCommunity: enriched.hasSuspiciousCommunity ?? false,
            hasBlackholeComm:      enriched.hasBlackholeComm ?? false,
          },
          rpkiState
        ) + vantageBonus
      ))
      if (updatedConf !== enriched.confidence) {
        useSHYENStore.getState().setIncidentConfidence?.(enriched.id, updatedConf)
        useSHYENStore.getState().addActivityLog?.('INFO', `Confidence updated: ${enriched.confidence}% → ${updatedConf}% (RPKI ${rpkiState})`, enriched.id)
      }
    })
  }

  // ── Resolve attacker country ──────────────────────────────────────────────
  if (!enriched.isSimulated && enriched.attacker?.country === '??') {
    lookupASCountry(enriched.attacker.asn).then(result => {
      if (result?.country && result.country !== 'XX') {
        useSHYENStore.getState().setIncidentAttackerCountry(enriched.id, result.country)
        useSHYENStore.getState().addActivityLog?.('INFO', `Resolved attacker origin: ${enriched.attacker.asn} → ${result.country}`, enriched.id)
      }
    })
  }

  // ── Resolve victim ASN when unknown ──────────────────────────────────────
  if (!enriched.isSimulated && enriched.victim?.isUnknown && enriched.prefix) {
    resolveRealASN(enriched.prefix).then(result => {
      if (result) {
        const resolvedVictim = {
          ...enriched.victim,
          asn:       result.asn,
          name:      result.holder || enriched.victim.name,
          isUnknown: false,
        }
        useSHYENStore.getState().setIncidentVictim?.(enriched.id, resolvedVictim)
        useSHYENStore.getState().addActivityLog?.('INFO', `Resolved victim: ${enriched.prefix} → ${result.asn} (${result.holder})`, enriched.id)
      }
    })
  }

  // ── Autonomous AI — skip for simulated incidents to save Groq tokens ─────
  if (!enriched.isSimulated) {
    autonomousDecision(enriched, () => useSHYENStore.getState().markAIAnalyzing(enriched.id))
      .then(d => { if (d) useSHYENStore.getState().markAIDecided(enriched.id, d) })
  }

  return enriched.id
}

function detectAttackType(entry) {
  if (entry.pathAnomaly === 'PATH_TOO_SHORT') return 'ORIGIN_HIJACK'
  if (entry.pathAnomaly === 'PATH_TOO_LONG')  return 'PATH_MANIPULATION'
  const prefixBits   = parseInt(entry.prefix?.split('/')[1] ?? '0')
  const expectedBits = parseInt(entry.matchedASN?.prefixes?.[0]?.split('/')[1] ?? '0')
  if (prefixBits > expectedBits + 4) return 'SUBPREFIX_HIJACK'
  return 'ORIGIN_HIJACK'
}

export default function App() {
  // Selective store subscriptions — do NOT subscribe to full store here.
  // `useSHYENStore()` (no selector) re-renders App on EVERY store mutation,
  // including setSystemTime which fires every 1s. That causes selectedIncident
  // to be recomputed and passed as a new object to DetailPanel every second,
  // massively increasing the chance of hitting transient render errors that black the panel.
  const incidents           = useSHYENStore(s => s.incidents)
  const selectedIncidentId  = useSHYENStore(s => s.selectedIncidentId)
  const selectIncident      = useSHYENStore(s => s.selectIncident)
  const addTickerEntry      = useSHYENStore(s => s.addTickerEntry)
  const setSystemTime       = useSHYENStore(s => s.setSystemTime)
  const setRisStatus        = useSHYENStore(s => s.setRisStatus)
  const setRisError         = useSHYENStore(s => s.setRisError)
  const incrementRisStats   = useSHYENStore(s => s.incrementRisStats)
  const markAIDecided       = useSHYENStore(s => s.markAIDecided)
  const markAIAnalyzing     = useSHYENStore(s => s.markAIAnalyzing)
  const setIncidentRPKI     = useSHYENStore(s => s.setIncidentRPKI)
  const setIncidentAttackerCountry = useSHYENStore(s => s.setIncidentAttackerCountry)
  const addActivityLog      = useSHYENStore(s => s.addActivityLog)
  const addVantageConfirmation = useSHYENStore(s => s.addVantageConfirmation)
  const setAPNICLoaded      = useSHYENStore(s => s.setAPNICLoaded)
  const addIncident         = useSHYENStore(s => s.addIncident)

  // NOTE: enrichAndAdd and RIS callbacks call useSHYENStore.getState() directly
  // to always get fresh state — no stale closure risk.

  const [showBreach,      setShowBreach]      = useState(false)
  const [apnicReady,      setApnicReady]       = useState(false)
  const [selectedCountry, setSelectedCountry]  = useState(null)
  const [historyCountry,  setHistoryCountry]   = useState(null)
  const [view3D,          setView3D]           = useState(true) // 2D/3D map toggle

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId) ?? null
  const filteredIncidents = selectedCountry
    ? incidents.filter(i => i.attacker?.country === selectedCountry)
    : incidents

  useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) selectIncident(incidents[0].id)
  }, [incidents.length])

  // Garbage-collect activeIncidentKeys once their incident is mitigated
  // and remove their timestamp from the global rate window so a new
  // attack can immediately take the freed slot (150/min cap is slot-based).
  useEffect(() => {
    for (const [key, id] of activeIncidentKeys.entries()) {
      const inc = incidents.find(i => i.id === id)
      if (!inc || inc.status === 'MITIGATED') {
        activeIncidentKeys.delete(key)
        // Remove one timestamp entry to free a slot in the global window
        if (globalIncidentTimes.length > 0) globalIncidentTimes.shift()
      }
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
        // Always use fresh store state — avoids stale closure from React hook snapshot
        const store = useSHYENStore.getState()
        const { addTickerEntry, incrementRisStats, incrementRisIndianCount, addVantageConfirmation, selectIncident } = store
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
        incrementRisIndianCount()

        const key = `${entry.prefix}|${entry.originAS}`

        // If this prefix/origin combo already has an active incident,
        // treat this as ANOTHER real RIS collector confirming it —
        // grow the vantage matrix instead of spamming new incidents.
        if (activeIncidentKeys.has(key)) {
          addVantageConfirmation(activeIncidentKeys.get(key), hostToVantage(entry.host))
          return
        }

        // Path anomalies and origin mismatches fire immediately (persistence = 1)
        const seenCount = (anomalyOccurrences.get(key) ?? 0) + 1
        anomalyOccurrences.set(key, seenCount)
        const requiredSightings = ANOMALY_PERSISTENCE_REQUIRED
        if (seenCount < requiredSightings) return

        // Minimum confidence gate — skip low-signal events that aren't worth an incident
        const rawConf = Math.min(99, entry.rawConfidence ?? 0)
        if (rawConf < MIN_CONFIDENCE_TO_INCIDENT) return

        // Per-prefix rate limit — different prefixes can create incidents simultaneously
        const lastForPrefix = prefixCooldowns.get(key) ?? 0
        if (now - lastForPrefix < PER_PREFIX_COOLDOWN) return

        // GLOBAL rate limit — caps total incidents per minute across ALL prefixes.
        // Prevents a BGP storm from flooding the panel even when each prefix has its own cooldown.
        const windowStart = now - GLOBAL_RATE_WINDOW
        while (globalIncidentTimes.length > 0 && globalIncidentTimes[0] < windowStart) {
          globalIncidentTimes.shift()
        }
        if (globalIncidentTimes.length >= GLOBAL_RATE_MAX) return

        prefixCooldowns.set(key, now)
        globalIncidentTimes.push(now)

        // FIX: Deterministic attack type from real BGP data, not random
        // ORIGIN_HIJACK: different AS announces our prefix
        // SUBPREFIX_HIJACK: more specific prefix announced (hijackers win routing)
        // ROUTE_LEAK: unexpected origin but not clearly hijack (multi-homed case)
        // PATH_MANIPULATION: abnormal AS path length
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
          timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
          status: 'DETECTED',
          rpkiPushed: false, ixpAlerted: false, forensicsReady: false,
          affectedIPs: (() => {
            // FIX: Calculate real IP count from prefix size
            const bits = parseInt(entry.prefix?.split('/')[1] ?? '24')
            return Math.pow(2, 32 - bits) // e.g. /24 = 256, /16 = 65536
          })(),
          // Real confidence from BGP signals (rawConfidence set in ripeRIS.js parser)
          confidence: Math.min(99, entry.rawConfidence ?? 55),
          isRealData: true, isSimulated: false,
          pathAnomaly: entry.pathAnomaly ?? null,
        })
      },
      onWithdrawal: entry => {
        const s = useSHYENStore.getState()
        s.addTickerEntry({ text: entry.text, suspicious: false, timestamp: entry.timestamp, realData: true, isWithdrawal: true })
        s.incrementRisStats()
      },
    })
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
    enrichAndAdd(sim)
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
          <PanelErrorBoundary incidentId={selectedIncidentId}>
            {selectedIncident ? <DetailPanel incident={selectedIncident} /> : <EmptyState apnicReady={apnicReady} />}
          </PanelErrorBoundary>
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
  let totalActive = 0
  for (const inc of incidents) {
    if (inc.status === 'MITIGATED') continue
    totalActive++
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
          ['Active Attacks', totalActive],
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
