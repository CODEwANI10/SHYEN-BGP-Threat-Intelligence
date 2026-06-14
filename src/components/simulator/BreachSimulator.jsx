// Features #60 #61 — Breach Simulator with Grok bridge + AI loading state
import { useState, useEffect, useRef } from 'react'
import { useSHYENStore } from '../../store/useSHYENStore.js'
import { generateIncident } from '../../data/mockGenerators.js'
import { playCriticalAlert } from '../../utils/soundEngine.js'

const ATTACK_SCRIPTS = [
  {
    label:'ORIGIN HIJACK — China Telecom targeting Reliance Jio',
    severity:'CRITICAL', attackerASN:'AS4134',
    lines:[
      '> Initializing breach simulation environment…',
      '> Connecting to RIPE RIS vantage points [10/10 online]',
      '> Injecting rogue BGP UPDATE from AS4134 (China Telecom)…',
      '> PREFIX: 157.32.0.0/16 — Owner: Reliance Jio (AS55836)',
      '> Propagating hijacked route to global routing table…',
      '> [VP-1] Amsterdam:  ANOMALY CONFIRMED — origin mismatch',
      '> [VP-2] Frankfurt:  ANOMALY CONFIRMED — origin mismatch',
      '> [VP-3] New York:   ANOMALY CONFIRMED — origin mismatch',
      '> [VP-4] Singapore:  ANOMALY CONFIRMED — origin mismatch',
      '> [VP-5] Tokyo:      ANOMALY CONFIRMED — origin mismatch',
      '> [VP-6] Mumbai:     ANOMALY CONFIRMED — origin mismatch',
      '> 8/10 vantage points confirming origin mismatch…',
      '> Propagation: 47% of global routing table affected',
      '> Estimated affected IPs: 2,847,392',
      '> Confidence: 99% — CRITICAL ORIGIN HIJACK DETECTED',
      '> ── Bridging to SHYEN AI Orchestrator ──',
      '> Grok AI analysis loading… dispatching full threat context',
      '> RPKI status: INVALID — No valid ROA for AS4134/157.32.0.0/16',
      '> ✓ Incident auto-added to dashboard — select to view AI analysis',
    ],
  },
  {
    label:'SUBPREFIX HIJACK — Pakistan Telecom targeting NPCI/UPI',
    severity:'HIGH', attackerASN:'AS45595',
    lines:[
      '> Initializing breach simulation environment…',
      '> Scanning Indian financial infrastructure prefixes…',
      '> Detected rogue sub-prefix announcement from AS45595…',
      '> PREFIX: 103.47.141.0/24 ⊂ 103.47.140.0/22 (NPCI/UPI)',
      '> More-specific route bypasses NPCI origin filters…',
      '> [VP-1] Amsterdam:  SUBPREFIX CONFIRMED',
      '> [VP-2] London:     SUBPREFIX CONFIRMED',
      '> [VP-3] New York:   SUBPREFIX CONFIRMED',
      '> Vantage confirmation: 6/10 — HIGH confidence',
      '> Affected UPI transactions routing via Pakistan Telecom',
      '> Grok AI analysis loading… correlating with cert transparency logs',
      '> CertSentinelAgent: querying crt.sh for npci.org.in…',
      '> OrchestratorAgent: monitoring for coordinated escalation',
      '> ✓ HIGH severity incident auto-added to dashboard',
    ],
  },
]

