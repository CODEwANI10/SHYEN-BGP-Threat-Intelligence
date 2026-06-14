import { useState } from 'react'
import { useSHYENStore } from '../../store/useSHYENStore.js'

const ACTIONS = [
  {
    key: 'rpki',
    field: 'rpkiPushed',
    label: 'RPKI ROA INVALIDATION',
    color: 'var(--accent-blue)',
    desc: 'Push Route Origin Authorization to IRINN — marks hijacked route cryptographically invalid for all ROV-enforcing routers globally',
    pairKey: 'ixp',  // completing this pair = MITIGATED
  },
  {
    key: 'ixp',
    field: 'ixpAlerted',
    label: 'IXP FILTER PUSH',
    color: 'var(--accent-amber)',
    desc: 'Alert NIXI Mumbai, Delhi, Chennai, Kolkata to reject hijacked announcement at Indian Internet Exchange Points',
    pairKey: 'rpki',
  },
  {
    key: 'forensics',
    field: 'forensicsReady',
    label: 'FORENSIC PACKAGE',
    color: 'var(--accent-purple)',
    desc: 'Auto-compile evidence bundle: origin AS, timestamp chain, vantage confirmations, affected prefix scope — formatted for CERT-In submission',
  },
]

// Format milliseconds → human readable
function formatMitigationTime(ms) {
  if (!ms || ms < 0) return null
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`
}

export default function ResponseActions({ incident }) {
  const triggerAction = useSHYENStore(s => s.triggerAction)
  const [executing, setExecuting] = useState(null)

  // "Execute All" — fires RPKI + IXP + Forensics simultaneously → instant MITIGATED
  async function executeAll() {
    setExecuting('all')
    // Fire all three actions with a tiny visual stagger
    triggerAction(incident.id, 'rpki')
    await new Promise(r => setTimeout(r, 80))
    triggerAction(incident.id, 'ixp')
    await new Promise(r => setTimeout(r, 80))
    triggerAction(incident.id, 'forensics')
    setExecuting(null)
  }

  async function executeSingle(key) {
    setExecuting(key)
    triggerAction(incident.id, key)
    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 300))
    setExecuting(null)
  }

  const allDone   = incident.rpkiPushed && incident.ixpAlerted && incident.forensicsReady
  const isMit     = incident.status === 'MITIGATED'
  const mitMs     = incident.mitigationMs
  const mitTime   = formatMitigationTime(mitMs)

  // If already mitigated by AI, show the summary banner
  if (isMit && incident.aiDecided) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          padding: '12px 14px',
          background: 'rgba(0,255,136,0.06)',
          border: '1px solid rgba(0,255,136,0.3)',
          borderRadius: 4,
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--accent-green)', letterSpacing: 1 }}>
              ✓ AI AUTONOMOUS MITIGATION COMPLETE
            </span>
            {mitTime && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                TTM: <span style={{ color: 'var(--accent-green)' }}>{mitTime}</span>
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', marginTop: 4 }}>
            {(incident.autonomousActionsExecuted ?? []).join(' · ')}
          </div>
        </div>
        {/* Still show individual action rows as confirmed */}
        {ACTIONS.map(action => (
          <ActionRow key={action.key} action={action} incident={incident} done={true} onExecute={null} executing={null} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Execute All button — visible when at least one action is pending */}
      {!allDone && (
        <button
          onClick={executeAll}
          disabled={executing === 'all'}
          style={{
            width: '100%', marginBottom: 10,
            padding: '9px 0',
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            letterSpacing: 2,
            background: executing === 'all'
              ? 'rgba(0,255,136,0.08)'
              : 'rgba(0,255,136,0.12)',
            border: '1px solid rgba(0,255,136,0.5)',
            color: 'var(--accent-green)',
            cursor: executing === 'all' ? 'wait' : 'pointer',
            borderRadius: 3,
            transition: 'background 0.15s',
          }}
        >
          {executing === 'all' ? '⚡ EXECUTING...' : '⚡ EXECUTE ALL — INSTANT MITIGATION'}
        </button>
      )}

      {isMit && mitTime && (
        <div style={{
          padding: '6px 10px', marginBottom: 8,
          background: 'rgba(0,255,136,0.05)',
          border: '1px solid rgba(0,255,136,0.2)',
          borderRadius: 3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--accent-green)' }}>
            ✓ MITIGATED
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            TTM: <span style={{ color: 'var(--accent-green)' }}>{mitTime}</span>
          </span>
        </div>
      )}

      {ACTIONS.map(action => (
        <ActionRow
          key={action.key}
          action={action}
          incident={incident}
          done={!!incident[action.field]}
          onExecute={() => executeSingle(action.key)}
          executing={executing}
        />
      ))}
    </div>
  )
}

function ActionRow({ action, incident, done, onExecute, executing }) {
  const isRunning = executing === action.key

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: 10,
      background: done ? 'rgba(0,255,136,0.04)' : 'rgba(10,14,20,0.6)',
      border: `1px solid ${done ? 'rgba(0,255,136,0.2)' : 'var(--border-subtle)'}`,
      borderRadius: 3, marginBottom: 6,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: `1px solid ${done ? 'var(--accent-green)' : 'var(--border-mid)'}`,
        background: done ? 'rgba(0,255,136,0.1)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 10,
        color: done ? 'var(--accent-green)' : 'var(--text-muted)',
        transition: 'all 0.2s',
      }}>
        {done ? '✓' : isRunning ? '…' : '○'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: action.color, marginBottom: 2 }}>
          {action.label}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {action.desc}
        </div>
      </div>
      {done
        ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-green)', letterSpacing: 1, whiteSpace: 'nowrap' }}>EXECUTED</span>
        : onExecute && (
          <button
            onClick={onExecute}
            disabled={isRunning}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 8,
              padding: '5px 10px', background: 'none',
              border: `1px solid ${action.color}60`,
              color: action.color, cursor: isRunning ? 'wait' : 'pointer',
              borderRadius: 2, letterSpacing: 1, whiteSpace: 'nowrap',
              opacity: isRunning ? 0.6 : 1,
            }}
          >
            {isRunning ? 'EXEC...' : 'EXECUTE'}
          </button>
        )
      }
    </div>
  )
}
