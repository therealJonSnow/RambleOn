import { describe, expect, it } from 'vitest'
import { readTakenAt } from './exif'

// Builds a minimal JPEG: SOI, APP1/Exif with IFD0 -> Exif IFD -> DateTimeOriginal, SOS.
function jpegWithDate(date: string, little: boolean): Uint8Array {
  const tiff: number[] = []
  const u16 = (n: number) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255])
  const u32 = (n: number) =>
    little ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  const str = [...date].map((c) => c.charCodeAt(0)).concat(0) // 20 bytes
  // Header (8) | IFD0 at 8: 1 entry (2+12+4=18) | Exif IFD at 26: 1 entry (18) | string at 44
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8))
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0))
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(str.length), ...u32(44), ...u32(0))
  tiff.push(...str)
  const app1 = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff)
  const size = app1.length + 2
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, size >> 8, size & 255, ...app1, 0xff, 0xda, 0, 2])
}

describe('readTakenAt', () => {
  it('reads DateTimeOriginal (little-endian, as iPhones write it)', () => {
    expect(readTakenAt(jpegWithDate('2026:10:24 14:05:09', true))).toBe('2026-10-24T14:05:09')
  })

  it('reads big-endian EXIF', () => {
    expect(readTakenAt(jpegWithDate('2025:01:02 03:04:05', false))).toBe('2025-01-02T03:04:05')
  })

  it('returns undefined for non-JPEGs and JPEGs without EXIF', () => {
    expect(readTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeUndefined()
    expect(readTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeUndefined()
    expect(readTakenAt(new Uint8Array([0xff, 0xd8, 0xff]))).toBeUndefined()
  })
})