export default function BreachSimulator({ onClose, onIncidentCreated }) {
  const [phase,    setPhase  ] = useState('select')
  const [script,   setScript ] = useState(null)
  const [lines,    setLines  ] = useState([])
  const [lineIdx,  setLineIdx] = useState(0)
  const [incident, setInc    ] = useState(null)
  const { addIncident, selectIncident, addActivity } = useSHYENStore()
  const termRef = useRef(null)

  useEffect(() => {
    if (phase !== 'running' || !script || lineIdx >= script.lines.length) {
      if (phase === 'running' && script && lineIdx >= script.lines.length) setTimeout(() => setPhase('done'), 600)
      return
    }
    const ln = script.lines[lineIdx]
    const delay = ln.includes('Grok AI') || ln.includes('Bridging') ? 700 : ln.startsWith('> ✓') ? 500 : 130
    const t = setTimeout(() => { setLines(p => [...p, ln]); setLineIdx(p => p + 1) }, delay)
    return () => clearTimeout(t)
  }, [phase, lineIdx, script])

  useEffect(() => { termRef.current?.scrollIntoView?.() }, [lines])

  const FA = { 'AS4134':{ asn:'AS4134',name:'China Telecom',country:'CN',mapX:572,mapY:92 }, 'AS45595':{ asn:'AS45595',name:'PTCL Pakistan',country:'PK',mapX:473,mapY:111 } }

  const startScript = (s) => {
    setScript(s); setLines([]); setLineIdx(0); setPhase('running')
    const inc = generateIncident(); inc.severity = s.severity; inc.confidence = 99
    if (FA[s.attackerASN]) inc.attacker = FA[s.attackerASN]
    setInc(inc); addIncident(inc); playCriticalAlert()
    addActivity('ACTION', `Breach simulation: ${s.attackerASN} targeting Indian infrastructure`)
  }

  const handleDone = () => {
    if (incident) { selectIncident(incident.id); onIncidentCreated?.(incident) }
    addActivity('INFO', 'Simulated incident selected — Grok AI analysis loading in right panel')
    onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ width:680,background:'#030608',border:'1px solid rgba(0,255,136,0.3)',borderRadius:6,overflow:'hidden',boxShadow:'0 0 60px rgba(0,255,136,0.15)' }}>
        {/* Terminal title bar */}
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(0,255,136,0.06)',borderBottom:'1px solid rgba(0,255,136,0.15)' }}>
          <div style={{ display:'flex',gap:6 }}>
            <div onClick={onClose} style={{ width:10,height:10,borderRadius:'50%',background:'#ff5f57',cursor:'pointer' }}/>
            <div style={{ width:10,height:10,borderRadius:'50%',background:'#febc2e' }}/>
            <div style={{ width:10,height:10,borderRadius:'50%',background:'#28c840' }}/>
          </div>
          <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'#00ff88',letterSpacing:2,marginLeft:8 }}>
            ⚡ SHYEN BREACH SIMULATOR {script ? '— '+script.label.slice(0,40) : ''}
          </span>
          <span style={{ marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:8,color:'#333' }}>Press [B] anytime</span>
        </div>

        {/* Scenario select */}
        {phase === 'select' && (
          <div style={{ padding:24 }}>
            <div style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'#555',letterSpacing:2,marginBottom:16 }}>SELECT ATTACK SCENARIO</div>
            {ATTACK_SCRIPTS.map((s,i) => (
              <div key={i} onClick={() => startScript(s)} style={{ padding:'12px 14px',background:'rgba(0,255,136,0.03)',border:'1px solid rgba(0,255,136,0.12)',borderRadius:4,marginBottom:8,cursor:'pointer' }}>
                <div style={{ fontFamily:'var(--font-mono)',fontSize:10,fontWeight:700,color:'#00ff88',marginBottom:4 }}>{s.label}</div>
                <div style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'#444' }}>Severity: {s.severity} · Attacker: {s.attackerASN}</div>
              </div>
            ))}
            <button onClick={onClose} style={{ marginTop:8,width:'100%',padding:'7px',fontFamily:'var(--font-mono)',fontSize:9,background:'none',border:'1px solid rgba(255,255,255,0.07)',color:'#555',cursor:'pointer',borderRadius:3 }}>CANCEL</button>
          </div>
        )}

        {/* Terminal output */}
        {(phase === 'running' || phase === 'done') && (
          <>
            <div style={{ padding:'16px 20px',height:340,overflowY:'auto',fontFamily:'var(--font-mono)',fontSize:10 }}>
              {lines.map((ln,i) => {
                const c = ln.startsWith('> ✓') ? '#30d158' : ln.includes('Grok AI') || ln.includes('Bridging') ? '#00bfff' : ln.includes('CONFIRMED') || ln.includes('DETECTED') ? '#ff2d55' : '#00ff88'
                return <div key={i} style={{ color:c,lineHeight:2 }}>{ln}</div>
              })}
              {phase === 'running' && <span style={{ color:'#00ff88',animation:'cursorBlink 1s step-end infinite' }}>█</span>}
              <div ref={termRef}/>
            </div>
            {phase === 'done' && (
              <div style={{ padding:'12px 20px',borderTop:'1px solid rgba(0,255,136,0.15)',display:'flex',gap:10,alignItems:'center' }}>
                <div style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'#30d158',flex:1 }}>
                  ✓ Simulation complete — Grok AI analysis auto-loading in right panel…
                </div>
                <button onClick={handleDone} style={{ fontFamily:'var(--font-mono)',fontSize:9,padding:'7px 18px',background:'rgba(0,255,136,0.12)',border:'1px solid rgba(0,255,136,0.35)',color:'#00ff88',cursor:'pointer',borderRadius:4,letterSpacing:1 }}>
                  VIEW INCIDENT →
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes cursorBlink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
    </div>
  )
}
