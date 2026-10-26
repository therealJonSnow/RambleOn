import type { Block, ImageBlock, Passage, TextBlock } from './models'

// A passage with photos is a list of blocks, always in the shape
//   text, (image, text)*
// so there is a text block before, between and after every photo to type in.
// Passages without photos keep plain `text` and no blocks.

export function blocksOf(p: Pick<Passage, 'text' | 'blocks'>): Block[] {
  return p.blocks?.length ? p.blocks : [{ type: 'text', text: p.text }]
}

export function textOf(blocks: Block[]): string {
  return blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function imagesOf(p: Pick<Passage, 'text' | 'blocks'>): ImageBlock[] {
  return blocksOf(p).filter((b): b is ImageBlock => b.type === 'image')
}

const joinText = (a: string, b: string) => [a.trimEnd(), b.trimStart()].filter(Boolean).join('\n\n')

export function normalise(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const last = out[out.length - 1]
    if (b.type === 'text') {
      if (last?.type === 'text') out[out.length - 1] = { type: 'text', text: joinText(last.text, b.text) }
      else out.push({ ...b })
    } else {
      if (!last || last.type === 'image') out.push({ type: 'text', text: '' })
      out.push(b)
    }
  }
  if (out.length === 0 || out[out.length - 1].type === 'image') out.push({ type: 'text', text: '' })
  return out
}

// Applies new blocks to a passage, dropping back to plain text when the last
// photo is removed.
export function withBlocks<P extends Pick<Passage, 'text' | 'blocks'>>(p: P, blocks: Block[]): P {
  const norm = normalise(blocks)
  const hasImages = norm.some((b) => b.type === 'image')
  return { ...p, text: textOf(norm), blocks: hasImages ? norm : undefined }
}

export interface Caret {
  block: number
  offset: number
}

// Inserts photos after the paragraph the caret is in (never mid-sentence),
// or at the end of the passage when there's no caret.
export function insertImages(blocks: Block[], caret: Caret | null, images: ImageBlock[]): Block[] {
  const b = normalise(blocks)
  let i = caret?.block ?? b.length - 1
  if (b[i]?.type !== 'text') i = b.length - 1
  const text = (b[i] as TextBlock).text
  const offset = caret && caret.block === i ? Math.min(caret.offset, text.length) : text.length
  let end = text.indexOf('\n', offset)
  if (end === -1) end = text.length
  const before: TextBlock = { type: 'text', text: text.slice(0, end).trimEnd() }
  const after: TextBlock = { type: 'text', text: text.slice(end).trimStart() }
  const photos = images.flatMap((img, k) => (k === 0 ? [img] : [{ type: 'text', text: '' } as TextBlock, img]))
  return normalise([...b.slice(0, i), before, ...photos, after, ...b.slice(i + 1)])
}

export function removeImage(blocks: Block[], id: string): Block[] {
  return normalise(blocks.filter((b) => !(b.type === 'image' && b.id === id)))
}

export function setTextBlock(blocks: Block[], index: number, text: string): Block[] {
  return blocks.map((b, i) => (i === index && b.type === 'text' ? { ...b, text } : b))
}

export function setCaption(blocks: Block[], id: string, caption: string): Block[] {
  return blocks.map((b) => (b.type === 'image' && b.id === id ? { ...b, caption } : b))
}
