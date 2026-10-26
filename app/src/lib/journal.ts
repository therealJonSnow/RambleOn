import { decryptJson, encryptJson } from './crypto'
import { formatTime } from './dates'
import { buildExportData, type ExportData } from './export'
import type { LocalDb } from './localdb'
import { DEFAULT_SETTINGS, type Note, type NotePayload, type Passage, type PassagePayload, type Settings } from './models'
import type { EncryptedRow, JournalStore, Table } from './store/types'
import { SyncEngine, type SyncStatus } from './sync'

export interface Draft {
  id: string
  writtenAt: string
  journalDate: string
  raw: string
}

export interface DayContent {
  passages: Passage[]
  margins: Passage[]
  notes: Note[]
  // False when the server couldn't be reached and only local changes are shown.
  complete: boolean
}

const ctx = (table: Table | 'settings' | 'draft', id = '') => `${table}:${id}`

// The app's view of the journal: encrypts on the way out, decrypts on the way
// in, and routes every change through the on-device outbox.
export class Journal {
  readonly store: JournalStore
  readonly key: CryptoKey
  readonly local: LocalDb
  readonly sync: SyncEngine
  // Last version the server confirmed for each row; the base for the next edit.
  private versions = new Map<string, number>()

  constructor(store: JournalStore, key: CryptoKey, local: LocalDb, onStatus?: (s: SyncStatus) => void) {
    this.store = store
    this.key = key
    this.local = local
    this.sync = new SyncEngine(store, local, {
      onStatus,
      onSynced: (_table, id, version) => this.versions.set(id, version),
      onConflict: (table, _ours, theirs) => this.keepConflictCopy(table, theirs),
    })
  }

  // --- Encoding

  async encodePassage(p: Passage): Promise<EncryptedRow> {
    const payload: PassagePayload = { title: p.title, raw: p.raw, text: p.text }
    return {
      id: p.id,
      kind: p.kind,
      journalDate: p.journalDate,
      writtenAt: p.writtenAt,
      version: this.versions.get(p.id) ?? 0,
      ciphertext: await encryptJson(this.key, ctx('passages', p.id), payload),
    }
  }

  async decodePassage(row: EncryptedRow): Promise<Passage> {
    const payload = await decryptJson<PassagePayload>(this.key, ctx('passages', row.id), row.ciphertext)
    return {
      id: row.id,
      kind: row.kind ?? 'passage',
      journalDate: row.journalDate,
      writtenAt: row.writtenAt,
      ...payload,
    }
  }

  async encodeNote(n: Note): Promise<EncryptedRow> {
    const payload: NotePayload = { text: n.text }
    return {
      id: n.id,
      journalDate: n.journalDate,
      writtenAt: n.writtenAt,
      version: this.versions.get(n.id) ?? 0,
      ciphertext: await encryptJson(this.key, ctx('notes', n.id), payload),
    }
  }

  async decodeNote(row: EncryptedRow): Promise<Note> {
    const payload = await decryptJson<NotePayload>(this.key, ctx('notes', row.id), row.ciphertext)
    return { id: row.id, journalDate: row.journalDate, writtenAt: row.writtenAt, ...payload }
  }

  // --- Reading

