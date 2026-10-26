import { Screen } from '../components/Screen'

export function UnavailablePage({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <Screen title="Can’t reach your database">
      <PausedHint />
      <p className="mb-6 text-ink-soft">Details: {message}</p>
      <button className="btn-primary w-full" onClick={onRetry}>
        Try again
      </button>
    </Screen>
  )
}

export function PausedHint() {
  return navigator.onLine ? (
    <p className="mb-4">
      If you haven’t opened RambleOn for a while, your free Supabase project may have been paused. Open the{' '}
      <a className="link" href="https://supabase.com/dashboard/projects" target="_blank" rel="noreferrer">
        Supabase dashboard
      </a>{' '}
      and choose <em>Restore project</em>. Nothing is lost.
    </p>
  ) : (
    <p className="mb-4">You’re offline. Connect to the internet and try again.</p>
  )
}
