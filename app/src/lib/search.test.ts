import { describe, expect, it } from 'vitest'
import type { Note, Passage } from './models'
import { search } from './search'

const p = (over: Partial<Passage>): Passage => ({
  id: crypto.randomUUID(), kind: 'passage', journalDate: '2026-10-25', writtenAt: '2026-10-25T20:00:00Z', title: '', raw: '', text: '', ...over,
})
const n = (over: Partial<Note>): Note => ({ id: crypto.randomUUID(), journalDate: '2026-10-26', writtenAt: '2026-10-26T09:00:00Z', text: '', ...over })

describe('search', () => {
  it('matches passages, titles, captions and notes, case-insensitively, newest first', () => {
    const hits = search('steam', [
      p({ text: 'Got the Steam train to the pub.' }),
      p({ journalDate: '2026-10-20', title: 'Steam fair', text: 'Rain all day.' }),
      p({ journalDate: '2026-10-21', text: 'Nothing here', blocks: [{ type: 'text', text: 'Nothing here' }, { type: 'image', id: 'a', caption: 'A steam engine', width: 1, height: 1 }, { type: 'text', text: '' }] }),
    ], [n({ text: 'Book: steam punk novel' })])
    expect(hits.map((h) => h.journalDate)).toEqual(['2026-10-26', '2026-10-25', '2026-10-21', '2026-10-20'])
    expect(hits[1]).toMatchObject({ before: 'Got the ', match: 'Steam', after: ' train to the pub.' })
  })

  it('trims long text around the match', () => {
    const long = 'a'.repeat(200) + ' needle ' + 'b'.repeat(200)
    const [hit] = search('needle', [p({ text: long })], [])
    expect(hit.before.startsWith('…')).toBe(true)
    expect(hit.after.endsWith('…')).toBe(true)
    expect(hit.before.length).toBeLessThan(70)
  })

  it('returns nothing for an empty query', () => {
    expect(search('  ', [p({ text: 'x' })], [])).toEqual([])
  })
})
