/**
 * SRS M10 v1.18 §7 #59 `GET /api/guru/galeri-rajah`, #60 `POST /api/guru/question-papers` and #63
 * `GET /api/guru/audio-kbat/template` · `/template-word`; all **T**.
 *
 * - #59 (DV-M10-09, FR-M10-103): live redirects the gallery fetch back to S21, so the prototype serves
 *   the empty gallery: `{folders: []}` and, with `?folder=`, `{images: []}`. No image is generated
 *   (D22); the modal shows its live empty texts.
 * - #60 (API-GUR-17, 44-F4): a teacher paper becomes an M04 QuestionSubmission `pending` and answers
 *   `201 {data:{batchId}}`. `paperType` is a slug, `subject` ≤ 100, `levelId` 1–5 (→ levelCode "T{n}") or empty,
 *   `year` 2000–2099 or empty, `preparedBy` ≤ 150, `note` ≤ 1000, `answerSchemeConfirmed` true, and 1–5
 *   files of `.pdf/.docx/.xlsx`, each ≤ 20 MB; a PDF named "scan…" / "imbas…" is the scanned-PDF case. M04 requires a year, but the form's "Tahun"
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

/** OPT-JENIS-HANTARAN stored slugs (API-GUR-17 `paperType`). */
export const PAPER_TYPES = [
  'umum',
  'trial',
  'dskp',
  'buku_teks',
  'buku_latihan',
  'peperiksaan',
  'lain',
] as const
/** Display label stored with the M04 submission. */
const PAPER_LABELS: Readonly<Record<(typeof PAPER_TYPES)[number], string>> = {
  umum: 'Soalan Umum',
  trial: 'Trial Paper',
  dskp: 'Soalan DSKP',
  buku_teks: 'Buku Teks',
  buku_latihan: 'Buku Latihan',
  peperiksaan: 'Soalan Peperiksaan',
  lain: 'Lain-lain',
}

const MAX_FILES = 5
const MAX_FILE_BYTES = 20 * 1024 * 1024
const PAPER_EXT = /\.(pdf|docx|xlsx)$/i

/** The 44-F4 texts (the same strings as the real API). */
const PAPER_MSG = {
  type: 'Sila pilih jenis soalan.',
  subject: 'Sila isi matapelajaran.',
  subjectLong: 'Matapelajaran tidak boleh melebihi 100 aksara.',
  level: 'Tingkatan tidak sah.',
  year: 'Tahun mesti antara 2000 dan 2099.',
  author: 'Disediakan oleh tidak boleh melebihi 150 aksara.',
  note: 'Catatan tambahan tidak boleh melebihi 1000 aksara.',
  confirm: 'Sila sahkan skema jawapan disertakan.',
  files: 'Sila pilih fail.',
  tooMany: 'Maksimum 5 fail, saiz maksimum 20MB setiap fail',
  fileType: 'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.',
  fileSize: 'Fail melebihi saiz maksimum 20 MB.',
  scanned: 'PDF imbasan imej tidak diterima — teks mesti boleh disalin.',
} as const

/** Mock stand-in for the text extractor: a PDF whose name says "scan" / "imbas" has no text on its first pages. */
const SCANNED_PDF = /(scan|imbas).*\.pdf$/i

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

    const paperType = textOf(b.paperType) ?? ''
    if (!(PAPER_TYPES as readonly string[]).includes(paperType)) fields.paperType = PAPER_MSG.type

    const subject = textOf(b.subject) ?? ''
    if (subject === '') fields.subject = PAPER_MSG.subject
    else if ([...subject].length > 100) fields.subject = PAPER_MSG.subjectLong

    let levelCode: string | null = null
    const t = b.levelId
    if (t !== undefined && t !== null && t !== '') {
      const n = intOf(typeof t === 'string' ? t.replace(/^T/i, '') : t)
      if (n === undefined || n < 1 || n > 5) fields.levelId = PAPER_MSG.level
      else levelCode = `T${String(n)}`
    }

    let year = new Date(ctx.clock.now()).getUTCFullYear()
    const y = b.year
    if (y !== undefined && y !== null && y !== '') {
      const n = intOf(y)
      if (n === undefined || n < 2000 || n > 2099) fields.year = PAPER_MSG.year
      else year = n
    }

    const author = textOf(b.preparedBy) ?? ''
    if ([...author].length > 150) fields.preparedBy = PAPER_MSG.author
    const note = textOf(b.note) ?? ''
    if ([...note].length > 1000) fields.note = PAPER_MSG.note
    const confirm = String(b.answerSchemeConfirmed ?? '')
      .trim()
      .toLowerCase()
    if (!['true', '1', 'on'].includes(confirm)) fields.answerSchemeConfirmed = PAPER_MSG.confirm

    const list = listOf(b, 'files') ?? []
    const files = list.flatMap((v) => {
      const f = fileOf(v)
      return f ? [f] : []
    })
    if (files.length === 0) fields.files = PAPER_MSG.files
    else if (files.length > MAX_FILES) fields.files = PAPER_MSG.tooMany
    else if (files.some((f) => !PAPER_EXT.test(f.name))) fields.files = PAPER_MSG.fileType
    else if (files.some((f) => f.size > MAX_FILE_BYTES)) fields.files = PAPER_MSG.fileSize
    else if (files.some((f) => SCANNED_PDF.test(f.name))) fields.files = PAPER_MSG.scanned

    if (Object.keys(fields).length > 0) return validationError(fields)
    const row = submissions.create(
      {
        teacherId: viewerId(req),
        subjectText: subject,
        levelCode,
        year,
        paperType: PAPER_LABELS[paperType as keyof typeof PAPER_LABELS],
        authorCredit: author === '' ? 'Kiriman guru' : author,
        note: note === '' ? null : note,
        files: files.map((f) => ({ name: f.name, size: f.size, mime: f.type })),
      },
      ctx.clock.now(),
    )
    return created({ batchId: row.id })
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
        'Template Set Audio KBAT',
        'Isi satu baris bagi setiap set. Muat naik fail audio melalui borang "Cipta Set" di /guru/audio-kbat.',
        [WORD_HEADINGS, WORD_EXAMPLE],
      ),
    )
    return blob(new Blob([bytes], { type: DOCX_TYPE }), 'template-audio-kbat.docx')
  }),
]
