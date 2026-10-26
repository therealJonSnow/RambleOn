import { useState, type FormEvent } from 'react'
import { ErrorText, Field, Screen } from '../components/Screen'
import { supabase } from '../lib/backend'

// Email one-time code. Magic links don't suit installed iOS PWAs: the link
// opens in Safari, whose storage is separate from the home-screen app.
export function SignInPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(error.message)
  }

  if (step === 'code') {
    return (
      <Screen title="Check your email">
        <form onSubmit={verify}>
          <p className="mb-6">
            We sent a code to <strong>{email}</strong>. Type it in here.
          </p>
          <Field
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <div className="flex items-center justify-between gap-4">
            <button type="button" className="link" onClick={() => setStep('email')}>
              Use a different email
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </div>
        </form>
      </Screen>
    )
  }

  return (
    <Screen title="Sign in">
      <form onSubmit={sendCode}>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </div>
      </form>
    </Screen>
  )
}
