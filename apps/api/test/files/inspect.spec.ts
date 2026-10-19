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
    badCrc[badCrc.length - 20] = (badCrc[badCrc.length - 20] ?? 0) ^ 0xff
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
    expect((bytes[20] ?? 0) & 0x08).toBe(0)
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

// ---- Security review F3: declared sizes in every container --------------------------------------

describe('pixel bombs (F3)', () => {
  const BIG = 16000 // 16000 x 16000 is 256M pixels, over the 50M cap

  it('refuses a lossy WebP (VP8) and a lossless WebP (VP8L) that declare a huge bitstream', () => {
    expect(inspectUpload(makeWebp({ vp8: { width: BIG, height: BIG } }))).toBeNull()
    expect(inspectUpload(makeWebp({ bitstream: { width: BIG, height: BIG } }))).toBeNull()
    expect(inspectUpload(makeWebp({ vp8: { width: 8, height: 8 } }))?.mime).toBe('image/webp')
    expect(inspectUpload(makeWebp({ bitstream: { width: 8, height: 8 } }))?.mime).toBe('image/webp')
  })

  it('refuses a WebP whose VP8 or VP8L header is malformed', () => {
    const bad = makeWebp({ vp8: { width: 8, height: 8 } })
    bad[12 + 8 + 10 + 8 + 3] = 0 // break the 9d 01 2a start code of the VP8 chunk
    expect(inspectUpload(bad)).toBeNull()
  })

  it('refuses an animated WebP with a huge frame, or a huge bitstream inside a frame', () => {
    expect(inspectUpload(makeWebp({ frames: [{ width: BIG, height: BIG }] }))).toBeNull()
    expect(inspectUpload(makeWebp({ frames: [{ width: 4, height: 4, inner: { width: BIG, height: BIG } }] }))).toBeNull()
    expect(inspectUpload(makeWebp({ frames: [{ width: 4, height: 4 }, { width: 4, height: 4 }] }))?.mime).toBe('image/webp')
  })

  it('refuses a frame that carries a chunk other than ALPH, VP8 or VP8L', () => {
    expect(inspectUpload(makeWebp({ frames: [{ width: 4, height: 4, innerFourcc: 'EXIF' }] }))).toBeNull()
  })

  it('refuses a WebP canvas (VP8X) over the cap', () => {
    expect(inspectUpload(makeWebp({ width: BIG, height: BIG }))).toBeNull()
  })

  it('caps the summed area of PNG animation frames, like the WebP ANMF cap (4 x the pixel cap)', () => {
    const frame = { width: 5000, height: 5000 } // 25M pixels each, under the single-frame cap
    expect(inspectUpload(makePng({ frames: Array.from({ length: 8 }, () => frame) }))?.mime).toBe('image/png') // 200M = the cap
    expect(inspectUpload(makePng({ frames: Array.from({ length: 9 }, () => frame) }))).toBeNull() // 225M
  })

  it('refuses a PNG animation frame (fcTL) over the cap and accepts a small one', () => {
    expect(inspectUpload(makePng({ fcTL: { width: 100000, height: 100000 } }))).toBeNull()
    expect(inspectUpload(makePng({ fcTL: { width: 0, height: 4 } }))).toBeNull()
    const ok = inspectUpload(makePng({ fcTL: { width: 2, height: 2 } }))
    expect(ok?.mime).toBe('image/png')
    expect(has(ok?.bytes as Buffer, 'fcTL')).toBe(true)
  })
})

// ---- Security review F4: strict allow-lists ------------------------------------------------------

