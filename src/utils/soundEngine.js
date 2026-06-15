// Feature #67 — Web Audio API sound effects for CRITICAL incidents
let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

export function playCriticalAlert() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    // Three-tone descending alert — subtle, professional
    const freqs = [880, 660, 440]
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.18)
      gain.gain.setValueAtTime(0, now + i * 0.18)
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.18 + 0.04)
      gain.gain.linearRampToValueAtTime(0, now + i * 0.18 + 0.22)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.25)
    })
  } catch {}
}

export function playMitigatedChime() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523, now)
    osc.frequency.linearRampToValueAtTime(784, now + 0.2)
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.4)
    osc.start(now); osc.stop(now + 0.45)
  } catch {}
}

export function playActionTone() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    gain.gain.setValueAtTime(0.05, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.18)
    osc.start(now); osc.stop(now + 0.2)
  } catch {}
}
