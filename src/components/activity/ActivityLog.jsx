import { useRef, useEffect } from 'react'

const TYPE_COLORS = { ACTION:'#00bfff', INFO:'#555', SUCCESS:'#30d158', WARNING:'#ffd60a', ERROR:'#ff2d55' }

export default function ActivityLog({ log }) {
  const endRef = useRef(null)
  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:'smooth' }) },[log])
  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
        <div style={{ fontFamily:'monospace',fontSize:9,fontWeight:700,color:'#555',letterSpacing:1.5 }}>ACTIVITY LOG</div>
        <div style={{ display:'flex',alignItems:'center',gap:4 }}>
          <div style={{ width:5,height:5,borderRadius:'50%',background:'#ff2d55' }}/>
          <span style={{ fontFamily:'monospace',fontSize:7.5,color:'#ff2d55',letterSpacing:1 }}>Live</span>
        </div>
      </div>
      <div style={{ maxHeight:155,overflowY:'auto' }}>
        {log.length===0&&(
          <div style={{ fontFamily:'monospace',fontSize:9,color:'#333',padding:'8px 0' }}>Monitoring active — waiting for events…</div>
        )}
        {log.slice(-25).map((e,i)=>(
          <div key={i} style={{ display:'flex',gap:8,padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontFamily:'monospace',fontSize:7.5,color:'#2a2a2a',flexShrink:0,minWidth:48 }}>{e.time}</span>
            <span style={{ fontFamily:'monospace',fontSize:7.5,color:TYPE_COLORS[e.type]??'#555',flexShrink:0,minWidth:56 }}>[{e.type}]</span>
            <span style={{ fontFamily:'monospace',fontSize:7.5,color:'#555',lineHeight:1.4 }}>{e.text}</span>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
    </div>
  )
}
