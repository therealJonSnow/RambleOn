import { fromBase64, toBase64, type Vault } from '../crypto'
import type { DaySummary, EncryptedRow, JournalStore, Table, UpsertResult } from './types'

interface Snapshot {
  vault: Vault | null
  settings: string | null
  passages: EncryptedRow[]
  notes: EncryptedRow[]
  media?: Record<string, string>
}

// In-memory store, used by tests and by demo mode (no Supabase configured),
// where it is persisted to localStorage.
export class MemoryStore implements JournalStore {
  private vault: Vault | null = null
  private settings: string | null = null
  private tables: Record<Table, Map<string, EncryptedRow>> = { passages: new Map(), notes: new Map() }
  private media = new Map<string, Uint8Array<ArrayBuffer>>()
  private persistKey?: string

  constructor(persistKey?: string) {
    this.persistKey = persistKey
    if (persistKey) {
      const raw = localStorage.getItem(persistKey)
      if (raw) {
        const s = JSON.parse(raw) as Snapshot
        this.vault = s.vault
        this.settings = s.settings
        for (const r of s.passages) this.tables.passages.set(r.id, r)
        for (const r of s.notes) this.tables.notes.set(r.id, r)
        for (const [path, b64] of Object.entries(s.media ?? {})) this.media.set(path, fromBase64(b64))
      }
    }
  }

  private save() {
    if (!this.persistKey) return
    const s: Snapshot = {
      vault: this.vault,
      settings: this.settings,
      passages: [...this.tables.passages.values()],
      notes: [...this.tables.notes.values()],
      media: Object.fromEntries([...this.media].map(([path, b]) => [path, toBase64(b)])),
    }
    try {
      localStorage.setItem(this.persistKey, JSON.stringify(s))
    } catch (e) {
      // Demo mode only: localStorage holds ~5MB, so lots of photos won't fit.
      console.warn('Demo storage is full', e)
    }
  }

  async getVault() {
    return this.vault
  }

  async putVault(vault: Vault) {
    this.vault = vault
    this.save()
  }

  async getSettings() {
    return this.settings
  }

  async putSettings(ciphertext: string) {
    this.settings = ciphertext
    this.save()
  }

  async listRows(table: Table, journalDate?: string) {
    return [...this.tables[table].values()]
      .filter((r) => journalDate === undefined || r.journalDate === journalDate)
      .map((r) => ({ ...r }))
  }

  async listDates() {
    const days = new Map<string, DaySummary>()
    const get = (date: string) => {
      let d = days.get(date)
      if (!d) days.set(date, (d = { date, passages: 0, notes: 0 }))
      return d
    }
    for (const r of this.tables.passages.values()) if (r.kind !== 'margin') get(r.journalDate).passages++
    for (const r of this.tables.notes.values()) get(r.journalDate).notes++
    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
  }

  async upsertRow(table: Table, row: EncryptedRow): Promise<UpsertResult> {
    const rows = this.tables[table]
    const current = rows.get(row.id)
    if (!current || current.version === row.version) {
      const version = current ? current.version + 1 : 1
      rows.set(row.id, { ...row, version })
      this.save()
      return { ok: true, version }
    }
    if (current.ciphertext === row.ciphertext && current.journalDate === row.journalDate) {
      return { ok: true, version: current.version }
    }
    return { ok: false, current: { ...current } }
  }

  async deleteRow(table: Table, id: string) {
    this.tables[table].delete(id)
    this.save()
  }

  async putMedia(path: string, bytes: Uint8Array<ArrayBuffer>) {
    this.media.set(path, bytes.slice())
    this.save()
  }

  async getMedia(path: string) {
    return this.media.get(path)?.slice() ?? null
  }

  async deleteMedia(path: string) {
    this.media.delete(path)
    this.save()
  }

  mediaPaths(): string[] {
    return [...this.media.keys()]
  }
}
