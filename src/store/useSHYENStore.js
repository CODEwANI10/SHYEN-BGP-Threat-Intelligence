import { create } from 'zustand'
import { applyAutonomousDecision, applyAlertModeDecision } from '../engine/autonomousActions.js'

const ACTION_LABELS = {
  rpki:      'PUSH RPKI',
  ixp:       'ALERT IXPs',
  forensics: 'FORENSICS',
  flag:      'FLAG FOR REVIEW',
}

let logCounter = 0
function logEntry(level, message, incidentId = null) {
  return { id: ++logCounter, level, message, incidentId, timestamp: new Date().toISOString() }
}
function appendLog(activityLog, entry) {
  return [...activityLog, entry].slice(-80)
}

// FIX: Raised incident cap from 30 → 200, with smart pruning:
// - MITIGATED incidents are pruned first (oldest first)
// - Active/DETECTED incidents are preserved
// - Hard cap at 200 to prevent memory bloat
const MAX_INCIDENTS = 200
function pruneIncidents(incidents) {
  if (incidents.length <= MAX_INCIDENTS) return incidents
  // Sort: keep DETECTED/ACTIVE first, prune oldest MITIGATED
  const active    = incidents.filter(i => i.status !== 'MITIGATED')
  const mitigated = incidents.filter(i => i.status === 'MITIGATED')
  // Keep most recent mitigated up to fill the cap
  const keepMitigated = mitigated.slice(0, MAX_INCIDENTS - active.length)
  return [...active, ...keepMitigated].slice(0, MAX_INCIDENTS)
}

