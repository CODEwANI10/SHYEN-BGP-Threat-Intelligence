/**
 * Autonomous AI Decision Engine — v4 (Real models, real data)
 *
 * MODEL UPGRADES:
 *  QUEUE 1  →  VITE_GROQ_API_KEY    →  llama-3.3-70b-versatile  (was: same, kept)
 *              High-accuracy JSON autonomous decisions
 *
 *  QUEUE 2  →  VITE_GROQ_API_KEY_2  →  llama-3.1-8b-instant     (was: llama3-8b-8192, deprecated)
 *              Fast text analysis + conversational queries
 *              Falls back to queue 1 when key 2 is absent
 *
 *  HuggingFace →  meta-llama/Llama-3.1-8B-Instruct (was: zephyr-7b-beta, often unavailable)
 *              Shared fallback for both queues
 *
 * Two completely independent Groq queues — no shared state, no contention.
 * Each queue has its own 12 s min-interval and 30 s 429-backoff.
 */

const GROQ_KEY_1 = import.meta.env.VITE_GROQ_API_KEY       // decisions
const GROQ_KEY_2 = import.meta.env.VITE_GROQ_API_KEY_2     // text / analysis
const HF_KEY     = import.meta.env.VITE_HF_API_KEY

// ── Models ────────────────────────────────────────────────────────────────
const GROQ_DECISION_MODEL = 'llama-3.3-70b-versatile'   // best accuracy for JSON
const GROQ_TEXT_MODEL     = 'llama-3.1-8b-instant'      // fast, high RPM
// HuggingFace models — ordered by reliability (free inference tier, no auth gate)
// zephyr-7b-beta removed: requires paid HF Pro / often returns 401
// Llama-3.1-8B-Instruct removed: gated model, requires HF token with model access approved
const HF_MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.3',
  'microsoft/Phi-3-mini-4k-instruct',
  'tiiuae/falcon-7b-instruct',
]

const DECISION_PROMPT = `You are SHYEN, an autonomous BGP security AI for India's national internet infrastructure.
Analyze BGP hijack incidents and return ONLY a valid JSON object. No markdown. No explanation. No text before or after the JSON.
Return exactly this structure:
{
  "threatLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "attackConfirmed": true | false,
  "immediateAction": "PUSH_RPKI" | "ALERT_IXP" | "FORENSICS" | "MONITOR",
  "reasoning": "one sentence max",
  "estimatedImpact": "one sentence max",
  "recommendRPKI": true | false,
  "recommendIXP": true | false
}`

const ALERT_PROMPT = `You are SHYEN, an autonomous BGP security AI for India's national internet infrastructure.
An anomaly has been detected with LOW confidence. Generate safeguarding recommendations.
Return ONLY a valid JSON object with no markdown, no explanation:
{
  "alertLevel": "WATCH" | "ADVISORY",
  "summary": "one sentence describing the anomaly",
  "safeguards": ["measure 1", "measure 2", "measure 3"],
  "monitorFor": "what to watch for next",
  "escalateIf": "condition that would raise confidence"
}`

// ── JSON extractor ────────────────────────────────────────────────────────
function extractJSON(text) {
  const stripped = text.replace(/```json|```/gi, '').trim()
  const start = stripped.indexOf('{')
  const end   = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try { return JSON.parse(stripped.slice(start, end + 1)) } catch { return null }
}

// ── Queue factory ─────────────────────────────────────────────────────────
const GROQ_MIN_INTERVAL = 4000

function _makeGroqQueue(label) {
  let lastCall     = 0
  let backoffUntil = 0
  const queue      = []
  let processing   = false

  function schedule(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      if (!processing) _process()
    })
  }

  async function _process() {
    if (processing || queue.length === 0) return
    processing = true
    while (queue.length > 0) {
      const minWait     = lastCall + GROQ_MIN_INTERVAL - Date.now()
      const backoffWait = backoffUntil - Date.now()
      const wait        = Math.max(0, minWait, backoffWait)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      const { fn, resolve, reject } = queue.shift()
      try {
        lastCall = Date.now()
        const result = await fn()
        resolve(result)
      } catch (err) {
        if (err?.status === 429) {
          backoffUntil = Date.now() + 30000
          console.warn(`[SHYEN AI ${label}] Rate limited — backing off 30 s`)
          resolve('RATE_LIMITED')
        } else {
          reject(err)
        }
      }
    }
    processing = false
  }

  return { schedule }
}

