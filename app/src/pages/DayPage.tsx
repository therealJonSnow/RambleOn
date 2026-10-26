import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AutoTextarea } from '../components/AutoTextarea'
import { Layout, Sheet } from '../components/Layout'
import { NotesArea } from '../components/NotesArea'
import { PageTurn, type Turn } from '../components/PageTurn'
import { PassageView } from '../components/PassageView'
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
import { useMediaQuery } from '../lib/useMediaQuery'
import { useJournal } from '../state/journal'

const arrow = 'grid size-11 place-items-center hover:text-ribbon active:text-ribbon'

const Chevron = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const DateHeading = ({ date }: { date: string }) => (
  <h1 className="text-center">
    <span className="typed-heading">
      {formatWeekday(date)} {formatLongDate(date)}
    </span>
  </h1>
)

export function DayPage() {
  const params = useParams()
  const navigate = useNavigate()
  // Wide screens put notes in their own column beside the page.
  const wide = useMediaQuery('(min-width: 1024px)')
  const { journal, settings, today, syncRevision, updateSettings } = useJournal()
  const date = params.date ?? today
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

  // Tapping "Start a new passage…" begins a draft, timed from that moment.
  function startPassage() {
    if (!draft) setDraft({ id: crypto.randomUUID(), writtenAt: new Date().toISOString(), journalDate: date, raw: '' })
  }

  // Tapped in and out without writing anything: quietly put the line back.
  function abandonIfEmpty() {
    if (draft && !draft.raw.trim()) {
      void journal.clearDraft()
      setDraft(null)
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

  const dayPath = (d: string) => (d === today ? '/' : `/day/${d}`)
  const target = (t: Turn) => addDays(date, t === 'forward' ? 1 : -1)
  const canForward = date < today

  const composing = draft !== null
  const empty = day && day.passages.length === 0 && !editable

  return (
    <Layout wide>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8">
        <PageTurn
          canForward={canForward}
          onTurned={(t) => navigate(dayPath(target(t)))}
          under={(t) => (
            <Sheet className="h-full">
              {(t === 'back' || canForward) && (
                <header className="mb-8">
                  <DateHeading date={target(t)} />
                </header>
              )}
            </Sheet>
          )}
        >
          {(turn) => (
            <Sheet>
              {/* Back and forward sit together in the margin, level with the date,
                  so the date keeps the full width of the text column. */}
              <header className="relative mb-8">
                <nav
                  className="no-print absolute -top-[7px] -left-[3.75rem] flex w-11 flex-col text-ink-soft sm:-left-20"
                  aria-label="Other days"
                >
                  {/* Full-margin-width, 44px tap targets; the first is centred on the date's first line. */}
                  <Link
                    to={dayPath(target('back'))}
                    className={arrow}
                    aria-label="Previous day"
                    onClick={(e) => {
                      e.preventDefault()
                      turn('back')
                    }}
                  >
                    <Chevron d="M10 3L5 8l5 5" />
                  </Link>
                  {canForward ? (
                    <Link
                      to={dayPath(target('forward'))}
                      className={arrow}
                      aria-label="Next day"
                      onClick={(e) => {
                        e.preventDefault()
                        turn('forward')
                      }}
                    >
                      <Chevron d="M6 3l5 5-5 5" />
                    </Link>
                  ) : (
                    <span className={`${arrow} opacity-25`} aria-hidden>
                      <Chevron d="M6 3l5 5-5 5" />
                    </span>
                  )}
                </nav>
                <DateHeading date={date} />
              </header>

              {!editable && (
                <p className="no-print mb-8 text-center text-pencil">This page is locked. Add a margin note to correct anything.</p>
              )}
              {editable && date < today && (
                <p className="no-print mb-8 text-center text-pencil">
                  Unlocked for editing ·{' '}
                  <button className="link" onClick={relock}>
                    Lock again
                  </button>
                </p>
              )}
              {day && !day.complete && (
                <p className="no-print mb-8 text-center text-ribbon">Couldn’t load everything. Showing what’s saved on this device.</p>
              )}

              {!day ? (
                <p className="animate-pulse text-ink-soft">Loading…</p>
              ) : (
                <>
                  {day.passages.map((p, i) => (
                    <Fragment key={p.id}>
                      {i > 0 && <PassageBreak />}
                      <PassageView passage={p} editable={editable} today={today} onSave={savePassage} onMove={movePassage} onDelete={deletePassage} />
                    </Fragment>
                  ))}
                  {empty && (
                    <p className="mb-10 text-pencil">
                      Nothing was written on this day.
                    </p>
                  )}
                </>
              )}

              {/* The next line of the page: tap it to start writing. */}
              {editable && day && (
                <section className="mb-4" aria-label="New passage">
                  {draft && day.passages.length > 0 && <PassageBreak />}
                  {draft && (
                    <header className="flex items-baseline gap-3 text-pencil">
                      <time>{formatTime(draft.writtenAt)}</time>
                      <span>Dictate with the keyboard mic</span>
                    </header>
                  )}
                  <div className="flex gap-3">
                    {!draft && (
                      <span aria-hidden className="pt-0.5 text-pencil">
                        +
                      </span>
                    )}
                    <AutoTextarea
                      ref={composerRef}
                      aria-label="New passage"
                      placeholder={draft ? 'Start talking…' : 'Start a new passage…'}
                      value={draft?.raw ?? ''}
                      onFocus={startPassage}
                      onBlur={abandonIfEmpty}
                      onChange={(e) => {
                        const d = { ...(draft ?? { id: crypto.randomUUID(), writtenAt: new Date().toISOString(), journalDate: date }), raw: e.target.value }
                        setDraft(d)
                        persistDraft(d)
                      }}
                    />
                  </div>
                  {composing && draft.raw.trim() && (
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


              {day && !wide && <NotesArea date={date} notes={day.notes} onSave={saveNote} onDelete={deleteNote} onAdded={addNote} />}
            </Sheet>
          )}
        </PageTurn>

        {day && wide && (
          <aside className="sheet px-6 py-8 lg:sticky lg:top-4">
            <NotesArea date={date} notes={day.notes} onSave={saveNote} onDelete={deleteNote} onAdded={addNote} separate />
          </aside>
        )}
      </div>

      <p className="no-print mt-6 px-1 text-right">
        <Link to={`/print/${date}`} className="link text-pencil">
          Print this day
        </Link>
      </p>
    </Layout>
  )
}

export function MarginNotes({
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
    <aside className="mt-2 mb-6 border-l border-pencil/60 pl-3 text-pencil" aria-label="Margin notes">
      {margins.map((m) => (
        <div key={m.id} className="group mb-3">
          <p className="uppercase">
            Added {formatShortDate(m.writtenAt)}
            <button
              className="no-print ml-3 normal-case opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ribbon"
              onClick={() => confirm('Delete this margin note?') && onDelete(m)}
            >
              delete
            </button>
          </p>
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>
      ))}
      {canAdd && (
        <div className="no-print">
          <AutoTextarea aria-label="New margin note" placeholder="Add a margin note…" value={text} onChange={(e) => setText(e.target.value)} />
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

// Between passages, as in a typed manuscript. Times are kept, not printed.
export function PassageBreak() {
  return (
    <p aria-hidden className="mb-6 text-center tracking-[0.6em] text-pencil">
      * * *
    </p>
  )
}
