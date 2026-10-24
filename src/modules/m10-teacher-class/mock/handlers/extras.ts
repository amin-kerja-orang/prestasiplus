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
 * - #63 (DV-M10-08, D24): the templates are those of the server copy. `/template` is
 *   `template-audio-kbat.csv` (`text/csv`, UTF-8 BOM, columns tajuk, kod_subjek, kod_tingkatan,
 *   nama_fail_audio and one example row, quoted as PHP `fputcsv` does); `/template-word` is a valid `.docx` (built by `docx.ts`, a
 *   stored ZIP) with a title, an intro line and a table of the same four columns and the example.
 */

import { blob, created, raw, route, validationError, type RouteDef } from '@/mock/define'
import { submissions } from '@/modules/m04-question-bank/mock'

import { tableDocx } from './docx'
import { bodyOf, fileOf, intOf, listOf, textOf, viewerId, teacherOnly } from './common'

export const PAPER_TYPES = [
  'Soalan Umum',
  'Kertas Percubaan',
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

/** The Audio KBAT bulk-import template of the server copy (TeacherQuestionToolsController, D24). */
const HEADINGS = ['tajuk', 'kod_subjek', 'kod_tingkatan', 'nama_fail_audio'] as const
const EXAMPLE = ['Contoh: KBAT Sains Bab 1', 'SCI', 'T4', 'kbat-sains-1.mp3'] as const
const csvCell = (c: string): string => (/[\s,"]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)
const BOM = String.fromCharCode(0xfeff)
export const TEMPLATE_CSV_TEXT = `${BOM}${HEADINGS.join(',')}\n${EXAMPLE.map(csvCell).join(',')}\n`
const WORD_HEADINGS = ['Tajuk', 'Kod Subjek', 'Kod Tingkatan', 'Nama Fail Audio'] as const
const WORD_EXAMPLE = ['KBAT Sains Bab 1', 'SCI', 'T4', 'kbat-sains-1.mp3'] as const
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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
      new Blob([TEMPLATE_CSV_TEXT], { type: 'text/csv; charset=UTF-8' }),
      'template-audio-kbat.csv',
    ),
  ),

  route('GET', '/api/guru/audio-kbat/template-word', [teacherOnly], () => {
    const bytes = new Uint8Array(
      tableDocx(
        'Templat Set Audio KBAT',
        'Isi satu baris bagi setiap set. Muat naik fail audio melalui borang "Cipta Set" di /guru/audio-kbat.',
        [WORD_HEADINGS, WORD_EXAMPLE],
      ),
    )
    return blob(new Blob([bytes], { type: DOCX_TYPE }), 'template-audio-kbat.docx')
  }),
]
