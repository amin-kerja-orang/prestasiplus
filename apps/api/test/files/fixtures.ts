import { crc32 } from 'node:zlib'

/** Hand-built, tiny, fictitious image files for the upload tests. */

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

export interface PngOptions {
  width?: number
  height?: number
  /** tEXt chunk carrying this text (stands for GPS or author metadata). */
  text?: string
  /** Bytes appended after IEND. */
  trailing?: Buffer
  /** Pad the IDAT with this many extra bytes (to reach a size). */
  padTo?: number
}

export function makePng(opts: PngOptions = {}): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(opts.width ?? 2, 0)
  ihdr.writeUInt32BE(opts.height ?? 2, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const parts = [PNG_SIGNATURE, pngChunk('IHDR', ihdr)]
  if (opts.text) parts.push(pngChunk('tEXt', Buffer.from(`GPSLatitude\0${opts.text}`, 'latin1')))
  const idat = Buffer.alloc(Math.max(16, (opts.padTo ?? 0) - 100), 0x11)
  parts.push(pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0)))
  if (opts.trailing) parts.push(opts.trailing)
  return Buffer.concat(parts)
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.from([0xff, marker, 0, 0])
  head.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([head, payload])
}

/** A big-endian EXIF payload with Orientation and a (fake) GPS marker string. */
export function exifPayload(orientation: number, gps = 'GPS-LAT-3.1390N'): Buffer {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4)
  tiff.write('MM', 0, 'latin1')
  tiff.writeUInt16BE(0x2a, 2)
  tiff.writeUInt32BE(8, 4)
  tiff.writeUInt16BE(1, 8)
  tiff.writeUInt16BE(0x0112, 10)
  tiff.writeUInt16BE(3, 12)
  tiff.writeUInt32BE(1, 14)
  tiff.writeUInt16BE(orientation, 18)
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, Buffer.from(gps, 'latin1')])
}

export interface JpegOptions {
  width?: number
  height?: number
  exifOrientation?: number
  comment?: string
  xmp?: string
  trailing?: Buffer
  padTo?: number
}

export function makeJpeg(opts: JpegOptions = {}): Buffer {
  const target = opts.padTo ?? 0
  const base = buildJpeg(opts, 0)
  return target > base.length ? buildJpeg(opts, target - base.length) : base
}

function buildJpeg(opts: JpegOptions, extra: number): Buffer {
  const sof = Buffer.alloc(15)
  sof[0] = 8
  sof.writeUInt16BE(opts.height ?? 2, 1)
  sof.writeUInt16BE(opts.width ?? 2, 3)
  sof[5] = 3
  const parts = [Buffer.from([0xff, 0xd8]), jpegSegment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'))]
  if (opts.exifOrientation !== undefined) parts.push(jpegSegment(0xe1, exifPayload(opts.exifOrientation)))
  if (opts.xmp) parts.push(jpegSegment(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0${opts.xmp}`, 'latin1')))
  if (opts.comment) parts.push(jpegSegment(0xfe, Buffer.from(opts.comment, 'latin1')))
  parts.push(jpegSegment(0xdb, Buffer.alloc(65, 1)), jpegSegment(0xc0, sof), jpegSegment(0xda, Buffer.from([3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0])))
  // Entropy-coded data: a stuffed 0xFF 0x00 and filler without markers.
  const entropy = Buffer.concat([Buffer.from([0x12, 0xff, 0x00, 0x34]), Buffer.alloc(8 + extra, 0x56)])
  parts.push(entropy, Buffer.from([0xff, 0xd9]))
  if (opts.trailing) parts.push(opts.trailing)
  return Buffer.concat(parts)
}

function riffChunk(fourcc: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.write(fourcc, 0, 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
}

export function makeWebp(opts: { exif?: string; width?: number; height?: number } = {}): Buffer {
  const vp8x = Buffer.alloc(10)
  vp8x[0] = opts.exif ? 0x08 : 0
  vp8x.writeUIntLE((opts.width ?? 2) - 1, 4, 3)
  vp8x.writeUIntLE((opts.height ?? 2) - 1, 7, 3)
  const body = [Buffer.from('WEBP', 'latin1'), riffChunk('VP8X', vp8x), riffChunk('VP8L', Buffer.from([0x2f, 0, 0, 0, 0, 0, 0, 0]))]
  if (opts.exif) body.push(riffChunk('EXIF', Buffer.from(opts.exif, 'latin1')))
  const joined = Buffer.concat(body)
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(joined.length, 4)
  return Buffer.concat([head, joined])
}

export function makePdf(padTo = 0): Buffer {
  const base = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1')
  return padTo > base.length ? Buffer.concat([base, Buffer.alloc(padTo - base.length, 0x20)]) : base
}
