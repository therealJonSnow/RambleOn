import { imagesOf } from './blocks'
import type { Note, Passage } from './models'

// Search runs on the device: everything is decrypted here, never on the server.

export interface SearchHit {
  kind: 'passage' | 'note' | 'margin'
  id: string
  journalDate: string
  writtenAt: string
  title: string
  // A short extract around the first match, split so the match can be highlighted.
  before: string
  match: string
  after: string
}

const CONTEXT = 60

function snippet(text: string, q: string): Pick<SearchHit, 'before' | 'match' | 'after'> | null {
  const flat = text.replace(/\s+/g, ' ')
  const at = flat.toLowerCase().indexOf(q)
  if (at === -1) return null
  const start = Math.max(0, at - CONTEXT)
  const end = Math.min(flat.length, at + q.length + CONTEXT)
  return {
    before: (start > 0 ? '…' : '') + flat.slice(start, at),
    match: flat.slice(at, at + q.length),
    after: flat.slice(at + q.length, end) + (end < flat.length ? '…' : ''),
  }
}

export function search(query: string, passages: Passage[], notes: Note[]): SearchHit[] {
  const q = query.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  for (const p of passages) {
    const captions = imagesOf(p).map((i) => i.caption).filter(Boolean)
    const s = snippet([p.title, p.text, ...captions].filter(Boolean).join(' · '), q)
    if (s) hits.push({ kind: p.kind, id: p.id, journalDate: p.journalDate, writtenAt: p.writtenAt, title: p.title, ...s })
  }
  for (const n of notes) {
    const s = snippet(n.text, q)
    if (s) hits.push({ kind: 'note', id: n.id, journalDate: n.journalDate, writtenAt: n.writtenAt, title: '', ...s })
  }
  // Newest first.
  return hits.sort((a, b) => b.journalDate.localeCompare(a.journalDate) || b.writtenAt.localeCompare(a.writtenAt))
}
