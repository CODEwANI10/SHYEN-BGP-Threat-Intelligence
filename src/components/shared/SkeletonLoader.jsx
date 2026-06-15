// Feature #74 — Skeleton loading states
export function SkeletonBlock({ w = '100%', h = 14, mb = 6, radius = 3 }) {
  return (
    <div style={{
      width: w, height: h, marginBottom: mb, borderRadius: radius,
      background: 'rgba(255,255,255,0.04)',
      animation: 'skeletonPulse 1.6s ease-in-out infinite',
    }}/>
  )
}

export function SkeletonCard() {
  return (
    <div style={{ padding:'10px 12px',background:'rgba(8,14,24,0.7)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:4,marginBottom:6 }}>
      <div style={{ display:'flex',gap:8,marginBottom:8 }}>
        <SkeletonBlock w={8} h={8} radius={4}/>
        <SkeletonBlock w={60} h={8}/>
        <SkeletonBlock w={40} h={8}/>
      </div>
      <SkeletonBlock w="70%" h={10} mb={5}/>
      <SkeletonBlock w="50%" h={9} mb={5}/>
      <SkeletonBlock w="90%" h={8}/>
    </div>
  )
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} w={i === lines - 1 ? '65%' : '100%'} h={9} mb={5}/>
      ))}
    </div>
  )
}

export function SkeletonMap() {
  return (
    <div style={{ width:'100%',height:260,background:'rgba(6,10,18,0.6)',border:'1px solid rgba(0,255,136,0.08)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',animation:'skeletonPulse 1.6s ease-in-out infinite' }}>
      <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'#2a2a2a',letterSpacing:2 }}>LOADING MAP…</span>
    </div>
  )
}
