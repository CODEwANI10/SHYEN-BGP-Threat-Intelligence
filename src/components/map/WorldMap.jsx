import { useMemo } from 'react'

const INDIA_X=487, INDIA_Y=148
const SEV_COLORS = { CRITICAL:'#ff2d55', HIGH:'#ff6b00', MEDIUM:'#ffd60a', LOW:'#30d158' }

export default function WorldMap({ incidents }) {
  const activeAtkers = useMemo(() => {
    const seen = new Set()
    return incidents
      .filter(i => i.status==='DETECTED' && i.attacker?.mapX)
      .slice(0,7)
      .filter(i => { if(seen.has(i.attacker.asn)) return false; seen.add(i.attacker.asn); return true })
      .map(i => ({ ...i.attacker, severity:i.severity, incId:i.id }))
  }, [incidents])

  return (
    <div style={{ position:'relative', width:'100%', height:260,
      background:'rgba(3,6,14,0.95)', border:'1px solid rgba(0,255,136,0.10)',
      borderRadius:4, overflow:'hidden' }}>
      {/* Legend */}
      <div style={{ position:'absolute',top:7,right:8,zIndex:5,display:'flex',gap:8,
        background:'rgba(0,0,0,0.55)',padding:'3px 8px',borderRadius:3 }}>
        {[['Low','#30d158'],['Medium','#ffd60a'],['High','#ff6b00'],['Critical','#ff2d55']].map(([l,c])=>(
          <div key={l} style={{ display:'flex',alignItems:'center',gap:3 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:c }}/>
            <span style={{ fontFamily:'monospace',fontSize:7.5,color:'#555' }}>{l}</span>
          </div>
        ))}
      </div>
      {/* Zoom controls */}
      <div style={{ position:'absolute',top:7,left:8,zIndex:5,display:'flex',flexDirection:'column',gap:2 }}>
        {['+','−'].map(s=>(
          <div key={s} style={{ width:20,height:20,background:'rgba(0,0,0,0.5)',
            border:'1px solid rgba(255,255,255,0.08)',borderRadius:2,display:'flex',
            alignItems:'center',justifyContent:'center',cursor:'default',color:'#444',fontSize:13 }}>{s}</div>
        ))}
      </div>

      <svg viewBox="0 0 700 260" style={{ width:'100%',height:'100%' }} preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {Array.from({length:14},(_,i)=>(
          <line key={`vg${i}`} x1={i*50} y1={0} x2={i*50} y2={260} stroke="rgba(0,255,136,0.035)" strokeWidth="0.5"/>
        ))}
        {Array.from({length:6},(_,i)=>(
          <line key={`hg${i}`} x1={0} y1={i*44} x2={700} y2={i*44} stroke="rgba(0,255,136,0.035)" strokeWidth="0.5"/>
        ))}

        {/* ── Continents ── */}
        {/* North America */}
        <polygon points="80,48 192,40 234,58 242,104 230,144 202,172 172,184 144,174 116,152 92,120 76,88"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.17)" strokeWidth="0.6"/>
        {/* South America */}
        <polygon points="148,192 196,190 220,226 233,276 203,316 156,312 132,280 130,242"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.17)" strokeWidth="0.6"/>
        {/* Europe */}
        <polygon points="322,50 416,46 444,64 456,88 442,108 400,116 360,106 338,89 330,70"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.17)" strokeWidth="0.6"/>
        {/* UK */}
        <polygon points="326,52 344,48 350,64 338,70 328,62"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.13)" strokeWidth="0.5"/>
        {/* Africa */}
        <polygon points="328,116 428,114 456,140 466,194 454,266 414,308 360,306 322,276 312,218 322,158"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.17)" strokeWidth="0.6"/>
        {/* Asia main */}
        <polygon points="440,48 700,44 712,130 680,188 644,200 612,196 584,184 566,172 547,162 528,154 506,145 486,140 466,112 448,82"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.17)" strokeWidth="0.6"/>
        {/* India highlighted */}
        <polygon points="484,140 548,137 568,152 570,173 549,202 516,208 488,196 477,170"
          fill="rgba(0,255,136,0.08)" stroke="rgba(0,255,136,0.50)" strokeWidth="1"/>
        {/* Australia */}
        <polygon points="572,228 685,224 704,260 682,296 636,308 594,290 564,262"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.17)" strokeWidth="0.6"/>
        {/* Japan */}
        <polygon points="664,92 684,90 690,110 676,118 664,108"
          fill="rgba(0,255,136,0.04)" stroke="rgba(0,255,136,0.13)" strokeWidth="0.5"/>

        {/* ── India pulse ── */}
        <circle cx={INDIA_X} cy={INDIA_Y} r="10" fill="none" stroke="rgba(0,255,136,0.35)" strokeWidth="1">
          <animate attributeName="r" values="6;18;6" dur="2.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.4s" repeatCount="indefinite"/>
        </circle>
        <circle cx={INDIA_X} cy={INDIA_Y} r="4.5" fill="#00ff88">
          <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite"/>
        </circle>

        {/* ── Attack paths ── */}
        {activeAtkers.map(atk => {
          const color = SEV_COLORS[atk.severity] ?? '#ff6b00'
          const cpx   = (atk.mapX+INDIA_X)/2
          const cpy   = Math.min(atk.mapY,INDIA_Y)-48
          return (
            <g key={atk.incId}>
              <path d={`M${atk.mapX},${atk.mapY} Q${cpx},${cpy} ${INDIA_X},${INDIA_Y}`}
                fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="6,4" opacity="0.75">
                <animate attributeName="stroke-dashoffset" values="0;-30" dur="0.85s" repeatCount="indefinite"/>
              </path>
              <circle cx={atk.mapX} cy={atk.mapY} r="5" fill={color} opacity="0.85">
                <animate attributeName="r" values="4;7;4" dur="2.1s" repeatCount="indefinite"/>
              </circle>
              <text x={atk.mapX} y={atk.mapY-10} textAnchor="middle" fill={color} fontSize="6.5" fontFamily="monospace" fontWeight="bold">{atk.asn}</text>
              <text x={atk.mapX} y={atk.mapY-3}  textAnchor="middle" fill={color} fontSize="5.5" fontFamily="monospace" opacity="0.75">{atk.name.slice(0,12)}</text>
              <text x={atk.mapX} y={atk.mapY+4}  textAnchor="middle" fill={color} fontSize="5" fontFamily="monospace" opacity="0.55">{atk.country}</text>
            </g>
          )
        })}

        {/* Vantage point dots */}
        {[[352,74],[92,98],[404,68],[673,96],[541,147],[636,220],[205,95],[487,158],[403,78],[342,72]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="2" fill="rgba(0,191,255,0.45)">
            <animate attributeName="opacity" values="0.3;0.75;0.3" dur={`${1.4+(i%4)*0.4}s`} repeatCount="indefinite"/>
          </circle>
        ))}

        {/* India label */}
        <text x={INDIA_X} y={INDIA_Y+18} textAnchor="middle" fill="#00ff88" fontSize="7.5" fontFamily="monospace" fontWeight="bold" letterSpacing="1">AS55836</text>
        <text x={INDIA_X} y={INDIA_Y+27} textAnchor="middle" fill="#00ff88" fontSize="6" fontFamily="monospace" opacity="0.65">Reliance Jio · India</text>
      </svg>
    </div>
  )
}
