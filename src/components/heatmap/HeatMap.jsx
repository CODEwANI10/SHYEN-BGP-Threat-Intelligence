const HEATMAP = [
  { type:'Route Leak',       cells:[2,4,7,1] },
  { type:'Origin Hijack',    cells:[1,3,9,4] },
  { type:'Subprefix Hijack', cells:[0,2,5,8] },
  { type:'Path Manip.',      cells:[3,5,2,0] },
]
const cellColor = v => {
  if (v===0) return 'rgba(255,255,255,0.03)'
  if (v<=2)  return 'rgba(255,107,0,0.14)'
  if (v<=5)  return 'rgba(255,107,0,0.36)'
  if (v<=7)  return 'rgba(255,45,85,0.52)'
  return 'rgba(255,45,85,0.82)'
}
export default function HeatMap() {
  return (
    <div style={{ padding:'10px 12px 12px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontFamily:'monospace',fontSize:9,fontWeight:700,color:'#555',letterSpacing:2,marginBottom:6 }}>BGP ATTACK HEATMAP</div>
      <div style={{ fontFamily:'monospace',fontSize:7.5,color:'#333',marginBottom:8 }}>Attack types by likelihood and impact</div>
      <div style={{ display:'grid',gridTemplateColumns:'88px repeat(4,1fr)',gap:2 }}>
        <div/>
        {['Low','Med','High','Critical'].map(h=>(
          <div key={h} style={{ textAlign:'center',fontFamily:'monospace',fontSize:7.5,color:'#444',padding:'1px 0',letterSpacing:0.5 }}>{h}</div>
        ))}
        {HEATMAP.map(row=>(
          <> 
            <div key={row.type+'-label'} style={{ fontFamily:'monospace',fontSize:8,color:'#555',display:'flex',alignItems:'center',paddingRight:4 }}>{row.type}</div>
            {row.cells.map((v,ci)=>(
              <div key={ci} style={{ background:cellColor(v),border:'1px solid rgba(255,255,255,0.04)',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center',height:22,color:v>2?'rgba(255,255,255,0.8)':'#333',fontWeight:700,fontSize:11 }}>
                {v||''}
              </div>
            ))}
          </>
        ))}
      </div>
      <div style={{ display:'flex',justifyContent:'space-between',marginTop:6 }}>
        <span style={{ fontFamily:'monospace',fontSize:7,color:'#333',letterSpacing:0.3 }}>↑ Impact</span>
        <span style={{ fontFamily:'monospace',fontSize:7,color:'#333',letterSpacing:0.3 }}>Detection Confidence →</span>
      </div>
    </div>
  )
}
