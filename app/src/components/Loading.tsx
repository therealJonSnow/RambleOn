export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <p className="text-ink-soft animate-pulse">{label}</p>
    </div>
  )
}
