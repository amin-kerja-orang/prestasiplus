/**
 * Generated PDF fixtures for the intake tests. Everything is built in memory with hand-written PDF
 * objects and a correct xref table; nothing binary is committed and no real paper is used.
 */
import { createHash } from 'node:crypto'
import { createDeflate, deflateSync } from 'node:zlib'

const latin1 = (s: string): Buffer => Buffer.from(s, 'latin1')

/** `bodies[i]` is the body of object `i + 1` (without the `n 0 obj` wrapper). */
function assemble(bodies: Buffer[], trailerExtra = '', root = 1): Buffer {
  const parts: Buffer[] = [latin1('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]
  const offsets: number[] = []
  let pos = parts[0]!.length
  bodies.forEach((body, i) => {
    offsets.push(pos)
    const chunk = Buffer.concat([latin1(`${i + 1} 0 obj\n`), body, latin1('\nendobj\n')])
    parts.push(chunk)
    pos += chunk.length
  })
  const xref = [`xref\n0 ${bodies.length + 1}\n`, '0000000000 65535 f \n']
  for (const o of offsets) xref.push(`${String(o).padStart(10, '0')} 00000 n \n`)
  xref.push(
    `trailer\n<< /Size ${bodies.length + 1} /Root ${root} 0 R ${trailerExtra} >>\nstartxref\n${pos}\n%%EOF\n`,
  )
  parts.push(latin1(xref.join('')))
  return Buffer.concat(parts)
}

function streamObj(dict: string, data: Buffer): Buffer {
  return Buffer.concat([latin1(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, latin1('\nendstream')])
}

function escapeText(s: string): string {
  return s.replace(/[\\()]/g, (c) => `\\${c}`)
}

/** Content stream: one Helvetica line per entry, 14 pt leading from the top of an A4 page. */
function textContent(lines: string[]): Buffer {
  const ops = ['BT', '/F1 12 Tf', '14 TL', '56 790 Td']
  for (const l of lines) ops.push(`(${escapeText(l)}) Tj T*`)
  ops.push('ET')
  return latin1(ops.join('\n'))
}

/** Digital-born PDF: `pages` A4 pages, each with `linesPerPage` lines of Helvetica text. */
export function textPdf(pages: number, linesPerPage = 6): Buffer {
  const bodies: Buffer[] = [Buffer.alloc(0), Buffer.alloc(0), latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')]
  const kids: string[] = []
  for (let p = 1; p <= pages; p++) {
    const pageObj = 4 + (p - 1) * 2
    kids.push(`${pageObj} 0 R`)
    bodies.push(
      latin1(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObj + 1} 0 R >>`,
      ),
    )
    const lines = Array.from({ length: linesPerPage }, (_, i) => `Page ${p} line ${i + 1}: Soalan ujian sintetik untuk pemprosesan`)
    bodies.push(streamObj('', textContent(lines)))
  }
  bodies[0] = latin1('<< /Type /Catalog /Pages 2 0 R >>')
  bodies[1] = latin1(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`)
  return assemble(bodies)
}

/** Image-only "scan-like" PDF: each page is one raw FlateDecode RGB image, no text layer. */
export function scanPdf(pages: number, imgW = 80, imgH = 112): Buffer {
  const rgb = Buffer.alloc(imgW * imgH * 3)
  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      const i = (y * imgW + x) * 3
      const dark = (x + y) % 17 < 3 // diagonal strokes so the page is not blank
      rgb[i] = rgb[i + 1] = rgb[i + 2] = dark ? 30 : 245
    }
  }
  const imageData = deflateSync(rgb)
  const bodies: Buffer[] = [Buffer.alloc(0), Buffer.alloc(0)]
  const kids: string[] = []
  for (let p = 1; p <= pages; p++) {
    const base = 3 + (p - 1) * 3
    kids.push(`${base} 0 R`)
    bodies.push(
      latin1(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${base + 1} 0 R >> >> /Contents ${base + 2} 0 R >>`,
      ),
    )
    bodies.push(
      streamObj(
        `/Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
        imageData,
      ),
    )
    bodies.push(streamObj('', latin1('q 595 0 0 842 0 0 cm /Im0 Do Q')))
  }
  bodies[0] = latin1('<< /Type /Catalog /Pages 2 0 R >>')
  bodies[1] = latin1(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`)
  return assemble(bodies)
}

const PAD = Buffer.from(
  '28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A',
  'hex',
)

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255
    ;[s[i], s[j]] = [s[j]!, s[i]!]
  }
  const out = Buffer.alloc(data.length)
  let a = 0
  let b = 0
  for (let k = 0; k < data.length; k++) {
    a = (a + 1) & 255
    b = (b + s[a]!) & 255
    ;[s[a], s[b]] = [s[b]!, s[a]!]
    out[k] = data[k]! ^ s[(s[a]! + s[b]!) & 255]!
  }
  return out
}

export interface EncryptedOptions {
  /** Write the /Encrypt key as `/Encr#79pt` so a plain byte scan does not see it (pdfjs still does). */
  hideName?: boolean
}

/**
 * Standard security handler, RC4 40-bit (V1/R2) with the user password "secret": pdfjs raises
 * PasswordException because the empty password does not open it.
 */
export function encryptedPdf(opts: EncryptedOptions = {}): Buffer {
  const id = Buffer.from('0123456789abcdef0123456789abcdef', 'hex')
  const o = createHash('sha256').update('owner-entry').digest() // 32 arbitrary bytes
  const p = -4
  const userPad = Buffer.concat([Buffer.from('secret'), PAD]).subarray(0, 32)
  const pBytes = Buffer.alloc(4)
  pBytes.writeInt32LE(p)
  const key = createHash('md5').update(userPad).update(o).update(pBytes).update(id).digest().subarray(0, 5)
  const u = rc4(key, PAD)
  const objKey = (n: number): Buffer =>
    createHash('md5')
      .update(Buffer.concat([key, Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, 0, 0])]))
      .digest()
      .subarray(0, 10)
  const content = rc4(objKey(5), textContent(['Encrypted synthetic page that nobody can read']))
  const name = opts.hideName ? '/Encr#79pt' : '/Encrypt'
  const bodies = [
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    latin1('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>'),
    streamObj('', content),
    latin1(`<< /Filter /Standard /V 1 /R 2 /O <${o.toString('hex')}> /U <${u.toString('hex')}> /P ${p} >>`),
  ]
  return assemble(bodies, `${name} 6 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>]`)
}

/** Garbage after a valid header: not a PDF that any reader can open. */
export function corruptPdf(): Buffer {
  const junk = Buffer.alloc(2048)
  let x = 12345
  for (let i = 0; i < junk.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    junk[i] = x & 255
  }
  return Buffer.concat([latin1('%PDF-1.4\n'), junk])
}

/** Deflates `totalBytes` of spaces in 1 MiB chunks (the result is a few hundred KB). */
async function deflateFill(totalBytes: number): Promise<Buffer> {
  const deflate = createDeflate({ level: 9 })
  const chunks: Buffer[] = []
  deflate.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<void>((resolve, reject) => {
    deflate.on('end', resolve)
    deflate.on('error', reject)
  })
  const block = Buffer.alloc(1024 * 1024, 0x20)
  for (let written = 0; written < totalBytes; written += block.length) {
    if (!deflate.write(block)) await new Promise<void>((r) => deflate.once('drain', r))
  }
  deflate.end()
  await done
  return Buffer.concat(chunks)
}

const bombCache = new Map<number, Buffer>()

/** A one-page PDF whose content stream inflates to `inflatedMb` MiB (default 600). Built at runtime, cached. */
export async function bombPdf(inflatedMb = 600): Promise<Buffer> {
  const cached = bombCache.get(inflatedMb)
  if (cached) return cached
  const data = await deflateFill(inflatedMb * 1024 * 1024)
  const pdf = assemble([
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>'),
    streamObj('/Filter /FlateDecode', data),
  ])
  bombCache.set(inflatedMb, pdf)
  return pdf
}

/**
 * One page with visible text, an /OpenAction JavaScript, URI link annotations and a /Launch action that
 * all point at `http://127.0.0.1:<port>/...`. A reader that follows any of them hits the listener.
 */
export function activePdf(port: number): Buffer {
  const base = `http://127.0.0.1:${port}`
  const bodies = [
    latin1(
      `<< /Type /Catalog /Pages 2 0 R /OpenAction 6 0 R /AA << /WC 6 0 R >> /Names << /JavaScript << /Names [(boot) 6 0 R] >> >> >>`,
    ),
    latin1('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    latin1(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R /Annots [7 0 R 8 0 R] /AA << /O 6 0 R >> >>',
    ),
    streamObj('', textContent(['Active content test page with links and scripts inside'])),
    latin1(
      `<< /Type /Action /S /JavaScript /JS (app.alert\\(1\\); this.submitForm\\('${base}/js'\\); app.launchURL\\('${base}/js2'\\);) >>`,
    ),
    latin1(
      `<< /Type /Annot /Subtype /Link /Rect [50 700 300 720] /Border [0 0 0] /A << /S /URI /URI (${base}/uri) >> >>`,
    ),
    latin1(
      `<< /Type /Annot /Subtype /Link /Rect [50 650 300 670] /Border [0 0 0] /A << /S /Launch /F (${base}/launch) /Win << /F (${base}/launch-win) >> >> >>`,
    ),
  ]
  return assemble(bodies)
}
