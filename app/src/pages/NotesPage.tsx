import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DeskHeading, Layout, Slip } from '../components/Layout'
import { LinkedText } from '../components/LinkedText'
import { formatLongDate, formatWeekday } from '../lib/dates'
import type { Note } from '../lib/models'
import { useJournal } from '../state/journal'

// Every note, newest first. Notes are decrypted on the device, so search
// runs here too.
export function NotesPage() {
  const { journal, today, syncRevision } = useJournal()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void journal.loadAllNotes().then((all) => setNotes(all.reverse()))
  }, [journal, syncRevision])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (notes ?? []).filter((n) => !q || n.text.toLowerCase().includes(q))
  }, [notes, query])

  return (
    <Layout>
      <DeskHeading>All notes</DeskHeading>
      <input
        type="search"
        aria-label="Search notes"
        placeholder="Search notes…"
        className="mb-6 w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 outline-none focus:border-ink"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!notes && <p className="animate-pulse px-1 text-ink-soft">Loading…</p>}
      {notes && shown.length === 0 && <p className="px-1 text-ink-soft">{query ? 'No notes match.' : 'No notes yet.'}</p>}
      <ul>
        {shown.map((n) => (
          <Slip key={n.id}>
            <Link to={n.journalDate === today ? '/' : `/day/${n.journalDate}`} className="block text-pencil uppercase tracking-[0.05em] hover:text-ribbon">
              {formatWeekday(n.journalDate)} {formatLongDate(n.journalDate)}
            </Link>
            <p className="break-words whitespace-pre-wrap">
              <LinkedText text={n.text} />
            </p>
          </Slip>
        ))}
      </ul>
    </Layout>
  )
}
