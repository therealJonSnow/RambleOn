import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Layout, Sheet } from '../components/Layout'
import { LinkedText } from '../components/LinkedText'
import { PassageView } from '../components/PassageView'
import { formatLongDate, formatMonth, formatWeekday } from '../lib/dates'
import type { DayContent } from '../lib/journal'
import { useJournal } from '../state/journal'
import { MarginNotes, PassageBreak } from './DayPage'

const noop = () => {}

// A day (2026-10-25) or a month (2026-10), one printed page per day.
export function PrintPage() {
  const { period = '' } = useParams()
  const { journal, today } = useJournal()
  const month = /^\d{4}-\d{2}$/.test(period)
  const [days, setDays] = useState<{ date: string; day: DayContent }[] | null>(null)

  useEffect(() => {
    let live = true
    setDays(null)
    void (async () => {
      const dates = month
        ? (await journal.store.listDates()).map((d) => d.date).filter((d) => d.startsWith(`${period}-`)).sort()
        : [period]
      const loaded = await Promise.all(dates.map(async (date) => ({ date, day: await journal.loadDay(date) })))
      if (live) setDays(loaded)
    })()
    return () => {
      live = false
    }
  }, [journal, period, month])

  const title = month ? formatMonth(period) : `${formatWeekday(period)} ${formatLongDate(period)}`
  const back = month ? '/days' : period === today ? '/' : `/day/${period}`

  return (
    <Layout>
      <div className="no-print mb-4 flex items-center justify-between gap-4 px-1">
        <Link to={back} className="link">
          Back
        </Link>
        <button className="btn-primary" disabled={!days?.length} onClick={() => window.print()}>
          Print
        </button>
      </div>
      <p className="no-print mb-5 px-1 text-ink-soft">
        {month ? `Every day of ${title}, one page each.` : title}
        {' '}Choose “Save as PDF” in the print dialog to keep a copy.
      </p>

      {!days && <p className="animate-pulse px-1 text-ink-soft">Loading…</p>}
      {days?.length === 0 && <p className="px-1 text-ink-soft">Nothing written in {title}.</p>}
      {days?.map(({ date, day }) => (
        <Sheet key={date} className="print-page mb-8">
          <header className="mb-8">
            <h1 className="text-center">
              <span className="typed-heading">
                {formatWeekday(date)} {formatLongDate(date)}
              </span>
            </h1>
          </header>
          {day.passages.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <PassageBreak />}
              <PassageView passage={p} editable={false} today={today} onSave={noop} onMove={noop} onDelete={noop} print />
            </Fragment>
          ))}
          {day.margins.length > 0 && <MarginNotes margins={day.margins} canAdd={false} onAdd={async () => {}} onDelete={noop} />}
          {day.notes.length > 0 && (
            <section className="mt-6" aria-label="Notes">
              <h2 className="typed-heading mb-4 inline-block">Notes</h2>
              <ul>
                {day.notes.map((n) => (
                  <li key={n.id} className="mb-2 flex gap-3">
                    <span aria-hidden className="text-pencil">
                      -
                    </span>
                    <p className="min-w-0 break-words whitespace-pre-wrap">
                      <LinkedText text={n.text} />
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Sheet>
      ))}
    </Layout>
  )
}
