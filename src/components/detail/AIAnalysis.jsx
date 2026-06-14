import { useState, useEffect, useRef } from 'react'
import { analyzeIncident } from '../../api/groqAPI.js'

export default function AIAnalysis({ incident, compact }) {
  const [text,    setText]    = useState(null)
  const [loading, setLoading] = useState(false)
  const lastIdRef = useRef(null)

  useEffect(() => {
    if (!incident || incident.id === lastIdRef.current) return
    lastIdRef.current = incident.id

    const controller = new AbortController()
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      setText('AI analysis timed out. Manual review required.')
      setLoading(false)
    }, 30000)

    setLoading(true)
    setText(null)

    analyzeIncident(incident, controller.signal)
      .then(result => {
        if (!timedOut) { clearTimeout(timer); setText(result); setLoading(false) }
      })
      .catch(err => {
        if (!timedOut && err.name !== 'AbortError') {
          clearTimeout(timer); setText('AI analysis service unavailable. Manual review required.'); setLoading(false)
        }
      })

    return () => { clearTimeout(timer); controller.abort() }
  }, [incident?.id])

  if (compact) {
    return (
      <div style={{
        padding:'8px 10px', background:'rgba(0,191,255,0.04)',
        border:'1px solid rgba(0,191,255,0.15)', borderRadius:3,
      }}>
        {loading ? (
          <div style={{ display:'flex', gap:5, alignItems:'center', padding:'4px 0' }}>
            {[0,0.16,0.32,0.48,0.64].map((d,i) => (
              <div key={i} style={{ width:5, height:5, background:'var(--accent-blue)', borderRadius:'50%', animation:`dotBounce 1.4s ease-in-out ${d}s infinite` }} />
            ))}
            <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', marginLeft:6 }}>Analyzing incident...</span>
          </div>
        ) : (
          <pre style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'#99d6ff', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0, wordBreak:'break-word' }}>
            {text || 'Awaiting analysis...'}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom:16, background:'rgba(0,191,255,0.04)', border:'1px solid rgba(0,191,255,0.15)', borderRadius:4, padding:16 }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--accent-blue)', letterSpacing:2, marginBottom:10 }}>
        ▸ SHYEN AUTONOMOUS ANALYSIS · groq (primary) / huggingface (fallback)
      </div>
      {loading ? (
        <div style={{ display:'flex', gap:6, alignItems:'center', padding:'8px 0' }}>
          {[0,0.16,0.32,0.48,0.64].map((d,i) => (
            <div key={i} style={{ width:6, height:6, background:'var(--accent-blue)', borderRadius:'50%', animation:`dotBounce 1.4s ease-in-out ${d}s infinite` }} />
          ))}
        </div>
      ) : (
        <pre style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'#99d6ff', lineHeight:1.8, whiteSpace:'pre-wrap', margin:0, wordBreak:'break-word' }}>
          {text}
        </pre>
      )}
    </div>
  )
}
