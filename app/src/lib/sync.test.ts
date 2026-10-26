import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openLocalDb } from './localdb'
import { MemoryStore } from './store/memory'
import { StoreUnavailableError, type EncryptedRow, type JournalStore } from './store/types'
import { SyncEngine } from './sync'

let n = 0
const freshLocal = () => openLocalDb(`test-${n++}`)

const row = (id: string, ciphertext: string, version = 0): EncryptedRow => ({
  id,
  kind: 'passage',
  journalDate: '2026-10-26',
  writtenAt: '2026-10-26T21:00:00.000Z',
  version,
  ciphertext,
})

// A store that can be switched offline.
function flaky(store: MemoryStore): JournalStore & { offline: boolean } {
  const s = {
    offline: false,
  } as JournalStore & { offline: boolean }
  for (const k of ['getVault', 'putVault', 'getSettings', 'putSettings', 'listRows', 'listDates', 'upsertRow', 'deleteRow'] as const) {
    ;(s as unknown as Record<string, unknown>)[k] = (...args: unknown[]) => {
      if (s.offline) return Promise.reject(new StoreUnavailableError())
      return (store[k] as (...a: unknown[]) => unknown).apply(store, args)
    }
  }
  return s
}

afterEach(() => vi.useRealTimers())

describe('SyncEngine', () => {
  it('saves locally while offline and uploads on reconnect', async () => {
    const mem = new MemoryStore()
    const store = flaky(mem)
    const local = await freshLocal()
    const engine = new SyncEngine(store, local)

    store.offline = true
    await engine.queueUpsert('passages', row('a', 'ct-1'))
    await engine.flush()
    expect(await engine.pending()).toHaveLength(1)
    expect(await mem.listRows('passages')).toHaveLength(0)

    store.offline = false
    await engine.flush()
    expect(await engine.pending()).toHaveLength(0)
    expect(await mem.listRows('passages')).toEqual([{ ...row('a', 'ct-1'), version: 1 }])
    engine.dispose()
  })

  it('keeps the outbox across app restarts', async () => {
    const mem = new MemoryStore()
    const store = flaky(mem)
    const name = `test-restart-${n++}`
    store.offline = true
    const first = new SyncEngine(store, await openLocalDb(name))
    await first.queueUpsert('notes', row('n1', 'ct'))
    await first.flush()
    first.dispose()

    store.offline = false
    const second = new SyncEngine(store, await openLocalDb(name))
    await second.flush()
    expect(await mem.listRows('notes')).toHaveLength(1)
    second.dispose()
  })

  it('coalesces edits made while offline onto the original base version', async () => {
    const mem = new MemoryStore()
    const store = flaky(mem)
    const engine = new SyncEngine(store, await freshLocal())
    await engine.queueUpsert('passages', row('a', 'v1'))
    await engine.flush()

    store.offline = true
    await engine.queueUpsert('passages', row('a', 'v2', 1))
    await engine.queueUpsert('passages', row('a', 'v3', 2)) // caller's guess is ignored
    store.offline = false
    await engine.flush()

    const [saved] = await mem.listRows('passages')
    expect(saved.ciphertext).toBe('v3')
    expect(saved.version).toBe(2)
    engine.dispose()
  })

  it('on conflict, keeps the other version via the hook and saves ours on top', async () => {
    const mem = new MemoryStore()
    await mem.upsertRow('passages', row('a', 'original'))
    await mem.upsertRow('passages', row('a', 'from laptop', 1)) // now version 2

    const onConflict = vi.fn(async () => {})
    const engine = new SyncEngine(mem, await freshLocal(), { onConflict })
    await engine.queueUpsert('passages', row('a', 'from phone', 1))
    await engine.flush()

    expect(onConflict).toHaveBeenCalledOnce()
    expect((onConflict.mock.calls[0] as unknown[])[2]).toMatchObject({ ciphertext: 'from laptop', version: 2 })
    const [saved] = await mem.listRows('passages')
    expect(saved).toMatchObject({ ciphertext: 'from phone', version: 3 })
    engine.dispose()
  })

  it('drops a delete of a row that never reached the server', async () => {
    const mem = new MemoryStore()
    const store = flaky(mem)
    store.offline = true
    const engine = new SyncEngine(store, await freshLocal())
    await engine.queueUpsert('notes', row('n', 'ct'))
    await engine.queueDelete('notes', 'n', '2026-10-26')
    expect(await engine.pending()).toHaveLength(0)
    engine.dispose()
  })

  it('reports pending count and availability', async () => {
    const mem = new MemoryStore()
    const store = flaky(mem)
    const statuses: { pending: number; unavailable: boolean }[] = []
    const engine = new SyncEngine(store, await freshLocal(), { onStatus: (s) => statuses.push(s) })
    store.offline = true
    await engine.queueUpsert('notes', row('n', 'ct'))
    await engine.flush()
    expect(statuses.at(-1)).toEqual({ pending: 1, unavailable: true })
    store.offline = false
    await engine.flush()
    expect(statuses.at(-1)).toEqual({ pending: 0, unavailable: false })
    engine.dispose()
  })
})
