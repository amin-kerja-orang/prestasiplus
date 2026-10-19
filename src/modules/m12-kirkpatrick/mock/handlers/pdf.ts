/** The S6 report (SRS M12 v1.6 #7, PROPOSED content): the lines and a one-page text PDF. Pure: no store is read. */

import type { Chain } from '../../api/types'
import { fmt1 } from '../repository/common'

const CONCLUSION =
  'Berdasarkan analisis empat tahap Model Kirkpatrick, Prestasi Plus menunjukkan keberkesanan sebagai ' +
  'platform pembelajaran digital. Tahap 1 (Reaksi) menunjukkan maklum balas positif daripada pengguna. ' +
  'Tahap 2 (Pembelajaran) melalui Head Count menunjukkan perkembangan akademik yang dapat dipantau. ' +
  'Tahap 3 (Tingkah Laku) menunjukkan pelajar yang konsisten menggunakan platform menunjukkan corak ' +
  'Mastery Learning. Tahap 4 (Hasil) korelasi antara penggunaan aktif dengan ketepatan jawapan ' +
  'membuktikan impak positif terhadap pencapaian. Empat-empat tahap Kirkpatrick dipenuhi dalam Prestasi Plus.'

const dash = (n: number | null, suffix = ''): string => (n === null ? '-' : `${fmt1(n)}${suffix}`)

/** The report lines (observed copy and the #6 figures). */
export function reportLines(c: Chain): string[] {
  const low = c.correlation.bands[0]
  const high = c.correlation.bands[c.correlation.bands.length - 1]
  const diff = high && low ? Math.round((high.acc - low.acc) * 10) / 10 : 0
  const conclusionAlesa =
    `Kesimpulan ALESA: Pelajar yang menjawab ${high?.label ?? ''} mencapai ketepatan ${String(high?.acc)}%, ` +
    `berbanding ${String(low?.acc)}% bagi pelajar dengan kurang 20 soalan ` +
    `(perbezaan ${diff >= 0 ? '+' : ''}${fmt1(diff)}%). Korelasi Pearson antara penggunaan dan ketepatan: ` +
    `r = ${String(c.t4.r)} (${c.t4.strength}).`
  return [
    'Tahap 1: Reaksi',
    `NPS Purata: ${fmt1(c.t1.nps)}`,
    `Kepuasan: ${fmt1(c.t1.satisfaction)}/5`,
    `Responden: ${String(c.t1.responses)}`,
    '',
    'Tahap 2: Pembelajaran',
    `Ketepatan: ${fmt1(c.t2.accuracy)}%`,
    `Soalan Dijawab: ${String(c.t2.answers)}`,
    `Skor Purata: ${fmt1(c.t2.avgScore)}%`,
    '',
    'Tahap 3: Tingkah Laku',
    `Pelajar aktif: ${String(c.t3.active)}/${String(c.t3.t4t5)} (${fmt1(c.t3.pct)}%)`,
    `Sesi Latihan: ${String(c.t3.sessions)}`,
    '',
    'Tahap 4: Hasil',
    `GPS: ${dash(c.t4.gps)}`,
    `Korelasi (r): ${String(c.t4.r)}`,
    `Kekuatan: ${c.t4.strength}`,
    '',
    'Analisis Korelasi: Penggunaan -> Pencapaian',
    ...c.correlation.bands.map(
      (b) => `${b.label}: ${String(b.n)} pelajar, ketepatan ${String(b.acc)}%`,
    ),
    '',
    conclusionAlesa,
    '',
    'Kesimpulan Model Kirkpatrick',
    CONCLUSION,
  ]
}

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

/** A one-page A4 PDF of `title` and `lines` (Helvetica, text only). */
export function buildPdf(title: string, lines: readonly string[]): Uint8Array {
  const rows = lines.flatMap((l) => wrap(ascii(l), 92))
  let content = `BT /F1 16 Tf 50 800 Td (${escapePdf(ascii(title))}) Tj ET\n`
  let y = 772
  for (const row of rows) {
    if (y < 40) break
    if (row !== '') content += `BT /F1 10 Tf 50 ${String(y)} Td (${escapePdf(row)}) Tj ET\n`
    y -= 13
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
