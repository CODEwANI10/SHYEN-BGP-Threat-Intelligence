// Feature #80 — Multi-agent UI: BGPWatchAgent, CertSentinelAgent, OrchestratorAgent
import { useState, useEffect } from 'react'
import { useSHYENStore } from '../../store/useSHYENStore.js'
import { runCertSentinel } from '../../utils/certMonitor.js'
import { checkPathAnomaly } from '../../utils/pathAnomalyDetection.js'
import { queryAbuseHistory } from '../../utils/abuseIPDB.js'

const SEV_COLORS = { CRITICAL:'#ff2d55', HIGH:'#ff6b00', MEDIUM:'#ffd60a', LOW:'#30d158' }

function AgentHeader({ name, status, icon, description, onRun, running }) {
  const statusColor = { ACTIVE:'#30d158', SCANNING:'#ffd60a', IDLE:'#555', ERROR:'#ff2d55' }[status] || '#555'
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'rgba(6,10,18,0.9)',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize:16 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ fontFamily:'var(--font-mono)',fontSize:10,fontWeight:700,color:'#ccc',letterSpacing:1 }}>{name}</span>
          <span style={{ width:6,height:6,borderRadius:'50%',background:statusColor,display:'inline-block',boxShadow:`0 0 6px ${statusColor}` }}/>
          <span style={{ fontFamily:'var(--font-mono)',fontSize:8,color:statusColor,letterSpacing:1 }}>{status}</span>
        </div>
        <div style={{ fontFamily:'var(--font-mono)',fontSize:7.5,color:'#444',marginTop:2 }}>{description}</div>
      </div>
      <button onClick={onRun} disabled={running} style={{ fontFamily:'var(--font-mono)',fontSize:8,padding:'4px 10px',background:'rgba(0,191,255,0.08)',border:'1px solid rgba(0,191,255,0.25)',color:'#00bfff',cursor:running?'not-allowed':'pointer',borderRadius:3,flexShrink:0 }}>
        {running ? '⏳ Running…' : '▶ Run'}
      </button>
    </div>
  )
}

