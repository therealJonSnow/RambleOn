import { strToU8, zipSync } from 'fflate'
import { formatLongDate, formatShortDate, formatTime, formatWeekday } from './dates'
import type { Note, Passage, Settings } from './models'

// Export format, version 1. The zip contains:
//   days/YYYY-MM-DD.md – readable pages
//   journal.json       – everything, for restoring (raw text, times, settings)
// Exports are unencrypted on purpose: a backup shouldn't depend on this app.

export const EXPORT_FORMAT = 'rambleon-export'
export const EXPORT_VERSION = 1

export interface ExportData {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  exportedAt: string
  settings: Settings
  passages: Omit<Passage, 'pending'>[]
  notes: Omit<Note, 'pending'>[]
}

const strip = <T extends { pending?: boolean }>({ pending: _pending, ...rest }: T) => rest

export function buildExportData(
  passages: Passage[],
  notes: Note[],
  settings: Settings,
  exportedAt = new Date().toISOString(),
): ExportData {
  const byTime = (a: { writtenAt: string; id: string }, b: { writtenAt: string; id: string }) =>
    a.writtenAt.localeCompare(b.writtenAt) || a.id.localeCompare(b.id)
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt,
    settings,
    passages: passages.map(strip).sort(byTime),
    notes: notes.map(strip).sort(byTime),
  }
}

export function dayMarkdown(date: string, passages: Passage[], margins: Passage[], notes: Note[]): string {
  const lines: string[] = [`# ${formatWeekday(date)}, ${formatLongDate(date)}`, '']
  for (const p of passages) {
    const time = formatTime(p.writtenAt)
    lines.push(p.title ? `## ${time} · ${p.title}` : `## ${time}`, '', p.text.trim(), '')
  }
  for (const m of margins) {
    const quoted = m.text.trim().split('\n').map((l) => `> ${l}`.trimEnd())
    lines.push(`> *Margin note, ${formatShortDate(m.writtenAt)} ${formatTime(m.writtenAt)}:*`, ...quoted, '')
  }
  if (notes.length > 0) {
    lines.push('## Notes', '')
    for (const n of notes) {
      const [first, ...rest] = n.text.trim().split('\n')
      lines.push(`- ${first}`, ...rest.map((l) => `  ${l}`.trimEnd()))
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function buildExportFiles(data: ExportData): Record<string, string> {
  const dates = new Set([...data.passages.map((p) => p.journalDate), ...data.notes.map((n) => n.journalDate)])
  const files: Record<string, string> = {}
  for (const date of [...dates].sort()) {
    const ps = data.passages.filter((p) => p.journalDate === date)
    files[`days/${date}.md`] = dayMarkdown(
      date,
      ps.filter((p) => p.kind === 'passage'),
      ps.filter((p) => p.kind === 'margin'),
      data.notes.filter((n) => n.journalDate === date),
    )
  }
  files['journal.json'] = JSON.stringify(data, null, 2)
  return files
}

export function buildExportZip(data: ExportData): Uint8Array {
  const files = buildExportFiles(data)
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])))
}

export function exportFileName(exportedAt: string): string {
  return `rambleon-export-${exportedAt.slice(0, 10)}.zip`
}

export class InvalidExportError extends Error {}

const isStr = (v: unknown): v is string => typeof v === 'string'

// Parses and checks journal.json before anything is restored.
export function parseExport(json: string): ExportData {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new InvalidExportError('This file is not valid JSON')
  }
  const d = data as Partial<ExportData>
  if (d?.format !== EXPORT_FORMAT) throw new InvalidExportError('This is not a RambleOn journal.json')
  if (d.version !== EXPORT_VERSION) throw new InvalidExportError(`Unsupported export version ${String(d.version)}`)
  if (!Array.isArray(d.passages) || !Array.isArray(d.notes)) throw new InvalidExportError('The export is incomplete')
  const date = /^\d{4}-\d{2}-\d{2}$/
  for (const p of d.passages) {
    if (
      !isStr(p.id) || !date.test(p.journalDate) || !isStr(p.writtenAt) ||
      !isStr(p.raw) || !isStr(p.text) || !isStr(p.title) || !['passage', 'margin'].includes(p.kind)
    ) {
      throw new InvalidExportError('A passage in the export is malformed')
    }
  }
  for (const n of d.notes) {
    if (!isStr(n.id) || !date.test(n.journalDate) || !isStr(n.writtenAt) || !isStr(n.text)) {
      throw new InvalidExportError('A note in the export is malformed')
    }
  }
  return d as ExportData
}
