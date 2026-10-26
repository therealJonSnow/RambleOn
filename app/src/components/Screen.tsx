import type { ReactNode } from 'react'

// A single sheet of paper, centred, for sign-in and unlock screens.
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-12 sm:items-center">
      <div className="sheet w-full max-w-md px-6 py-8 sm:px-10">
        <p className="label mb-1">RambleOn</p>
        <h1 className="mb-6 font-display text-3xl">{title}</h1>
        {children}
      </div>
    </main>
  )
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 block">
      <span className="label mb-1 block">{label}</span>
      <input
        className="w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 outline-none focus:border-ink"
        {...props}
      />
      {hint && <span className="mt-1 block text-sm text-ink-soft">{hint}</span>}
    </label>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="mb-4 text-ribbon">
      {children}
    </p>
  )
}
