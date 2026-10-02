/**
 * SRS M10 v1.18 §7 #59 `GET /api/guru/galeri-rajah`, #60 `POST /api/guru/question-papers` and #63
 * `GET /api/guru/audio-kbat/template` · `/template-word`; all **T**.
 *
 * - #59 (DV-M10-09, FR-M10-103): live redirects the gallery fetch back to S21, so the prototype serves
 *   the empty gallery: `{folders: []}` and, with `?folder=`, `{images: []}`. No image is generated
 *   (D22); the modal shows its live empty texts.
 * - #60 (BR-M10-25, FR-M10-98, §5): a teacher paper becomes an M04 QuestionSubmission `pending`.
 *   `jenisSoalan` is one of the 7 labels (value = label), `subject` ≤ 100, `tingkatan` 1–5 (→ levelCode
 *   "T{n}") or empty, `tahun` 2000–2099 or empty, `disediakanOleh` ≤ 150, `catatan` ≤ 1000, and 1–5
 *   files of `.pdf/.doc/.docx/.xls/.xlsx`, each ≤ 20 MB. M04 requires a year, but the form's "Tahun"
 *   is optional, so an empty one is stored as the year of the mock clock (SRS gap, reported). Nothing
 *   of the files is stored but their name, size and type.
 * - #63 (DV-M10-08, OQ-M09-03): no source file exists to serve byte for byte (the server copy builds
 *   its templates on request; M09's are text placeholders), and the project has no office-document
 *   writer. A text file named `.xlsx` / `.docx` is a broken file, so the templates are served
 *   with an honest type: `/template` as `template-audio-kbat.csv` (`text/csv`, UTF-8 with a BOM so
 *   Excel reads it) and `/template-word` as `template-audio-kbat.txt` (`text/plain`). Both carry
 *   the template **structure** (set fields, the 4 fixed sections, the 30 question rows; FN-M10-7.6)
 *   and no media. A recorded deviation (the live links download XLSX / DOCX).
 */

import { blob, created, raw, route, validationError, type RouteDef } from '@/mock/define'
import { submissions } from '@/modules/m04-question-bank/mock'

import { bodyOf, fileOf, intOf, listOf, textOf, viewerId, teacherOnly } from './common'

export const PAPER_TYPES = [
  'Soalan Umum',
  'Trial Paper',
  'Soalan DSKP',
  'Buku Teks',
  'Buku Latihan',
  'Soalan Peperiksaan',
  'Lain-lain',
] as const

const MAX_FILES = 5
const MAX_FILE_BYTES = 20 * 1024 * 1024
const PAPER_EXT = /\.(pdf|docx?|xlsx?)$/i

/** UNVERIFIED COPY (OQ-M10-16). */
const PAPER_MSG = {
  type: 'Sila pilih jenis soalan.',
  subject: 'Sila isi matapelajaran.',
  subjectLong: 'Matapelajaran tidak boleh melebihi 100 aksara.',
  level: 'Tingkatan tidak sah.',
  year: 'Tahun mesti antara 2000 dan 2099.',
  author: 'Disediakan oleh tidak boleh melebihi 150 aksara.',
  note: 'Catatan tidak boleh melebihi 1000 aksara.',
  files: 'Sila pilih sekurang-kurangnya satu fail.',
  tooMany: 'Maksimum 5 fail.',
  file: (name: string): string => `${name}: format atau saiz tidak dibenarkan.`,
} as const

/** The fixed Audio KBAT layout (FN-M10-7.6.3, BR-M10-26). */
const SECTIONS = [
  ['Bahagian 1', '1-8'],
  ['Bahagian 2', '9-16'],
  ['Bahagian 3', '17-24'],
  ['Bahagian 4', '25-30'],
] as const

