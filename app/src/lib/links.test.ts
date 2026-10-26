import { describe, expect, it } from 'vitest'
import { linkify } from './links'

describe('linkify', () => {
  it('finds links and leaves trailing punctuation outside them', () => {
    expect(linkify('Podcast: https://open.spotify.com/episode/4xK?si=a1. Sam said.')).toEqual([
      { text: 'Podcast: ' },
      { text: 'https://open.spotify.com/episode/4xK?si=a1', href: 'https://open.spotify.com/episode/4xK?si=a1' },
      { text: '. Sam said.' },
    ])
  })

  it('handles www. addresses and links in brackets', () => {
    expect(linkify('(see www.example.com)')).toEqual([
      { text: '(see ' },
      { text: 'www.example.com', href: 'https://www.example.com' },
      { text: ')' },
    ])
  })

  it('returns plain text unchanged', () => {
    expect(linkify('Met Alex in the park')).toEqual([{ text: 'Met Alex in the park' }])
    expect(linkify('')).toEqual([])
  })
})