export const useSHYENStore = create((set) => ({
  incidents:          [],
  selectedIncidentId: null,
  ticker:             [],
  totalAnnouncements: 0,
  activeTab:          'incidents',
  systemTime:         new Date(),

  activityLog: [ logEntry('INFO', 'SHYEN activity stream online') ],

  risStatus:      'disconnected',
  risMessageCount: 0,
  risIndianCount:  0,
  risError:        null,

  apnicLoaded: false,
  apnicCount:  0,

  notifications: [],

  addIncident: (incident) => set(state => {
    // FIX: Smart pruning instead of hard slice(0, 30)
    const raw = [incident, ...state.incidents]
    const incidents = pruneIncidents(raw)
    const activityLog = appendLog(
      state.activityLog,
      logEntry(
        incident.aiDecided ? 'SUCCESS' : 'INFO',
        `${incident.aiDecided ? 'AI DECIDED' : 'Incident detected'}: ${incident.severity} ${incident.type.replace(/_/g,' ')} on ${incident.victim.name}`,
        incident.id,
      ),
    )
    return { incidents, activityLog }
  }),

  selectIncident: (id) => set({ selectedIncidentId: id }),

  addTickerEntry: (entry) => set(state => ({
    ticker:             [...state.ticker, entry].slice(-20),
    totalAnnouncements: state.totalAnnouncements + 1,
  })),

  incrementAnnouncements: () => set(state => ({
    totalAnnouncements: state.totalAnnouncements + 1,
  })),

  addActivityLog: (level, message, incidentId = null) => set(state => ({
    activityLog: appendLog(state.activityLog, logEntry(level, message, incidentId)),
  })),

  triggerAction: (incidentId, action) => set(state => {
    let actedIncident = null
    const incidents = state.incidents.map(inc => {
      if (inc.id !== incidentId) return inc
      const u = { ...inc }
      if (action === 'rpki')      u.rpkiPushed     = true
      if (action === 'ixp')       u.ixpAlerted     = true
      if (action === 'forensics') u.forensicsReady = true
      if (action === 'flag')      u.flagged        = true
      // FIX: Instant MITIGATED — any complete response (RPKI+IXP) triggers immediately
      if (u.rpkiPushed && u.ixpAlerted) {
        u.status = 'MITIGATED'
        u.mitigatedAt = new Date().toISOString()
        // Calculate time-to-mitigate in ms from detection
        u.mitigationMs = u.timestamp ? Date.now() - new Date(u.timestamp).getTime() : null
      }
      actedIncident = u
      return u
    })

    const actionLabel = ACTION_LABELS[action] ?? action.toUpperCase()
    let activityLog = appendLog(
      state.activityLog,
      logEntry('ACTION', `${actionLabel} executed${actedIncident ? ` for ${actedIncident.victim.name}` : ''}`, incidentId),
    )
    if (actedIncident?.status === 'MITIGATED') {
      activityLog = appendLog(activityLog, logEntry('SUCCESS', `Mitigation complete for ${actedIncident.victim.name}`, incidentId))
    }

    return { incidents, activityLog }
  }),

  markAIAnalyzing: (incidentId) => set(state => ({
    incidents: state.incidents.map(inc =>
      inc.id === incidentId ? { ...inc, aiAnalyzing: true } : inc
    ),
  })),

  markAIDecided: (incidentId, decision) => set(state => {
    const isAlert = decision?.mode === 'alert'

    const incidents = state.incidents.map(inc => {
      if (inc.id !== incidentId) return inc
      if (isAlert) {
        return applyAlertModeDecision(inc, decision)
      }
      return applyAutonomousDecision(inc, decision)
    })

    const notification = {
      id:        Date.now(),
      text:      isAlert
        ? `ANOMALY FLAGGED on incident #${incidentId} — IXPs alerted autonomously, RPKI push suggested`
        : `AI autonomously acted on incident #${incidentId}`,
      action:    isAlert ? 'ALERT_IXP' : (decision?.immediateAction ?? 'MONITOR'),
      timestamp: new Date(),
      isAlert,
    }

    const activityLog = appendLog(
      state.activityLog,
      logEntry(
        isAlert ? 'INFO' : 'SUCCESS',
        isAlert
          ? `AI AUTONOMOUS: flagged incident #${String(incidentId).padStart(4,'0')} for review and alerted IXPs (low confidence) — RPKI push suggested`
          : `AI DECIDED autonomous response for incident #${String(incidentId).padStart(4,'0')}`,
        incidentId,
      ),
    )

    return {
      incidents,
      activityLog,
      notifications: [notification, ...state.notifications].slice(0, 10),
    }
  }),

  setIncidentRPKI: (incidentId, rpkiStatus) => set(state => ({
    incidents: state.incidents.map(inc =>
      inc.id === incidentId ? { ...inc, rpkiStatus } : inc
    ),
  })),

  setIncidentAttackerCountry: (incidentId, country) => set(state => ({
    incidents: state.incidents.map(inc =>
      inc.id === incidentId
        ? { ...inc, attacker: { ...inc.attacker, country } }
        : inc
    ),
  })),

  // FIX: Also enrich the victim name if it was "Unknown Indian ISP"
  setIncidentVictim: (incidentId, victim) => set(state => ({
    incidents: state.incidents.map(inc =>
      inc.id === incidentId ? { ...inc, victim } : inc
    ),
  })),

  // FIX: Allow confidence to be updated after RPKI enrichment
  setIncidentConfidence: (incidentId, confidence) => set(state => ({
    incidents: state.incidents.map(inc =>
      inc.id === incidentId ? { ...inc, confidence } : inc
    ),
  })),

  addVantageConfirmation: (incidentId, vantagePoint) => set(state => ({
    incidents: state.incidents.map(inc => {
      if (inc.id !== incidentId) return inc
      const existing = inc.confirmedPoints ?? []
      if (existing.includes(vantagePoint) || existing.length >= 8) return inc
      return { ...inc, confirmedPoints: [...existing, vantagePoint] }
    }),
  })),

  dismissNotification: (id) => set(state => ({
    notifications: state.notifications.filter(n => n.id !== id),
  })),

  setActiveTab:  (tab)    => set({ activeTab: tab }),
  setSystemTime: (date)   => set({ systemTime: date }),
  setRisStatus:  (status) => set({ risStatus: status, risError: null }),
  setRisError:   (error)  => set({ risError: error, risStatus: 'error' }),

  incrementRisStats: () => set(state => ({
    risMessageCount: state.risMessageCount + 1,
    risIndianCount:  state.risIndianCount  + 1,
  })),

  setAPNICLoaded: (count) => set({ apnicLoaded: true, apnicCount: count }),
}))

// ── User profile store ────────────────────────────────────────────────────
export const useProfileStore = create((set, get) => ({
  name:         'Yash',
  organization: 'DIGIFARM',
  country:      'India',
  email:        '',
  reportEmail:  '',
  photo:        null,
  priorities:   [],

  setProfile: (fields) => set(state => ({ ...state, ...fields })),
  setPhoto:   (dataUrl) => set({ photo: dataUrl }),

  addPriority: (item) => set(state => ({
    priorities: [{ ...item, id: Date.now() }, ...state.priorities].slice(0, 50),
  })),
  removePriority: (id) => set(state => ({
    priorities: state.priorities.filter(p => p.id !== id),
  })),
}))

// ── Custom monitor store ──────────────────────────────────────────────────
export const useMonitorStore = create((set) => ({
  targets:  [],
  loading:  false,

  addTarget:    (t)  => set(state => ({ targets: [{ ...t, id: Date.now(), routes: [] }, ...state.targets].slice(0, 20) })),
  removeTarget: (id) => set(state => ({ targets: state.targets.filter(t => t.id !== id) })),
  updateRoutes: (id, routes) => set(state => ({
    targets: state.targets.map(t => t.id === id ? { ...t, routes, lastChecked: new Date() } : t),
  })),
  setLoading: (v) => set({ loading: v }),
}))
