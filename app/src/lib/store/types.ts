import type { Vault } from '../crypto'

export type Table = 'passages' | 'notes'
export type PassageKind = 'passage' | 'margin'

// What the server stores. Only dates, times and versions are readable;
// everything written by the user lives inside `ciphertext`.
export interface EncryptedRow {
  id: string
  kind?: PassageKind
  journalDate: string
  writtenAt: string
  // Version the row is based on. 0 means "new row".
  version: number
  ciphertext: string
}

export interface DaySummary {
  date: string
  passages: number
  notes: number
}

export type UpsertResult = { ok: true; version: number } | { ok: false; current: EncryptedRow }

// Thrown when the backend cannot be reached (offline, paused project, outage).
export class StoreUnavailableError extends Error {
  constructor(message = 'Could not reach the database') {
    super(message)
  }
}

export interface JournalStore {
  getVault(): Promise<Vault | null>
  putVault(vault: Vault): Promise<void>
  getSettings(): Promise<string | null>
  putSettings(ciphertext: string): Promise<void>
  listRows(table: Table, journalDate?: string): Promise<EncryptedRow[]>
  listDates(): Promise<DaySummary[]>
  // Optimistic concurrency: succeeds when the stored version equals
  // row.version (or the row is new), otherwise returns the current row.
  upsertRow(table: Table, row: EncryptedRow): Promise<UpsertResult>
  deleteRow(table: Table, id: string): Promise<void>
}
