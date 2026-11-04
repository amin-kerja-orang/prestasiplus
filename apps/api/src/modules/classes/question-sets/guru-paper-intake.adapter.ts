import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { INTAKE_FILE_MESSAGES, type QuestionSetPaper } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { idToString } from '../../../db/ids'
import { detectOffice, inspectUpload } from '../../files/content-inspect'
import { FilesConfig } from '../../files/files.config'
import { IntakeFilesService } from '../../intake/files/intake-files.service'
import { IntakeUploadService } from '../../intake/files/intake-upload.service'
import { PDF_ENGINE, type PdfEngine } from '../../ocr'
import { intakeTeacherEnabled } from '../../intake/intake-teacher.gate'
import { type PaperSubmission, type QuestionPaperIntakePort } from './question-sets.ports'

/** OPT-JENIS-HANTARAN (docs/prd/r1/40-cross-cutting.md): the declaration label to the stored slug. Unknown reads as `lain`. */
export const GURU_PAPER_TYPE_SLUGS: Readonly<Record<string, string>> = {
  'Soalan Umum': 'umum',
  'Trial Paper': 'trial',
  'Soalan DSKP': 'dskp',
  'Buku Teks': 'buku_teks',
  'Buku Latihan': 'buku_latihan',
  'Soalan Peperiksaan': 'peperiksaan',
  'Lain-lain': 'lain',
}

/** ERR-REQ-04 with the list of what the guru path accepts (FR-GUR-44-13). */
export const GURU_PAPER_TYPE_REFUSED = 'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.'
/** Field table of 20 FR-GUR-44-13 (D-26): refusal of a PDF with no extractable text on its first 3 pages. */
export const GURU_PAPER_SCANNED_REFUSED = 'PDF imbasan imej tidak diterima — teks mesti boleh disalin.'
const SCAN_CHECK_PAGES = 3
const DEFAULT_SOURCE_TEXT = 'Kiriman guru'

function refuse(message: string): ApiError {
  return ApiError.of('VALIDATION_ERROR', { fields: { files: message } })
}

/**
 * The real paper intake of the teacher "Hantar Kertas Soalan" (S1-T08, API-GUR-17): refuses what is not a text PDF, DOCX or XLSX, creates an
 * intake batch with `source = 'guru'` owned by the teacher and stores the files through the same upload pipeline as the admin
 * (magic bytes, page limits, duplicates, jobs). The level is not stored (no column until DM-09).
 */
@Injectable()
export class GuruPaperIntakeAdapter implements QuestionPaperIntakePort {
  constructor(
    @Inject(IntakeFilesService) private readonly batches: IntakeFilesService,
    @Inject(IntakeUploadService) private readonly uploads: IntakeUploadService,
    @Inject(PDF_ENGINE) private readonly pdf: PdfEngine,
    @Inject(FilesConfig) private readonly filesConfig: FilesConfig,
    @Inject(ConfigService) private readonly config: Pick<ConfigService, 'get'>,
  ) {}

  async submit(input: PaperSubmission): Promise<QuestionSetPaper> {
    const { declaration: d } = input
    // Defence in depth: the route already has IntakeTeacherGate; the same 403 here if the adapter is ever reached another way.
    // PRECONDITION: INTAKE_TEACHER_ENABLED must stay off in production until AZ-35 ClamAV scanning of uploads is live (OOXML files are
    // stored unopened and an admin opens them on a desktop; a macro-bearing file passes the content check).
    if (input.auth.active.role === 'teacher' && !intakeTeacherEnabled(this.config.get<unknown>('INTAKE_TEACHER_ENABLED'))) throw ApiError.of('FORBIDDEN')
    // Refusals first, so no batch is created for a file that cannot be accepted.
    for (const f of input.files) await this.assertAcceptable(f.buffer)

    const who = { ip: input.ip, requestId: input.requestId }
    const author = d.authorCredit.trim()
    const batchId = await this.batches.createGuruBatch(
      input.auth,
      {
        paperType: GURU_PAPER_TYPE_SLUGS[d.paperType] ?? 'lain',
        subject: d.subjectText,
        year: d.year,
        sourceText: author === '' ? DEFAULT_SOURCE_TEXT : author.slice(0, 200),
        note: d.note,
      },
      who,
    )
    const id = idToString(batchId)
    let uploaded
    try {
      uploaded = await this.uploads.upload(input.auth, id, input.files.map((f) => ({ buffer: f.buffer, originalname: f.name })), who, undefined, { acceptOffice: true })
    } catch (err) {
      await this.batches.discardEmptyBatch(batchId)
      throw err
    }
    const detail = await this.batches.getBatch(input.auth, id)
    return {
      id,
      teacherId: input.teacherId,
      subjectText: d.subjectText,
      levelCode: d.levelCode,
      year: d.year,
      paperType: d.paperType,
      authorCredit: d.authorCredit,
      note: d.note,
      files: uploaded.files.map((f, index) => ({ index, name: f.originalName, size: f.sizeBytes, mime: detectOffice(input.files[index]?.buffer ?? Buffer.alloc(0)) ?? 'application/pdf' })),
      status: detail.status === 'processing' ? 'processing' : 'pending',
      adminNotes: null,
      createdAt: toMytTimestamp(input.at),
    }
  }

  /** DOCX/XLSX by content (stored as they are), or a PDF with a text layer on at least one of its first 3 pages. Anything else is refused. */
  private async assertAcceptable(buffer: Buffer): Promise<void> {
    // Size first (cheap), before any parsing of the content.
    if (buffer.length === 0) throw refuse(GURU_PAPER_TYPE_REFUSED)
    if (buffer.length > this.filesConfig.intakeMaxBytes) throw refuse(INTAKE_FILE_MESSAGES.size(Math.floor(this.filesConfig.intakeMaxBytes / (1024 * 1024))))
    if (detectOffice(buffer)) return
    const inspected = inspectUpload(buffer)
    if (!inspected || inspected.mime !== 'application/pdf') throw refuse(GURU_PAPER_TYPE_REFUSED)
    let pages: number
    try {
      pages = (await this.pdf.inspect(buffer)).pageCount
    } catch {
      // Encrypted, corrupt or too complex: the upload pipeline reports it with its own message when the batch is stored.
      return
    }
    for (let n = 1; n <= Math.min(SCAN_CHECK_PAGES, pages); n += 1) {
      const page = await this.pdf.extractText(buffer, n).catch(() => null)
      if (page !== null && page.text.trim() !== '') return
    }
    throw refuse(GURU_PAPER_SCANNED_REFUSED)
  }
}
