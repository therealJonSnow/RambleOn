import { useState, type ReactNode } from 'react'
import { DeskHeading, Layout } from '../components/Layout'
import { demoMode } from '../lib/backend'
import { formatLongDate } from '../lib/dates'
import { buildExportZip, exportFileName, readExport } from '../lib/export'
import { makeThumb } from '../lib/images'
import { DEFAULT_FILLERS } from '../lib/filler'
import type { Settings } from '../lib/models'
import { useBackend } from '../state/backend'
import { useJournal } from '../state/journal'
import { useVault } from '../state/vault'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="label mb-2 px-1">{title}</h2>
      {/* Plain panels: settings aren't a journal page. */}
      <div className="rounded-lg border border-ink/10 bg-paper/70 px-4 py-4">{children}</div>
    </section>
  )
}

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

export function SettingsPage() {
  const { journal, settings, updateSettings, today, status } = useJournal()
  const { lock } = useVault()
  const { signOut, email } = useBackend()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [newFiller, setNewFiller] = useState('')
  const [unlockDate, setUnlockDate] = useState('')

  const update = async (next: Settings) => {
    setMessage('')
    try {
      await updateSettings(next)
    } catch (e) {
      setMessage(`Couldn’t save settings: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function doExport() {
    setBusy(true)
    setMessage('')
    try {
      const data = await journal.exportData(settings)
      const { media, missing } = await journal.exportMedia(data)
      const blob = new Blob([buildExportZip(data, media) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName(data.exportedAt)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setMessage(
        `Exported ${data.passages.length} passages, ${data.notes.length} notes and ${media.size} photos.` +
          (missing.length ? ` ${missing.length} photos couldn’t be downloaded and are missing from the export.` : ''),
      )
    } catch (e) {
      setMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function doRestore(file: File) {
    setBusy(true)
    setMessage('')
    try {
      const { data, media } = readExport(file.name, new Uint8Array(await file.arrayBuffer()))
      const ok = confirm(
        `Restore ${data.passages.length} passages, ${data.notes.length} notes and ${media.size} photos from ${formatLongDate(data.exportedAt.slice(0, 10))}?\n\nRecords that already exist are overwritten with the version in the file. Your settings are replaced too.`,
      )
      if (!ok) return
      const result = await journal.restore(data, media, makeThumb)
      await updateSettings(await journal.loadSettings())
      setMessage(`Restored ${result.passages} passages, ${result.notes} notes and ${result.photos} photos.`)
    } catch (e) {
      setMessage(`Restore failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function doSignOut() {
    if (status.pending > 0 && !confirm(`${status.pending} changes haven’t uploaded yet and will be lost. Sign out anyway?`)) return
    await lock()
    await signOut()
  }

  const fillers = settings.fillers

  return (
    <Layout>
      <DeskHeading>Settings</DeskHeading>

        {message && (
          <p role="status" className="mb-6 rounded-lg border border-ribbon/40 bg-paper/70 px-4 py-3">
            {message}
          </p>
        )}

        <Section title="When does a day end?">
          <label className="flex flex-wrap items-center gap-3">
            New day starts at
            <select
              className="rounded-sm border border-ink/30 bg-paper px-2 py-1"
              value={settings.rolloverHour}
              onChange={(e) => update({ ...settings, rolloverHour: Number(e.target.value) })}
            >
              {Array.from({ length: 13 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-ink-soft">
            Anything written before this time goes on the previous day’s page, and that’s when past days lock.
          </p>
        </Section>

        <Section title="Filler words">
          <p className="mb-4 text-ink-soft">
            Removed from dictation when you save a passage. Your original words are always kept. Phrases like “you
            know” can carry meaning, so they’re off by default.
          </p>
          <ul className="mb-4 flex flex-wrap gap-2">
            {fillers.map((f, i) => (
              <li key={f.text} className={`flex items-center gap-2 rounded-sm border px-2 py-1 ${f.enabled ? 'border-ink' : 'border-ink/20 text-pencil'}`}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-ribbon"
                    checked={f.enabled}
                    onChange={() => update({ ...settings, fillers: fillers.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)) })}
                  />
                  {f.text}
                </label>
                <button
                  aria-label={`Remove ${f.text}`}
                  className="text-pencil hover:text-ribbon"
                  onClick={() => update({ ...settings, fillers: fillers.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const text = newFiller.trim().toLowerCase().replace(/\s+/g, ' ')
              if (!text || fillers.some((f) => f.text.toLowerCase() === text)) return
              void update({ ...settings, fillers: [...fillers, { text, enabled: true }] })
              setNewFiller('')
            }}
          >
            <input
              aria-label="New filler word"
              placeholder="Add a word or phrase"
              className="w-full rounded-sm border border-ink/30 bg-paper px-3 py-1"
              value={newFiller}
              onChange={(e) => setNewFiller(e.target.value)}
            />
            <button className="btn">Add</button>
            <button type="button" className="link" onClick={() => update({ ...settings, fillers: DEFAULT_FILLERS })}>
              Reset to defaults
            </button>
          </form>
        </Section>

        <Section title="Unlock a past day">
          <p className="mb-3 text-ink-soft">
            Past days lock at rollover, like a page out of the typewriter. Unlock one if you really need to change or
            delete something.
          </p>
          <form
            className="mb-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!unlockDate || unlockDate >= today || settings.unlockedDates.includes(unlockDate)) return
              void update({ ...settings, unlockedDates: [...settings.unlockedDates, unlockDate].sort() })
              setUnlockDate('')
            }}
          >
            <input
              type="date"
              aria-label="Day to unlock"
              max={today}
              className="rounded-sm border border-ink/30 bg-paper px-2 py-1"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
            />
            <button className="btn">Unlock</button>
          </form>
          {settings.unlockedDates.length > 0 && (
            <ul>
              {settings.unlockedDates.map((d) => (
                <li key={d} className="flex items-center gap-3">
                  {formatLongDate(d)}
                  <button
                    className="link"
                    onClick={() => update({ ...settings, unlockedDates: settings.unlockedDates.filter((x) => x !== d) })}
                  >
                    Lock again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Export and restore">
          <p className="mb-4 text-ink-soft">
            Downloads everything as a zip: a Markdown page per day, your photos, and <code>journal.json</code> for restoring.{' '}
            <strong>The export is not encrypted</strong>, so keep it somewhere safe.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={busy} onClick={doExport}>
              Export everything
            </button>
            <label className={`btn cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              Restore from file…
              <input
                type="file"
                accept=".zip,.json,application/zip,application/json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void doRestore(file)
                }}
              />
            </label>
          </div>
        </Section>

        <Section title="This device">
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={() => confirm('Lock the journal on this device? You’ll need your passphrase to open it again.') && lock()}>
              Lock journal
            </button>
            {!demoMode && (
              <button className="btn" onClick={doSignOut}>
                Sign out{email ? ` (${email})` : ''}
              </button>
            )}
          </div>
        </Section>
    </Layout>
  )
}
