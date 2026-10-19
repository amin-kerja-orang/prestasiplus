import { describe, expect, it } from 'vitest'

import { inspectUpload, sniffMime } from '../../src/modules/files/content-inspect'
import { exifPayload, makeJpeg, makePdf, makePng, makeWebp } from './fixtures'

const has = (b: Buffer, text: string): boolean => b.includes(Buffer.from(text, 'latin1'))

describe('sniffMime (magic bytes only)', () => {
  it('recognises the four types', () => {
    expect(sniffMime(makeJpeg())).toBe('image/jpeg')
    expect(sniffMime(makePng())).toBe('image/png')
    expect(sniffMime(makeWebp())).toBe('image/webp')
    expect(sniffMime(makePdf())).toBe('application/pdf')
  })

  it.each([
    ['plain text', Buffer.from('just some text pretending to be a picture')],
    ['html', Buffer.from('<html><script>alert(1)</script></html>')],
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')],
    ['windows executable', Buffer.from('MZ\x90\0\x03\0\0\0', 'latin1')],
    ['gif', Buffer.from('GIF89a\x01\0\x01\0', 'latin1')],
    ['empty', Buffer.alloc(0)],
    ['truncated png signature', Buffer.from([0x89, 0x50, 0x4e])],
  ])('rejects %s', (_n, bytes) => {
    expect(sniffMime(bytes)).toBeNull()
    expect(inspectUpload(bytes)).toBeNull()
  })
})

describe('JPEG', () => {
  it('drops EXIF GPS, XMP and comments but keeps a valid image', () => {
    const src = makeJpeg({ exifOrientation: 1, comment: 'camera-serial-123', xmp: 'xmp-author' })
    expect(has(src, 'GPS-LAT')).toBe(true)
    const out = inspectUpload(src)
    expect(out?.mime).toBe('image/jpeg')
    const bytes = out?.bytes as Buffer
    expect(has(bytes, 'GPS-LAT')).toBe(false)
    expect(has(bytes, 'camera-serial')).toBe(false)
    expect(has(bytes, 'xmp-author')).toBe(false)
    expect(has(bytes, 'adobe.com')).toBe(false)
    expect(bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))).toBe(true)
    expect(bytes.subarray(bytes.length - 2).equals(Buffer.from([0xff, 0xd9]))).toBe(true)
    // The result is itself a clean, parseable file.
    expect(inspectUpload(bytes)?.bytes.equals(bytes)).toBe(true)
  })

  it('keeps only the orientation of the EXIF block', () => {
    const out = inspectUpload(makeJpeg({ exifOrientation: 6 }))?.bytes as Buffer
    expect(has(out, 'Exif')).toBe(true)
    expect(has(out, 'GPS-LAT')).toBe(false)
    const at = out.indexOf(Buffer.from('Exif\0\0', 'latin1'))
    // tiff header at +6: "MM", 0x002a, offset 8; the orientation value sits 18 bytes into the TIFF block.
    expect(out.readUInt16BE(at + 6 + 18)).toBe(6)
    expect(out.includes(exifPayload(6).subarray(0, 4))).toBe(true)
  })

  it('does not add an EXIF block when the orientation is normal or absent', () => {
    expect(has(inspectUpload(makeJpeg({ exifOrientation: 1 }))?.bytes as Buffer, 'Exif')).toBe(false)
    expect(has(inspectUpload(makeJpeg())?.bytes as Buffer, 'Exif')).toBe(false)
  })

  it('drops data appended after the end marker (polyglot)', () => {
    const out = inspectUpload(makeJpeg({ trailing: Buffer.from('<?php system($_GET[0]); ?>') }))?.bytes as Buffer
    expect(has(out, '<?php')).toBe(false)
  })

  it('refuses a broken structure and a pixel bomb', () => {
    const good = makeJpeg()
    expect(inspectUpload(good.subarray(0, good.length - 2))).toBeNull() // no EOI
    expect(inspectUpload(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('garbage')]))).toBeNull()
    expect(inspectUpload(makeJpeg({ width: 20000, height: 20000 }))).toBeNull()
    expect(inspectUpload(makeJpeg({ width: 0, height: 5 }))).toBeNull()
  })
})

describe('PNG', () => {
  it('drops text chunks and trailing data', () => {
    const src = makePng({ text: 'author-name', trailing: Buffer.from('<script>x</script>') })
    const out = inspectUpload(src)
    expect(out?.mime).toBe('image/png')
    const bytes = out?.bytes as Buffer
    expect(has(bytes, 'author-name')).toBe(false)
    expect(has(bytes, 'tEXt')).toBe(false)
    expect(has(bytes, '<script>')).toBe(false)
    expect(has(bytes, 'IDAT')).toBe(true)
    expect(inspectUpload(bytes)?.bytes.equals(bytes)).toBe(true)
  })

  it('refuses a bad CRC, a missing IEND, a missing IHDR and a pixel bomb', () => {
    const good = makePng()
    const badCrc = Buffer.from(good)
    badCrc[badCrc.length - 20] ^= 0xff
    expect(inspectUpload(badCrc)).toBeNull()
    expect(inspectUpload(good.subarray(0, good.length - 12))).toBeNull()
    expect(inspectUpload(Buffer.concat([good.subarray(0, 8), good.subarray(33)]))).toBeNull()
    expect(inspectUpload(makePng({ width: 100000, height: 100000 }))).toBeNull()
  })
})

describe('WebP', () => {
  it('drops the EXIF chunk and clears its flag', () => {
    const src = makeWebp({ exif: 'GPS-LAT-3.1390N' })
    const out = inspectUpload(src)
    expect(out?.mime).toBe('image/webp')
    const bytes = out?.bytes as Buffer
    expect(has(bytes, 'GPS-LAT')).toBe(false)
    expect(has(bytes, 'EXIF')).toBe(false)
    expect(bytes[20] & 0x08).toBe(0)
    expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length)
    expect(inspectUpload(bytes)?.bytes.equals(bytes)).toBe(true)
  })

  it('refuses a RIFF that is not WebP data or is cut short', () => {
    const good = makeWebp()
    expect(inspectUpload(good.subarray(0, good.length - 4))).toBeNull()
    const noImage = Buffer.from(good)
    noImage.write('ABCD', 12, 'latin1') // first chunk is not VP8/VP8L/VP8X
    expect(inspectUpload(noImage)).toBeNull()
    expect(inspectUpload(makeWebp({ width: 20000, height: 20000 }))).toBeNull()
  })
})

describe('PDF', () => {
  it('is detected and passed through unchanged', () => {
    const pdf = makePdf()
    expect(inspectUpload(pdf)).toEqual({ mime: 'application/pdf', bytes: pdf })
  })
})
