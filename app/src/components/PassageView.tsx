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
  // Printing: full-size photos.
  print?: boolean
}

export function PassageView({ passage, editable, today, onSave, onMove, onDelete, print = false }: Props) {
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
  const titleRef = useRef<HTMLInputElement>(null)
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
    <section className={`relative mb-6 ${editable ? 'pr-8' : ''}`} aria-label={`Passage at ${time}`}>
      {/* Titles are typed in capitals. Times are kept, but not printed on the page. */}
      {editable ? (
        <input
          ref={titleRef}
          aria-label="Title"
          className={`w-full bg-transparent uppercase tracking-[0.05em] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-pencil/60 ${
            title ? '' : 'sr-only focus:not-sr-only'
          }`}
          placeholder="Add a title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save(build(e.target.value, blocks))
          }}
          onBlur={() => save.flush()}
        />
      ) : (
        title && <h2 className="uppercase tracking-[0.05em]">{title}</h2>
      )}
      {editable && (
        <button
          className="no-print absolute top-0 right-0 px-1 text-pencil hover:text-ribbon"
          aria-label="Passage options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋯
        </button>
      )}

      {menuOpen && (
        <div className="no-print mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-sm border border-ink/20 px-3 py-2">
          {!title && (
            <button
              className="link"
              onClick={() => {
                // Focus inside the tap so iOS opens the keyboard.
                titleRef.current?.focus()
                setMenuOpen(false)
              }}
            >
              Add title
            </button>
          )}
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
              <p key={`t${i}`} className="whitespace-pre-wrap">
                {b.text}
              </p>
            )
          )
        ) : (
          <figure key={b.id} className="mt-6 mb-2 sm:mx-6">
            <div className="relative">
              <Photo image={b} full={print} onOpen={() => setViewing(b)} />
              {editable && (
                <button
                  className="no-print absolute -top-3 -right-3 z-10 grid size-8 place-items-center rounded-full bg-ribbon text-ribbon-ink shadow-md active:scale-95"
                  aria-label="Remove photo"
                  onClick={() => removePhoto(b)}
                >
                  {/* Drawn, not typed, so it sits exactly centred. */}
                  <svg viewBox="0 0 12 12" className="size-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              )}
            </div>
            {editable ? (
              <input
                aria-label="Caption"
                className="mt-1 w-full bg-transparent text-ribbon outline-none placeholder:text-ribbon/40"
                placeholder="Add a caption"
                value={b.caption}
                onChange={(e) => update(setCaption(blocks, b.id, e.target.value))}
                onBlur={() => save.flush()}
              />
            ) : (
              b.caption && <figcaption className="mt-1 text-ribbon">{b.caption}</figcaption>
            )}
          </figure>
        ),
      )}

      {adding > 0 && <p className="my-4 animate-pulse text-ink-soft">Adding {adding === 1 ? 'photo' : `${adding} photos`}…</p>}
      {photoError && <p className="my-2 text-ribbon">{photoError}</p>}

      {passage.raw !== text && (
        <div className="no-print mt-1">
          <button className="text-pencil hover:text-ribbon" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? 'Hide original' : 'Show original'}
          </button>
          {showRaw && (
            <p className="mt-1 border-l border-pencil/60 pl-3 whitespace-pre-wrap text-pencil">
              {passage.raw}
            </p>
          )}
        </div>
      )}

      {viewing && <PhotoViewer image={viewing} onClose={() => setViewing(null)} />}
    </section>
  )
}
