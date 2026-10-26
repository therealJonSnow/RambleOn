import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Sheet } from '../components/Layout'
import { formatLongDate, formatWeekday } from '../lib/dates'
import type { DaySummary } from '../lib/store/types'
import { useJournal } from '../state/journal'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function DaysPage() {
  const { journal, today, syncRevision } = useJournal()
  const [days, setDays] = useState<DaySummary[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    journal.store.listDates().then(
      (d) => {
        setDays(d)
        setError(false)
      },
      () => setError(true),
    )
  }, [journal, syncRevision])

  return (
    <Layout>
      <Sheet>
        <h1 className="mb-8 font-display text-4xl">Days</h1>
        {error && <p className="text-ribbon">Couldn’t load your days. Check your connection and try again.</p>}
        {!days && !error && <p className="animate-pulse text-ink-soft">Loading…</p>}
        {days?.length === 0 && <p className="text-pencil">Nothing written yet.</p>}
        <ol>
          {days?.map((d) => (
            <li key={d.date} className="border-b border-dashed border-ink/20 last:border-0">
              <Link to={d.date === today ? '/' : `/day/${d.date}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-ribbon">
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
      </Sheet>
    </Layout>
  )
}
