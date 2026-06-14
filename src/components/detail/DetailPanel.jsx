import { useState } from 'react'
import { useSHYENStore }    from '../../store/useSHYENStore.js'
import SeverityBadge        from '../shared/SeverityBadge.jsx'
import VantageMatrix        from './VantageMatrix.jsx'
import RPKIStatus           from './RPKIStatus.jsx'
import ConversationalQuery  from './ConversationalQuery.jsx'
import AIAnalysis           from './AIAnalysis.jsx'
import ActivityLog          from './ActivityLog.jsx'
import ForensicsReport      from './ForensicsReport.jsx'
import { generateCERTInReport } from '../../utils/pdfExport.js'

const SEV_COLOR     = { CRITICAL:'var(--accent-red)', HIGH:'var(--accent-orange)', MEDIUM:'var(--accent-amber)', LOW:'#30d158' }
const SECTOR_COLORS = { Financial:'#ff2d55', Government:'#ffd60a', Defense:'#ff6b00', Telecom:'#00bfff', ISP:'#00ff88', IXP:'#bf5af2' }

// Response action button
function ResponseBtn({ color, icon, label, desc, done, onClick }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={done ? undefined : onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', borderRadius:4, cursor: done ? 'default' : 'pointer',
        background: done ? `${color}12` : h ? `${color}18` : `${color}0a`,
        border:`1px solid ${done ? color+'60' : color+'30'}`,
        transition:'all 0.15s', marginBottom:6,
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>{icon}</div>
        <div style={{ textAlign:'left' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color, letterSpacing:'0.08em' }}>{label}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>{desc}</div>
        </div>
      </div>
      {done
        ? <span style={{ color:'#30d158', fontSize:14 }}>✓</span>
        : <span style={{ color, fontSize:12 }}>›</span>
      }
    </button>
  )
}

