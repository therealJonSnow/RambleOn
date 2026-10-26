import { DEFAULT_ROLLOVER_HOUR } from './dates'
import { DEFAULT_FILLERS, type FillerWord } from './filler'
import type { PassageKind } from './store/types'

export interface Passage {
  id: string
  kind: PassageKind
  journalDate: string
  writtenAt: string
  // Optional typed title. The headline shows the time when empty.
  title: string
  // Exactly what was dictated or typed.
  raw: string
  // What the page shows: raw with fillers removed, plus any edits.
  text: string
  pending?: boolean
}

export interface Note {
  id: string
  journalDate: string
  writtenAt: string
  text: string
  pending?: boolean
}

export interface Settings {
  rolloverHour: number
  buttonSide: 'right' | 'left'
  fillers: FillerWord[]
  unlockedDates: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  rolloverHour: DEFAULT_ROLLOVER_HOUR,
  buttonSide: 'right',
  fillers: DEFAULT_FILLERS,
  unlockedDates: [],
}

// The parts of each record that are encrypted.
export type PassagePayload = Pick<Passage, 'title' | 'raw' | 'text'>
export type NotePayload = Pick<Note, 'text'>
