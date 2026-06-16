import { useState, useRef, useEffect } from 'react'
import { useSHYENStore } from '../../store/useSHYENStore.js'
import { chatWithGrok } from '../../api/grokAPI.js'

const SYSTEM_CTX = (incidents, log) =>
`You are SHYEN's Admin Assistant — expert in BGP security and Indian internet infrastructure.
Current state: ${incidents.filter(i=>i.status==='DETECTED').length} active incidents, ${incidents.filter(i=>i.status==='MITIGATED').length} mitigated.
Recent alerts: ${incidents.slice(0,3).map(i=>`${i.severity} on ${i.victim.name} (${i.victim.asn})`).join('; ')}.
Answer technical questions about BGP hijacks, RPKI, CERT-In procedures, Indian ISP topology, and mitigation strategies. Be concise and actionable.`

const SUGGESTIONS = [
  'Summarise all critical incidents',
  'What is RPKI and why does India need it?',
  'Which Indian ASNs have the worst RPKI coverage?',
  'Explain BGP hijacking to a non-expert',
  'How do I report an incident to CERT-In?',
  'What vantage points are confirming this attack?',
]

export default function AdminChat() {
  const { chatMessages, addChatMessage, clearChat, grokApiKey, incidents, activityLog } = useSHYENStore()
  const [input, setInput]   = useState('')
  const [loading, setLoad]  = useState(false)
  const endRef = useRef(null)

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:'smooth' }) },[chatMessages])

  const send = async (text) => {
    const msg = text.trim() || input.trim()
    if (!msg || loading) return
    setInput('')
    addChatMessage({ role:'user', content:msg, ts:new Date() })
    setLoad(true)
    try {
      const all = [...chatMessages, { role:'user', content:msg }]
      const reply = await chatWithGrok(all, SYSTEM_CTX(incidents, activityLog), grokApiKey)
      addChatMessage({ role:'assistant', content:reply, ts:new Date() })
    } catch(e) {
      addChatMessage({ role:'assistant', content:`Error: ${e.message}`, ts:new Date() })
    }
    setLoad(false)
  }

  const pad = n => String(n).padStart(2,'0')
  const fmt = d => { const t=new Date(d); return `${pad(t.getHours())}:${pad(t.getMinutes())}` }

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
        <div style={{ fontFamily:'monospace',fontSize:9,fontWeight:700,color:'#555',letterSpacing:2 }}>ADMIN CHAT</div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <span style={{ fontFamily:'monospace',fontSize:8,color:'rgba(0,191,255,0.6)' }}>Powered by Grok</span>
          {chatMessages.length>0&&(
            <button onClick={clearChat} style={{ fontFamily:'monospace',fontSize:7.5,color:'#444',background:'none',border:'1px solid rgba(255,255,255,0.06)',padding:'2px 6px',borderRadius:2,cursor:'pointer' }}>clear</button>
          )}
        </div>
      </div>

      <div style={{ flex:1,overflowY:'auto',minHeight:0,marginBottom:8 }}>
        {chatMessages.length===0 && (
          <>
            <div style={{ fontFamily:'monospace',fontSize:9,color:'#333',padding:'8px 0 12px',textAlign:'center' }}>Ask me anything about the current threats</div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
              {SUGGESTIONS.map(s=>(
                <button key={s} onClick={()=>send(s)} style={{ fontFamily:'monospace',fontSize:8,color:'#444',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',padding:'4px 8px',borderRadius:12,cursor:'pointer',textAlign:'left' }}>{s}</button>
              ))}
            </div>
          </>
        )}
        {chatMessages.map((m,i)=>(
          <div key={i} style={{ display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:8 }}>
            <div style={{
              maxWidth:'88%',
              background:m.role==='user'?'rgba(30,58,138,0.6)':'rgba(10,18,32,0.8)',
              border:`1px solid ${m.role==='user'?'rgba(59,110,245,0.3)':'rgba(255,255,255,0.06)'}`,
              borderRadius:m.role==='user'?'10px 10px 2px 10px':'10px 10px 10px 2px',
              padding:'7px 10px',
            }}>
              {m.role==='assistant'&&<div style={{ fontFamily:'monospace',fontSize:7.5,color:'#00bfff',marginBottom:3,letterSpacing:1 }}>🤖 SHYEN AI</div>}
              <div style={{ fontFamily:'monospace',fontSize:9.5,color:'#ccc',lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word' }}>{m.content}</div>
              <div style={{ fontFamily:'monospace',fontSize:7,color:'#2a2a2a',marginTop:3,textAlign:'right' }}>{fmt(m.ts)}</div>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{ display:'flex',gap:5,padding:'6px 0' }}>
            {[0,.18,.36,.54,.72].map((d,i)=>(
              <div key={i} style={{ width:5,height:5,borderRadius:'50%',background:'#00bfff',animation:`dotBounce 1.3s ease-in-out ${d}s infinite` }}/>
            ))}
          </div>
        )}
        <div ref={endRef}/>
      </div>

      <div style={{ display:'flex',gap:6,flexShrink:0 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="Ask about BGP threats, RPKI, mitigation…"
          style={{ flex:1,background:'rgba(8,14,24,0.8)',border:'1px solid rgba(255,255,255,0.08)',
            color:'#ddd',padding:'8px 10px',borderRadius:6,fontFamily:'monospace',fontSize:10,outline:'none' }}/>
        <button onClick={()=>send()} disabled={loading||!input.trim()}
          style={{ padding:'0 14px',background:input.trim()?'rgba(30,58,138,0.7)':'none',border:`1px solid ${input.trim()?'rgba(59,110,245,0.4)':'rgba(255,255,255,0.06)'}`,color:input.trim()?'#93c5fd':'#333',borderRadius:6,cursor:input.trim()?'pointer':'not-allowed',fontSize:14 }}>➤</button>
      </div>
    </div>
  )
}