const queue1 = _makeGroqQueue('KEY1')
const queue2 = _makeGroqQueue('KEY2')

// ── Groq caller: queue 1 → decisions ─────────────────────────────────────
async function _fetchGroq1(systemPrompt, userContent, maxTokens, temperature = 0.1, model = GROQ_DECISION_MODEL) {
  if (!GROQ_KEY_1) return null
  return queue1.schedule(async () => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY_1}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (res.status === 429) { const e = new Error('Rate limited'); e.status = 429; throw e }
    if (!res.ok) { console.warn(`[SHYEN AI KEY1] Groq ${res.status}`); return null }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  })
}

// ── Groq caller: queue 2 → text (key 2 first, falls back to key 1) ───────
async function _fetchGroq2(systemPrompt, userContent, maxTokens, temperature = 0.2) {
  const key = GROQ_KEY_2 || GROQ_KEY_1
  if (!key) return null
  const q = GROQ_KEY_2 ? queue2 : queue1
  return q.schedule(async () => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (res.status === 429) { const e = new Error('Rate limited'); e.status = 429; throw e }
    if (!res.ok) { console.warn(`[SHYEN AI KEY2] Groq ${res.status}`); return null }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  })
}

async function callGroq(systemPrompt, userContent, maxTokens = 250) {
  const text = await _fetchGroq1(systemPrompt, userContent, maxTokens)
  if (!text || text === 'RATE_LIMITED') return text ?? null
  return extractJSON(text)
}

async function callGroqText(systemPrompt, userContent, maxTokens = 400, temperature = 0.2) {
  return _fetchGroq2(systemPrompt, userContent, maxTokens, temperature)
}

