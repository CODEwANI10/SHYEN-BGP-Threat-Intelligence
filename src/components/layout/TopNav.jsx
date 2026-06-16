import { useState } from 'react'
import { useSHYENStore, useProfileStore } from '../../store/useSHYENStore.js'
import NotificationsPanel from '../panels/NotificationsPanel.jsx'
import ProfilePanel       from '../panels/ProfilePanel.jsx'
import AttackHistoryPanel from '../panels/AttackHistoryPanel.jsx'
import RouteMonitorPanel  from '../panels/RouteMonitorPanel.jsx'

export default function TopNav({ onBreachClick }) {
  const systemTime  = useSHYENStore(s => s.systemTime)
  const risStatus   = useSHYENStore(s => s.risStatus)
  const notifications = useSHYENStore(s => s.notifications)
  const profile     = useProfileStore()

  const [showNotif,   setShowNotif]   = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)

  const timeStr = new Date(systemTime).toISOString().replace('T',' ').slice(0,19) + ' UTC'
  const dateStr = new Date(systemTime).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
  const badge   = notifications.length

  return (
    <>
      <nav style={{
        height:64, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', borderBottom:'1px solid var(--border-subtle)',
        background:'#060c14', flexShrink:0, zIndex:10,
      }}>
        {/* LEFT — Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" fill="#0a1520" stroke="rgba(0,255,136,0.2)" strokeWidth="1"/>
            <path d="M20 8 L28 18 L20 16 L12 18 Z" fill="#00ff88" opacity="0.9"/>
            <path d="M20 16 L24 24 L20 22 L16 24 Z" fill="#00cc66" opacity="0.7"/>
            <circle cx="20" cy="20" r="2" fill="#00ff88" opacity="0.8"/>
          </svg>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:900, color:'#00ff88', letterSpacing:'-0.02em', lineHeight:1 }}>SHYEN</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#446644', letterSpacing:'0.18em', marginTop:1 }}>BGP THREAT INTELLIGENCE</div>
          </div>

          <div style={{ width:1, height:32, background:'var(--border-subtle)', margin:'0 8px' }} />

          {/* Live status */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              width:7, height:7, borderRadius:'50%',
              background: risStatus === 'connected' ? 'var(--accent-green)' : risStatus === 'connecting' ? '#ffd60a' : '#666',
              boxShadow: risStatus === 'connected' ? '0 0 6px var(--accent-green)' : 'none',
            }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color: risStatus === 'connected' ? 'var(--accent-green)' : '#666', letterSpacing:'0.1em' }}>
              {risStatus === 'connected' ? 'LIVE · 8 VANTAGE POINTS' : risStatus === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
            </span>
          </div>

          <div style={{ width:1, height:32, background:'var(--border-subtle)', margin:'0 8px' }} />

          {/* Quick-nav buttons */}
          <NavBtn label="📊 HISTORY" onClick={() => { setShowHistory(true); setShowMonitor(false); setShowNotif(false); setShowProfile(false) }} />
          <NavBtn label="🔍 MONITOR" onClick={() => { setShowMonitor(true); setShowHistory(false); setShowNotif(false); setShowProfile(false) }} />
        </div>

        {/* CENTER — clock */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:16, fontWeight:700, color:'var(--text-primary)', letterSpacing:'0.05em' }}>{timeStr.slice(11)}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.1em', marginTop:1 }}>{dateStr}</div>
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#00ff88', boxShadow:'0 0 4px #00ff88' }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#446644', letterSpacing:'0.1em' }}>System Online</span>
          </div>

          <div style={{ width:1, height:24, background:'var(--border-subtle)' }} />

          {/* Breach button */}
          <button onClick={onBreachClick} style={{
            fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.12em', color:'#ff2d55',
            background:'rgba(255,45,85,0.08)', border:'1px solid rgba(255,45,85,0.3)',
            borderRadius:4, padding:'6px 14px', cursor:'pointer', transition:'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,45,85,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,45,85,0.08)' }}
          >⚡ SIMULATE BREACH</button>

          {/* Notifications bell */}
          <div style={{ position:'relative', cursor:'pointer' }} onClick={() => { setShowNotif(!showNotif); setShowProfile(false) }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background: showNotif ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)', border:`1px solid ${showNotif ? 'var(--accent-green)' : 'var(--border-subtle)'}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
              <span style={{ fontSize:15 }}>🔔</span>
            </div>
            {badge > 0 && (
              <div style={{ position:'absolute', top:-2, right:-2, width:16, height:16, borderRadius:'50%', background:'#ff2d55', border:'1.5px solid #060c14', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontSize:8, color:'#fff', fontWeight:700 }}>
                {badge > 9 ? '9+' : badge}
              </div>
            )}
          </div>

          {/* Settings */}
          <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <span style={{ fontSize:15 }}>⚙️</span>
          </div>

          {/* Profile */}
          <div style={{ width:34, height:34, borderRadius:'50%', background: showProfile ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.08)', border:`1px solid ${showProfile ? 'var(--accent-green)' : 'rgba(0,255,136,0.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', transition:'all 0.15s' }}
            onClick={() => { setShowProfile(!showProfile); setShowNotif(false) }}
          >
            {profile.photo
              ? <img src={profile.photo} alt="profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent-green)', fontWeight:700 }}>{(profile.name?.[0] ?? 'Y').toUpperCase()}</span>
            }
          </div>
        </div>
      </nav>

      {/* Panels */}
      {showNotif   && <NotificationsPanel onClose={() => setShowNotif(false)} />}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      {showHistory && <AttackHistoryPanel onClose={() => setShowHistory(false)} />}
      {showMonitor && <RouteMonitorPanel onClose={() => setShowMonitor(false)} />}
    </>
  )
}

function NavBtn({ label, onClick }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        fontFamily:'var(--font-mono)', fontSize:8, fontWeight:700, letterSpacing:'0.08em',
        color: h ? 'var(--accent-green)' : 'var(--text-muted)',
        background: h ? 'rgba(0,255,136,0.08)' : 'none',
        border:`1px solid ${h ? 'rgba(0,255,136,0.2)' : 'var(--border-subtle)'}`,
        borderRadius:3, padding:'4px 10px', cursor:'pointer', transition:'all 0.15s',
      }}
    >{label}</button>
  )
}
