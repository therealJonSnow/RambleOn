import { describe, expect, it } from 'vitest'
import { DEFAULT_FILLERS, removeFillers } from './filler'

describe('removeFillers: punctuation rules', () => {
  it.each([
    ['I went out. Um. Then I came home.', 'I went out. Then I came home.'],
    ['Um, I think it was fine.', 'I think it was fine.'],
    ['It was, um, fine.', 'It was fine.'],
    ['I I think', 'I think'],
    ['I think so um.', 'I think so.'],
    ['Um.', ''],
    ['It was um fine.', 'It was fine.'],
    ['It was fine um', 'It was fine'],
    ['Um? Right.', 'Right.'],
    ['UM, I THINK', 'I THINK'],
    ['Erm, the the cat sat.', 'The cat sat.'],
    ['I went home um, and then slept.', 'I went home and then slept.'],
  ])('%j -> %j', (input, expected) => {
    expect(removeFillers(input)).toBe(expected)
  })
})

describe('removeFillers: leaves real words alone', () => {
  it.each([
    'We snapped it with like eight of us pulling on a branch.',
    'Yeah, I need to get more involved in the design process.',
    'It was very very good.',
    'She had had enough.',
    'I knew that that was wrong.',
    'The umbrella was under the bridge.',
    'Uhura and Erma went out.',
  ])('%j is unchanged', (input) => {
    expect(removeFillers(input)).toBe(input)
  })
})

describe('removeFillers: settings', () => {
  it('ignores disabled fillers', () => {
    expect(removeFillers('It was, you know, fine.')).toBe('It was, you know, fine.')
  })

  it('removes enabled multi-word phrases', () => {
    const fillers = DEFAULT_FILLERS.map((f) => (f.text === 'you know' ? { ...f, enabled: true } : f))
    expect(removeFillers('It was, you know, fine.', fillers)).toBe('It was fine.')
  })

  it('supports custom fillers, e.g. regional ones', () => {
    expect(removeFillers('Ehm, it was good.', [{ text: 'ehm', enabled: true }])).toBe('It was good.')
  })
})

// Fixtures modelled on real raw iOS dictations, anonymised (names and places
// changed). Mistranscriptions are deliberately left in: rules don't fix those.
describe('removeFillers: dictation fixtures', () => {
  it('weekend entry', () => {
    const raw =
      'Got the bus home and there was a tree fallen and we had to cut it down. Well we snapped it with like eight of us pulling on a branch. Um so that was cool. Got home, got way too tired eating pizza for dinner.'
    expect(removeFillers(raw)).toBe(
      'Got the bus home and there was a tree fallen and we had to cut it down. Well we snapped it with like eight of us pulling on a branch. So that was cool. Got home, got way too tired eating pizza for dinner.',
    )
  })

  it('sunday entry with fillers at sentence start and mid-sentence', () => {
    const raw =
      'Went on a walk with Sam, had a roast and felt sleepy for the rest of the day. Uh managed to finish the book though.\n\nIt is a very good book. Very relevant to the modern day about us versus then uh finish the night starting the next one in the series.'
    expect(removeFillers(raw)).toBe(
      'Went on a walk with Sam, had a roast and felt sleepy for the rest of the day. Managed to finish the book though.\n\nIt is a very good book. Very relevant to the modern day about us versus then finish the night starting the next one in the series.',
    )
  })

  it('work entry has nothing to remove', () => {
    const raw =
      'Today started work. Looks like a bit of a quiet week working on the wiframes and some other bits. Yeah, I need to get more involved in the design process I think.\n\nI think that would be an interesting move for me. We will check back in later.'
    expect(removeFillers(raw)).toBe(raw)
  })
})
