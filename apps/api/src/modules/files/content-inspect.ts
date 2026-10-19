/**
 * Content inspection of an upload (BE-04): the type is decided from the bytes (magic numbers), never
 * from the file name or the client header, and raster images are rewritten without metadata.
 *
 * Decision (open question 2): no re-encoding (that needs an image library that is not a dependency).
 * Instead each container is parsed and rebuilt with an allow-list of segments or chunks, so EXIF
 * (GPS, camera, time), XMP, IPTC, comments and text chunks are dropped, as is anything appended after
 * the end marker (polyglot payloads). For JPEG only the EXIF orientation value is kept, in a minimal
 * synthetic EXIF segment, so phone photos still display upright. A file whose structure does not
 * parse is refused like a wrong type.
 */

export type DetectedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export interface Inspected {
  mime: DetectedMime
  /** The bytes to store (sanitised for images, unchanged for PDF). */
  bytes: Buffer
}

/** Decompression-bomb guard: largest accepted image area in pixels. */
export const MAX_PIXELS = 50_000_000

export const EXTENSION_OF: Readonly<Record<DetectedMime, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** The detected type by magic bytes only, or null. */
export function sniffMime(b: Buffer): DetectedMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png'
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  if (b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf'
  return null
}

/** Detects the type and returns the bytes to store, or null when the type is unknown or the structure is broken. */
export function inspectUpload(input: Buffer): Inspected | null {
  const mime = sniffMime(input)
  if (!mime) return null
  let bytes: Buffer | null
  switch (mime) {
    case 'image/jpeg':
      bytes = sanitizeJpeg(input)
      break
    case 'image/png':
      bytes = sanitizePng(input)
      break
    case 'image/webp':
      bytes = sanitizeWebp(input)
      break
    case 'application/pdf':
      bytes = input
      break
  }
  return bytes ? { mime, bytes } : null
}

// ---- JPEG ---------------------------------------------------------------------------------------

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/** Minimal EXIF segment holding only the orientation tag (big endian TIFF). */
function orientationSegment(orientation: number): Buffer {
  const seg = Buffer.alloc(2 + 2 + 6 + 8 + 2 + 12 + 4)
  seg[0] = 0xff
  seg[1] = 0xe1
  seg.writeUInt16BE(seg.length - 2, 2)
  seg.write('Exif\0\0', 4, 'latin1')
  seg.write('MM', 10, 'latin1')
  seg.writeUInt16BE(0x002a, 12)
  seg.writeUInt32BE(8, 14)
  seg.writeUInt16BE(1, 18) // one entry
  seg.writeUInt16BE(0x0112, 20) // Orientation
  seg.writeUInt16BE(3, 22) // SHORT
  seg.writeUInt32BE(1, 24)
  seg.writeUInt16BE(orientation, 28)
  return seg
}

/** Orientation (2..8) from an EXIF APP1 payload (starting at "Exif\0\0"), or null. */
function readOrientation(payload: Buffer): number | null {
  if (payload.length < 14 || payload.toString('latin1', 0, 6) !== 'Exif\0\0') return null
  const tiff = payload.subarray(6)
  const little = tiff.toString('latin1', 0, 2) === 'II'
  if (!little && tiff.toString('latin1', 0, 2) !== 'MM') return null
  const u16 = (o: number): number => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o))
  const u32 = (o: number): number => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o))
  if (u16(2) !== 0x002a) return null
  const ifd = u32(4)
  if (ifd < 8 || ifd + 2 > tiff.length) return null
  const count = u16(ifd)
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > tiff.length) return null
    if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
      const value = u16(entry + 8)
      return value >= 2 && value <= 8 ? value : null
    }
  }
  return null
}