// ── BGPWatch Agent Panel ──
function BGPWatchAgent({ incidents }) {
  const [status,   setStatus  ] = useState('ACTIVE')
  const [findings, setFindings] = useState([])

  const run = () => {
    setStatus('SCANNING')
    setTimeout(() => {
      const f = incidents.slice(0, 5).map(inc => {
        const path = checkPathAnomaly(inc)
        return { id:inc.id, victimName:inc.victim.name, victimASN:inc.victim.asn, prefix:inc.prefix, severity:inc.severity, pathAnomaly:path }
      })
      setFindings(f); setStatus('ACTIVE')
    }, 1200)
  }

  return (
    <div style={{ background:'rgba(8,12,20,0.85)',border:'1px solid rgba(0,191,255,0.12)',borderRadius:4,overflow:'hidden',marginBottom:8 }}>
      <AgentHeader name="BGPWatchAgent" status={status} icon="🔭"
        description="Monitors RIPE RIS BGP updates — origin mismatch + path anomaly detection"
        onRun={run} running={status==='SCANNING'}/>
      <div style={{ padding:'8px 12px',maxHeight:140,overflowY:'auto' }}>
        {findings.length === 0 ? (
          <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#2a2a2a',padding:'6px 0' }}>Click Run to scan active BGP routes…</div>
        ) : findings.map(f => (
          <div key={f.id} style={{ display:'flex',gap:8,alignItems:'flex-start',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontFamily:'var(--font-mono)',fontSize:8,color:SEV_COLORS[f.severity]??'#555',flexShrink:0 }}>●</span>
            <div>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:8.5,color:'#bbb',fontWeight:600 }}>{f.victimName}</span>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:7.5,color:'#555',marginLeft:6 }}>{f.prefix}</span>
              {f.pathAnomaly.anomaly && (
                <div style={{ fontFamily:'var(--font-mono)',fontSize:7.5,color:'#ffd60a',marginTop:1 }}>⚠ {f.pathAnomaly.reason}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CertSentinel Agent Panel ──
function CertSentinelAgent() {
  const [status,   setStatus  ] = useState('IDLE')
  const [certData, setCertData] = useState([])

  const run = async () => {
    setStatus('SCANNING')
    const results = await runCertSentinel()
    setCertData(results)
    setStatus('ACTIVE')
  }

  return (
    <div style={{ background:'rgba(8,12,20,0.85)',border:'1px solid rgba(191,90,242,0.12)',borderRadius:4,overflow:'hidden',marginBottom:8 }}>
      <AgentHeader name="CertSentinelAgent" status={status} icon="🔐"
        description="Polls crt.sh for suspicious SSL certs on Indian bank & govt domains"
        onRun={run} running={status==='SCANNING'}/>
      <div style={{ padding:'8px 12px',maxHeight:140,overflowY:'auto' }}>
        {status==='SCANNING' && (
          <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#444',padding:'6px 0' }}>Querying crt.sh for Indian domains…</div>
        )}
        {certData.length === 0 && status !== 'SCANNING' ? (
          <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#2a2a2a',padding:'6px 0' }}>Click Run to scan certificate transparency logs…</div>
        ) : certData.map((c,i) => (
          <div key={i} style={{ display:'flex',gap:8,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize:8,flexShrink:0 }}>{c.suspicious?'⚠':'✓'}</span>
            <div>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:8.5,color:c.suspicious?'#ffd60a':'#555',fontWeight:600 }}>{c.domain}</span>
              <div style={{ fontFamily:'var(--font-mono)',fontSize:7.5,color:'#444',marginTop:1 }}>
                {c.commonName} · {c.issuer.slice(0,45)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Orchestrator Agent Panel ──
function OrchestratorAgent({ incident }) {
  const [status,    setStatus   ] = useState('IDLE')
  const [abuseData, setAbuseData] = useState(null)
  const { grokApiKey } = useSHYENStore()

  const run = async () => {
    if (!incident) return
    setStatus('SCANNING')
    const data = await queryAbuseHistory(incident.attacker.asn)
    setAbuseData(data)
    setStatus('ACTIVE')
  }

  return (
    <div style={{ background:'rgba(8,12,20,0.85)',border:'1px solid rgba(0,255,136,0.12)',borderRadius:4,overflow:'hidden' }}>
      <AgentHeader name="OrchestratorAgent" status={status} icon="🤖"
        description="Correlates all agent signals — AbuseIPDB history + coordinated attack detection"
        onRun={run} running={status==='SCANNING'}/>
      <div style={{ padding:'8px 12px',maxHeight:140,overflowY:'auto' }}>
        {!incident && <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#2a2a2a',padding:'6px 0' }}>Select an incident to orchestrate…</div>}
        {incident && !abuseData && status !== 'SCANNING' && (
          <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#2a2a2a',padding:'6px 0' }}>Target: {incident.attacker.asn} — Click Run for threat history…</div>
        )}
        {status==='SCANNING' && <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#444',padding:'6px 0' }}>Querying threat intelligence databases…</div>}
        {abuseData && (
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:9,fontWeight:700,color:abuseData.known?'#ff2d55':'#30d158' }}>
                {abuseData.known ? '⚠ KNOWN MALICIOUS ASN' : '✓ No Prior Record'}
              </span>
            </div>
            {abuseData.known && (
              <>
                {[
                  ['ASN',          abuseData.asn],
                  ['Reports',      abuseData.reports + ' historical reports'],
                  ['Risk Score',   abuseData.riskScore + '/100'],
                  ['Categories',   abuseData.categories.join(', ')],
                  ['Last Seen',    abuseData.lastSeen],
                  ['Country',      abuseData.country],
                  ['Source',       abuseData.source],
                ].map(([k,v])=>(
                  <div key={k} style={{ display:'flex',gap:8,padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontFamily:'var(--font-mono)',fontSize:7.5,color:'#444',minWidth:72 }}>{k}</span>
                    <span style={{ fontFamily:'var(--font-mono)',fontSize:7.5,color:'#888' }}>{v}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentPanel({ incident }) {
  const incidents = useSHYENStore(s => s.incidents)
  return (
    <div>
      <div style={{ fontFamily:'var(--font-mono)',fontSize:9,fontWeight:700,color:'#555',letterSpacing:2,marginBottom:10 }}>
        MULTI-AGENT SYSTEM
        <span style={{ color:'#2a2a2a',fontWeight:400,marginLeft:8,fontSize:7.5 }}>3 AGENTS ACTIVE</span>
      </div>
      <BGPWatchAgent incidents={incidents}/>
      <CertSentinelAgent/>
      <OrchestratorAgent incident={incident}/>
    </div>
  )
}
