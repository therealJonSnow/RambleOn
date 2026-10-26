import 'fake-indexeddb/auto'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createVault } from './crypto'
import { buildExportZip, parseExport } from './export'
import { Journal } from './journal'
import { openLocalDb } from './localdb'
import { DEFAULT_SETTINGS, type Note, type Passage } from './models'
import { MemoryStore } from './store/memory'

let n = 0
async function freshJournal() {
  const store = new MemoryStore()
  const { key } = await createVault('passphrase', 1000)
  return { store, journal: new Journal(store, key, await openLocalDb(`journal-${n++}`)) }
}

const passage = (over: Partial<Passage>): Passage => ({
  id: crypto.randomUUID(),
  kind: 'passage',
  journalDate: '2026-10-25',
  writtenAt: '2026-10-25T21:40:00.000Z',
  title: '',
  raw: '',
  text: '',
  ...over,
})

const note = (over: Partial<Note>): Note => ({
  id: crypto.randomUUID(),
  journalDate: '2026-10-25',
  writtenAt: '2026-10-25T12:00:00.000Z',
  text: '',
  ...over,
})

async function seed(journal: Journal) {
  await journal.savePassage(
    passage({ title: 'Steam trains', raw: 'Um so that was cool.', text: 'So that was cool.' }),
  )
  await journal.savePassage(
    passage({ writtenAt: '2026-10-25T23:40:00.000Z', raw: 'Late one.', text: 'Late one.' }),
  )
  await journal.savePassage(
    passage({ kind: 'margin', writtenAt: '2026-10-27T09:00:00.000Z', raw: 'It was Sam.', text: 'It was Sam.' }),
  )
  await journal.saveNote(note({ text: 'Podcast: The Rest Is History' }))
  await journal.saveNote(note({ journalDate: '2026-10-26', text: 'Met Alex and Jo in the park\nJo has a dog called Biscuit' }))
  await journal.sync.flush()
}

describe('Journal', () => {
  it('stores only ciphertext on the server', async () => {
    const { store, journal } = await freshJournal()
    await seed(journal)
    const rows = JSON.stringify([...(await store.listRows('passages')), ...(await store.listRows('notes'))])
    expect(rows).not.toContain('cool')
    expect(rows).not.toContain('Podcast')
  })

  it('loads a day, separating passages, margin notes and notes', async () => {
    const { journal } = await freshJournal()
    await seed(journal)
    const day = await journal.loadDay('2026-10-25')
    expect(day.passages.map((p) => p.text)).toEqual(['So that was cool.', 'Late one.'])
    expect(day.margins.map((p) => p.text)).toEqual(['It was Sam.'])
    expect(day.notes.map((x) => x.text)).toEqual(['Podcast: The Rest Is History'])
    expect(day.complete).toBe(true)
  })

  it('edits after sync without creating conflict copies', async () => {
    const { journal } = await freshJournal()
    const p = passage({ raw: 'First.', text: 'First.' })
    await journal.savePassage(p)
    await journal.sync.flush()
    await journal.savePassage({ ...p, text: 'First, edited.' })
    await journal.sync.flush()
    const day = await journal.loadDay(p.journalDate)
    expect(day.passages.map((x) => x.text)).toEqual(['First, edited.'])
    expect(day.notes).toHaveLength(0)
  })

  it('keeps a conflict copy when another device edited the same passage', async () => {
    const { store, journal } = await freshJournal()
    const p = passage({ raw: 'Original.', text: 'Original.' })
    await journal.savePassage(p)
    await journal.sync.flush()

    // Another device with the same key edits it first.
    const other = new Journal(store, journal.key, await openLocalDb(`journal-${n++}`))
    await other.loadDay(p.journalDate)
    await other.savePassage({ ...p, text: 'Edited on laptop.' })
    await other.sync.flush()

    await journal.savePassage({ ...p, text: 'Edited on phone.' })
    await journal.sync.flush()

    const day = await journal.loadDay(p.journalDate)
    expect(day.passages.map((x) => x.text)).toEqual(['Edited on phone.'])
    expect(day.notes).toHaveLength(1)
    expect(day.notes[0].text).toContain('Edited on laptop.')
  })
})

describe('export and restore', () => {
  it('writes readable markdown per day plus journal.json', async () => {
    const { journal } = await freshJournal()
    await seed(journal)
    const files = unzipSync(buildExportZip(await journal.exportData(DEFAULT_SETTINGS)))
    expect(Object.keys(files).sort()).toEqual(['days/2026-10-25.md', 'days/2026-10-26.md', 'journal.json'])

    const md = strFromU8(files['days/2026-10-25.md'])
    expect(md).toContain('# Sunday, 25 October 2026')
    expect(md).toMatch(/## \d\d:40 · Steam trains\n\nSo that was cool\./)
    expect(md).toContain('> It was Sam.')
    expect(md).toContain('## Notes\n\n- Podcast: The Rest Is History')

    const md26 = strFromU8(files['days/2026-10-26.md'])
    expect(md26).toContain('- Met Alex and Jo in the park\n  Jo has a dog called Biscuit')
  })

  it('round-trips: export, restore into a fresh project, nothing lost', async () => {
    const { journal } = await freshJournal()
    await seed(journal)
    const settings = { ...DEFAULT_SETTINGS, rolloverHour: 5, unlockedDates: ['2026-10-01'] }
    const first = await journal.exportData(settings)
    const json = strFromU8(unzipSync(buildExportZip(first))['journal.json'])

    // A different project with a different passphrase.
    const fresh = await freshJournal()
    await fresh.journal.restore(parseExport(json))
    const second = await fresh.journal.exportData(await fresh.journal.loadSettings())

    expect({ ...second, exportedAt: '' }).toEqual({ ...first, exportedAt: '' })
  })

  it('restoring the same file twice changes nothing', async () => {
    const { journal } = await freshJournal()
    await seed(journal)
    const data = await journal.exportData(DEFAULT_SETTINGS)
    await journal.restore(data)
    await journal.restore(data)
    const again = await journal.exportData(DEFAULT_SETTINGS)
    expect(again.passages).toEqual(data.passages)
    expect(again.notes).toEqual(data.notes)
  })

  it('rejects files that are not RambleOn exports', () => {
    expect(() => parseExport('nope')).toThrow('not valid JSON')
    expect(() => parseExport('{"format":"other"}')).toThrow('not a RambleOn')
    expect(() =>
      parseExport(JSON.stringify({ format: 'rambleon-export', version: 1, passages: [{ id: 1 }], notes: [] })),
    ).toThrow('malformed')
  })
})
