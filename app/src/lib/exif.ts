// Reads when a JPEG photo was taken (EXIF DateTimeOriginal), so the date can
// be kept after the photo is re-encoded, which strips all metadata,
// including GPS location.
// Returns local camera time as "YYYY-MM-DDTHH:MM:SS", or undefined.

const DATE_TIME_ORIGINAL = 0x9003
const DATE_TIME = 0x0132
const EXIF_IFD_POINTER = 0x8769

export function readTakenAt(bytes: Uint8Array): string | undefined {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (view.getUint16(0) !== 0xffd8) return undefined // not a JPEG
    let pos = 2
    while (pos + 4 <= view.byteLength) {
      const marker = view.getUint16(pos)
      const size = view.getUint16(pos + 2)
      if (marker === 0xffe1 && ascii(bytes, pos + 4, 6) === 'Exif\0\0') {
        return readTiff(view, pos + 10)
      }
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return undefined // image data starts
      pos += 2 + size
    }
  } catch {
    // Malformed metadata: just no date.
  }
  return undefined
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

function readTiff(view: DataView, tiff: number): string | undefined {
  const little = view.getUint16(tiff) === 0x4949 // "II"
  const u16 = (o: number) => view.getUint16(tiff + o, little)
  const u32 = (o: number) => view.getUint32(tiff + o, little)

  const entries = (ifd: number) => {
    const out = new Map<number, number>() // tag -> offset of its entry
    const count = u16(ifd)
    for (let i = 0; i < count; i++) out.set(u16(ifd + 2 + i * 12), ifd + 2 + i * 12)
    return out
  }
  const readAsciiTag = (entry: number) => {
    const count = u32(entry + 4)
    const at = count > 4 ? u32(entry + 8) : entry + 8
    let s = ''
    for (let i = 0; i < count - 1; i++) s += String.fromCharCode(view.getUint8(tiff + at + i))
    return s
  }

  const ifd0 = entries(u32(4))
  const exifPtr = ifd0.get(EXIF_IFD_POINTER)
  const exif = exifPtr !== undefined ? entries(u32(exifPtr + 8)) : new Map<number, number>()
  const entry = exif.get(DATE_TIME_ORIGINAL) ?? ifd0.get(DATE_TIME)
  if (entry === undefined) return undefined
  const m = readAsciiTag(entry).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined
}
