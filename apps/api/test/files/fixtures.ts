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
  /** An animation frame control chunk with this frame size. */
  fcTL?: { width: number; height: number }
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
  if (opts.fcTL) {
    const fc = Buffer.alloc(26)
    fc.writeUInt32BE(opts.fcTL.width, 4)
    fc.writeUInt32BE(opts.fcTL.height, 8)
    parts.push(pngChunk('fcTL', fc))
  }
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
  /** SOF2 with two scans instead of baseline SOF0. */
  progressive?: boolean
  /** DRI plus restart markers (FF D0..) inside the entropy data. */
  restart?: boolean
  /** 0xFF fill bytes before every segment marker. */
  fill?: boolean
  /** A JFIF APP0 that carries a 2x1 RGB thumbnail. */
  jfifThumbnail?: boolean
  /** Extra raw segments, each [marker, payload], inserted after APP0. */
  extra?: Array<[number, Buffer]>
  /** Phone style: EXIF with an embedded thumbnail, MPF APP2, a second (MPF) image after the first EOI. */
  phone?: boolean
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
  const fill = opts.fill ? Buffer.from([0xff, 0xff]) : Buffer.alloc(0)
  const seg = (marker: number, payload: Buffer): Buffer => Buffer.concat([fill, jpegSegment(marker, payload)])
  const jfif = Buffer.from(
    opts.jfifThumbnail ? 'JFIF\0\x01\x01\0\0\x01\0\x01\x02\x01' : 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0',
    'latin1',
  )
  const thumb = opts.jfifThumbnail ? Buffer.from('THUMBNAIL-PIXELS', 'latin1') : Buffer.alloc(0)
  const parts = [Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.concat([jfif, thumb]))]
  if (opts.phone) {
    const embedded = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('EXIF-THUMB-JPEG'), Buffer.from([0xff, 0xd9])])
    parts.push(seg(0xe1, Buffer.concat([exifPayload(6), embedded])))
    parts.push(seg(0xe2, Buffer.from('MPF\0MP-INDEX-DATA', 'latin1')))
  }
  if (opts.exifOrientation !== undefined) parts.push(seg(0xe1, exifPayload(opts.exifOrientation)))
  if (opts.xmp) parts.push(seg(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0${opts.xmp}`, 'latin1')))
  if (opts.comment) parts.push(seg(0xfe, Buffer.from(opts.comment, 'latin1')))
  for (const [marker, payload] of opts.extra ?? []) parts.push(seg(marker, payload))
  parts.push(seg(0xdb, Buffer.alloc(65, 1)))
  if (opts.restart) parts.push(seg(0xdd, Buffer.from([0, 4])))
  parts.push(seg(opts.progressive ? 0xc2 : 0xc0, sof))
  const scanHeader = Buffer.from([3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0])
  const filler = Buffer.alloc(8 + extra, 0x56)
  const entropy = opts.restart
    ? Buffer.concat([Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0]), filler, Buffer.from([0xff, 0xd1, 0x77])])
    : Buffer.concat([Buffer.from([0x12, 0xff, 0x00, 0x34]), filler])
  parts.push(seg(0xda, scanHeader), entropy)
  if (opts.progressive) parts.push(seg(0xda, scanHeader), Buffer.from([0x21, 0x22]))
  parts.push(Buffer.from([0xff, 0xd9]))
  if (opts.phone) parts.push(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 4, 0x41, 0x42, 0xff, 0xd9]))
  if (opts.trailing) parts.push(opts.trailing)
  return Buffer.concat(parts)
}

function riffChunk(fourcc: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.write(fourcc, 0, 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
}

export interface WebpOptions {
  exif?: string
  width?: number
  height?: number
  /** Bytes of an unknown chunk 'JUNK' to include. */
  junk?: string
  /** Size declared inside the VP8L bitstream header. */
  bitstream?: { width: number; height: number }
  /** Use a lossy VP8 chunk with this declared size instead of VP8L. */
  vp8?: { width: number; height: number }
  /** Animation frames: each with its declared frame size and the inner bitstream size. */
  frames?: Array<{ width: number; height: number; inner?: { width: number; height: number }; innerFourcc?: string }>
}

function vp8lPayload(width: number, height: number): Buffer {
  const p = Buffer.alloc(8)
  p[0] = 0x2f
  p.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 1)
  return p
}

function vp8Payload(width: number, height: number): Buffer {
  const p = Buffer.alloc(10)
  p[3] = 0x9d
  p[4] = 0x01
  p[5] = 0x2a
  p.writeUInt16LE(width & 0x3fff, 6)
  p.writeUInt16LE(height & 0x3fff, 8)
  return p
}

export function makeWebp(opts: WebpOptions = {}): Buffer {
  const vp8x = Buffer.alloc(10)
  vp8x[0] = opts.exif ? 0x08 : opts.frames ? 0x02 : 0
  vp8x.writeUIntLE((opts.width ?? 2) - 1, 4, 3)
  vp8x.writeUIntLE((opts.height ?? 2) - 1, 7, 3)
  const body = [Buffer.from('WEBP', 'latin1'), riffChunk('VP8X', vp8x)]
  if (opts.frames) {
    body.push(riffChunk('ANIM', Buffer.alloc(6)))
    for (const f of opts.frames) {
      const head = Buffer.alloc(16)
      head.writeUIntLE(f.width - 1, 6, 3)
      head.writeUIntLE(f.height - 1, 9, 3)
      const inner = f.inner ?? { width: 1, height: 1 }
      body.push(riffChunk('ANMF', Buffer.concat([head, riffChunk(f.innerFourcc ?? 'VP8L', vp8lPayload(inner.width, inner.height))])))
    }
  } else if (opts.vp8) {
    body.push(riffChunk('VP8 ', vp8Payload(opts.vp8.width, opts.vp8.height)))
  } else {
    body.push(riffChunk('VP8L', vp8lPayload(opts.bitstream?.width ?? 1, opts.bitstream?.height ?? 1)))
  }
  if (opts.exif) body.push(riffChunk('EXIF', Buffer.from(opts.exif, 'latin1')))
  if (opts.junk) body.push(riffChunk('JUNK', Buffer.from(opts.junk, 'latin1')))
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
