import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { demoMode } from '../lib/backend'
import { useJournal } from '../state/journal'
import { PausedHint } from '../pages/UnavailablePage'
import { SyncIndicator } from './SyncIndicator'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `font-display tracking-wide ${isActive ? 'text-ribbon' : 'hover:text-ribbon'}`

export function Layout({ children }: { children: ReactNode }) {
  const { status } = useJournal()
  return (
    <div className="mx-auto max-w-2xl px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-32 sm:px-6">
      <nav className="no-print mb-3 flex items-center justify-between gap-4 px-1">
        <NavLink to="/" end className={navClass}>
          Today
        </NavLink>
        <div className="flex gap-5">
          <NavLink to="/days" className={navClass}>
            Days
          </NavLink>
          <NavLink to="/notes" className={navClass}>
            Notes
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            Settings
          </NavLink>
        </div>
      </nav>
      {demoMode && (
        <p className="no-print mb-3 px-1 text-sm text-ink-soft">
          Demo mode: no Supabase configured, so your (encrypted) journal is kept in this browser only.
        </p>
      )}
      {status.unavailable && navigator.onLine && (
        <div className="no-print mb-3 rounded-sm border border-ribbon/40 px-4 pt-3 pb-1 text-sm">
          <PausedHint />
          <p className="mb-3">Your writing is saved on this device and will upload when it’s back.</p>
        </div>
      )}
      <div className="no-print mb-2 px-1">
        <SyncIndicator />
      </div>
      {children}
    </div>
  )
}

export function Sheet({ children }: { children: ReactNode }) {
  return <article className="sheet min-h-[70dvh] px-5 py-8 sm:px-12 sm:py-12">{children}</article>
}