describe('strict allow-lists (F4)', () => {
  it('drops an unknown WebP chunk', () => {
    const out = inspectUpload(makeWebp({ junk: 'smuggled-payload' }))?.bytes as Buffer
    expect(has(out, 'JUNK')).toBe(false)
    expect(has(out, 'smuggled-payload')).toBe(false)
    expect(out.readUInt32LE(4) + 8).toBe(out.length)
    expect(inspectUpload(out)?.bytes.equals(out)).toBe(true)
  })

  it('keeps APP14 only when it is a short Adobe block', () => {
    const adobe = Buffer.concat([Buffer.from('Adobe', 'latin1'), Buffer.alloc(7)]) // length field 14
    const kept = inspectUpload(makeJpeg({ extra: [[0xee, adobe]] }))?.bytes as Buffer
    expect(has(kept, 'Adobe')).toBe(true)
    const junk = inspectUpload(makeJpeg({ extra: [[0xee, Buffer.from('NotAdobe-with-hidden-data', 'latin1')]] }))?.bytes as Buffer
    expect(has(junk, 'hidden-data')).toBe(false)
    const long = inspectUpload(makeJpeg({ extra: [[0xee, Buffer.concat([Buffer.from('Adobe', 'latin1'), Buffer.alloc(40, 0x41)])]] }))?.bytes as Buffer
    expect(has(long, 'Adobe')).toBe(false)
  })

  it('drops other application markers and the JPEGn extension markers', () => {
    const out = inspectUpload(
      makeJpeg({ extra: [[0xe5, Buffer.from('app5-secret')], [0xef, Buffer.from('app15-secret')], [0xf3, Buffer.from('jpg3-secret')], [0xfd, Buffer.from('jpg13-secret')]] }),
    )?.bytes as Buffer
    for (const word of ['app5-secret', 'app15-secret', 'jpg3-secret', 'jpg13-secret']) expect(has(out, word)).toBe(false)
  })

  it('refuses a reserved marker', () => {
    expect(inspectUpload(makeJpeg({ extra: [[0x7f, Buffer.from('reserved')]] }))).toBeNull()
  })

  it('removes the JFIF thumbnail and keeps a minimal JFIF header', () => {
    const src = makeJpeg({ jfifThumbnail: true })
    expect(has(src, 'THUMBNAIL-PIXELS')).toBe(true)
    const out = inspectUpload(src)?.bytes as Buffer
    expect(has(out, 'THUMBNAIL-PIXELS')).toBe(false)
    expect(has(out, 'JFIF')).toBe(true)
    expect(out.readUInt16BE(4)).toBe(16) // APP0 length field
    expect(out[4 + 2 + 12]).toBe(0) // thumbnail width
    expect(out[4 + 2 + 13]).toBe(0) // thumbnail height
    expect(inspectUpload(out)?.bytes.equals(out)).toBe(true)
  })
})

// ---- Code review Minor 6: real-world JPEG files --------------------------------------------------

describe('real-world JPEG shapes', () => {
  it('accepts 0xFF fill bytes between segments', () => {
    const out = inspectUpload(makeJpeg({ fill: true, exifOrientation: 3 }))
    expect(out?.mime).toBe('image/jpeg')
  })

  it('accepts a progressive file with two scans', () => {
    const src = makeJpeg({ progressive: true })
    const out = inspectUpload(src)?.bytes as Buffer
    expect(out.indexOf(Buffer.from([0xff, 0xc2]))).toBeGreaterThan(0)
    // both scan headers survive
    expect(out.toString('latin1').split('\xff\xda').length - 1).toBe(2)
    expect(inspectUpload(out)?.bytes.equals(out)).toBe(true)
  })

  it('accepts restart markers inside the entropy data and keeps the restart interval', () => {
    const out = inspectUpload(makeJpeg({ restart: true }))?.bytes as Buffer
    expect(out.includes(Buffer.from([0xff, 0xdd, 0, 4, 0, 4]))).toBe(true)
    expect(out.includes(Buffer.from([0xff, 0xd0]))).toBe(true)
    expect(out.includes(Buffer.from([0xff, 0xd1, 0x77]))).toBe(true)
  })

  it('cleans a phone-style file: EXIF with a thumbnail, MPF, a second image after the first EOI', () => {
    const src = makeJpeg({ phone: true, comment: 'phone-serial' })
    expect(has(src, 'GPS-LAT')).toBe(true)
    expect(has(src, 'EXIF-THUMB-JPEG')).toBe(true)
    expect(has(src, 'MPF')).toBe(true)
    const out = inspectUpload(src)?.bytes as Buffer
    expect(out).toBeDefined()
    for (const word of ['GPS-LAT', 'EXIF-THUMB-JPEG', 'MPF', 'MP-INDEX', 'phone-serial']) expect(has(out, word)).toBe(false)
    // orientation 6 survives, exactly one EOI at the end
    const at = out.indexOf(Buffer.from('Exif\0\0', 'latin1'))
    expect(out.readUInt16BE(at + 6 + 18)).toBe(6)
    expect(out.subarray(out.length - 2).equals(Buffer.from([0xff, 0xd9]))).toBe(true)
    expect(out.indexOf(Buffer.from([0xff, 0xd9]))).toBe(out.length - 2)
    expect(inspectUpload(out)?.bytes.equals(out)).toBe(true)
  })
})
