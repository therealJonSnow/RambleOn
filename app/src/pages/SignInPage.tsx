import { useState, type FormEvent } from 'react'
import { ErrorText, Field, Screen } from '../components/Screen'
import { supabase } from '../lib/backend'

// Email + password. It needs no email sending, so it works on Supabase's free
// tier without custom SMTP, and iCloud Keychain fills it in with Face ID
// inside the installed app.
export function SignInPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    const credentials = { email: email.trim(), password }
    if (mode === 'signin') {
      const { error } = await supabase!.auth.signInWithPassword(credentials)
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase!.auth.signUp(credentials)
      if (error) {
        setError(/signups? not allowed|disabled/i.test(error.message) ? 'Sign-ups are turned off for this journal.' : error.message)
      } else if (!data.session) {
        // "Confirm email" is still on in Supabase.
        setInfo('Account created. Confirm it from the email Supabase sent, then sign in.')
        setMode('signin')
      }
    }
    setBusy(false)
  }

  const signup = mode === 'signup'

  return (
    <Screen title={signup ? 'Create your account' : 'Sign in'}>
      <form onSubmit={submit}>
        {signup && (
          <p className="mb-6 text-sm text-ink-soft">
            This is your sign-in. Next you’ll choose a separate passphrase that encrypts your journal.
          </p>
        )}
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          required
          minLength={signup ? 10 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={signup ? 'At least 10 characters. Let your password manager create one.' : undefined}
        />
        <ErrorText>{error}</ErrorText>
        {info && (
          <p role="status" className="mb-4">
            {info}
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(signup ? 'signin' : 'signup')
              setError('')
              setInfo('')
            }}
          >
            {signup ? 'Sign in instead' : 'Create account'}
          </button>
          <button className="btn-primary whitespace-nowrap" disabled={busy}>
            {busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </form>
    </Screen>
  )
}
