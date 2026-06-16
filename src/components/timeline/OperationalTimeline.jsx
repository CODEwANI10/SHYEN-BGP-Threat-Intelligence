const pad = n => String(n).padStart(2,'0')

const STAGES = [
  { icon:'🔴', label:'Anomaly\nDetected',      color:'#ff2d55' },
  { icon:'🔵', label:'Multi-Vantage\nValid.',  color:'#00bfff' },
  { icon:'🟠', label:'Threat\nConfirmed',      color:'#ff6b00' },
  { icon:'🔒', label:'RPKI\nInvalidation',     color:'#30d158' },
  { icon:'⚡',  label:'IXP Alerts\nDispatched', color:'#ffd60a' },
  { icon:'⚙',  label:'Mitigation\nIn Progress',color:'#00ff88' },
]

function getStage(inc) {
  if (!inc) return 1
  if (inc.rpkiPushed && inc.ixpAlerted) return 5
  if (inc.rpkiPushed) return 3
  if (inc.ixpAlerted) return 4
  if (inc.forensicsReady) return 2
  return 1
}

export default function OperationalTimeline({ incident }) {
  const stage = getStage(incident)
  const estRes = new Date(Date.now()+3*60000)
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontFamily:'monospace',fontSize:9,fontWeight:700,color:'#555',letterSpacing:2,marginBottom:10 }}>OPERATIONAL TIMELINE</div>
      <div style={{ display:'flex',alignItems:'center',gap:0 }}>
        {STAGES.map((s,i)=>(
          <div key={i} style={{ display:'flex',alignItems:'center',flex:i<STAGES.length-1?'1 1 auto':'0 0 auto' }}>
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
              <div style={{
                width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,
                background:i<=stage?`${s.color}22`:'rgba(255,255,255,0.03)',
                border:`1px solid ${i<=stage?s.color:'rgba(255,255,255,0.08)'}`,
                boxShadow:i===stage?`0 0 10px ${s.color}55`:'none',
                transition:'all 0.4s',
              }}>{s.icon}</div>
              <div style={{ fontFamily:'monospace',fontSize:7,color:i<=stage?s.color:'#333',textAlign:'center',lineHeight:1.5,whiteSpace:'pre-line',width:58 }}>{s.label}</div>
            </div>
            {i<STAGES.length-1&&(
              <div style={{ flex:1,height:1,background:i<stage?'rgba(0,255,136,0.28)':'rgba(255,255,255,0.05)',margin:'0 2px',marginBottom:16,transition:'background 0.4s' }}/>
            )}
          </div>
        ))}
        {/* EST. RESOLUTION */}
        <div style={{ marginLeft:8,flexShrink:0 }}>
          <div style={{ background:'rgba(0,255,136,0.07)',border:'1px solid rgba(0,255,136,0.25)',borderRadius:4,padding:'4px 8px',textAlign:'center' }}>
            <div style={{ fontFamily:'monospace',fontSize:6.5,color:'#30d158',letterSpacing:1 }}>EST. RESOLUTION</div>
            <div style={{ fontFamily:'monospace',fontSize:11,fontWeight:800,color:'#30d158' }}>{`${pad(estRes.getUTCHours())}:${pad(estRes.getUTCMinutes())} UTC`}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
