import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AutoTextarea } from '../components/AutoTextarea'
import { Layout, Sheet } from '../components/Layout'
import { NotesArea } from '../components/NotesArea'
import { PassageView } from '../components/PassageView'
import { RecordButton } from '../components/RecordButton'
import {
  addDays,
  formatLongDate,
  formatShortDate,
  formatTime,
  formatWeekday,
  isDayEditable,
} from '../lib/dates'
import { removeFillers } from '../lib/filler'
import type { DayContent, Draft } from '../lib/journal'
import type { Note, Passage } from '../lib/models'
import { useDebounced } from '../lib/useDebounced'
import { useJournal } from '../state/journal'

export function DayPage() {
  const params = useParams()
  const { journal, settings, today, syncRevision, updateSettings } = useJournal()
  const date = params.date ?? today
  const isToday = date === today
  const editable = isDayEditable(date, today, settings.unlockedDates)

  const [day, setDay] = useState<DayContent | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const reload = useCallback(async () => {
    setDay(await journal.loadDay(date))
  }, [journal, date])

  // Clear only when the date changes: refreshing after a sync must not
  // remount the editors you might be typing in.
  useEffect(() => {
    setDay(null)
  }, [date])
  useEffect(() => {
    void reload()
  }, [reload, syncRevision])

  // Bring back an unsaved draft (e.g. the app was closed mid-sentence).
  useEffect(() => {
    void journal.loadDraft().then((d) => setDraft(d && d.journalDate === date ? d : null))
  }, [journal, date])

  const persistDraft = useDebounced((d: Draft) => void journal.saveDraft(d), 300)

  // --- Composer

  function startPassage() {
    // Focus synchronously inside the tap, or iOS won't open the keyboard.
    composerRef.current?.focus()
    if (!draft) {
      const d: Draft = { id: crypto.randomUUID(), writtenAt: new Date().toISOString(), journalDate: date, raw: '' }
      setDraft(d)
    }
  }

  async function finishPassage() {
    if (!draft) return
    persistDraft.flush()
    const raw = draft.raw.trim()
    if (raw) {
      const passage: Passage = {
        id: draft.id,
        kind: 'passage',
        journalDate: draft.journalDate,
        writtenAt: draft.writtenAt,
        title: '',
        raw,
        text: removeFillers(raw, settings.fillers),
        pending: true,
      }
      // Into the outbox (on the device) before the draft is cleared.
      await journal.savePassage(passage)
      setDay((d) => d && { ...d, passages: [...d.passages.filter((x) => x.id !== passage.id), passage] })
    }
    await journal.clearDraft()
    setDraft(null)
    composerRef.current?.blur()
  }

  async function discardPassage() {
    if (draft?.raw.trim() && !confirm('Discard this passage?')) return
    await journal.clearDraft()
    setDraft(null)
  }

  // --- Changes

  const replacePassage = (p: Passage) =>
    setDay((d) => d && { ...d, passages: d.passages.map((x) => (x.id === p.id ? { ...p, pending: true } : x)) })

  const savePassage = (p: Passage) => {
    void journal.savePassage(p)
    replacePassage(p)
  }

  const movePassage = (p: Passage, to: string) => {
    void journal.savePassage({ ...p, journalDate: to })
    setDay((d) => d && { ...d, passages: d.passages.filter((x) => x.id !== p.id) })
  }

  const deletePassage = (p: Passage) => {
    void journal.deletePassage(p)
    setDay((d) => d && { ...d, passages: d.passages.filter((x) => x.id !== p.id), margins: d.margins.filter((x) => x.id !== p.id) })
  }

  const saveNote = (n: Note) => void journal.saveNote(n)
  const deleteNote = (n: Note) => {
    void journal.deleteNote(n)
    setDay((d) => d && { ...d, notes: d.notes.filter((x) => x.id !== n.id) })
  }
  // Replace rather than append: a refresh may already have brought it back.
  const addNote = (n: Note) =>
    setDay((d) => d && { ...d, notes: [...d.notes.filter((x) => x.id !== n.id), { ...n, pending: true }] })

  const addMargin = async (text: string) => {
    const now = new Date().toISOString()
    const margin: Passage = { id: crypto.randomUUID(), kind: 'margin', journalDate: date, writtenAt: now, title: '', raw: text, text, pending: true }
    await journal.savePassage(margin)
    setDay((d) => d && { ...d, margins: [...d.margins.filter((x) => x.id !== margin.id), margin] })
  }

  const relock = () =>
    updateSettings({ ...settings, unlockedDates: settings.unlockedDates.filter((d) => d !== date) })

  const composing = draft !== null
  const empty = day && day.passages.length === 0 && !composing

  return (
    <Layout>
      <Sheet>
        <header className="mb-10 flex items-start justify-between gap-2">
          <Link to={`/day/${addDays(date, -1)}`} className="no-print px-2 py-1 text-2xl text-ink-soft hover:text-ribbon" aria-label="Previous day">
            ‹
          </Link>
          <div className="text-center">
            <h1 className="font-display text-4xl leading-tight">{formatWeekday(date)}</h1>
            <p className="text-ink-soft">{formatLongDate(date)}</p>
          </div>
          {date < today ? (
            <Link to={addDays(date, 1) === today ? '/' : `/day/${addDays(date, 1)}`} className="no-print px-2 py-1 text-2xl text-ink-soft hover:text-ribbon" aria-label="Next day">
              ›
            </Link>
          ) : (
            <span className="px-2 py-1 text-2xl opacity-0" aria-hidden>
              ›
            </span>
          )}
        </header>

        {!editable && (
          <p className="no-print mb-8 text-center text-sm text-pencil">This page is locked. Add a margin note to correct anything.</p>
        )}
        {editable && date < today && (
          <p className="no-print mb-8 text-center text-sm text-pencil">
            Unlocked for editing ·{' '}
            <button className="link" onClick={relock}>
              Lock again
            </button>
          </p>
        )}
        {day && !day.complete && (
          <p className="no-print mb-8 text-center text-sm text-ribbon">Couldn’t load everything. Showing what’s saved on this device.</p>
        )}

        {!day ? (
          <p className="animate-pulse text-ink-soft">Loading…</p>
        ) : (
          <>
            {day.passages.map((p) => (
              <PassageView key={p.id} passage={p} editable={editable} today={today} onSave={savePassage} onMove={movePassage} onDelete={deletePassage} />
            ))}
            {empty && (
              <p className="mb-10 text-pencil">
                {isToday ? 'Nothing yet today. Tap the button to start a passage.' : 'Nothing was written on this day.'}
              </p>
            )}
          </>
        )}

        {/* Always in the DOM so it can take focus inside the button tap. */}
        {editable && (
          <section className={composing ? 'mb-10' : 'pointer-events-none absolute h-0 overflow-hidden opacity-0'} aria-hidden={!composing}>
            {draft && (
              <header className="mb-1 flex items-baseline gap-3">
                <time className="font-display text-lg text-ribbon">{formatTime(draft.writtenAt)}</time>
                <span className="text-sm text-pencil">Tap the mic on your keyboard to dictate</span>
              </header>
            )}
            <AutoTextarea
              ref={composerRef}
              aria-label="New passage"
              placeholder="Start talking…"
              tabIndex={composing ? 0 : -1}
              value={draft?.raw ?? ''}
              onChange={(e) => {
                const d = { ...(draft ?? { id: crypto.randomUUID(), writtenAt: new Date().toISOString(), journalDate: date }), raw: e.target.value }
                setDraft(d)
                persistDraft(d)
              }}
            />
            {composing && (
              <div className="no-print mt-3 flex justify-end gap-3">
                <button className="btn" onClick={discardPassage}>
                  Discard
                </button>
                <button className="btn-primary" onClick={finishPassage}>
                  Done
                </button>
              </div>
            )}
          </section>
        )}

        {day && (day.margins.length > 0 || !editable) && (
          <MarginNotes margins={day.margins} canAdd={!editable} onAdd={addMargin} onDelete={deletePassage} />
        )}

        {day && <NotesArea date={date} notes={day.notes} onSave={saveNote} onDelete={deleteNote} onAdded={addNote} />}
      </Sheet>

      {editable && !composing && <RecordButton side={settings.buttonSide} onPress={startPassage} />}
    </Layout>
  )
}

