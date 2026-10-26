import { useState, type ComponentProps } from 'react'
import { hasLink, linkify } from '../lib/links'
import { AutoTextarea } from './AutoTextarea'

// A note that is always one tap from editing, with tappable web links.
// The textarea stays in place (so iOS opens the keyboard on the first tap);
// while it isn't focused, a copy of the text with real links is laid over it.
// Only the links take taps; everything else falls through to the textarea.
export function LinkedTextarea({ value, onFocus, onBlur, className = '', ...props }: ComponentProps<typeof AutoTextarea>) {
  const [focused, setFocused] = useState(false)
  const overlay = !focused && hasLink(value)
  return (
    <div className="relative min-w-0 flex-1">
      <AutoTextarea
        {...props}
        value={value}
        className={`break-words ${overlay ? 'text-transparent' : ''} ${className}`}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
      />
      {overlay && (
        <div aria-hidden className="pointer-events-none absolute inset-0 break-words whitespace-pre-wrap">
          {linkify(value).map((s, i) =>
            s.href ? (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                tabIndex={-1}
                className="pointer-events-auto text-ribbon underline decoration-dotted underline-offset-4"
              >
                {s.text}
              </a>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </div>
      )}
    </div>
  )
}
