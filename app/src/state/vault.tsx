import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Loading } from '../components/Loading'
import { createVault, resetPassphrase, unlockWithPassphrase, type Vault } from '../lib/crypto'
import { openLocalDb, type LocalDb } from '../lib/localdb'
import { useBackend } from './backend'
import { SetupPage } from '../pages/SetupPage'
import { UnlockPage } from '../pages/UnlockPage'
import { UnavailablePage } from '../pages/UnavailablePage'

interface VaultState {
  key: CryptoKey
  local: LocalDb
  lock(): Promise<void>
}

const VaultContext = createContext<VaultState | null>(null)

export function useVault(): VaultState {
  const v = useContext(VaultContext)
  if (!v) throw new Error('useVault outside VaultGate')
  return v
}

type Phase =
  | { name: 'loading' }
  | { name: 'unavailable'; message: string }
  | { name: 'setup' }
  | { name: 'unlock'; vault: Vault }
  | { name: 'ready'; key: CryptoKey }

// Gets the master key: from this device if it was unlocked before, otherwise
// by asking for the passphrase (or setting one up on first run).
export function VaultGate({ children }: { children: ReactNode }) {
  const { store, userId } = useBackend()
  const [local, setLocal] = useState<LocalDb | null>(null)
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })
  const keyName = `masterKey:${userId}`

  const load = useCallback(async () => {
    setPhase({ name: 'loading' })
    const db = await openLocalDb()
    setLocal(db)
    // Stored as a non-extractable CryptoKey: usable here, but its bytes can't be read out.
    const saved = await db.get<CryptoKey>(keyName)
    if (saved) return setPhase({ name: 'ready', key: saved })
    try {
      const vault = await store.getVault()
      setPhase(vault ? { name: 'unlock', vault } : { name: 'setup' })
    } catch (e) {
      setPhase({ name: 'unavailable', message: e instanceof Error ? e.message : String(e) })
    }
  }, [store, keyName])

  useEffect(() => {
    void load()
  }, [load])

  const remember = async (key: CryptoKey) => {
    await local!.set(keyName, key)
    setPhase({ name: 'ready', key })
  }

  const lock = useCallback(async () => {
    await local?.del(keyName)
    await local?.del('draft')
    await load()
  }, [local, keyName, load])

  switch (phase.name) {
    case 'loading':
      return <Loading />
    case 'unavailable':
      return <UnavailablePage message={phase.message} onRetry={load} />
    case 'setup':
      return (
        <SetupPage
          create={(passphrase) => createVault(passphrase)}
          save={async (vault, key) => {
            await store.putVault(vault)
            await remember(key)
          }}
        />
      )
    case 'unlock':
      return (
        <UnlockPage
          unlock={async (passphrase) => remember(await unlockWithPassphrase(phase.vault, passphrase))}
          recover={async (recoveryKey, newPassphrase) => {
            const { vault, key } = await resetPassphrase(phase.vault, recoveryKey, newPassphrase)
            await store.putVault(vault)
            await remember(key)
          }}
        />
      )
    case 'ready':
      return <VaultContext.Provider value={{ key: phase.key, local: local!, lock }}>{children}</VaultContext.Provider>
  }
}
