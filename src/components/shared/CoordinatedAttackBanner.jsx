// Feature #81 — COORDINATED ATTACK alert banner
import { useState, useEffect } from 'react'

export default function CoordinatedAttackBanner({ attacks, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    if (attacks && attacks.length > 0) {
      setCurrent(attacks[0])
      setVisible(true)
    }
  }, [attacks?.length])

  if (!visible || !current) return null

  return (
    <div style={{
      position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
      zIndex:1000, minWidth:500, maxWidth:700,
      background:'rgba(5,3,10,0.97)', border:'2px solid #ff2d55',
      borderRadius:6, padding:'12px 16px',
      boxShadow:'0 0 40px rgba(255,45,85,0.5), 0 0 80px rgba(255,45,85,0.2)',
      animation:'borderPulse 1.2s ease-in-out infinite',
    }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
        <div style={{ fontSize:18 }}>🚨</div>
        <div style={{ fontFamily:'var(--font-mono)',fontSize:11,fontWeight:800,color:'#ff2d55',letterSpacing:2 }}>
          COORDINATED ATTACK DETECTED
        </div>
        <div style={{ marginLeft:'auto',display:'flex',gap:8 }}>
          <span style={{ fontFamily:'var(--font-mono)',fontSize:8,color:'rgba(255,45,85,0.5)',padding:'2px 8px',border:'1px solid rgba(255,45,85,0.25)',borderRadius:2,animation:'glowPulse 1.5s ease-in-out infinite' }}>CRITICAL</span>
          <button onClick={()=>{setVisible(false);onDismiss&&onDismiss(current)}}
            style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'#555',background:'none',border:'none',cursor:'pointer',padding:'0 4px' }}>✕</button>
        </div>
      </div>
      <div style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'#888',lineHeight:1.7 }}>
        <span style={{ color:'#ff2d55',fontWeight:700 }}>{current.victimName} ({current.victimASN})</span> is under simultaneous attack from{' '}
        <span style={{ color:'#ff6b00' }}>{current.incidentCount} coordinated BGP anomalies</span>
        {current.hasCertAnomaly && <span style={{ color:'#ffd60a' }}> + fraudulent SSL certificate issuance</span>}.
        Multi-agent confirmation: BGPWatchAgent ✓{current.hasCertAnomaly ? ' · CertSentinelAgent ✓' : ''} · OrchestratorAgent ✓
      </div>
      <div style={{ marginTop:8,display:'flex',gap:8 }}>
        {['Push RPKI Now','Alert All IXPs','Generate Report'].map(a=>(
          <button key={a} style={{ fontFamily:'var(--font-mono)',fontSize:8,padding:'4px 10px',background:'rgba(255,45,85,0.12)',border:'1px solid rgba(255,45,85,0.35)',color:'#ff2d55',cursor:'pointer',borderRadius:2,letterSpacing:0.5 }}>⚡ {a}</button>
        ))}
      </div>
    </div>
  )
}
