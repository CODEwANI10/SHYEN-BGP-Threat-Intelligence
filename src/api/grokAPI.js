// Grok (xAI) API — free tier at console.x.ai
// Model: grok-3-mini

const GROK_URL   = 'https://api.x.ai/v1/chat/completions'
const GROK_MODEL = 'grok-3-mini'

const SYSTEM_PROMPT = `You are SHYEN, an elite autonomous BGP security analyst for India's national internet infrastructure. Analyze BGP hijack incidents with military precision.
Respond in exactly 3 labeled sections (no markdown, no asterisks, no hashes):
THREAT SUMMARY: 2-3 sentences on what happened and the immediate danger to Indian internet users.
ATTACK VECTOR: 2-3 technical sentences on the BGP mechanism exploited and propagation path.
RECOMMENDED ACTIONS: exactly 3 numbered action items starting with strong action verbs.
Total response under 220 words. Use technical language. Be direct and authoritative.`

function buildPrompt(inc) {
  return `Analyze this live BGP hijack incident on Indian critical infrastructure:
Victim: ${inc.victim.name} (${inc.victim.asn}) | Sector: ${inc.victim.sector}
Attack Type: ${inc.type.replace(/_/g,' ')}
Hijacked Prefix: ${inc.prefix}
Attacker: ${inc.attacker.asn} (${inc.attacker.name}, ${inc.attacker.country})
Affected IPs: ${inc.affectedIPs.toLocaleString()}
Vantage Confirmations: ${inc.confirmedPoints.length}/10 global points
Confidence: ${inc.confidence}%
Severity: ${inc.severity}
Global Propagation: ${inc.propagationPct}%
Attack ID: INC-${new Date().getFullYear()}-${String(inc.id).padStart(4,'0')}`
}

export async function analyzeWithGrok(incident, apiKey, signal) {
  if (!apiKey) {
    return 'Grok API key not configured. Open ⚙ Settings and enter your xAI key (free at console.x.ai).'
  }
  const r = await fetch(GROK_URL, {
    method: 'POST', signal,
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROK_MODEL, max_tokens:700, temperature:0.15,
      messages:[
        { role:'system', content:SYSTEM_PROMPT },
        { role:'user',   content:buildPrompt(incident) },
      ],
    }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(()=>'')
    throw new Error(`Grok ${r.status}: ${txt.slice(0,140)}`)
  }
  const d = await r.json()
  return d.choices?.[0]?.message?.content ?? 'Analysis unavailable.'
}

// Admin chat endpoint — passes full conversation history
export async function chatWithGrok(messages, systemContext, apiKey, signal) {
  if (!apiKey) return 'Grok API key required for Admin Chat.'
  const r = await fetch(GROK_URL, {
    method:'POST', signal,
    headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${apiKey}` },
    body:JSON.stringify({
      model:GROK_MODEL, max_tokens:800, temperature:0.2,
      messages:[
        { role:'system', content:systemContext },
        ...messages.slice(-10).map(m=>({ role:m.role, content:m.content })),
      ],
    }),
  })
  if (!r.ok) { const t=await r.text().catch(()=>''); throw new Error(`Grok ${r.status}: ${t.slice(0,120)}`) }
  return (await r.json()).choices?.[0]?.message?.content ?? 'Response unavailable.'
}

// CERT-In report generator
export async function generateCERTInReport(incident, analysis, apiKey, signal) {
  if (!apiKey) return 'API key required to generate CERT-In report.'
  const incId = `CERT-IN-BGP-${new Date().getFullYear()}-${String(incident.id).padStart(4,'0')}`
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

  const r = await fetch(GROK_URL, {
    method:'POST', signal,
    headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${apiKey}` },
    body:JSON.stringify({ model:GROK_MODEL, max_tokens:2000, temperature:0.1,
      messages:[
        { role:'system', content:'You are a CERT-In cybersecurity specialist generating formal Indian government incident reports. Be precise, formal, and thorough.' },
        { role:'user', content:prompt },
      ],
    }),
  })
  if (!r.ok) { const t=await r.text().catch(()=>''); throw new Error(`Grok ${r.status}: ${t.slice(0,120)}`) }
  const data = await r.json()
  return { id:incId, text:data.choices?.[0]?.message?.content??'Report generation failed.', generatedAt:new Date() }
}

// ISP NOC notification drafter
export async function generateISPNotification(incident, analysis, apiKey, signal) {
  if (!apiKey) return 'API key required.'
  const prompt = `Draft an urgent ISP NOC notification email for this BGP incident:
Incident: ${incident.type} on ${incident.victim.name} (${incident.victim.asn})
Hijacked Prefix: ${incident.prefix}
Attacker: ${incident.attacker.asn} (${incident.attacker.country})
Severity: ${incident.severity}
Analysis: ${analysis?.slice(0,300) ?? 'Pending'}

Format: TO: noc@isp.in | SUBJECT | BODY with technical details, AS numbers, affected prefixes, immediate actions needed (RPKI ROA push, filter recommendations), response deadline within 2 hours. Sign as SHYEN Automated Threat Response System.`
  const r = await fetch(GROK_URL, {
    method:'POST', signal,
    headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${apiKey}` },
    body:JSON.stringify({ model:GROK_MODEL, max_tokens:1000, temperature:0.15,
      messages:[
        { role:'system', content:'You are a senior network security engineer drafting urgent ISP NOC notifications. Be technical, precise, immediately actionable.' },
        { role:'user', content:prompt },
      ],
    }),
  })
  if (!r.ok) { const t=await r.text().catch(()=>''); throw new Error(`Grok ${r.status}: ${t.slice(0,120)}`) }
  return (await r.json()).choices?.[0]?.message?.content ?? 'Generation failed.'
}
