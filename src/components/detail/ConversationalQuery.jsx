import { useState } from 'react'
import { callTextAI } from '../../api/autonomousAI.js'

const SYSTEM_PROMPT = `You are SHYEN, an expert BGP security analyst for India's national internet infrastructure. Answer questions about BGP incidents concisely and technically. Keep answers under 100 words. No markdown formatting.`

async function queryAI(question, context) {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY
  const hfKey   = import.meta.env.VITE_HF_API_KEY
  if (!groqKey && !hfKey) return 'No AI provider configured. Add VITE_GROQ_API_KEY or VITE_HF_API_KEY to .env.local'

  try {
    // Routed through the shared Groq rate-limit queue with HuggingFace
    // fallback — avoids competing uncoordinated with the autonomous
    // decision engine and the AI analysis panel, which previously caused
    // repeated 429s and required asking 2-3 times before getting a reply.
    const result = await callTextAI(
      SYSTEM_PROMPT,
      `Current incidents:\n${context}\n\nQuestion: ${question}`,
      200,
      0.3,
    )
    return result ?? 'No response from AI. Please try again in a moment.'
  } catch (e) {
    return `Query error: ${e.message}`
  }
}

export default function ConversationalQuery({ incidents, compact }) {
  const [query,   setQuery]   = useState('')
  const [answer,  setAnswer]  = useState('')
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)

  const SUGGESTIONS = [
    'Which sector is most targeted?',
    'Summarize all CRITICAL incidents',
    'Which attacker is most active?',
    'What happened in the last hour?',
  ]

  async function ask(q) {
    if (!q.trim()) return
    setLoading(true)
    setAnswer('')
    setOpen(true)
    const context = (incidents ?? []).slice(0, 10).map(i =>
      `[${i.severity}] ${i.type} on ${i.victim?.name} (${i.victim?.sector}) from ${i.attacker?.asn} [${i.attacker?.country}] - status: ${i.status}`
    ).join('\n')
    const result = await queryAI(q, context)
    setAnswer(result)
    setLoading(false)
  }

  if (compact) {
    return (
      <div style={{ marginTop:8 }}>
        <button onClick={() => setOpen(!open)} style={{
          width:'100%', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700,
          color:'#fff', letterSpacing:'0.1em',
          background:'linear-gradient(135deg, #6b46c1, #553c9a)',
          border:'none', borderRadius:4, padding:'10px 0', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>✦ Analyze Incident</button>

        {open && (
          <div style={{ marginTop:8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQuery(s); ask(s) }} style={{
                  fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)',
                  background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)',
                  borderRadius:3, padding:'3px 7px', cursor:'pointer',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask(query)}
                placeholder="Ask anything..."
                style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:9,
                  background:'rgba(0,0,0,0.3)', border:'1px solid var(--border-mid)',
                  color:'var(--text-primary)', borderRadius:3, padding:'5px 8px', outline:'none' }} />
              <button onClick={() => ask(query)} disabled={loading || !query.trim()} style={{
                fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'#000',
                background: loading ? '#333' : 'var(--accent-green)',
                border:'none', borderRadius:3, padding:'0 10px', cursor:'pointer',
              }}>{loading ? '...' : 'ASK'}</button>
            </div>
            {answer && (
              <pre style={{ marginTop:6, padding:'6px 8px', background:'rgba(0,255,136,0.04)',
                border:'1px solid rgba(0,255,136,0.12)', borderRadius:3,
                fontFamily:'var(--font-mono)', fontSize:9, color:'#99ffcc',
                lineHeight:1.7, whiteSpace:'pre-wrap', margin:'6px 0 0' }}>{answer}</pre>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop:16, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border-subtle)', borderRadius:4, padding:12 }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--accent-green)', letterSpacing:'0.15em', marginBottom:10 }}>◈ ASK SHYEN</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQuery(s); ask(s) }} style={{
            fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)',
            background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)',
            borderRadius:3, padding:'3px 8px', cursor:'pointer',
          }}>{s}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask(query)}
          placeholder="Ask anything about current incidents..."
          style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:10,
            background:'rgba(0,0,0,0.3)', border:'1px solid var(--border-mid)',
            color:'var(--text-primary)', borderRadius:3, padding:'6px 10px', outline:'none' }} />
        <button onClick={() => ask(query)} disabled={loading || !query.trim()} style={{
          fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color:'#000',
          background: loading ? '#333' : 'var(--accent-green)',
          border:'none', borderRadius:3, padding:'0 12px', cursor:'pointer',
        }}>{loading ? '...' : 'ASK'}</button>
      </div>
      {answer && (
        <pre style={{ marginTop:10, padding:'8px 10px', background:'rgba(0,255,136,0.04)',
          border:'1px solid rgba(0,255,136,0.12)', borderRadius:3,
          fontFamily:'var(--font-mono)', fontSize:9, color:'#99ffcc',
          lineHeight:1.7, whiteSpace:'pre-wrap', margin:'10px 0 0' }}>{answer}</pre>
      )}
    </div>
  )
}
