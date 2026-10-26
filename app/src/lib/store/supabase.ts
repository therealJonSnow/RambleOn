import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Vault } from '../crypto'
import {
  StoreUnavailableError,
  type DaySummary,
  type EncryptedRow,
  type JournalStore,
  type Table,
  type UpsertResult,
} from './types'

interface DbRow {
  id: string
  kind?: 'passage' | 'margin'
  journal_date: string
  written_at: string
  version: number
  ciphertext: string
}

const COLUMNS: Record<Table, string> = {
  passages: 'id, kind, journal_date, written_at, version, ciphertext',
  notes: 'id, journal_date, written_at, version, ciphertext',
}

function fromDb(r: DbRow): EncryptedRow {
  return {
    id: r.id,
    ...(r.kind ? { kind: r.kind } : {}),
    journalDate: r.journal_date,
    writtenAt: r.written_at,
    version: r.version,
    ciphertext: r.ciphertext,
  }
}

function toDb(table: Table, r: EncryptedRow, version: number) {
  return {
    id: r.id,
    ...(table === 'passages' ? { kind: r.kind ?? 'passage' } : {}),
    journal_date: r.journalDate,
    written_at: r.writtenAt,
    version,
    ciphertext: r.ciphertext,
    updated_at: new Date().toISOString(),
  }
}

// supabase-js reports network failures as errors without a Postgres code.
function check(error: PostgrestError | null): void {
  if (!error) return
  if (!error.code || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    throw new StoreUnavailableError(error.message)
  }
  throw new Error(`${error.code}: ${error.message}`)
}

// Supabase caps responses at 1000 rows by default, so read in pages: an
// export must never silently stop at the first thousand passages.
const PAGE = 1000
async function allPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const page = await fetchPage(from, from + PAGE - 1)
    all.push(...page)
    if (page.length < PAGE) return all
  }
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof TypeError) throw new StoreUnavailableError(e.message)
    throw e
  }
}

export class SupabaseStore implements JournalStore {
  private db: SupabaseClient
  private userId: string
  constructor(db: SupabaseClient, userId: string) {
    this.db = db
    this.userId = userId
  }

  getVault() {
    return guard(async () => {
      const { data, error } = await this.db
        .from('vaults')
        .select('salt, iterations, wrapped_by_passphrase, wrapped_by_recovery')
        .maybeSingle()
      check(error)
      if (!data) return null
      return {
        salt: data.salt,
        iterations: data.iterations,
        wrappedByPassphrase: data.wrapped_by_passphrase,
        wrappedByRecovery: data.wrapped_by_recovery,
      } satisfies Vault
    })
  }

  putVault(vault: Vault) {
    return guard(async () => {
      const { error } = await this.db.from('vaults').upsert({
        user_id: this.userId,
        salt: vault.salt,
        iterations: vault.iterations,
        wrapped_by_passphrase: vault.wrappedByPassphrase,
        wrapped_by_recovery: vault.wrappedByRecovery,
      })
      check(error)
    })
  }

  getSettings() {
    return guard(async () => {
      const { data, error } = await this.db.from('settings').select('ciphertext').maybeSingle()
      check(error)
      return (data?.ciphertext as string | undefined) ?? null
    })
  }

  putSettings(ciphertext: string) {
    return guard(async () => {
      const { error } = await this.db
        .from('settings')
        .upsert({ user_id: this.userId, ciphertext, updated_at: new Date().toISOString() })
      check(error)
    })
  }

  listRows(table: Table, journalDate?: string) {
    return guard(() =>
      allPages(async (from, to) => {
        let q = this.db.from(table).select(COLUMNS[table])
        if (journalDate) q = q.eq('journal_date', journalDate)
        const { data, error } = await q.order('written_at').order('id').range(from, to)
        check(error)
        return ((data ?? []) as unknown as DbRow[]).map(fromDb)
      }),
    )
  }

  listDates() {
    return guard(() =>
      allPages(async (from, to) => {
        const { data, error } = await this.db.rpc('journal_days').range(from, to)
        check(error)
        return ((data ?? []) as { date: string; passages: number; notes: number }[]).map(
          (d): DaySummary => ({ date: d.date, passages: d.passages, notes: d.notes }),
        )
      }),
    )
  }

  private async current(table: Table, id: string): Promise<EncryptedRow | null> {
    const { data, error } = await this.db.from(table).select(COLUMNS[table]).eq('id', id).maybeSingle()
    check(error)
    return data ? fromDb(data as unknown as DbRow) : null
  }

  upsertRow(table: Table, row: EncryptedRow): Promise<UpsertResult> {
    return guard(async () => {
      if (row.version > 0) {
        const { data, error } = await this.db
          .from(table)
          .update(toDb(table, row, row.version + 1))
          .eq('id', row.id)
          .eq('version', row.version)
          .select('version')
        check(error)
        if (data && data.length === 1) return { ok: true, version: row.version + 1 }
      }

      const current = await this.current(table, row.id)
      if (!current) {
        const { error } = await this.db.from(table).insert({ ...toDb(table, row, 1), user_id: this.userId })
        // 23505: inserted by an earlier attempt whose response was lost.
        if (error?.code !== '23505') {
          check(error)
          return { ok: true, version: 1 }
        }
        const again = await this.current(table, row.id)
        if (!again) throw new Error('Row vanished during insert')
        return this.resolve(row, again)
      }
      return this.resolve(row, current)
    })
  }

  private resolve(row: EncryptedRow, current: EncryptedRow): UpsertResult {
    if (current.ciphertext === row.ciphertext && current.journalDate === row.journalDate) {
      return { ok: true, version: current.version }
    }
    return { ok: false, current }
  }

  deleteRow(table: Table, id: string) {
    return guard(async () => {
      const { error } = await this.db.from(table).delete().eq('id', id)
      check(error)
    })
  }

  // Private bucket; storage policies limit each user to their own folder.
  private mediaPath(path: string) {
    return `${this.userId}/${path}`
  }

  putMedia(path: string, bytes: Uint8Array<ArrayBuffer>) {
    return guard(async () => {
      const { error } = await this.db.storage
        .from('media')
        .upload(this.mediaPath(path), new Blob([bytes]), { upsert: true, contentType: 'application/octet-stream' })
      if (error) throw toStoreError(error)
    })
  }

  getMedia(path: string) {
    return guard(async () => {
      const { data, error } = await this.db.storage.from('media').download(this.mediaPath(path))
      if (error) {
        if (/not.?found|404/i.test(`${error.name} ${error.message} ${(error as { status?: number }).status ?? ''}`)) return null
        throw toStoreError(error)
      }
      return new Uint8Array(await data.arrayBuffer())
    })
  }

  deleteMedia(path: string) {
    return guard(async () => {
      const { error } = await this.db.storage.from('media').remove([this.mediaPath(path)])
      if (error) throw toStoreError(error)
    })
  }
}

function toStoreError(error: Error): Error {
  return /fetch|network/i.test(error.message) ? new StoreUnavailableError(error.message) : error
}
