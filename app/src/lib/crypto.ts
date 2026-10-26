// End-to-end encryption with WebCrypto.
//
// A random AES-GCM master key encrypts everything. It is stored twice in the
// vault, wrapped (encrypted) by:
//   1. a key derived from the passphrase (PBKDF2-SHA256), and
//   2. the recovery key (32 random bytes, shown once for printing).
// The server only ever sees wrapped keys and ciphertext.

export const PBKDF2_ITERATIONS = 600_000
const IV_BYTES = 12

export interface Vault {
  salt: string
  iterations: number
  wrappedByPassphrase: string
  wrappedByRecovery: string
}

const subtle = () => globalThis.crypto.subtle
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n))
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

// --- Recovery key: Crockford base32, grouped in fours for reading aloud/printing.

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function encodeRecoveryKey(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out.match(/.{1,4}/g)!.join('-')
}

export function decodeRecoveryKey(key: string): Uint8Array<ArrayBuffer> {
  const clean = key
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) throw new Error('Recovery key contains an invalid character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  if (out.length !== 32) throw new Error('Recovery key is the wrong length')
  return new Uint8Array(out)
}

// --- Keys

async function passphraseKek(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await subtle().importKey('raw', encoder.encode(passphrase.normalize('NFC')), 'PBKDF2', false, [
    'deriveKey',
  ])
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

function recoveryKek(recoveryBytes: Uint8Array<ArrayBuffer>) {
  return subtle().importKey('raw', recoveryBytes, { name: 'AES-GCM' }, false, ['wrapKey', 'unwrapKey'])
}

async function wrap(master: CryptoKey, kek: CryptoKey): Promise<string> {
  const iv = randomBytes(IV_BYTES)
  const wrapped = await subtle().wrapKey('raw', master, kek, { name: 'AES-GCM', iv })
  return toBase64(concat(iv, new Uint8Array(wrapped)))
}

async function unwrap(blob: string, kek: CryptoKey, extractable: boolean): Promise<CryptoKey> {
  const bytes = fromBase64(blob)
  return subtle().unwrapKey(
    'raw',
    bytes.slice(IV_BYTES),
    kek,
    { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
    { name: 'AES-GCM' },
    extractable,
    ['encrypt', 'decrypt'],
  )
}

export class WrongSecretError extends Error {
  constructor() {
    super('That passphrase or recovery key is not right')
  }
}

// Creates a new vault. Returns the vault to store, the recovery key to show
// once, and a non-extractable master key for this device.
export async function createVault(
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<{ vault: Vault; recoveryKey: string; key: CryptoKey }> {
  const master = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const salt = randomBytes(16)
  const recoveryBytes = randomBytes(32)
  const vault: Vault = {
    salt: toBase64(salt),
    iterations,
    wrappedByPassphrase: await wrap(master, await passphraseKek(passphrase, salt, iterations)),
    wrappedByRecovery: await wrap(master, await recoveryKek(recoveryBytes)),
  }
  const key = await unlockWithPassphrase(vault, passphrase)
  return { vault, recoveryKey: encodeRecoveryKey(recoveryBytes), key }
}

export async function unlockWithPassphrase(vault: Vault, passphrase: string): Promise<CryptoKey> {
  const kek = await passphraseKek(passphrase, fromBase64(vault.salt), vault.iterations)
  try {
    return await unwrap(vault.wrappedByPassphrase, kek, false)
  } catch {
    throw new WrongSecretError()
  }
}

// Recovery: unlock with the recovery key and set a new passphrase.
export async function resetPassphrase(
  vault: Vault,
  recoveryKey: string,
  newPassphrase: string,
): Promise<{ vault: Vault; key: CryptoKey }> {
  let master: CryptoKey
  try {
    master = await unwrap(vault.wrappedByRecovery, await recoveryKek(decodeRecoveryKey(recoveryKey)), true)
  } catch {
    throw new WrongSecretError()
  }
  const salt = randomBytes(16)
  const next: Vault = {
    ...vault,
    salt: toBase64(salt),
    wrappedByPassphrase: await wrap(master, await passphraseKek(newPassphrase, salt, vault.iterations)),
  }
  return { vault: next, key: await unlockWithPassphrase(next, newPassphrase) }
}

// --- Data
// `context` is bound in as additional data (e.g. "passages:<id>"), so a
// ciphertext copied onto another row fails to decrypt.

export async function encryptJson(key: CryptoKey, context: string, value: unknown): Promise<string> {
  const iv = randomBytes(IV_BYTES)
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(JSON.stringify(value)),
  )
  return toBase64(concat(iv, new Uint8Array(ct)))
}

export async function decryptJson<T>(key: CryptoKey, context: string, blob: string): Promise<T> {
  const bytes = fromBase64(blob)
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES), additionalData: encoder.encode(context) },
    key,
    bytes.slice(IV_BYTES),
  )
  return JSON.parse(decoder.decode(pt)) as T
}

// Binary data (photos). Same scheme as encryptJson, without the JSON step.
export async function encryptBytes(key: CryptoKey, context: string, bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = randomBytes(IV_BYTES)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, key, bytes)
  return concat(iv, new Uint8Array(ct))
}

export async function decryptBytes(key: CryptoKey, context: string, blob: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: blob.slice(0, IV_BYTES), additionalData: encoder.encode(context) },
    key,
    blob.slice(IV_BYTES),
  )
  return new Uint8Array(pt)
}
