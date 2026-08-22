// Groq API — fast inference for Admin Chat, CERT-In reports, ISP notifications
// Docs: https://console.groq.com/docs/openai
//
// Model constants — configurable via VITE_GROQ_MODEL_FAST / VITE_GROQ_MODEL_ACCURATE
// (same env vars used by autonomousAI.js) so the model can be changed in one
// place without touching this or any other file. Falls back to the current
// defaults when those env vars aren't set.
// Chat/conversational: fast text model.
// Reports/notifications: high-accuracy model for formal document generation.
const GROQ_URL          = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_CHAT_MODEL   = import.meta.env.VITE_GROQ_MODEL_FAST     || 'openai/gpt-oss-20b'   // fast, high RPM — admin chat
const GROQ_REPORT_MODEL = import.meta.env.VITE_GROQ_MODEL_ACCURATE || 'openai/gpt-oss-120b'  // high accuracy — formal reports

function getKey() {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key) throw new Error('Groq API is not configured. Please set VITE_GROQ_API_KEY.')
  return key
}

// Shared request helper — timeout guard + sanitized error messages, used by
// all three Groq calls below. Without a timeout, a stalled network request
// left the caller's loading state stuck indefinitely with no error and no
// way to retry (Section 12 "network timeout" requirement). 25s is generous
// for a single chat/report completion. Raw upstream error bodies are logged
// to the console for debugging but never surfaced to the browser, since
// they can echo request internals.
async function fetchGroq(key, body, signal) {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), 25000)
  const onCallerAbort = () => timeoutController.abort()
  if (signal) signal.addEventListener('abort', onCallerAbort, { once: true })

  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST', signal: timeoutController.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      console.error(`Groq request failed (${r.status}):`, t)
      throw new Error('Unable to contact the AI service. Please try again.')
    }
    return await r.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(signal?.aborted ? 'Request cancelled.' : 'Request timed out. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', onCallerAbort)
  }
}

// Admin Chat endpoint — passes full conversation history
// apiKey parameter kept for backward compatibility but env var takes priority.
export async function chatWithGroq(messages, systemContext, _apiKey, signal) {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key) return 'Groq API is not configured. Please set VITE_GROQ_API_KEY.'

  const data = await fetchGroq(key, {
    model: GROQ_CHAT_MODEL, max_tokens: 800, temperature: 0.2,
    messages: [
      { role: 'system', content: systemContext },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
    ],
  }, signal)
  return data.choices?.[0]?.message?.content ?? 'Response unavailable.'
}

// CERT-In report generator
export async function generateCERTInReport(incident, analysis, _apiKey, signal) {
  const key = getKey()
  const incId = `CERT-IN-BGP-${new Date().getFullYear()}-${String(incident.id).padStart(4, '0')}`
  const prompt = `Generate a formal CERT-In (Indian Computer Emergency Response Team) incident report.
INCIDENT_ID: ${incId}
DATE/TIME: ${new Date(incident.timestamp).toISOString()} IST
VICTIM: ${incident.victim.name} (${incident.victim.asn}) — ${incident.victim.sector}
ATTACK_TYPE: ${incident.type}
HIJACKED_PREFIX: ${incident.prefix}
ATTACKER_ASN: ${incident.attacker.asn} (${incident.attacker.country})
AFFECTED_IPs: ${incident.affectedIPs.toLocaleString()}
CONFIDENCE: ${incident.confidence}%
SEVERITY: ${incident.severity}
AI_ANALYSIS: ${analysis ?? 'Pending'}

Write a complete formal CERT-In incident report with sections: Executive Summary, Incident Classification, Affected Infrastructure, Technical Timeline, BGP Analysis (AS paths, RPKI validity, prefix scope), Impact Assessment, Indicators of Compromise (IOCs), Immediate Actions Required, Recommendations for ISPs and NIXI, RPKI ROA remediation steps. No markdown formatting.`

  const data = await fetchGroq(key, {
    model: GROQ_REPORT_MODEL, max_tokens: 2000, temperature: 0.1,
    messages: [
      { role: 'system', content: 'You are a CERT-In cybersecurity specialist generating formal Indian government incident reports. Be precise, formal, and thorough.' },
      { role: 'user', content: prompt },
    ],
  }, signal)
  return { id: incId, text: data.choices?.[0]?.message?.content ?? 'Report generation failed.', generatedAt: new Date() }
}

// ISP NOC notification drafter
export async function generateISPNotification(incident, analysis, _apiKey, signal) {
  const key = getKey()
  const prompt = `Draft an urgent ISP NOC notification email for this BGP incident:
Incident: ${incident.type} on ${incident.victim.name} (${incident.victim.asn})
Hijacked Prefix: ${incident.prefix}
Attacker: ${incident.attacker.asn} (${incident.attacker.country})
Severity: ${incident.severity}
Analysis: ${analysis?.slice(0, 300) ?? 'Pending'}

Format: TO: noc@isp.in | SUBJECT | BODY with technical details, AS numbers, affected prefixes, immediate actions needed (RPKI ROA push, filter recommendations), response deadline within 2 hours. Sign as SHYEN Automated Threat Response System.`
  const data = await fetchGroq(key, {
    model: GROQ_REPORT_MODEL, max_tokens: 1000, temperature: 0.15,
    messages: [
      { role: 'system', content: 'You are a senior network security engineer drafting urgent ISP NOC notifications. Be technical, precise, immediately actionable.' },
      { role: 'user', content: prompt },
    ],
  }, signal)
  return data.choices?.[0]?.message?.content ?? 'Generation failed.'
}
