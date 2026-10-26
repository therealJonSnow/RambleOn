import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoMode, supabase } from '../lib/backend'
import { MemoryStore } from '../lib/store/memory'
import { SupabaseStore } from '../lib/store/supabase'
import type { JournalStore } from '../lib/store/types'
import { SignInPage } from '../pages/SignInPage'
import { Loading } from '../components/Loading'

interface Backend {
  store: JournalStore
  userId: string
  email: string | null
  demo: boolean
  signOut(): Promise<void>
}

const BackendContext = createContext<Backend | null>(null)

export function useBackend(): Backend {
  const b = useContext(BackendContext)
  if (!b) throw new Error('useBackend outside BackendGate')
  return b
}

// Resolves who is signed in and which store to use. Shows sign-in if needed.
export function BackendGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(demoMode ? null : undefined)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const email = session?.user.email ?? null
  const backend = useMemo<Backend | null>(() => {
    if (demoMode) {
      return {
        store: new MemoryStore('rambleon-demo'),
        userId: 'demo',
        email: null,
        demo: true,
        signOut: async () => {},
      }
    }
    if (!supabase || !userId) return null
    return {
      store: new SupabaseStore(supabase, userId),
      userId,
      email,
      demo: false,
      signOut: async () => {
        await supabase!.auth.signOut()
      },
    }
  }, [userId, email])

  if (session === undefined) return <Loading />
  if (!backend) return <SignInPage />
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>
}