  // Server rows overlaid with anything still waiting in the outbox.
  private async merged(table: Table, journalDate?: string): Promise<{ rows: EncryptedRow[]; pending: Set<string>; complete: boolean }> {
    let server: EncryptedRow[] = []
    let complete = true
    try {
      server = await this.store.listRows(table, journalDate)
    } catch {
      complete = false
    }
    const byId = new Map(server.map((r) => [r.id, r]))
    for (const r of server) this.versions.set(r.id, r.version)

    const pending = new Set<string>()
    for (const item of await this.sync.pending()) {
      if (item.table !== table) continue
      if (item.op === 'delete') {
        byId.delete(item.id)
      } else if (journalDate === undefined || item.row.journalDate === journalDate) {
        byId.set(item.row.id, item.row)
        pending.add(item.row.id)
      } else {
        byId.delete(item.row.id) // moved to another day
      }
    }
    const rows = [...byId.values()].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt))
    return { rows, pending, complete }
  }

  async loadDay(date: string): Promise<DayContent> {
    const p = await this.merged('passages', date)
    const n = await this.merged('notes', date)
    const passages = await Promise.all(
      p.rows.map(async (r) => ({ ...(await this.decodePassage(r)), pending: p.pending.has(r.id) })),
    )
    const notes = await Promise.all(
      n.rows.map(async (r) => ({ ...(await this.decodeNote(r)), pending: n.pending.has(r.id) })),
    )
    return {
      passages: passages.filter((x) => x.kind === 'passage'),
      margins: passages.filter((x) => x.kind === 'margin'),
      notes,
      complete: p.complete && n.complete,
    }
  }

  async loadAllPassages(): Promise<Passage[]> {
    const { rows, pending } = await this.merged('passages')
    return Promise.all(rows.map(async (r) => ({ ...(await this.decodePassage(r)), pending: pending.has(r.id) })))
  }

  async loadAllNotes(): Promise<Note[]> {
    const { rows, pending } = await this.merged('notes')
    return Promise.all(rows.map(async (r) => ({ ...(await this.decodeNote(r)), pending: pending.has(r.id) })))
  }

  // --- Writing (all queued through the outbox)

  async savePassage(p: Passage): Promise<void> {
    await this.sync.queueUpsert('passages', await this.encodePassage(p))
  }

  async deletePassage(p: Passage): Promise<void> {
    await this.sync.queueDelete('passages', p.id, p.journalDate)
  }

  async saveNote(n: Note): Promise<void> {
    await this.sync.queueUpsert('notes', await this.encodeNote(n))
  }

  async deleteNote(n: Note): Promise<void> {
    await this.sync.queueDelete('notes', n.id, n.journalDate)
  }

  // The latest save wins; the version it replaced is kept as a note so
  // nothing is silently lost.
  private async keepConflictCopy(table: Table, theirs: EncryptedRow): Promise<void> {
    const text =
      table === 'passages'
        ? (await this.decodePassage(theirs)).text
        : (await this.decodeNote(theirs)).text
    const what = table === 'passages' ? `the passage from ${formatTime(theirs.writtenAt)}` : 'a note'
    await this.saveNote({
      id: crypto.randomUUID(),
      journalDate: theirs.journalDate,
      writtenAt: new Date().toISOString(),
      text: `Conflict copy: ${what} was also edited on another device. That version was:\n\n${text}`,
    })
  }

  // --- Export and restore

  async exportData(settings: Settings): Promise<ExportData> {
    return buildExportData(await this.loadAllPassages(), await this.loadAllNotes(), settings)
  }

  // Writes every record from an export straight to the server (needs a
  // connection). Restoring the same file twice is harmless: records are
  // matched by id and overwritten.
  async restore(data: ExportData): Promise<{ passages: number; notes: number }> {
    const put = async (table: Table, row: EncryptedRow) => {
      let result = await this.store.upsertRow(table, row)
      if (!result.ok) result = await this.store.upsertRow(table, { ...row, version: result.current.version })
      if (!result.ok) throw new Error(`Could not restore ${table} ${row.id}`)
      this.versions.set(row.id, result.version)
    }
    for (const p of data.passages) {
      this.versions.delete(p.id)
      await put('passages', await this.encodePassage(p))
    }
    for (const n of data.notes) {
      this.versions.delete(n.id)
      await put('notes', await this.encodeNote(n))
    }
    await this.saveSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    return { passages: data.passages.length, notes: data.notes.length }
  }

  // --- Settings

  // Cached on the device (encrypted) so the app still works offline.
  async loadSettings(): Promise<Settings> {
    let blob: string | null
    try {
      blob = await this.store.getSettings()
      if (blob) await this.local.set('settings', blob)
    } catch (e) {
      blob = (await this.local.get<string>('settings')) ?? null
      if (!blob) throw e
    }
    if (!blob) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(await decryptJson<Partial<Settings>>(this.key, ctx('settings'), blob)) }
  }

  async saveSettings(settings: Settings): Promise<void> {
    const blob = await encryptJson(this.key, ctx('settings'), settings)
    await this.store.putSettings(blob)
    await this.local.set('settings', blob)
  }

  // --- Composer draft, kept on the device until it's saved as a passage.

  async loadDraft(): Promise<Draft | null> {
    const blob = await this.local.get<string>('draft')
    if (!blob) return null
    try {
      return await decryptJson<Draft>(this.key, ctx('draft'), blob)
    } catch {
      return null
    }
  }

  async saveDraft(draft: Draft): Promise<void> {
    await this.local.set('draft', await encryptJson(this.key, ctx('draft'), draft))
  }

  async clearDraft(): Promise<void> {
    await this.local.del('draft')
  }
}
