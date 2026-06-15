// Features #72 #73 — Keyboard arrow keys + Enter for incidents
import { useEffect } from 'react'

export function useKeyboardNav({ incidents, selectedId, onSelect, onAction, breachSimRef }) {
  useEffect(() => {
    const handler = (e) => {
      // Don't fire if user is typing in an input
      if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return

      const shown = incidents
      const idx   = shown.findIndex(i => i.id === selectedId)

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        const next = shown[idx + 1]
        if (next) onSelect(next.id)
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        const prev = shown[idx - 1]
        if (prev) onSelect(prev.id)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const inc = shown[idx]
        if (!inc) return
        // Execute first available action
        if (!inc.rpkiPushed)      { onAction(inc.id, 'rpki');      return }
        if (!inc.ixpAlerted)      { onAction(inc.id, 'ixp');       return }
        if (!inc.forensicsReady)  { onAction(inc.id, 'forensics'); return }
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        if (breachSimRef?.current) breachSimRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [incidents, selectedId, onSelect, onAction])
}
