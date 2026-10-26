import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Without Supabase settings the app runs in demo mode: no sign-in, and the
// (still encrypted) journal is kept in this browser's localStorage.
export const demoMode = !url || !key

export const supabase: SupabaseClient | null = demoMode
  ? null
  : createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
