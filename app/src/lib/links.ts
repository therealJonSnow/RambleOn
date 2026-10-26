// Finds web addresses in plain text so they can be shown as tappable links.

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']*[^\s<>"'.,;:!?)\]]/gi

export type Segment = { text: string; href?: string }

export function linkify(text: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    const url = m[0]
    out.push({ text: url, href: url.toLowerCase().startsWith('www.') ? `https://${url}` : url })
    last = m.index + url.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export const hasLink = (text: string) => linkify(text).some((s) => s.href)
