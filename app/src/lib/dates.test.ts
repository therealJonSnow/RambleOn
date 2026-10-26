import { describe, expect, it } from 'vitest'
import { addDays, isDayEditable, journalDateFor } from './dates'

describe('journalDateFor', () => {
  it('puts a 00:40 passage on the previous day', () => {
    expect(journalDateFor(new Date(2026, 9, 26, 0, 40), 4)).toBe('2026-10-25')
  })

  it('rolls over at the configured hour', () => {
    expect(journalDateFor(new Date(2026, 9, 26, 3, 59), 4)).toBe('2026-10-25')
    expect(journalDateFor(new Date(2026, 9, 26, 4, 0), 4)).toBe('2026-10-26')
  })

  it('uses calendar midnight when rollover is 0', () => {
    expect(journalDateFor(new Date(2026, 9, 26, 0, 40), 0)).toBe('2026-10-26')
  })

  it('crosses month and year boundaries', () => {
    expect(journalDateFor(new Date(2027, 0, 1, 1, 0), 4)).toBe('2026-12-31')
  })
})

describe('addDays', () => {
  it('moves across months', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('isDayEditable', () => {
  it('locks past days unless unlocked', () => {
    expect(isDayEditable('2026-10-26', '2026-10-26', [])).toBe(true)
    expect(isDayEditable('2026-10-25', '2026-10-26', [])).toBe(false)
    expect(isDayEditable('2026-10-25', '2026-10-26', ['2026-10-25'])).toBe(true)
  })
})
