import { readTakenAt } from './exif'

// Prepares a picked photo on the device: reads the date taken, then
// re-encodes it smaller. Re-encoding drops all metadata, GPS included.
// JPEG rather than WebP because Safari can't encode WebP from a canvas.

export const FULL_SIZE = 1600
export const THUMB_SIZE = 640

export interface PreparedImage {
  full: Uint8Array<ArrayBuffer>
  thumb: Uint8Array<ArrayBuffer>
  width: number
  height: number
  takenAt?: string
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const original = new Uint8Array(await file.arrayBuffer())
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const full = await encode(bitmap, FULL_SIZE, 0.82)
    const thumb = await encode(bitmap, THUMB_SIZE, 0.75)
    return { full: full.bytes, thumb: thumb.bytes, width: full.width, height: full.height, takenAt: readTakenAt(original) }
  } finally {
    bitmap.close()
  }
}

// Used when restoring an export: the zip holds full-size photos only.
export async function makeThumb(full: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const bitmap = await createImageBitmap(new Blob([full], { type: 'image/jpeg' }))
  try {
    return (await encode(bitmap, THUMB_SIZE, 0.75)).bytes
  } finally {
    bitmap.close()
  }
}

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  )
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height }
}
