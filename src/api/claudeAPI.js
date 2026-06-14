// Anthropic Claude API — claude-sonnet-4-20250514
// Set VITE_ANTHROPIC_API_KEY in .env.local

const SYSTEM_PROMPT = `You are SHYEN, an autonomous BGP security analyst for India's national internet infrastructure. Analyze BGP hijack incidents with precision and urgency.
Respond in exactly 3 labeled sections (no markdown, no asterisks, no hashes):
THREAT SUMMARY: 2-3 sentences on what happened and the immediate danger.
ATTACK VECTOR: 2-3 sentences on the BGP mechanism exploited and propagation.
RECOMMENDED ACTIONS: exactly 3 numbered action items starting with action verbs.
Total response under 220 words. Use technical language.`

function buildPrompt(inc) {
  return `Analyze BGP hijack incident:
Victim: ${inc.victim.name} (${inc.victim.asn}) | Sector: ${inc.victim.sector}
Attack: ${inc.type.replace(/_/g,' ')}
Prefix: ${inc.prefix}
Attacker: ${inc.attacker.asn} (${inc.attacker.name}, ${inc.attacker.country})
IPs Affected: ${inc.affectedIPs.toLocaleString()}
Vantage Points: ${inc.confirmedPoints.length}/10
Confidence: ${inc.confidence}%
Severity: ${inc.severity}`
}

export async function analyzeWithClaude(incident, apiKey, signal) {
  const key = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) return 'Claude API key not configured. Open ⚙ Settings or set VITE_ANTHROPIC_API_KEY in .env.local'
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST', signal,
    headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({
      model:'claude-sonnet-4-20250514', max_tokens:700,
      system:SYSTEM_PROMPT,
      messages:[{ role:'user', content:buildPrompt(incident) }],
    }),
  })
  const d = await r.json()
  if (d.error) {
    if (d.error.type==='authentication_error') return 'Claude API key invalid. Check VITE_ANTHROPIC_API_KEY.'
    return `Claude error: ${d.error.message}`
  }
  return d.content?.find(c=>c.type==='text')?.text ?? 'Analysis unavailable.'
}

// Keep backward compat export
export const analyzeIncident = analyzeWithClaude
