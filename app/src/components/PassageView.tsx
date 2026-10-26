import { useRef, useState } from 'react'
import {
  blocksOf,
  insertImages,
  removeImage,
  setCaption,
  setTextBlock,
  textOf,
  withBlocks,
  type Caret,
} from '../lib/blocks'
import { formatTime } from '../lib/dates'
import { prepareImage } from '../lib/images'
import type { Block, ImageBlock, Passage } from '../lib/models'
import { useDebounced } from '../lib/useDebounced'
import { useJournal } from '../state/journal'
import { AutoTextarea } from './AutoTextarea'
import { Photo, PhotoViewer } from './Photo'

interface Props {
  passage: Passage
  editable: boolean
  today: string
  onSave(p: Passage): void
  onMove(p: Passage, date: string): void
  onDelete(p: Passage): void
}

export function PassageView({ passage, editable, today, onSave, onMove, onDelete }: Props) {
  const { journal } = useJournal()
  // Local copies: the page may reload underneath while you type.
  const [title, setTitle] = useState(passage.title)
  const [blocks, setBlocks] = useState<Block[]>(() => blocksOf(passage))
  const [showRaw, setShowRaw] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adding, setAdding] = useState(0)
  const [photoError, setPhotoError] = useState('')
  const [viewing, setViewing] = useState<ImageBlock | null>(null)
  // Where the cursor last was, so photos go after that paragraph.
  const caret = useRef<Caret | null>(null)
  const save = useDebounced((next: Passage) => onSave(next), 800)

  const build = (t: string, b: Block[]) => withBlocks({ ...passage, title: t }, b)
  const update = (b: Block[], immediate = false) => {
    setBlocks(b)
    const next = build(title, b)
    if (immediate) {
      save.flush()
      onSave(next)
    } else {
      save(next)
    }
  }

  async function addPhotos(files: File[]) {
    setMenuOpen(false)
    setPhotoError('')
    setAdding(files.length)
    const added: ImageBlock[] = []
    for (const file of files) {
      try {
        const prepared = await prepareImage(file)
        const id = crypto.randomUUID()
        await journal.saveImage(id, prepared.full, prepared.thumb)
        added.push({
          type: 'image',
          id,
          caption: '',
          width: prepared.width,
          height: prepared.height,
          ...(prepared.takenAt ? { takenAt: prepared.takenAt } : {}),
        })
      } catch (e) {
        console.error(e)
        setPhotoError('One of the photos couldn’t be read.')
      }
      setAdding((n) => n - 1)
    }
    if (added.length) {
      update(insertImages(blocks, caret.current, added), true)
      caret.current = null // block positions have shifted
    }
  }

  function removePhoto(img: ImageBlock) {
    if (!confirm('Remove this photo?')) return
    void journal.deleteImage(img.id)
    update(removeImage(blocks, img.id), true)
  }

  const time = formatTime(passage.writtenAt)
  const text = textOf(blocks)

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
              save(build(e.target.value, blocks))
            }}
            onBlur={() => save.flush()}
          />
        ) : (
          title && <h2 className="min-w-0 flex-1 font-display text-lg">{title}</h2>
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
        <div className="no-print mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-sm border border-ink/20 px-3 py-2 text-sm">
          <label className="link cursor-pointer">
            Add photo
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = ''
                if (files.length) void addPhotos(files)
              }}
            />
          </label>
          <label className="flex items-center gap-2">
            Move to
            <input
              type="date"
              className="rounded-sm border border-ink/30 bg-paper px-2"
              max={today}
              defaultValue={passage.journalDate}
              onChange={(e) =>
                e.target.value && e.target.value !== passage.journalDate && onMove(build(title, blocks), e.target.value)
              }
            />
          </label>
          <button
            className="link text-ribbon"
            onClick={() => confirm('Delete this passage? This can’t be undone.') && onDelete({ ...passage, blocks })}
          >
            Delete
          </button>
        </div>
      )}

      {blocks.map((b, i) =>
        b.type === 'text' ? (
          editable ? (
            <AutoTextarea
              key={`t${i}`}
              aria-label={blocks.length > 1 ? `Passage text, part ${i / 2 + 1}` : 'Passage text'}
              placeholder={blocks.length > 1 ? '…' : undefined}
              value={b.text}
              onChange={(e) => update(setTextBlock(blocks, i, e.target.value))}
              onSelect={(e) => (caret.current = { block: i, offset: e.currentTarget.selectionStart })}
              onBlur={(e) => {
                caret.current = { block: i, offset: e.currentTarget.selectionStart }
                save.flush()
              }}
            />
          ) : (
            b.text.trim() && (
              <p key={`t${i}`} className="leading-8 whitespace-pre-wrap">
                {b.text}
              </p>
            )
          )
        ) : (
          <figure key={b.id} className="my-6 sm:mx-6">
            <Photo image={b} onOpen={() => setViewing(b)} />
            {editable ? (
              <div className="mt-2 flex items-baseline gap-3">
                <input
                  aria-label="Caption"
                  className="min-w-0 flex-1 bg-transparent font-type text-ribbon outline-none placeholder:text-ribbon/40"
                  placeholder="Add a caption"
                  value={b.caption}
                  onChange={(e) => update(setCaption(blocks, b.id, e.target.value))}
                  onBlur={() => save.flush()}
                />
                <button className="no-print shrink-0 text-sm text-pencil hover:text-ribbon" onClick={() => removePhoto(b)}>
                  Remove
                </button>
              </div>
            ) : (
              b.caption && <figcaption className="mt-2 font-type text-ribbon">{b.caption}</figcaption>
            )}
          </figure>
        ),
      )}

      {adding > 0 && <p className="my-4 animate-pulse text-sm text-ink-soft">Adding {adding === 1 ? 'photo' : `${adding} photos`}…</p>}
      {photoError && <p className="my-2 text-sm text-ribbon">{photoError}</p>}

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

      {viewing && <PhotoViewer image={viewing} onClose={() => setViewing(null)} />}
    </section>
  )
}
