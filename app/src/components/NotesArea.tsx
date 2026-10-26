import { useState } from 'react'
import type { Note } from '../lib/models'
import { useDebounced } from '../lib/useDebounced'
import { AutoTextarea } from './AutoTextarea'

interface Props {
  date: string
  notes: Note[]
  onSave(n: Note): void
  onDelete(n: Note): void
  onAdded(n: Note): void
}

// The day's notes: text-first, always editable, like a small notes app.
export function NotesArea({ date, notes, onSave, onDelete, onAdded }: Props) {
  return (
    <section className="mt-14 border-t border-dashed border-ink/30 pt-6" aria-label="Notes">
      <h2 className="label mb-4">Notes</h2>
      <ul>
        {notes.map((n) => (
          <NoteItem key={n.id} note={n} onSave={onSave} onDelete={onDelete} />
        ))}
      </ul>
      <NewNote key={date} date={date} onSave={onSave} onDelete={onDelete} onAdded={onAdded} />
    </section>
  )
}

function NoteItem({ note, onSave, onDelete }: { note: Note; onSave(n: Note): void; onDelete(n: Note): void }) {
  const [text, setText] = useState(note.text)
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
          if (e.target.value.trim()) save(e.target.value)
        }}
        onBlur={() => {
          if (text.trim()) save.flush()
          else onDelete(note)
        }}
      />
      {note.pending && <span className="shrink-0 pt-2 text-xs text-ink-soft">not synced</span>}
    </li>
  )
}

const blankNote = (date: string): Note => ({
  id: crypto.randomUUID(),
  journalDate: date,
  writtenAt: new Date().toISOString(),
  text: '',
})

// Always on the page, so tapping it opens the keyboard straight away. Saved
// as you type; on blur it joins the list above and the box resets.
function NewNote({ date, onSave, onDelete, onAdded }: Omit<Props, 'notes'>) {
  const [note, setNote] = useState(() => blankNote(date))
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
            if (!saved) onSave(note)
            onAdded(note)
          } else if (saved) {
            onDelete(note)
          }
          setNote(blankNote(date))
          setSaved(false)
        }}
      />
    </div>
  )
}
