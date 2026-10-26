import type { LocalDb, OutboxItem } from './localdb'
import { StoreUnavailableError, type EncryptedRow, type JournalStore, type Table } from './store/types'

// Every change is written to the on-device outbox first, then pushed to the
// server. Items leave the outbox only once the server has confirmed them, so
// nothing is lost if the connection drops or the app is closed.

export type SyncStatus = { pending: number; unavailable: boolean }

export interface SyncHandlers {
  // Server confirmed a row; `version` is the new server version.
  onSynced?(table: Table, id: string, version: number): void
  // The row changed on another device since we last saw it. The latest save
  // wins, so ours is retried on top; this hook keeps the other version.
  onConflict?(table: Table, ours: EncryptedRow, theirs: EncryptedRow): Promise<void>
  onStatus?(status: SyncStatus): void
}

const outboxKey = (table: Table, id: string) => `${table}:${id}`

export class SyncEngine {
  private store: JournalStore
  private local: LocalDb
  private handlers: SyncHandlers
  private flushing: Promise<void> | null = null
  private again = false
  private unavailable = false
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private retryDelay = 2000

  constructor(store: JournalStore, local: LocalDb, handlers: SyncHandlers = {}) {
    this.store = store
    this.local = local
    this.handlers = handlers
  }

  async queueUpsert(table: Table, row: EncryptedRow): Promise<void> {
    const key = outboxKey(table, row.id)
    // If an earlier edit is still waiting, keep its base version: the server
    // hasn't moved on yet.
    const existing = await this.local.getOutbox(key)
    const base = existing?.op === 'upsert' ? existing.row.version : row.version
    await this.local.putOutbox({ key, table, op: 'upsert', row: { ...row, version: base }, queuedAt: now() })
    await this.reportStatus()
    void this.flush()
  }

  async queueDelete(table: Table, id: string, journalDate: string): Promise<void> {
    const key = outboxKey(table, id)
    const existing = await this.local.getOutbox(key)
    if (existing?.op === 'upsert' && existing.row.version === 0) {
      // Never reached the server: just drop it.
      await this.local.deleteOutbox(key)
    } else {
      await this.local.putOutbox({ key, table, op: 'delete', id, journalDate, queuedAt: now() })
    }
    await this.reportStatus()
    void this.flush()
  }

  pending(): Promise<OutboxItem[]> {
    return this.local.outbox()
  }

  // Pushes the outbox in order. Safe to call often (on reconnect, on focus).
  // A call made while a flush is running is covered by one more pass, and
  // the returned promise waits for that pass too.
  flush(): Promise<void> {
    this.again = true
    this.flushing ??= (async () => {
      try {
        while (this.again) {
          this.again = false
          await this.run()
        }
      } finally {
        this.flushing = null
      }
    })()
    return this.flushing
  }

  private async run(): Promise<void> {
    clearTimeout(this.retryTimer)
    try {
      for (const item of await this.local.outbox()) {
        await this.push(item)
      }
      this.unavailable = false
      this.retryDelay = 2000
    } catch (e) {
      // Anything else (e.g. a server error) is logged and retried the same way.
      if (!(e instanceof StoreUnavailableError)) console.error('Sync failed', e)
      this.unavailable = true
      this.retryTimer = setTimeout(() => void this.flush(), this.retryDelay)
      this.retryDelay = Math.min(this.retryDelay * 2, 60_000)
    } finally {
      await this.reportStatus()
    }
  }

  private async push(item: OutboxItem): Promise<void> {
    if (item.op === 'delete') {
      await this.store.deleteRow(item.table, item.id)
      await this.removeIfUnchanged(item)
      return
    }

    let row = item.row
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await this.store.upsertRow(item.table, row)
      if (result.ok) {
        await this.removeIfUnchanged(item, result.version)
        this.handlers.onSynced?.(item.table, row.id, result.version)
        return
      }
      await this.handlers.onConflict?.(item.table, row, result.current)
      row = { ...row, version: result.current.version }
    }
    throw new Error(`Could not save ${item.key} after repeated conflicts`)
  }

  // A newer edit may have been queued while this one was in flight. If so,
  // keep it, rebased on the version the server now has.
  private async removeIfUnchanged(item: OutboxItem, version?: number): Promise<void> {
    const latest = await this.local.getOutbox(item.key)
    if (!latest) return
    if (latest.queuedAt === item.queuedAt) {
      await this.local.deleteOutbox(item.key)
    } else if (latest.op === 'upsert' && version !== undefined) {
      await this.local.putOutbox({ ...latest, row: { ...latest.row, version } })
      this.again = true
    }
  }

  private async reportStatus(): Promise<void> {
    const pending = (await this.local.outbox()).length
    this.handlers.onStatus?.({ pending, unavailable: this.unavailable })
  }

  dispose(): void {
    clearTimeout(this.retryTimer)
  }
}

// Monotonic so items queued within the same millisecond keep their order.
let last = 0
function now(): string {
  const t = Math.max(Date.now(), last + 1)
  last = t
  return new Date(t).toISOString()
}
