// Rule-based filler-word removal for dictated text.
//
// Works on tokens (words, spaces, punctuation) rather than find-and-replace,
// so the punctuation around a filler is handled properly:
//   "I went out. Um. Then I came home." -> "I went out. Then I came home."
//   "Um, I think it was fine."          -> "I think it was fine."
//   "It was, um, fine."                 -> "It was fine."
//   "I I think"                         -> "I think"

export interface FillerWord {
  text: string
  enabled: boolean
}

export const DEFAULT_FILLERS: FillerWord[] = [
  { text: 'um', enabled: true },
  { text: 'umm', enabled: true },
  { text: 'uh', enabled: true },
  { text: 'uhh', enabled: true },
  { text: 'er', enabled: true },
  { text: 'erm', enabled: true },
  { text: 'hmm', enabled: true },
  { text: 'you know', enabled: false },
  { text: 'I mean', enabled: false },
]

// Doubled words that are almost never intentional. Words people double on
// purpose ("very very", "no no", "had had", "that that") are left alone.
const STUTTER_WORDS = new Set([
  'i', 'the', 'a', 'an', 'and', 'to', 'of', 'it', 'we', 'my', 'in', 'but',
  'was', 'he', 'she', 'they', 'you', 'on', 'at', 'for', 'with',
])

type Token = { t: 'word' | 'space' | 'punct'; v: string }

const TERMINATOR = /^[.!?…]$/

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const m of text.matchAll(/[\p{L}\p{N}'’]+|\s+|[^\s\p{L}\p{N}'’]/gu)) {
    const v = m[0]
    const t = /^\s/.test(v) ? 'space' : /^[\p{L}\p{N}'’]/u.test(v) ? 'word' : 'punct'
    tokens.push({ t, v })
  }
  return tokens
}

const isInlineSpace = (tok: Token | undefined) => tok?.t === 'space' && !tok.v.includes('\n')
const isBreak = (tok: Token | undefined) => tok?.t === 'space' && tok.v.includes('\n')

// Index just past the filler phrase if it starts at i, otherwise -1.
// Words in a phrase may be separated by single inline spaces only.
function matchPhrase(tokens: Token[], i: number, phrase: string[]): number {
  let j = i
  for (let w = 0; w < phrase.length; w++) {
    if (w > 0) {
      if (!isInlineSpace(tokens[j])) return -1
      j++
    }
    const tok = tokens[j]
    if (tok?.t !== 'word' || tok.v.toLowerCase() !== phrase[w]) return -1
    j++
  }
  return j
}

function lastIndex(out: Token[], pred: (t: Token) => boolean): number {
  for (let k = out.length - 1; k >= 0; k--) if (pred(out[k])) return k
  return -1
}

function trimTrailingInlineSpace(out: Token[]) {
  while (isInlineSpace(out[out.length - 1])) out.pop()
}

function skipInlineSpace(tokens: Token[], j: number): number {
  while (isInlineSpace(tokens[j])) j++
  return j
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function removeFillers(text: string, fillers: FillerWord[] = DEFAULT_FILLERS): string {
  const phrases = fillers
    .filter((f) => f.enabled)
    .map((f) => f.text.toLowerCase().trim().split(/\s+/).filter(Boolean))
    .filter((p) => p.length > 0)
    .sort((a, b) => b.length - a.length)

  const tokens = tokenize(text)
  const out: Token[] = []
  let capitaliseNext = false
  let i = 0

  while (i < tokens.length) {
    const tok = tokens[i]

    if (tok.t === 'word') {
      let end = -1
      for (const p of phrases) {
        end = matchPhrase(tokens, i, p)
        if (end !== -1) break
      }

      if (end !== -1) {
        const prevIdx = lastIndex(out, (t) => !isInlineSpace(t))
        const prev = out[prevIdx]
        const atSentenceStart =
          prevIdx === -1 || isBreak(prev) || (prev.t === 'punct' && TERMINATOR.test(prev.v))
        const k = skipInlineSpace(tokens, end)
        const next = tokens[k]

        if (next?.t === 'punct' && next.v === ',') {
          // "um," – drop the filler and its comma.
          let j = k + 1
          if (prev?.t === 'punct' && prev.v === ',') {
            // ", um," – drop both commas: "It was, um, fine." -> "It was fine."
            out.length = prevIdx
          }
          if (atSentenceStart) {
            j = skipInlineSpace(tokens, j)
            capitaliseNext = true
          } else if (isInlineSpace(out[out.length - 1])) {
            j = skipInlineSpace(tokens, j)
          }
          i = j
          continue
        }

        if (next?.t === 'punct' && TERMINATOR.test(next.v)) {
          if (atSentenceStart) {
            // A sentence that is only a filler ("Um.") goes entirely,
            // with its full stop and the space after it.
            let j = k
            while (tokens[j]?.t === 'punct' && TERMINATOR.test(tokens[j].v)) j++
            i = skipInlineSpace(tokens, j)
            if (i >= tokens.length || isBreak(tokens[i])) trimTrailingInlineSpace(out)
          } else {
            // "I think so um." -> "I think so."
            trimTrailingInlineSpace(out)
            i = k
          }
          continue
        }

        // Followed by a word, a line break or the end of the text.
        if (atSentenceStart) {
          capitaliseNext = true
          i = k
        } else if (next === undefined || isBreak(next)) {
          trimTrailingInlineSpace(out)
          i = k
        } else {
          i = k
        }
        continue
      }

      // Stutters: "I I think" -> "I think" (keeps the first, so its case survives).
      const prevWordIdx = out.length - 2
      if (
        isInlineSpace(out[out.length - 1]) &&
        out[out.length - 1].v === ' ' &&
        out[prevWordIdx]?.t === 'word' &&
        out[prevWordIdx].v.toLowerCase() === tok.v.toLowerCase() &&
        STUTTER_WORDS.has(tok.v.toLowerCase())
      ) {
        out.pop()
        i++
        continue
      }

      if (capitaliseNext) {
        out.push({ t: 'word', v: capitalise(tok.v) })
        capitaliseNext = false
        i++
        continue
      }
    }

    if (tok.t === 'space' && isBreak(tok)) capitaliseNext = false
    out.push(tok)
    i++
  }

  return out.map((t) => t.v).join('')
}
