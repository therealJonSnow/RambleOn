import { linkify } from '../lib/links'

// Read-only text with tappable web links.
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((s, i) =>
        s.href ? (
          <a key={i} href={s.href} target="_blank" rel="noreferrer" className="text-ribbon underline decoration-dotted underline-offset-4 break-words">
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}
