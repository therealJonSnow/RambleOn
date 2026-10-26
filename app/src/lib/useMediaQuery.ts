import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (change) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', change)
      return () => m.removeEventListener('change', change)
    },
    () => window.matchMedia(query).matches,
  )
}
