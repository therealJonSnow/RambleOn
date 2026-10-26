import { useEffect, useState } from 'react'
import type { ImageBlock } from '../lib/models'
import { useJournal } from '../state/journal'

// Loads and decrypts a photo, returning an object URL (or null if missing).
function usePhotoUrl(id: string, variant: 'thumb' | 'full') {
  const { journal } = useJournal()
  const [state, setState] = useState<{ key: string; url: string | null | undefined }>({ key: '', url: undefined })
  const key = `${id}:${variant}`
  useEffect(() => {
    let live = true
    journal.imageUrl(id, variant).then(
      (url) => live && setState({ key, url }),
      () => live && setState({ key, url: null }),
    )
    return () => {
      live = false
    }
  }, [journal, id, variant, key])
  return state.key === key ? state.url : undefined
}

// A photo taped onto the page.
export function Photo({ image, onOpen }: { image: ImageBlock; onOpen(): void }) {
  const url = usePhotoUrl(image.id, 'thumb')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={image.caption ? `Photo: ${image.caption}. Open full screen` : 'Open photo full screen'}
      className="taped-photo relative block w-full bg-print p-1.5 shadow-md"
      style={{ aspectRatio: `${image.width + 12} / ${image.height + 12}` }}
    >
      {url ? (
        <img src={url} alt={image.caption} className="size-full object-cover" draggable={false} />
      ) : (
        <span className="grid size-full place-items-center bg-paper-edge text-ink-soft">
          {url === null ? 'Photo unavailable' : 'Loading photo…'}
        </span>
      )}
    </button>
  )
}

export function PhotoViewer({ image, onClose }: { image: ImageBlock; onClose(): void }) {
  const url = usePhotoUrl(image.id, 'full')
  const thumb = usePhotoUrl(image.id, 'thumb')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const src = url ?? thumb
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      {src ? (
        <img src={src} alt={image.caption} className="max-h-full max-w-full object-contain" />
      ) : (
        <p className="text-white/70">{url === null ? 'Photo unavailable' : 'Loading…'}</p>
      )}
      {image.caption && <p className="mt-3 text-center text-[#ff8a80]">{image.caption}</p>}
      <button className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 px-3 py-1 text-white" aria-label="Close">
        ×
      </button>
    </div>
  )
}
