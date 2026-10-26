import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loading } from '../components/Loading'
import { journalDateFor } from '../lib/dates'
import { Journal } from '../lib/journal'
import { requestPersistentStorage } from '../lib/localdb'
import type { Settings } from '../lib/models'
import type { SyncStatus } from '../lib/sync'
import { UnavailablePage } from '../pages/UnavailablePage'
import { useBackend } from './backend'
import { useVault } from './vault'

interface JournalState {
  journal: Journal
  settings: Settings
  updateSettings(next: Settings): Promise<void>
  // Today's journal date (rolls over at settings.rolloverHour).
  today: string
  status: SyncStatus
  // Bumps whenever the outbox empties, so pages can refresh pending markers.
  syncRevision: number
}

const JournalContext = createContext<JournalState | null>(null)

export function useJournal(): JournalState {
  const j = useContext(JournalContext)
  if (!j) throw new Error('useJournal outside JournalProvider')
  return j
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const { store } = useBackend()
  const { key, local } = useVault()
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, unavailable: false })
  const [syncRevision, setSyncRevision] = useState(0)
  const lastPending = useRef(0)

  const journal = useMemo(
    () =>
      new Journal(store, key, local, (s) => {
        setStatus(s)
        if (lastPending.current > 0 && s.pending === 0) setSyncRevision((r) => r + 1)
        lastPending.current = s.pending
      }),
    [store, key, local],
  )

  const [settings, setSettings] = useState<Settings | null>(null)
  const [loadError, setLoadError] = useState('')

  const loadSettings = useCallback(() => {
    setLoadError('')
    journal.loadSettings().then(setSettings, (e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [journal])

  useEffect(() => {
    loadSettings()
    void requestPersistentStorage()
    void journal.sync.flush()

    // Uploads can't run in the background on iOS, so push whenever we can.
    const flush = () => void journal.sync.flush()
    const onVisible = () => document.visibilityState === 'visible' && flush()
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisible)
      journal.sync.dispose()
    }
  }, [journal, loadSettings])

  // Keep "today" right if the app stays open past the rollover hour.
  const rolloverHour = settings?.rolloverHour ?? 4
  const [today, setToday] = useState(() => journalDateFor(new Date(), rolloverHour))
  useEffect(() => {
    const tick = () => setToday(journalDateFor(new Date(), rolloverHour))
    tick()
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [rolloverHour])

  const updateSettings = useCallback(
    async (next: Settings) => {
      const previous = settings
      setSettings(next)
      try {
        await journal.saveSettings(next)
      } catch (e) {
        setSettings(previous)
        throw e
      }
    },
    [journal, settings],
  )

  if (loadError) return <UnavailablePage message={loadError} onRetry={loadSettings} />
  if (!settings) return <Loading />

  return (
    <JournalContext.Provider value={{ journal, settings, updateSettings, today, status, syncRevision }}>
      {children}
    </JournalContext.Provider>
  )
}
