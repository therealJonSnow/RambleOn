import { useState, type FormEvent } from 'react'
import { ErrorText, Field, Screen } from '../components/Screen'
import type { Vault } from '../lib/crypto'

interface Props {
  create(passphrase: string): Promise<{ vault: Vault; recoveryKey: string; key: CryptoKey }>
  save(vault: Vault, key: CryptoKey): Promise<void>
}

// First run: choose a passphrase, then print the recovery key. The vault is
// only saved once the recovery key has been seen.
export function SetupPage({ create, save }: Props) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [created, setCreated] = useState<Awaited<ReturnType<Props['create']>> | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [createdOn] = useState(() => new Date().toLocaleDateString('en-GB'))
  const [error, setError] = useState('')

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (passphrase.length < 10) return setError('Use at least 10 characters. A few words works well.')
    if (passphrase !== confirm) return setError('The passphrases don’t match.')
    setError('')
    setBusy(true)
    try {
      setCreated(await create(passphrase))
    } finally {
      setBusy(false)
    }
  }

  async function onFinish() {
    if (!created) return
    setBusy(true)
    try {
      await save(created.vault, created.key)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (created) {
    return (
      <Screen title="Your recovery key">
        <p className="mb-4 no-print">
          If you forget your passphrase, this key is the <strong>only</strong> way back into your journal. Print
          it and keep it with your typed pages.
        </p>
        <div className="mb-6 rounded-sm border-2 border-dashed border-ink p-4">
          <p className="label mb-2">RambleOn recovery key</p>
          <p className="font-bold break-words select-all">
            {created.recoveryKey}
          </p>
          <p className="mt-2 text-ink-soft">Created {createdOn}</p>
        </div>
        <div className="no-print">
          <button className="btn mb-6 w-full" onClick={() => window.print()}>
            Print recovery key
          </button>
          <label className="mb-6 flex items-start gap-3">
            <input type="checkbox" className="mt-1.5 size-5 accent-ribbon" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            <span>I’ve printed or saved my recovery key somewhere safe.</span>
          </label>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary w-full" disabled={!saved || busy} onClick={onFinish}>
            {busy ? 'Saving…' : 'Open my journal'}
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="Lock your journal">
      <form onSubmit={onCreate}>
        <p className="mb-6">
          Everything you write is encrypted on this device before it’s uploaded, so nobody else can read it, not
          even your database host. Choose a passphrase to lock it with.
        </p>
        <Field
          label="Passphrase"
          type="password"
          autoComplete="new-password"
          required
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          hint="You’ll enter this once on each device."
        />
        <Field
          label="Type it again"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating keys…' : 'Continue'}
        </button>
      </form>
    </Screen>
  )
}
