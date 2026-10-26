import { describe, expect, it } from 'vitest'
import { blocksOf, insertImages, normalise, removeImage, textOf, withBlocks } from './blocks'
import type { Block, ImageBlock } from './models'

const img = (id: string): ImageBlock => ({ type: 'image', id, caption: '', width: 4, height: 3 })
const t = (text: string): Block => ({ type: 'text', text })

describe('insertImages', () => {
  const blocks = [t('First paragraph here.\nSecond paragraph, still going.')]

  it('goes after the paragraph the caret is in, never mid-sentence', () => {
    const out = insertImages(blocks, { block: 0, offset: 5 }, [img('a')])
    expect(out).toEqual([t('First paragraph here.'), img('a'), t('Second paragraph, still going.')])
  })

  it('goes at the end without a caret', () => {
    const out = insertImages(blocks, null, [img('a')])
    expect(out).toEqual([t('First paragraph here.\nSecond paragraph, still going.'), img('a'), t('')])
  })

  it('keeps a text block between several photos', () => {
    const out = insertImages([t('Hi.')], null, [img('a'), img('b')])
    expect(out).toEqual([t('Hi.'), img('a'), t(''), img('b'), t('')])
  })

  it('works on a later text block', () => {
    const start = [t('One.'), img('a'), t('Two.\nThree.')]
    const out = insertImages(start, { block: 2, offset: 1 }, [img('b')])
    expect(out).toEqual([t('One.'), img('a'), t('Two.'), img('b'), t('Three.')])
  })
})

describe('normalise and removeImage', () => {
  it('always alternates text and photos, starting and ending with text', () => {
    expect(normalise([img('a'), img('b')])).toEqual([t(''), img('a'), t(''), img('b'), t('')])
  })

  it('merges the text around a removed photo', () => {
    const out = removeImage([t('Before.'), img('a'), t('After.')], 'a')
    expect(out).toEqual([t('Before.\n\nAfter.')])
  })
})

describe('withBlocks', () => {
  it('keeps text in sync for search and export, and drops blocks without photos', () => {
    const p = { text: 'x', blocks: undefined as Block[] | undefined }
    const withPhoto = withBlocks(p, [t('A.'), img('a'), t('B.')])
    expect(withPhoto.text).toBe('A.\n\nB.')
    expect(withPhoto.blocks).toHaveLength(3)
    const without = withBlocks(withPhoto, removeImage(blocksOf(withPhoto), 'a'))
    expect(without).toEqual({ text: 'A.\n\nB.', blocks: undefined })
    expect(textOf(blocksOf(without))).toBe('A.\n\nB.')
  })
})
