// Feature #68 — Smooth animated number counter
import { useState, useEffect, useRef } from 'react'

export function useAnimatedCounter(target, duration = 600) {
  const [value,  setValue ] = useState(target)
  const prevRef  = useRef(target)
  const frameRef = useRef(null)

  useEffect(() => {
    const start    = prevRef.current
    const end      = target
    if (start === end) return
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = end
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target, duration])

  return value
}
