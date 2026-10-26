import { useState } from 'react'
import type { Note } from '../lib/models'
import { useDebounced } from '../lib/useDebounced'
import { AutoTextarea } from './AutoTextarea'

interface Props {
  date: string
  notes: Note[]
  onSave(n: Note): void
  onDelete(n: Note): void
  // A new note is finished (the box lost focus). Must replace any copy with the same id.
  onAdded(n: Note): void
}

const blankNote = (date: string): Note => ({
  id: crypto.randomUUID(),
  journalDate: date,
  writtenAt: new Date().toISOString(),
  text: '',
})

// The day's notes: text-first, always editable, like a small notes app.
export function NotesArea({ date, notes, onSave, onDelete, onAdded }: Props) {
  // The note being typed in the "Add a note…" box. It is saved as you type,
  // so a page refresh can bring it back from the server: keep it out of the
  // list until it's finished, or it shows up twice.
  const [draft, setDraft] = useState(() => blankNote(date))
  const [draftDate, setDraftDate] = useState(date)
  if (draftDate !== date) {
    setDraftDate(date)
    setDraft(blankNote(date))
  }
  const listed = notes.filter((n) => n.id !== draft.id)

  return (
    <section className="mt-14 border-t border-dashed border-ink/30 pt-6" aria-label="Notes">
      <h2 className="label mb-4">Notes</h2>
      <ul>
        {listed.map((n) => (
          <NoteItem key={n.id} note={n} onSave={onSave} onDelete={onDelete} />
        ))}
      </ul>
      <NewNote
        key={draft.id}
        note={draft}
        onSave={onSave}
        onDelete={onDelete}
        onDone={(finished) => {
          if (finished) onAdded(finished)
          setDraft(blankNote(date))
        }}
      />
    </section>
  )
}

function NoteItem({ note, onSave, onDelete }: { note: Note; onSave(n: Note): void; onDelete(n: Note): void }) {
  const [text, setText] = useState(note.text)
  const [edited, setEdited] = useState(false)
  const save = useDebounced((t: string) => onSave({ ...note, text: t }), 800)
  return (
    <li className="mb-3 flex gap-3">
      <span aria-hidden className="pt-0.5 leading-8 text-pencil">
        –
      </span>
      <AutoTextarea
        aria-label="Note"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setEdited(true)
          if (e.target.value.trim()) save(e.target.value)
        }}
        onBlur={() => {
          if (!edited) return
          if (text.trim()) save.flush()
          else onDelete(note) // you cleared it: that's a delete
        }}
      />
      {note.pending && <span className="shrink-0 pt-2 text-xs text-ink-soft">not synced</span>}
    </li>
  )
}

// Always on the page, so tapping it opens the keyboard straight away.
function NewNote({
  note: initial,
  onSave,
  onDelete,
  onDone,
}: {
  note: Note
  onSave(n: Note): void
  onDelete(n: Note): void
  onDone(finished: Note | null): void
}) {
  const [note, setNote] = useState(initial)
  const [saved, setSaved] = useState(false)
  const save = useDebounced((n: Note) => {
    onSave(n)
    setSaved(true)
  }, 800)

  return (
    <div className="flex gap-3">
      <span aria-hidden className="pt-0.5 leading-8 text-pencil">
        +
      </span>
      <AutoTextarea
        aria-label="New note"
        placeholder="Add a note…"
        value={note.text}
        onChange={(e) => {
          const next = { ...note, text: e.target.value, writtenAt: note.text ? note.writtenAt : new Date().toISOString() }
          setNote(next)
          if (next.text.trim()) save(next)
        }}
        onBlur={() => {
          if (note.text.trim()) {
            save.flush()
            onSave(note) // idempotent: same id, latest text
            onDone(note)
          } else {
            if (saved) onDelete(note)
            onDone(null)
          }
        }}
      />
    </div>
  )
}
