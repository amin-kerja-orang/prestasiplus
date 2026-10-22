import { Injectable } from '@nestjs/common'

import type { PdfPort } from '../ports/pdf.port'

/** Characters per line before wrapping, and the page geometry (A4, points). */
const WRAP = 92
const TOP = 772
const LEADING = 13
const BOTTOM = 40

const ascii = (s: string): string =>
  s
    .replace(/[–—]/g, '-')
    .replace(/·/g, '.')
    .replace(/[^\x20-\x7e]/g, '?')

const escapePdf = (s: string): string => s.replace(/[\\()]/g, (c) => `\\${c}`)

function wrap(line: string, width: number): string[] {
  if (line.length <= width) return [line]
  const out: string[] = []
  let cur = ''
  for (const word of line.split(' ')) {
    if (cur !== '' && cur.length + 1 + word.length > width) {
      out.push(cur)
      cur = word
    } else cur = cur === '' ? word : `${cur} ${word}`
  }
  if (cur !== '') out.push(cur)
  return out
}

/**
 * A minimal hand-written one-page A4 PDF (Helvetica, text only, no images or fonts to embed), the same layout
 * contract as the mock `pdf.ts`. No library is added to the dependency tree for one text page.
 */
@Injectable()
export class TextPdfAdapter implements PdfPort {
  render(title: string, lines: readonly string[]): Uint8Array {
    const rows = lines.flatMap((l) => wrap(ascii(l), WRAP))
    let content = `BT /F1 16 Tf 50 800 Td (${escapePdf(ascii(title))}) Tj ET\n`
    let y = TOP
    for (const row of rows) {
      if (y < BOTTOM) break
      if (row !== '') content += `BT /F1 10 Tf 50 ${String(y)} Td (${escapePdf(row)}) Tj ET\n`
      y -= LEADING
    }
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${String(content.length)} >>\nstream\n${content}endstream`,
    ]
    let pdf = '%PDF-1.4\n'
    const offsets: number[] = []
    objects.forEach((body, i) => {
      offsets.push(pdf.length)
      pdf += `${String(i + 1)} 0 obj\n${body}\nendobj\n`
    })
    const xref = pdf.length
    pdf += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`
    for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`
    pdf += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
    return new TextEncoder().encode(pdf)
  }
}
