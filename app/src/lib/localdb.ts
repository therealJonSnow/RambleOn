import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EncryptedRow, Table } from './store/types'

// On-device storage (IndexedDB):
//   kv     – the non-extractable master key and the encrypted composer draft
//   outbox – encrypted changes (rows and photos) waiting to reach the server

export type RowOutboxItem =
  | { key: string; table: Table; op: 'upsert'; row: EncryptedRow; queuedAt: string }
  | { key: string; table: Table; op: 'delete'; id: string; journalDate: string; queuedAt: string }

// Photos: `bytes` is already encrypted.
export type MediaOutboxItem =
  | { key: string; op: 'putMedia'; path: string; bytes: Uint8Array<ArrayBuffer>; queuedAt: string }
  | { key: string; op: 'deleteMedia'; path: string; queuedAt: string }

export type OutboxItem = RowOutboxItem | MediaOutboxItem

export const isRowItem = (item: OutboxItem): item is RowOutboxItem => item.op === 'upsert' || item.op === 'delete'

interface Schema extends DBSchema {
  kv: { key: string; value: unknown }
  outbox: { key: string; value: OutboxItem; indexes: { queuedAt: string } }
}

export interface LocalDb {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  outbox(): Promise<OutboxItem[]>
  putOutbox(item: OutboxItem): Promise<void>
  getOutbox(key: string): Promise<OutboxItem | undefined>
  deleteOutbox(key: string): Promise<void>
}

export async function openLocalDb(name = 'rambleon'): Promise<LocalDb> {
  const db: IDBPDatabase<Schema> = await openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('kv')
      db.createObjectStore('outbox', { keyPath: 'key' }).createIndex('queuedAt', 'queuedAt')
    },
  })
  return {
    get: async <T,>(key: string) => (await db.get('kv', key)) as T | undefined,
    set: async (key, value) => void (await db.put('kv', value, key)),
    del: (key) => db.delete('kv', key),
    outbox: () => db.getAllFromIndex('outbox', 'queuedAt'),
    putOutbox: async (item) => void (await db.put('outbox', item)),
    getOutbox: (key) => db.get('outbox', key),
    deleteOutbox: (key) => db.delete('outbox', key),
  }
}

// Ask the browser not to evict our storage (installed iOS PWAs are already exempt).
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Not supported: nothing to do.
  }
}
