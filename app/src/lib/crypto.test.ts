import { describe, expect, it } from 'vitest'
import {
  createVault,
  decodeRecoveryKey,
  decryptJson,
  encodeRecoveryKey,
  encryptJson,
  resetPassphrase,
  unlockWithPassphrase,
  WrongSecretError,
} from './crypto'

// Low iteration count keeps tests fast; the app uses PBKDF2_ITERATIONS.
const FAST = 1000

describe('recovery key encoding', () => {
  it('round-trips 32 bytes and is grouped in fours', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const key = encodeRecoveryKey(bytes)
    expect(key).toMatch(/^([0-9A-Z]{4}-)+[0-9A-Z]{1,4}$/)
    expect(decodeRecoveryKey(key)).toEqual(bytes)
  })

  it('tolerates lowercase, spaces and look-alike letters', () => {
    const bytes = new Uint8Array(32).fill(0)
    const key = encodeRecoveryKey(bytes).replace(/0/g, 'o').replace(/-/g, ' ')
    expect(decodeRecoveryKey(key)).toEqual(bytes)
  })
})

describe('vault', () => {
  it('unlocks with the passphrase and rejects a wrong one', async () => {
    const { vault, key } = await createVault('correct horse battery', FAST)
    const blob = await encryptJson(key, 'passages:1', { text: 'Hello' })

    const again = await unlockWithPassphrase(vault, 'correct horse battery')
    expect(await decryptJson(again, 'passages:1', blob)).toEqual({ text: 'Hello' })

    await expect(unlockWithPassphrase(vault, 'wrong')).rejects.toBeInstanceOf(WrongSecretError)
  })

  it('resets the passphrase with the recovery key, keeping data readable', async () => {
    const { vault, recoveryKey, key } = await createVault('old passphrase', FAST)
    const blob = await encryptJson(key, 'notes:1', { text: 'Remember Sam' })

    const reset = await resetPassphrase(vault, recoveryKey, 'new passphrase')
    expect(await decryptJson(reset.key, 'notes:1', blob)).toEqual({ text: 'Remember Sam' })
    await expect(unlockWithPassphrase(reset.vault, 'old passphrase')).rejects.toBeInstanceOf(WrongSecretError)
    await expect(resetPassphrase(vault, encodeRecoveryKey(new Uint8Array(32)), 'x')).rejects.toBeInstanceOf(
      WrongSecretError,
    )
  })

  it('keeps the device key non-extractable', async () => {
    const { key } = await createVault('passphrase', FAST)
    expect(key.extractable).toBe(false)
  })
})

describe('encryptJson', () => {
  it('fails to decrypt a ciphertext moved to another row', async () => {
    const { key } = await createVault('passphrase', FAST)
    const blob = await encryptJson(key, 'passages:1', { text: 'x' })
    await expect(decryptJson(key, 'passages:2', blob)).rejects.toThrow()
  })
})