export default function DetailPanel({ incident: inc }) {
  const incidents  = useSHYENStore(s => s.incidents)
  const triggerAction = useSHYENStore(s => s.triggerAction)
  const addActivityLog = useSHYENStore(s => s.addActivityLog)
  const [showForensics, setShowForensics] = useState(false)

  async function handleForensics() {
    triggerAction(inc.id, 'forensics')
    setShowForensics(true)
    addActivityLog?.('SUCCESS', `Forensics evidence bundle compiled for ${inc.victim?.name}`, inc.id)
  }
  const color      = SEV_COLOR[inc.severity] ?? '#30d158'
  const incId      = `INC-${new Date(inc.timestamp).getFullYear()}-${String(new Date(inc.timestamp).getMonth()+1).padStart(2,'0')}${String(new Date(inc.timestamp).getDate()).padStart(2,'0')}-${String(inc.id).padStart(4,'0')}`

  return (
    <div style={{ animation:'fadeIn 0.25s ease-out' }}>

      {/* AI SOC ANALYST header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:14, fontWeight:800, letterSpacing:'-0.01em' }}>AI SOC ANALYST</div>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--accent-purple)', letterSpacing:'0.08em' }}>Powered by Groq ›</span>
      </div>

      {/* Incident header */}
      <div style={{ padding:'10px 12px', background:'rgba(10,18,28,0.6)', border:`1px solid ${color}33`, borderRadius:4, marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
          <SeverityBadge severity={inc.severity} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>{incId}</span>
          {inc.isRealData  && <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#00ff88', border:'1px solid #00ff8844', borderRadius:2, padding:'1px 5px' }}>● LIVE</span>}
          {inc.isSimulated && <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#bf5af2', border:'1px solid #bf5af244', borderRadius:2, padding:'1px 5px' }}>⚡ SIM</span>}
          {inc.aiDecided   && <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#00bfff', border:'1px solid #00bfff44', borderRadius:2, padding:'1px 5px' }}>◈ AI ACTED</span>}
          {inc.aiAlerted && !inc.aiDecided && <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#ffd60a', border:'1px solid #ffd60a44', borderRadius:2, padding:'1px 5px' }}>⚠ AI ALERT</span>}
          {inc.flagged && <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#ff6b00', border:'1px solid #ff6b0044', borderRadius:2, padding:'1px 5px' }}>🚩 FLAGGED</span>}
        </div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:14, fontWeight:700, marginBottom:3 }}>🇮🇳 {inc.victim?.name}</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>{inc.type?.replace(/_/g,' ')} · {inc.prefix}</div>
      </div>

      {/* THREAT SUMMARY */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.1em', marginBottom:6 }}>THREAT SUMMARY</div>
        <AIAnalysis incident={inc} compact />
      </div>

      {/* ATTACK VECTOR */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.1em', marginBottom:6 }}>ATTACK VECTOR</div>
        <div style={{ padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid var(--border-subtle)', borderRadius:3 }}>
          {[
            ['Type',             inc.type?.replace(/_/g,' ')],
            ['Attacker ASN',     inc.attacker?.asn],
            ['Target ASN',       inc.victim?.asn],
            ['Affected Prefix',  inc.prefix],
            ['First Seen',       new Date(inc.timestamp).toISOString().replace('T',' ').slice(0,19)+' UTC'],
            ['Confidence',       `${inc.confidence}%`],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', gap:8, marginBottom:3 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', minWidth:90 }}>• {k}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-secondary)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RPKI Status */}
      <RPKIStatus asn={inc.victim?.asn} prefix={inc.prefix} />

      {/* AI ANOMALY ALERT — shown when confidence < 75% */}
      {inc.aiAlerted && inc.aiAlert && !inc.aiDecided && (
        <div style={{ marginBottom:10, padding:'10px 12px', background:'rgba(255,214,10,0.05)', border:'1px solid rgba(255,214,10,0.25)', borderRadius:4 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#ffd60a', letterSpacing:'0.12em', marginBottom:6, fontWeight:700 }}>
            ⚠ ANOMALY ALERT — LOW CONFIDENCE
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#00bfff', marginBottom:8, lineHeight:1.6 }}>
            ◈ AI ACTED AUTONOMOUSLY: flagged for review &amp; alerted IXPs
            <br/>→ RPKI push <span style={{ color:'#ffd60a' }}>suggested</span> — review and trigger manually below
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)', marginBottom:8, lineHeight:1.6 }}>
            {inc.aiAlert.summary}
          </div>
          {inc.aiAlert.safeguards?.length > 0 && (
            <div style={{ marginBottom:6 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', marginBottom:4, letterSpacing:'0.08em' }}>SAFEGUARDING MEASURES:</div>
              {inc.aiAlert.safeguards.map((s, i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:3 }}>
                  <span style={{ color:'#ffd60a', fontFamily:'var(--font-mono)', fontSize:9, flexShrink:0 }}>→</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)', lineHeight:1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          )}
          {inc.aiAlert.monitorFor && (
            <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', marginBottom:3 }}>
              <span style={{ color:'#ffd60a' }}>MONITOR: </span>{inc.aiAlert.monitorFor}
            </div>
          )}
          {inc.aiAlert.escalateIf && (
            <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
              <span style={{ color:'#ff6b00' }}>ESCALATE IF: </span>{inc.aiAlert.escalateIf}
            </div>
          )}
        </div>
      )}

      {/* RECOMMENDED ACTIONS */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.1em', marginBottom:6 }}>RECOMMENDED ACTIONS</div>
        <div style={{ padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid var(--border-subtle)', borderRadius:3 }}>
          {[
            { label:'Push RPKI Invalidation', done: inc.rpkiPushed },
            { label:'Alert IXPs',             done: inc.ixpAlerted },
            { label:'Generate Forensics Report', done: inc.forensicsReady },
          ].map(({ label, done }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background: done ? 'rgba(48,209,88,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${done ? '#30d158' : 'var(--border-subtle)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {done && <span style={{ color:'#30d158', fontSize:9 }}>✓</span>}
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color: done ? '#30d158' : 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Analyze Incident button */}
        <ConversationalQuery incidents={incidents} compact />
      </div>

      {/* RESPONSE ACTIONS */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.1em' }}>RESPONSE ACTIONS</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>Incident ID: {incId}</div>
        </div>
        <ResponseBtn color="#30d158" icon="🔒" label="PUSH RPKI" desc="RPKI Invalidation" done={inc.rpkiPushed} onClick={() => triggerAction(inc.id, 'rpki')} />
        <ResponseBtn color="#ffd60a" icon="⚠️" label="ALERT IXPs" desc="Notify NIXI & peers" done={inc.ixpAlerted} onClick={() => triggerAction(inc.id, 'ixp')} />
        <ResponseBtn color="#ff6b00" icon="📋" label="FORENSICS" desc={inc.forensicsReady ? "View evidence bundle" : "Compile evidence"} done={false} onClick={handleForensics} />
        {inc.forensicsReady && (
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#30d158', marginTop:-2, marginBottom:6, paddingLeft:38, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span>✓ Bundle ready</span>
            <button onClick={async () => { try { await generateCERTInReport(inc); addActivityLog?.('SUCCESS', `CERT-In PDF downloaded`, inc.id) } catch { addActivityLog?.('INFO', `PDF export failed`, inc.id) } }} style={{
              fontFamily:'var(--font-mono)', fontSize:8, color:'#00bfff',
              background:'none', border:'1px solid rgba(0,191,255,0.35)',
              borderRadius:2, padding:'1px 6px', cursor:'pointer',
            }}>⬇ DOWNLOAD PDF</button>
            <button onClick={() => setShowForensics(true)} style={{
              fontFamily:'var(--font-mono)', fontSize:8, color:'#ff8c00',
              background:'none', border:'1px solid rgba(255,140,0,0.35)',
              borderRadius:2, padding:'1px 6px', cursor:'pointer',
            }}>✉ EMAIL REPORT</button>
          </div>
        )}
      </div>

      {showForensics && <ForensicsReport incident={inc} onClose={() => setShowForensics(false)} />}

      {/* Vantage Matrix */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.1em', marginBottom:6 }}>VANTAGE MATRIX</div>
        <VantageMatrix incident={inc} />
      </div>

      {/* Activity Log */}
      <ActivityLog />
    </div>
  )
}