// ── HuggingFace fallback ──────────────────────────────────────────────────
async function _tryHFModel(model, systemPrompt, userContent, maxTokens, temperature) {
  try {
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${HF_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    // 401 = bad/missing HF key — no point trying other models, key itself is invalid
    if (res.status === 401) {
      console.warn(`[SHYEN AI] HuggingFace 401 — check VITE_HF_API_KEY`)
      return 'AUTH_FAILED'
    }
    if (!res.ok) {
      console.warn(`[SHYEN AI] HuggingFace ${res.status} for ${model}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  } catch (err) {
    console.warn(`[SHYEN AI] HuggingFace error for ${model}:`, err.message)
    return null
  }
}

async function _fetchHF(systemPrompt, userContent, maxTokens, temperature = 0.1) {
  if (!HF_KEY) { console.warn('[SHYEN AI] No HF_API_KEY set'); return null }
  for (const model of HF_MODELS) {
    const result = await _tryHFModel(model, systemPrompt, userContent, maxTokens, temperature)
    if (result === 'AUTH_FAILED') return null  // key is bad — stop trying
    if (result !== null) return result
  }
  console.warn('[SHYEN AI] All HuggingFace models failed')
  return null
}

async function callHuggingFace(systemPrompt, userContent, maxTokens = 250) {
  const text = await _fetchHF(systemPrompt, userContent, maxTokens, 0.1)
  return text ? extractJSON(text) : null
}

export async function callHuggingFaceText(systemPrompt, userContent, maxTokens = 400, temperature = 0.2) {
  return _fetchHF(systemPrompt, userContent, maxTokens, temperature)
}

// ── Local deterministic fallback ──────────────────────────────────────────
function _localDecisionFallback(incident) {
  const c   = incident.confidence ?? 0
  const pts = incident.confirmedPoints?.length ?? 0
  return {
    threatLevel:     c >= 90 ? 'CRITICAL' : c >= 80 ? 'HIGH' : 'MEDIUM',
    attackConfirmed: true,
    immediateAction: (pts >= 6 || c >= 85) ? 'PUSH_RPKI' : 'ALERT_IXP',
    reasoning:       `${c}% confidence BGP hijack on ${incident.prefix} — ${pts}/8 vantage confirmations.`,
    estimatedImpact: `~${(incident.affectedIPs ?? 0).toLocaleString()} IPs potentially rerouted via ${incident.attacker?.country ?? 'unknown'} AS.`,
    recommendRPKI:   c >= 80,
    recommendIXP:    true,
    _source: 'local-fallback',
  }
}

function _localSummaryFallback(incident) {
  const c = incident.confidence ?? 0
  return {
    alertLevel: c >= 60 ? 'ADVISORY' : 'WATCH',
    summary:    `Anomalous BGP announcement on ${incident.prefix} from ${incident.attacker?.asn ?? '?'} at ${c}% confidence.`,
    safeguards: [
      'Enable RPKI validation for affected prefix in upstream routers',
      'Monitor BGP path announcements from adjacent ASes for 60 min',
      'Alert NOC team for manual routing-table inspection',
    ],
    monitorFor:  'Rising vantage-point count or propagation spread above 40%',
    escalateIf:  `Confidence exceeds 75% or additional ISPs confirm rerouting of ${incident.prefix}`,
    _source: 'local-fallback',
  }
}

// ── Smart callers ─────────────────────────────────────────────────────────
async function callDecisionAI(systemPrompt, userContent, maxTokens = 250) {
  const r = await callGroq(systemPrompt, userContent, maxTokens)
  if (r && r !== 'RATE_LIMITED') return r
  // Groq unavailable → try HuggingFace
  return callHuggingFace(systemPrompt, userContent, maxTokens)
}

async function callSummaryAI(systemPrompt, userContent, maxTokens = 300) {
  const hf = await callHuggingFace(systemPrompt, userContent, maxTokens)
  if (hf) return hf
  const r = await callGroq(systemPrompt, userContent, maxTokens)
  if (r && r !== 'RATE_LIMITED') return r
  return null
}

export async function callTextAI(systemPrompt, userContent, maxTokens = 400, temperature = 0.2) {
  const r = await callGroqText(systemPrompt, userContent, maxTokens, temperature)
  if (r && r !== 'RATE_LIMITED') return r
  return (await callHuggingFaceText(systemPrompt, userContent, maxTokens, temperature)) ?? null
}

// ── Incident context builder ──────────────────────────────────────────────
function buildIncidentContext(incident) {
  return `Incident: ${incident.type} on ${incident.victim?.name} (${incident.victim?.sector}) ` +
    `prefix ${incident.prefix} by ${incident.attacker?.asn} [${incident.attacker?.country}]. ` +
    `Confidence: ${incident.confidence}%. Affected IPs: ${incident.affectedIPs}. ` +
    `Vantage confirmations: ${incident.confirmedPoints?.length ?? 0}/8. ` +
    `Repeat attacker: ${incident.isRepeatAttacker ?? false}. ` +
    `RPKI status: ${incident.rpkiStatus?.state ?? 'unknown'}.`
}

// ── Main export ───────────────────────────────────────────────────────────
export async function autonomousDecision(incident, onAnalyzing) {
  if (!GROQ_KEY_1 && !GROQ_KEY_2 && !HF_KEY) return null

  const isHighConfidence = incident.confidence >= 75
  onAnalyzing?.()

  if (isHighConfidence) {
    const decision = await callDecisionAI(DECISION_PROMPT, buildIncidentContext(incident), 250)
    return decision
      ? { mode: 'autonomous', ...decision }
      : { mode: 'autonomous', ..._localDecisionFallback(incident) }
  } else {
    const alert = await callSummaryAI(ALERT_PROMPT, buildIncidentContext(incident), 300)
    return alert
      ? { mode: 'alert', ...alert }
      : { mode: 'alert', ..._localSummaryFallback(incident) }
  }
}
