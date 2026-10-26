import { useState, type FormEvent } from 'react'
import { ErrorText, Field, Screen } from '../components/Screen'

interface Props {
  unlock(passphrase: string): Promise<void>
  recover(recoveryKey: string, newPassphrase: string): Promise<void>
}

export function UnlockPage({ unlock, recover }: Props) {
  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(e: FormEvent, fn: () => Promise<void>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  if (mode === 'recovery') {
    return (
      <Screen title="Use your recovery key">
        <form
          onSubmit={(e) => {
            if (passphrase.length < 10) {
              e.preventDefault()
              return setError('Use at least 10 characters for the new passphrase.')
            }
            void run(e, () => recover(recoveryKey, passphrase))
          }}
        >
          <Field
            label="Recovery key"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            hint="Dashes and spaces don’t matter."
          />
          <Field
            label="New passphrase"
            type="password"
            autoComplete="new-password"
            required
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <div className="flex items-center justify-between gap-4">
            <button type="button" className="link" onClick={() => setMode('passphrase')}>
              Back
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </form>
      </Screen>
    )
  }

  return (
    <Screen title="Unlock your journal">
      <form onSubmit={(e) => run(e, () => unlock(passphrase))}>
        <Field
          label="Passphrase"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          hint="Needed once on each device."
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-between gap-4">
          <button type="button" className="link" onClick={() => setMode('recovery')}>
            Forgot it?
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </Screen>
  )
}