/** The template: the set fields, the four sections and the 30 question rows, one `row` per line. */
const tsv = (cells: readonly string[]): string => cells.join('\t')
const csvRow = (cells: readonly string[]): string =>
  cells.map((c) => (/[",\r\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)).join(',')

function templateText(row: (cells: readonly string[]) => string): string {
  const lines = [
    'Template Set Audio KBAT',
    '',
    row(['Tajuk Set', 'Tahap', 'Subjek', 'Sumber / Penyumbang', 'Arahan Umum']),
    row(['', '', '', '', '']),
    '',
    row(['Bahagian', 'Soalan', 'Tajuk Audio', 'Fail Audio', 'Transkrip Audio']),
    ...SECTIONS.map(([name, range]) => row([name, range, '', '', ''])),
    '',
    row([
      'No',
      'Teks Soalan',
      'Pilihan A',
      'Pilihan B',
      'Pilihan C',
      'Pilihan D',
      'Jawapan (A/B/C/D)',
      'Markah (1-20)',
      'KBAT Level (1-5)',
      'DSKP SP ID',
      'Skema / Penjelasan',
    ]),
    ...Array.from({ length: 30 }, (_, i) =>
      row([String(i + 1), '', '', '', '', '', '', '', '', '', '']),
    ),
    '',
  ]
  return lines.join('\r\n')
}

export const extraRoutes: RouteDef[] = [
  route('GET', '/api/guru/galeri-rajah', [teacherOnly], (req) => {
    const folder = req.query.folder
    const has = typeof folder === 'string' ? folder.trim() !== '' : Array.isArray(folder)
    return raw(200, has ? { images: [] } : { folders: [] })
  }),

  route('POST', '/api/guru/question-papers', [teacherOnly], (req, ctx) => {
    const b = bodyOf(req)
    const fields: Record<string, string> = {}

    const paperType = textOf(b.jenisSoalan) ?? ''
    if (!(PAPER_TYPES as readonly string[]).includes(paperType)) fields.jenisSoalan = PAPER_MSG.type

    const subject = textOf(b.subject) ?? ''
    if (subject === '') fields.subject = PAPER_MSG.subject
    else if ([...subject].length > 100) fields.subject = PAPER_MSG.subjectLong

    let levelCode: string | null = null
    const t = b.tingkatan
    if (t !== undefined && t !== null && t !== '') {
      const n = intOf(typeof t === 'string' ? t.replace(/^T/i, '') : t)
      if (n === undefined || n < 1 || n > 5) fields.tingkatan = PAPER_MSG.level
      else levelCode = `T${String(n)}`
    }

    let year = new Date(ctx.clock.now()).getUTCFullYear()
    const y = b.tahun
    if (y !== undefined && y !== null && y !== '') {
      const n = intOf(y)
      if (n === undefined || n < 2000 || n > 2099) fields.tahun = PAPER_MSG.year
      else year = n
    }

    const author = textOf(b.disediakanOleh) ?? ''
    if ([...author].length > 150) fields.disediakanOleh = PAPER_MSG.author
    const note = textOf(b.catatan) ?? ''
    if ([...note].length > 1000) fields.catatan = PAPER_MSG.note

    const list = listOf(b, 'files') ?? []
    const files = list.flatMap((v) => {
      const f = fileOf(v)
      return f ? [f] : []
    })
    if (files.length === 0) fields.files = PAPER_MSG.files
    else if (files.length > MAX_FILES) fields.files = PAPER_MSG.tooMany
    else {
      const bad = files.find((f) => !PAPER_EXT.test(f.name) || f.size > MAX_FILE_BYTES)
      if (bad) fields.files = PAPER_MSG.file(bad.name)
    }

    if (Object.keys(fields).length > 0) return validationError(fields)
    const row = submissions.create(
      {
        teacherId: viewerId(req),
        subjectText: subject,
        levelCode,
        year,
        paperType,
        authorCredit: author,
        note: note === '' ? null : note,
        files: files.map((f) => ({ name: f.name, size: f.size, mime: f.type })),
      },
      ctx.clock.now(),
    )
    return created(row)
  }),

  route('GET', '/api/guru/audio-kbat/template', [teacherOnly], () =>
    blob(
      new Blob(['﻿', templateText(csvRow)], { type: 'text/csv; charset=UTF-8' }),
      'template-audio-kbat.csv',
    ),
  ),

  route('GET', '/api/guru/audio-kbat/template-word', [teacherOnly], () =>
    blob(
      new Blob([templateText(tsv)], { type: 'text/plain; charset=UTF-8' }),
      'template-audio-kbat.txt',
    ),
  ),
]
