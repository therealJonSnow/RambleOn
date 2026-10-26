import { DEFAULT_ROLLOVER_HOUR } from './dates'
import { DEFAULT_FILLERS, type FillerWord } from './filler'
import type { PassageKind } from './store/types'

export interface TextBlock {
  type: 'text'
  text: string
}

// A photo taped into the page. The encrypted files live in storage at
// `<id>` (full size) and `<id>.thumb`; this block holds only the details.
export interface ImageBlock {
  type: 'image'
  id: string
  caption: string
  width: number
  height: number
  // When the photo was taken (local time from the camera), if known.
  takenAt?: string
}

export type Block = TextBlock | ImageBlock

export interface Passage {
  id: string
  kind: PassageKind
  journalDate: string
  writtenAt: string
  // Optional typed title. The headline shows the time when empty.
  title: string
  // Exactly what was dictated or typed.
  raw: string
  // What the page shows: raw with fillers removed, plus any edits. With
  // photos, this is the text blocks joined (kept for search and export).
  text: string
  // Only present once a photo has been added: text and photos in order.
  blocks?: Block[]
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
  fillers: FillerWord[]
  unlockedDates: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  rolloverHour: DEFAULT_ROLLOVER_HOUR,
  fillers: DEFAULT_FILLERS,
  unlockedDates: [],
}

// The parts of each record that are encrypted.
export type PassagePayload = Pick<Passage, 'title' | 'raw' | 'text' | 'blocks'>
export type NotePayload = Pick<Note, 'text'>
