import { useSustained } from '../lib/useSustained'
import { useJournal } from '../state/journal'

// Floats over the page (never moves the layout) and only appears when
// changes have been waiting a while: offline, or the server is unreachable.
// Normal saves take a moment and aren't worth announcing.
export function SyncIndicator() {
  const { status } = useJournal()
  const show = useSustained(status.pending > 0 || status.unavailable, 4000)
  if (!show) return null
  const label = !navigator.onLine
    ? `Offline · ${status.pending} saved on this device`
    : status.unavailable
      ? `Can’t reach database · ${status.pending} waiting`
      : `${status.pending} waiting to sync`
  return (
    <p
      role="status"
      className="no-print pointer-events-none fixed top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/85 px-3 py-1 whitespace-nowrap text-paper shadow-md"
    >
      <span className="size-1.5 rounded-full bg-ribbon" aria-hidden />
      {label}
    </p>
  )
}