function MarginNotes({
  margins,
  canAdd,
  onAdd,
  onDelete,
}: {
  margins: Passage[]
  canAdd: boolean
  onAdd(text: string): Promise<void>
  onDelete(p: Passage): void
}) {
  const [text, setText] = useState('')
  return (
    <aside className="mt-6 border-l-2 border-pencil/40 pl-4 text-pencil" aria-label="Margin notes">
      {margins.map((m) => (
        <div key={m.id} className="group mb-4">
          <p className="text-xs tracking-wider uppercase">
            Margin note · {formatShortDate(m.writtenAt)} {formatTime(m.writtenAt)}
            <button
              className="no-print ml-3 normal-case opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ribbon"
              onClick={() => confirm('Delete this margin note?') && onDelete(m)}
            >
              delete
            </button>
          </p>
          <p className="italic leading-7 whitespace-pre-wrap">{m.text}</p>
        </div>
      ))}
      {canAdd && (
        <div className="no-print">
          <AutoTextarea aria-label="New margin note" placeholder="Add a margin note…" className="italic" value={text} onChange={(e) => setText(e.target.value)} />
          {text.trim() && (
            <div className="mt-2 flex justify-end">
              <button
                className="btn"
                onClick={async () => {
                  await onAdd(text.trim())
                  setText('')
                }}
              >
                Add to margin
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
