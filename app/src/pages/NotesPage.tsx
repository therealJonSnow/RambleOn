import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Sheet } from '../components/Layout'
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
      <Sheet>
        <h1 className="mb-6 font-display text-4xl">All notes</h1>
        <input
          type="search"
          aria-label="Search notes"
          placeholder="Search notes…"
          className="mb-8 w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 outline-none focus:border-ink"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!notes && <p className="animate-pulse text-ink-soft">Loading…</p>}
        {notes && shown.length === 0 && <p className="text-pencil">{query ? 'No notes match.' : 'No notes yet.'}</p>}
        <ul>
          {shown.map((n) => (
            <li key={n.id} className="mb-6">
              <Link to={n.journalDate === today ? '/' : `/day/${n.journalDate}`} className="label hover:text-ribbon">
                {formatWeekday(n.journalDate)} {formatLongDate(n.journalDate)}
              </Link>
              <p className="leading-8 whitespace-pre-wrap">{n.text}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    </Layout>
  )
}
