import { useJournal } from '../state/journal'

export function SyncIndicator() {
  const { status } = useJournal()
  if (status.pending === 0 && !status.unavailable) return null
  const offline = !navigator.onLine
  const label = offline
    ? `Offline · ${status.pending} saved on this device`
    : status.unavailable
      ? `Can’t reach database · ${status.pending} waiting`
      : `${status.pending} waiting to sync`
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="size-2 rounded-full bg-ribbon animate-pulse" aria-hidden />
      {label}
    </p>
  )
}
