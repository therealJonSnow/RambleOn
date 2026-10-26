import { useEffect, useRef } from 'react'

// Debounced callback that also runs any pending call on unmount, so the last
// keystrokes are never dropped.
export function useDebounced<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<A | null>(null)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (pending.current) fnRef.current(...pending.current)
    },
    [],
  )

  const call = (...args: A) => {
    pending.current = args
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      pending.current = null
      fnRef.current(...args)
    }, ms)
  }
  call.flush = () => {
    clearTimeout(timer.current)
    if (pending.current) {
      const args = pending.current
      pending.current = null
      fnRef.current(...args)
    }
  }
  return call
}