function sanitizeJpeg(b: Buffer): Buffer | null {
  const kept: Buffer[] = []
  let orientation: number | null = null
  let sawFrame = false
  let sawScan = false
  let end = -1
  let pos = 2

  while (pos < b.length) {
    if (b[pos] !== 0xff) return null
    while (b[pos + 1] === 0xff) pos += 1 // fill bytes
    const marker = b[pos + 1]
    if (marker === undefined) return null
    if (marker === 0xd9) {
      end = pos + 2
      break
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      pos += 2
      continue
    }
    if (pos + 4 > b.length) return null
    const length = b.readUInt16BE(pos + 2)
    if (length < 2 || pos + 2 + length > b.length) return null
    const segment = b.subarray(pos, pos + 2 + length)
    const payload = segment.subarray(4)

    if (SOF_MARKERS.has(marker)) {
      if (length < 8) return null
      const height = segment.readUInt16BE(5)
      const width = segment.readUInt16BE(7)
      if (width === 0 || height === 0 || width * height > MAX_PIXELS) return null
      sawFrame = true
    }

    if (marker === 0xe1) {
      orientation = orientation ?? readOrientation(payload)
    } else if (marker === 0xe2) {
      if (payload.toString('latin1', 0, 12) === 'ICC_PROFILE\0') kept.push(segment)
    } else if (marker === 0xee) {
      kept.push(segment) // Adobe colour transform
    } else if (marker === 0xe0) {
      if (payload.toString('latin1', 0, 5) === 'JFIF\0') kept.push(segment)
    } else if (marker < 0xe0 || marker > 0xef) {
      if (marker !== 0xfe) kept.push(segment) // everything but comments
    } // other APPn (EXIF/XMP/IPTC/Photoshop) are dropped

    pos += 2 + length
    if (marker === 0xda) {
      sawScan = true
      // Entropy-coded data up to the next real marker (FF 00 is a stuffed byte, FF D0-D7 a restart).
      const start = pos
      while (pos < b.length) {
        if (b[pos] === 0xff) {
          const next = b[pos + 1]
          if (next === undefined) return null
          if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) break
          pos += next === 0xff ? 1 : 2
        } else {
          pos += 1
        }
      }
      kept.push(b.subarray(start, pos))
    }
  }
  if (end < 0 || !sawFrame || !sawScan) return null

  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]
  const first = kept[0]
  const afterJfif = first !== undefined && first[1] === 0xe0 ? 1 : 0
  kept.forEach((part, i) => {
    if (i === afterJfif && orientation !== null) parts.push(orientationSegment(orientation))
    parts.push(part)
  })
  parts.push(Buffer.from([0xff, 0xd9]))
  return Buffer.concat(parts)
}

// ---- PNG ----------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Buffer): number {
  let c = 0xffffffff
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT'])

function sanitizePng(b: Buffer): Buffer | null {
  const kept: Buffer[] = [PNG_SIGNATURE]
  let pos = 8
  let first = true
  let sawData = false
  let ended = false

  while (pos + 12 <= b.length) {
    const length = b.readUInt32BE(pos)
    if (length > 0x7fffffff || pos + 12 + length > b.length) return null
    const type = b.toString('latin1', pos + 4, pos + 8)
    if (!/^[A-Za-z]{4}$/.test(type)) return null
    const chunk = b.subarray(pos, pos + 12 + length)
    if (crc32(b.subarray(pos + 4, pos + 8 + length)) !== chunk.readUInt32BE(8 + length)) return null

    if (first) {
      if (type !== 'IHDR' || length !== 13) return null
      const width = chunk.readUInt32BE(8)
      const height = chunk.readUInt32BE(12)
      if (width === 0 || height === 0 || width * height > MAX_PIXELS) return null
      first = false
    }
    if (type === 'IDAT') sawData = true
    if (PNG_KEEP.has(type)) kept.push(chunk)
    pos += 12 + length
    if (type === 'IEND') {
      ended = true
      break // anything after IEND is dropped
    }
  }
  if (first || !sawData || !ended) return null
  return Buffer.concat(kept)
}

// ---- WebP ---------------------------------------------------------------------------------------

const WEBP_DROP = new Set(['EXIF', 'XMP '])

function sanitizeWebp(b: Buffer): Buffer | null {
  const riffSize = b.readUInt32LE(4)
  const total = riffSize + 8
  if (riffSize < 4 || total > b.length) return null
  const kept: Buffer[] = []
  let pos = 12
  let sawImage = false
  let index = 0

  while (pos + 8 <= total) {
    const fourcc = b.toString('latin1', pos, pos + 4)
    const size = b.readUInt32LE(pos + 4)
    const padded = size + (size % 2)
    if (pos + 8 + padded > total) return null
    let chunk: Buffer = b.subarray(pos, pos + 8 + padded)

    if (index === 0 && fourcc !== 'VP8 ' && fourcc !== 'VP8L' && fourcc !== 'VP8X') return null
    if (fourcc === 'VP8X') {
      if (size < 10 || index !== 0) return null
      const width = (b.readUIntLE(pos + 12, 3) & 0xffffff) + 1
      const height = (b.readUIntLE(pos + 15, 3) & 0xffffff) + 1
      if (width * height > MAX_PIXELS) return null
      chunk = Buffer.from(chunk)
      chunk[8] = (chunk[8] as number) & ~(0x08 | 0x04) // clear the EXIF and XMP flags
    }
    if (fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'ANMF') sawImage = true
    if (!WEBP_DROP.has(fourcc)) kept.push(chunk)
    pos += 8 + padded
    index += 1
  }
  if (!sawImage) return null

  const body = Buffer.concat(kept)
  const head = Buffer.alloc(12)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(body.length + 4, 4)
  head.write('WEBP', 8, 'latin1')
  return Buffer.concat([head, body])
}
