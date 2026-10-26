import { useEffect, useState } from 'react'

// True only once `condition` has held for `ms`; false as soon as it stops.
// Keeps brief, normal states (a save in flight) from flashing on screen.
export function useSustained(condition: boolean, ms: number): boolean {
  const [sustained, setSustained] = useState(false)
  useEffect(() => {
    if (!condition) {
      setSustained(false)
      return
    }
    const timer = setTimeout(() => setSustained(true), ms)
    return () => clearTimeout(timer)
  }, [condition, ms])
  return condition && sustained
}
