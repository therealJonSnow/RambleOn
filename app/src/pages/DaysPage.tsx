import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Sheet } from '../components/Layout'
import { formatLongDate, formatTime, formatWeekday } from '../lib/dates'
import type { Note, Passage } from '../lib/models'
import { search } from '../lib/search'
import type { DaySummary } from '../lib/store/types'
import { useJournal } from '../state/journal'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function DaysPage() {
  const { journal, today, syncRevision } = useJournal()
  const [days, setDays] = useState<DaySummary[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  // Everything, decrypted on the device. Loaded the first time you search.
  const [all, setAll] = useState<{ passages: Passage[]; notes: Note[] } | null>(null)
  const searching = query.trim().length > 0

  useEffect(() => {
    journal.store.listDates().then(
      (d) => {
        setDays(d)
        setError(false)
      },
      () => setError(true),
    )
  }, [journal, syncRevision])

  useEffect(() => {
    if (!searching) return
    let live = true
    void Promise.all([journal.loadAllPassages(), journal.loadAllNotes()]).then(
      ([passages, notes]) => live && setAll({ passages, notes }),
    )
    return () => {
      live = false
    }
    // Reload when a sync lands, not on every keystroke.
  }, [journal, syncRevision, searching])

  const hits = useMemo(() => (all && searching ? search(query, all.passages, all.notes) : []), [all, query, searching])
  const dayLink = (date: string) => (date === today ? '/' : `/day/${date}`)

  return (
    <Layout>
      <Sheet>
        <h1 className="mb-6 font-display text-4xl">Days</h1>
        <input
          type="search"
          aria-label="Search your journal"
          placeholder="Search passages and notes…"
          className="mb-8 w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 outline-none focus:border-ink"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {searching ? (
          <>
            {!all && <p className="animate-pulse text-ink-soft">Searching…</p>}
            {all && hits.length === 0 && <p className="text-pencil">Nothing matches “{query.trim()}”.</p>}
            {all && hits.length > 0 && <p className="label mb-4">{plural(hits.length, 'result')}</p>}
            <ol>
              {hits.map((h) => (
                <li key={h.id} className="border-b border-dashed border-ink/20 last:border-0">
                  <Link to={dayLink(h.journalDate)} className="block py-3 hover:text-ribbon">
                    <span className="label block">
                      {formatWeekday(h.journalDate)} {formatLongDate(h.journalDate)} ·{' '}
                      {h.kind === 'note' ? 'Note' : h.kind === 'margin' ? 'Margin note' : formatTime(h.writtenAt)}
                      {h.title && ` · ${h.title}`}
                    </span>
                    <span className="leading-7 [overflow-wrap:anywhere]">
                      {h.before}
                      <mark className="bg-ribbon/20 text-ink">{h.match}</mark>
                      {h.after}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            {error && <p className="text-ribbon">Couldn’t load your days. Check your connection and try again.</p>}
            {!days && !error && <p className="animate-pulse text-ink-soft">Loading…</p>}
            {days?.length === 0 && <p className="text-pencil">Nothing written yet.</p>}
            <ol>
              {days?.map((d) => (
                <li key={d.date} className="border-b border-dashed border-ink/20 last:border-0">
                  <Link to={dayLink(d.date)} className="flex items-baseline justify-between gap-4 py-3 hover:text-ribbon">
                    <span>
                      <span className="font-display text-lg">{formatWeekday(d.date)}</span>{' '}
                      <span className="text-ink-soft">{formatLongDate(d.date)}</span>
                    </span>
                    <span className="shrink-0 text-sm text-pencil">
                      {[d.passages && plural(d.passages, 'passage'), d.notes && plural(d.notes, 'note')].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </Sheet>
    </Layout>
  )
}
