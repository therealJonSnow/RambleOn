import { useState } from 'react'
import { formatTime } from '../lib/dates'
import type { Passage } from '../lib/models'
import { useDebounced } from '../lib/useDebounced'
import { AutoTextarea } from './AutoTextarea'

interface Props {
  passage: Passage
  editable: boolean
  today: string
  onSave(p: Passage): void
  onMove(p: Passage, date: string): void
  onDelete(p: Passage): void
}

export function PassageView({ passage, editable, today, onSave, onMove, onDelete }: Props) {
  // Local copies: the page may reload underneath while you type.
  const [title, setTitle] = useState(passage.title)
  const [text, setText] = useState(passage.text)
  const [showRaw, setShowRaw] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const save = useDebounced((next: Passage) => onSave(next), 800)

  const current = { ...passage, title, text }
  const time = formatTime(passage.writtenAt)

  return (
    <section className="group mb-10" aria-label={`Passage at ${time}`}>
      <header className="mb-1 flex items-baseline gap-3">
        <time dateTime={passage.writtenAt} className="shrink-0 font-display text-lg text-ribbon">
          {time}
        </time>
        {editable ? (
          <input
            aria-label="Title"
            className="min-w-0 flex-1 bg-transparent font-display text-lg outline-none placeholder:text-pencil/60"
            placeholder="Add a title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ ...current, title: e.target.value })
            }}
            onBlur={() => save.flush()}
          />
        ) : (
          title && <h2 className="min-w-0 flex-1 font-display text-lg">{title}</h2>
        )}
        {passage.pending && (
          <span className="shrink-0 text-xs text-ink-soft" title="Saved on this device, waiting to upload">
            not synced
          </span>
        )}
        {editable && (
          <button
            className="no-print ml-auto shrink-0 px-2 text-ink-soft hover:text-ribbon"
            aria-label="Passage options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
        )}
      </header>

      {menuOpen && (
        <div className="no-print mb-3 flex flex-wrap items-center gap-4 rounded-sm border border-ink/20 px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            Move to
            <input
              type="date"
              className="rounded-sm border border-ink/30 bg-paper px-2"
              max={today}
              defaultValue={passage.journalDate}
              onChange={(e) => e.target.value && e.target.value !== passage.journalDate && onMove(current, e.target.value)}
            />
          </label>
          <button
            className="link text-ribbon"
            onClick={() => confirm('Delete this passage? This can’t be undone.') && onDelete(passage)}
          >
            Delete
          </button>
        </div>
      )}

      {editable ? (
        <AutoTextarea
          aria-label="Passage text"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            save({ ...current, text: e.target.value })
          }}
          onBlur={() => save.flush()}
        />
      ) : (
        <p className="leading-8 whitespace-pre-wrap">{text}</p>
      )}

      {passage.raw !== text && (
        <div className="no-print mt-1">
          <button className="text-sm text-pencil hover:text-ribbon" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? 'Hide original' : 'Show original'}
          </button>
          {showRaw && (
            <p className="mt-2 border-l-2 border-pencil/40 pl-3 text-sm leading-7 whitespace-pre-wrap text-pencil">
              {passage.raw}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
