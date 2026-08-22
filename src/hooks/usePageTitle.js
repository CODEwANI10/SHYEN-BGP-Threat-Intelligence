// Feature #69 — Dynamic browser page title: SHYEN | N ACTIVE INCIDENTS
import { useEffect } from 'react'

export function usePageTitle(activeCount) {
  useEffect(() => {
    document.title = activeCount > 0
      ? `⚠ SHYEN | ${activeCount} ACTIVE INCIDENT${activeCount !== 1 ? 'S' : ''}`
      : 'SHYEN — BGP Threat Intelligence'
  }, [activeCount])
}
