// The thumb-zone button that starts a new passage. Without the AI add-on it
// opens the keyboard, and you dictate with the keyboard's mic key.
export function RecordButton({ side, onPress }: { side: 'left' | 'right'; onPress(): void }) {
  return (
    <button
      type="button"
      aria-label="New passage"
      onClick={onPress}
      className={`no-print fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 grid size-16 place-items-center rounded-full bg-ribbon text-ribbon-ink shadow-lg ring-4 ring-paper transition active:scale-95 ${
        side === 'left' ? 'left-5' : 'right-5'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}
