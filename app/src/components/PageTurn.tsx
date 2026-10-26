import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type Turn = 'back' | 'forward'

interface Props {
  canForward: boolean
  // The turn has finished: show the other day.
  onTurned(turn: Turn): void
  // What's revealed underneath while the page is lifted.
  under(turn: Turn): ReactNode
  children(turn: (t: Turn) => void): ReactNode
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Not while you're typing: the keyboard is up and a sideways drag is
// probably moving the cursor.
const editing = () => document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') ?? false

// Loose pages: drag one sideways and it lifts off in the direction you
// swipe, showing the next sheet beneath. Swipe left for the next day,
// right for the day before.
export function PageTurn({ canForward, onTurned, under, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [turning, setTurning] = useState<Turn | null>(null)
  const busy = useRef(false)

  const place = useCallback((dx: number, animate: boolean) => {
    const el = pageRef.current
    if (!el) return
    const w = el.offsetWidth || window.innerWidth
    const p = dx / w
    el.style.transition = animate ? 'transform 280ms cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 280ms' : 'none'
    // Pivot from below the page, so it arcs away like a sheet slid off a pile.
    el.style.transformOrigin = '50% 120%'
    el.style.transform = dx ? `translate3d(${dx}px, ${Math.abs(dx) * 0.05}px, 0) rotate(${p * 9}deg)` : ''
    el.style.boxShadow = dx ? `0 ${12 + Math.abs(p) * 30}px ${30 + Math.abs(p) * 40}px -12px rgb(0 0 0 / ${0.35 + Math.abs(p) * 0.2})` : ''
  }, [])

  const finish = useCallback(
    (t: Turn) => {
      place(0, false)
      setTurning(null)
      busy.current = false
      window.scrollTo(0, 0)
      onTurned(t)
    },
    [onTurned, place],
  )

  const commit = useCallback(
    (t: Turn) => {
      if (reducedMotion()) return finish(t)
      busy.current = true
      const w = pageRef.current?.offsetWidth ?? window.innerWidth
      place((t === 'forward' ? -1 : 1) * w * 1.2, true)
      setTimeout(() => finish(t), 290)
    },
    [finish, place],
  )

  const turn = useCallback(
    (t: Turn) => {
      if (busy.current || (t === 'forward' && !canForward)) return
      setTurning(t)
      // Let the page underneath render before this one lifts away.
      requestAnimationFrame(() => commit(t))
    },
    [canForward, commit],
  )

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let start: { x: number; y: number; axis: 'x' | 'y' | null } | null = null
    let last = { dx: 0, t: 0, v: 0 }

    const onStart = (e: TouchEvent) => {
      const target = e.target as Element
      if (busy.current || e.touches.length !== 1 || editing() || target.closest('[data-no-turn]')) return
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }
      last = { dx: 0, t: e.timeStamp, v: 0 }
    }
    const onMove = (e: TouchEvent) => {
      if (!start) return
      const dx = e.touches[0].clientX - start.x
      const dy = e.touches[0].clientY - start.y
      if (!start.axis) {
        if (Math.hypot(dx, dy) < 10) return
        start.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y'
      }
      if (start.axis === 'y') return
      e.preventDefault()
      const t: Turn = dx < 0 ? 'forward' : 'back'
      setTurning(t)
      // Today is the top page: it gives a little, then springs back.
      const shown = t === 'forward' && !canForward ? dx * 0.2 : dx
      const dt = Math.max(1, e.timeStamp - last.t)
      last = { dx, t: e.timeStamp, v: (dx - last.dx) / dt }
      place(shown, false)
    }
    const onEnd = () => {
      if (!start || start.axis !== 'x') {
        start = null
        return
      }
      start = null
      const w = pageRef.current?.offsetWidth ?? window.innerWidth
      const t: Turn = last.dx < 0 ? 'forward' : 'back'
      const allowed = t === 'back' || canForward
      // Far enough, or a quick flick the same way.
      const flung = Math.abs(last.dx) > w * 0.25 || (Math.abs(last.v) > 0.5 && Math.sign(last.v) === Math.sign(last.dx))
      if (allowed && flung) {
        commit(t)
      } else {
        place(0, true)
        setTimeout(() => !busy.current && setTurning(null), 290)
      }
    }

    wrap.addEventListener('touchstart', onStart, { passive: true })
    wrap.addEventListener('touchmove', onMove, { passive: false })
    wrap.addEventListener('touchend', onEnd)
    wrap.addEventListener('touchcancel', onEnd)
    return () => {
      wrap.removeEventListener('touchstart', onStart)
      wrap.removeEventListener('touchmove', onMove)
      wrap.removeEventListener('touchend', onEnd)
      wrap.removeEventListener('touchcancel', onEnd)
    }
  }, [canForward, commit, place])

  return (
    <div ref={wrapRef} className="relative flex flex-1 touch-pan-y flex-col">
      {turning && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {under(turning)}
        </div>
      )}
      <div ref={pageRef} className="relative flex flex-1 flex-col will-change-transform">
        {children(turn)}
      </div>
    </div>
  )
}
