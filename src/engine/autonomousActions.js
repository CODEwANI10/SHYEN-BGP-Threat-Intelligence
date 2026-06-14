export function getAutonomousActions(decision) {
  const immediateAction = decision?.immediateAction
  const actions = []

  if (decision?.recommendRPKI || immediateAction === 'PUSH_RPKI') {
    actions.push({ field: 'rpkiPushed', label: 'PUSH RPKI' })
  }

  if (decision?.recommendIXP || immediateAction === 'ALERT_IXP') {
    actions.push({ field: 'ixpAlerted', label: 'ALERT IXPs' })
  }

  if (immediateAction === 'FORENSICS') {
    actions.push({ field: 'forensicsReady', label: 'FORENSICS' })
  }

  // Always include all three for high-confidence decisions — full response pipeline
  if (decision?.attackConfirmed && decision?.threatLevel === 'CRITICAL') {
    if (!actions.find(a => a.field === 'rpkiPushed'))   actions.push({ field: 'rpkiPushed',     label: 'PUSH RPKI' })
    if (!actions.find(a => a.field === 'ixpAlerted'))   actions.push({ field: 'ixpAlerted',     label: 'ALERT IXPs' })
    if (!actions.find(a => a.field === 'forensicsReady')) actions.push({ field: 'forensicsReady', label: 'FORENSICS' })
  }

  return actions
}

export function getAlertModeActions() {
  return [
    { field: 'flagged',    label: 'FLAG FOR REVIEW' },
    { field: 'ixpAlerted', label: 'ALERT IXPs' },
  ]
}

export function applyAutonomousDecision(incident, decision) {
  const actions = getAutonomousActions(decision)
  const updated = {
    ...incident,
    aiDecided: true,
    aiAnalyzing: false,
    aiDecision: decision,
    aiDecidedAt: new Date().toISOString(),
    autonomousActionsExecuted: actions.map(action => action.label),
  }

  actions.forEach(action => {
    updated[action.field] = true
  })

  // FIX: Mark MITIGATED as soon as RPKI+IXP are both done (by AI or user)
  // Also mark MITIGATED if AI confirmed attack and executed full response
  if (updated.rpkiPushed && updated.ixpAlerted) {
    updated.status = 'MITIGATED'
    updated.mitigatedAt = new Date().toISOString()
    updated.mitigationMs = updated.aiDecidedAt
      ? new Date(updated.aiDecidedAt) - new Date(updated.timestamp)
      : null
  }

  return updated
}

export function applyAlertModeDecision(incident, decision) {
  const actions = getAlertModeActions()
  const updated = {
    ...incident,
    aiAnalyzing: false,
    aiAlerted: true,
    aiAlert: decision,
    aiDecidedAt: new Date().toISOString(),
    autonomousActionsExecuted: actions.map(action => action.label),
  }

  actions.forEach(action => {
    updated[action.field] = true
  })

  return updated
}
