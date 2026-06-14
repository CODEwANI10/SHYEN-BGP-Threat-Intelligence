import { useSHYENStore } from '../../store/useSHYENStore.js'
import { INDIAN_ASNS }   from '../../data/indianASNs.js'
import { useRef }        from 'react'

function StatCard({ label, value, color, sub, delta, deltaColor }) {
  return (
    <div style={{
      flex: 1, padding: '12px 20px',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.12em', textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color: deltaColor ?? 'var(--text-muted)' }}>
        {delta && <span style={{ color: deltaColor ?? 'var(--accent-green)' }}>{delta} </span>}
        {sub}
      </div>
    </div>
  )
}

export default function StatsBar() {
  const totalAnnouncements = useSHYENStore(s => s.totalAnnouncements)
  const incidents          = useSHYENStore(s => s.incidents)
  const risIndianCount     = useSHYENStore(s => s.risIndianCount)
  const apnicCount         = useSHYENStore(s => s.apnicCount)
  const systemTime         = useSHYENStore(s => s.systemTime)

  const active    = incidents.filter(i => i.status === 'DETECTED').length
  const mitigated = incidents.filter(i => i.status === 'MITIGATED').length
  const avgConf   = incidents.length > 0
    ? Math.round(incidents.reduce((s, i) => s + (i.confidence ?? 0), 0) / incidents.length)
    : 0

  const timeStr = new Date(systemTime).toISOString().replace('T',' ').slice(0,19) + ' UTC'

  return (
    <div style={{
      display:'flex', height:72,
      borderBottom:'1px solid var(--border-subtle)',
      background:'#07111a', flexShrink:0,
    }}>
      <StatCard
        label="Active Incidents"
        value={active}
        color="var(--accent-red)"
        delta="↑ live"
        deltaColor="var(--accent-red)"
        sub="from RIPE RIS feed"
      />
      <StatCard
        label="Mitigated Today"
        value={mitigated}
        color="#30d158"
        delta={mitigated > 0 ? `↑ ${mitigated}` : ''}
        deltaColor="#30d158"
        sub="from yesterday"
      />
      <StatCard
        label="Indian ASNs Monitored"
        value={INDIAN_ASNS.length}
        color="var(--accent-blue)"
        sub="All critical networks"
      />
      <StatCard
        label="Threat Confidence"
        value={avgConf > 0 ? `${avgConf}%` : '—'}
        color="var(--accent-purple)"
        sub="Average confidence"
      />
      <StatCard
        label="Vantage Points"
        value={8}
        color="var(--accent-amber)"
        sub="Global monitoring"
      />

    </div>
  )
}
