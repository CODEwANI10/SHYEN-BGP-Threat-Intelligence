/**
 * groqAPI.js — Incident text analysis
 * Uses llama-3.1-8b-instant (fast) via the shared text queue in autonomousAI.js
 * Model was llama3-8b-8192 (deprecated) — fixed to llama-3.1-8b-instant
 */
import { callTextAI } from './autonomousAI.js'

const SYSTEM_PROMPT = `You are SHYEN, an autonomous BGP security analyst for India's national internet infrastructure. Analyze BGP hijack incidents with precision and urgency.
Respond in exactly 3 labeled sections with no markdown formatting:
THREAT ASSESSMENT: 2-3 sentences on what happened and why it is dangerous.
ATTACK VECTOR: 2-3 sentences on the technical mechanism of this attack.
RECOMMENDED ACTIONS: exactly 3 bullet points starting with action verbs.
Total response under 180 words. Use technical language. No asterisks. No hashes.`

function buildUserPrompt(incident) {
  return `Analyze this BGP hijack incident:
Victim: ${incident.victim.name} (${incident.victim.asn}) | Sector: ${incident.victim.sector}
Attack Type: ${incident.type}
Hijacked Prefix: ${incident.prefix}
Attacker: ${incident.attacker.asn} (${incident.attacker.name}) | Country: ${incident.attacker.country}
Affected IPs: ${incident.affectedIPs}
Vantage Confirmations: ${incident.confirmedPoints.length}/8
Confidence Score: ${incident.confidence}%
Severity: ${incident.severity}
RPKI Status: ${incident.rpkiStatus?.state ?? 'unknown'}
Repeat Attacker: ${incident.isRepeatAttacker ? 'YES — seen ' + incident.repeatCount + ' times' : 'No'}`
}

export async function analyzeIncident(incident, signal) {
  const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY
  const HF_KEY   = import.meta.env.VITE_HF_API_KEY
  if (!GROQ_KEY && !HF_KEY) {
    return 'API key not configured. Add VITE_GROQ_API_KEY or VITE_HF_API_KEY to .env.local'
  }

  try {
    const racePromise = callTextAI(SYSTEM_PROMPT, buildUserPrompt(incident), 600, 0.3)
    const result = signal
      ? await new Promise((resolve, reject) => {
          if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
          const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
          signal.addEventListener('abort', onAbort, { once: true })
          racePromise.then(r => { signal.removeEventListener('abort', onAbort); resolve(r) },
                            e => { signal.removeEventListener('abort', onAbort); reject(e) })
        })
      : await racePromise

    return result ?? 'AI analysis service unavailable. Manual review required.'
  } catch (err) {
    if (err.name === 'AbortError') throw err
    return 'AI analysis service unavailable. Manual review required.'
  }
}
