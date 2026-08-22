/**
 * Backend sync — translates in-app objects (incident, change-log entry,
 * chat message, activity-log entry) into Supabase rows and fires the
 * insert. Every function here is fire-and-forget: it must never block or
 * throw into the caller (the zustand store), so the UI/demo can't be
 * broken by a network hiccup or a missing .env key.
 */
import { sbInsert, sbInsertMany, sbUpdate } from './supabaseClient.js'

export function syncIncident(incident, { isDemo = false } = {}) {
  const row = {
    id:               String(incident.id),
    type:             incident.type ?? 'UNKNOWN',
    severity:         incident.severity ?? 'LOW',
    status:           incident.status ?? 'DETECTED',
    victim_name:      incident.victim?.name ?? null,
    victim_asn:       incident.victim?.asn ?? null,
    attacker_asn:     incident.attacker?.asn ?? null,
    attacker_country: incident.attacker?.country ?? null,
    prefix:           incident.prefix ?? null,
    confidence:       incident.confidence ?? null,
    is_demo:          isDemo,
    payload:          incident,
    detected_at:      incident.timestamp ?? new Date().toISOString(),
  }
  sbInsert('incidents', row)
}

export function syncIncidentStatus(incidentId, patch) {
  sbUpdate('incidents', { id: String(incidentId) }, { ...patch, updated_at: new Date().toISOString() })
}

export function syncChangeLogEntry(entry, { incidentId = null, isDemo = false } = {}) {
  const row = {
    incident_id: incidentId != null ? String(incidentId) : null,
    entry_type:  entry.type ?? 'ACTION',
    label:       entry.label ?? '',
    payload:     entry,
    is_demo:     isDemo,
    created_at:  entry.timestamp ?? new Date().toISOString(),
  }
  sbInsert('change_log', row)
}

export function syncChatMessage(msg, { sessionId = 'default' } = {}) {
  const row = {
    session_id: sessionId,
    role:       msg.role ?? 'user',
    content:    msg.content ?? msg.text ?? '',
    payload:    msg,
  }
  sbInsert('chat_messages', row)
}

export function syncActivityLogEntry(entry) {
  const row = {
    level:       entry.level ?? 'INFO',
    message:     entry.message ?? '',
    incident_id: entry.incidentId != null ? String(entry.incidentId) : null,
    created_at:  entry.timestamp ?? new Date().toISOString(),
  }
  sbInsert('activity_log', row)
}

/** Bulk-seed all demo incidents + their synthetic activity entries in one go. */
export function syncDemoIncidentsBulk(incidents) {
  const rows = incidents.map(inc => ({
    id:               String(inc.id),
    type:             inc.type ?? 'UNKNOWN',
    severity:         inc.severity ?? 'LOW',
    status:           inc.status ?? 'DETECTED',
    victim_name:      inc.victim?.name ?? null,
    victim_asn:       inc.victim?.asn ?? null,
    attacker_asn:     inc.attacker?.asn ?? null,
    attacker_country: inc.attacker?.country ?? null,
    prefix:           inc.prefix ?? null,
    confidence:       inc.confidence ?? null,
    is_demo:          true,
    payload:          inc,
    detected_at:      inc.timestamp ?? new Date().toISOString(),
  }))
  sbInsertMany('incidents', rows)
}
