import { Inject, Injectable } from '@nestjs/common'
import {
  AUDIO_ADMIN_MAX_PAGE_SIZE,
  AUDIO_ADMIN_PAGE_SIZE,
  AUDIO_SECTION_COUNT,
  AUDIO_STATUS_LABELS,
  AudioKbatAttemptRequestSchema,
  CONTENT_FLASH,
  CONTENT_MESSAGES,
  type AdminAudioKbatCreatedSchema,
  type AdminAudioKbatListResponseSchema,
  type AudioKbatPlaySet,
  type AudioKbatStatus,
} from '@pp/contract'
import type { z } from 'zod'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import type { TxClient } from '../../../db/client'
import { isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { CurriculumRepository } from '../../curriculum'
import { FilesService } from '../../files'
import { AUDIO_AUDIT, PUBLIC_FILE_ID, WRITE_TX } from './audio.constants'
import { withoutNul } from './null-char'
import { parseCreateForm, type ParsedSetInput, type UploadedPart } from './audio-form'
import {
  AudioRepository,
  type AdminFilter,
  type SetRow,
  type StoredQuestion,
  type StoredSection,
} from './audio.repository'

const REQUIRED = CONTENT_MESSAGES.fieldRequired
const INVALID = CONTENT_MESSAGES.fieldInvalid
const FILTER_STATUSES = Object.keys(AUDIO_STATUS_LABELS) as AudioKbatStatus[]

/** Who is acting: the signed-in user and the request facts the audit row needs. */
export interface Actor {
  userId: string
  role: string
  sessionRowId: string
  scopeLevel: string
  schoolId: string | null
  isTest: boolean
  requestId: string | null
  ip: string | null
}

export interface AdminListQuery {
  educationLevelId?: string | undefined
  subjectId?: string | undefined
  status?: string | undefined
  search?: string | undefined
  page?: string | undefined
  pageSize?: string | undefined
}

export interface AudioBytes {
  bytes: Buffer
  contentType: string
}

type AttemptBody = z.infer<typeof AudioKbatAttemptRequestSchema>
type AdminAudioKbatCreated = z.infer<typeof AdminAudioKbatCreatedSchema>
type AdminAudioKbatListResponse = z.infer<typeof AdminAudioKbatListResponseSchema>

/** Level and subject names by id (BE-08), for the `{ id, name }` references of the wire. */
interface Refs {
  level(id: string): { id: string; name: string }
  subject(id: string): { id: string; name: string }
  hasLevel(id: string): boolean
  hasSubject(id: string): boolean
}

/** The field of a curriculum FK violation (P2003 on the audio set's level or subject FK), or null for any other error. */
export function curriculumFkField(err: unknown): 'educationLevelId' | 'subjectId' | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown }
  if (e.code === 'P2003' || (typeof e.message === 'string' && e.message.includes('Foreign key constraint'))) {
    let text = typeof e.message === 'string' ? e.message : ''
    try {
      text += JSON.stringify(e.meta ?? {}) + JSON.stringify(e.cause ?? {})
    } catch {
      // an unserialisable detail only narrows the text
    }
    if (text.includes('fk_audio_kbat_sets_education_level_id') || text.includes('education_level_id')) return 'educationLevelId'
    if (text.includes('fk_audio_kbat_sets_subject_id') || text.includes('subject_id')) return 'subjectId'
    return null
  }
  return e.cause !== undefined && e.cause !== err ? curriculumFkField(e.cause) : null
}

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

function invalid(fields: Record<string, string>): ApiError {
  const messages = Object.values(fields)
  const [first] = messages
  const more = messages.length - 1
  const message = first === undefined ? 'The given data was invalid.' : more === 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
  return ApiError.of('VALIDATION_ERROR', { fields, message })
}

/** Page number: missing, non-numeric or below 1 is page 1 (never rejected). */
function positiveInt(raw: string | undefined): number | null {
  const t = raw?.trim() ?? ''
  return /^\d{1,9}$/.test(t) && Number(t) >= 1 ? Number(t) : null
}

const idOrUndefined = (raw: string | undefined): string | undefined => {
  const t = raw?.trim()
  return t !== undefined && /^[1-9]\d{0,18}$/.test(t) && isIdString(t) ? t : undefined
}

@Injectable()
export class AudioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AudioRepository) private readonly repo: AudioRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  /** All levels and subjects once per request: the curriculum is small (a few dozen rows). */
  private async refs(): Promise<Refs> {
    const [levels, subjects] = await this.guard(() => Promise.all([this.curriculum.levels(), this.curriculum.subjects()]))
    const lv = new Map(levels.map((l) => [String(l.id), l.name]))
    const sb = new Map(subjects.map((x) => [String(x.id), x.name]))
    return {
      // An id that is no longer in the curriculum cannot happen (RESTRICT FKs); the empty name is only a fallback.
      level: (id) => ({ id, name: lv.get(id) ?? '' }),
      subject: (id) => ({ id, name: sb.get(id) ?? '' }),
      hasLevel: (id) => lv.has(id),
      hasSubject: (id) => sb.has(id),
    }
  }

  // --- student play ------------------------------------------------------------------------------

  /** GET /audio-kbat-sets: approved sets only. A malformed filter id is ignored, as the mock ignores a non-integer. */
  async listApproved(query: { educationLevelId?: string | undefined; subjectId?: string | undefined }) {
    const educationLevelId = idOrUndefined(query.educationLevelId)
    const subjectId = idOrUndefined(query.subjectId)
    const rows = await this.guard(() =>
      this.repo.listApproved({ ...(educationLevelId ? { educationLevelId } : {}), ...(subjectId ? { subjectId } : {}) }),
    )
    const refs = await this.refs()
    return {
      data: rows.map((r) => ({ id: r.id, title: r.title, educationLevel: refs.level(r.educationLevelId), subject: refs.subject(r.subjectId) })),
      meta: listMeta(1, Math.max(1, rows.length), rows.length),
    }
  }

  /**
   * GET /audio-kbat-sets/:id. The wire shape is built field by field from the stored set: the correct answer, the
   * explanation, the KBAT level and the DSKP link are never copied (and the contract schema is strict).
   */
  async play(id: string): Promise<AudioKbatPlaySet> {
    const set = await this.guard(() => this.repo.getApproved(id))
    if (!set) throw notFound()
    return {
      id: set.id,
      title: set.title,
      instructions: set.instructions,
      sections: set.sections.map((section) => ({
        no: section.no,
        title: section.title,
        audioUrl: section.audioFileId && PUBLIC_FILE_ID.test(section.audioFileId) ? `/api/audio-kbat-sets/${set.id}/sections/${String(section.no)}/audio` : null,
        questions: set.questions
          .filter((q) => q.no >= section.questionFrom && q.no <= section.questionTo)
          .map((q) => ({ no: q.no, questionText: q.questionText, options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }, marks: q.marks })),
      })),
    }
  }

  /** The bytes of one section's audio of an approved set (authenticated). This is the ONLY student path to an audio_kbat file. */
  async audio(id: string, sectionNo: string): Promise<AudioBytes> {
    const set = await this.guard(() => this.repo.getApproved(id))
    const no = /^[1-9]$/.test(sectionNo) ? Number(sectionNo) : 0
    const section = set?.sections.find((s) => s.no === no)
    const fileId = section?.audioFileId
    if (!fileId || !PUBLIC_FILE_ID.test(fileId)) throw notFound()
    // The files module checks the purpose: only an audio_kbat file is ever read here.
    const file = await this.files.readManaged(fileId, 'audio_kbat')
    if (!file) throw notFound()
    return { bytes: file.bytes, contentType: file.mime }
  }

  /**
   * POST /audio-kbat-sets/:id/attempts. The set is looked up first (404 before the body is judged). The answers are
   * marked here from the stored key; the client never sees it. One attempt row per submit.
   */
  async attempt(actor: Actor, id: string, rawBody: unknown): Promise<{ score: number; totalMarks: number }> {
    const set = await this.guard(() => this.repo.getApproved(id))
    if (!set) throw notFound()
    const body = this.parseAttempt(rawBody, set)
    const { score, totalMarks } = mark(set.questions, body.answers)
    const now = this.clock.now()
    await this.write(async (tx) => {
      const attemptId = await this.repo.createAttempt({
        setId: set.id,
        userId: actor.userId,
        answers: body.answers.map((a) => ({ no: a.no, choice: a.choice })),
        score,
        totalMarks,
        isTest: actor.isTest,
        now,
      })
      await this.audit.record({
        tx,
        ...this.auditBase(actor, AUDIO_AUDIT.ATTEMPT_SUBMITTED),
        targetType: 'audio_kbat_attempt',
        targetId: attemptId,
        details: { setId: set.id, score, totalMarks, answered: body.answers.length },
      })
    })
    return { score, totalMarks }
  }

  // --- admin -------------------------------------------------------------------------------------

  async adminList(query: AdminListQuery): Promise<AdminAudioKbatListResponse> {
    const page = positiveInt(query.page) ?? 1
    const size = Math.min(positiveInt(query.pageSize) ?? AUDIO_ADMIN_PAGE_SIZE, AUDIO_ADMIN_MAX_PAGE_SIZE)
    const status = (query.status ?? '').trim()
    const educationLevelId = idOrUndefined(query.educationLevelId)
    const subjectId = idOrUndefined(query.subjectId)
    const filter: AdminFilter = {
      ...(educationLevelId ? { educationLevelId } : {}),
      ...(subjectId ? { subjectId } : {}),
      // An unknown status value is ignored (the select only offers real ones).
      ...(FILTER_STATUSES.includes(status as AudioKbatStatus) ? { status: status as AudioKbatStatus } : {}),
      search: withoutNul(query.search ?? '').trim().slice(0, 200),
    }
    const [{ rows, total }, stats] = await this.guard(() => Promise.all([this.repo.adminList(filter, (page - 1) * size, size), this.repo.stats()]))
    const refs = await this.refs()
    return {
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        educationLevel: refs.level(r.educationLevelId),
        subject: refs.subject(r.subjectId),
        status: r.status,
        statusLabel: AUDIO_STATUS_LABELS[r.status],
        questionCount: r.questionCount,
      })),
      meta: { ...listMeta(page, size, total), stats },
    }
  }

  /**
   * POST /admin/audio-kbat-sets. Validation first (nothing is stored when a field is wrong), then the audio files are
   * stored, then the set and its audit row commit together; if that fails the stored files are removed again.
   */
  async create(actor: Actor, rawBody: unknown, files: readonly UploadedPart[]): Promise<{ data: AdminAudioKbatCreated; status: string }> {
    const { value, fields } = parseCreateForm(rawBody, files)
    // The level and the subject must exist in the curriculum (BE-08); a malformed id was already refused above.
    const refs = await this.refs()
    if (!fields.educationLevelId && !refs.hasLevel(value.educationLevelId)) fields.educationLevelId = INVALID
    if (!fields.subjectId && !refs.hasSubject(value.subjectId)) fields.subjectId = INVALID
    if (Object.keys(fields).length > 0) throw invalid(fields)

    const stored: string[] = []
    try {
      const sections: StoredSection[] = []
      for (const s of value.sections) {
        let audioFileId: string | null = null
        if (s.audio) {
          // Through the files module: type from the bytes, 20 MB rule, a `files` row of purpose audio_kbat.
          const file = await this.files.storeManaged({ ownerUserId: actor.userId, purpose: 'audio_kbat', bytes: s.audio.bytes, isTest: actor.isTest })
          audioFileId = file.publicId
          stored.push(file.publicId)
        }
        sections.push({
          no: s.no,
          title: s.title,
          audioFileId,
          audioFileName: s.audio?.fileName ?? null,
          transcript: s.transcript,
          questionFrom: s.questionFrom,
          questionTo: s.questionTo,
        })
      }
      const questions: StoredQuestion[] = value.questions.map((q) => ({ ...q }))
      const now = this.clock.now()
      const created = await this.write(async (tx) => {
        const row = await this.repo.createSet({ ...pickSet(value), sections, questions, createdById: actor.userId, now })
        await this.audit.record({
          tx,
          ...this.auditBase(actor, AUDIO_AUDIT.SET_CREATED),
          targetType: 'audio_kbat_set',
          targetId: row.id,
          details: { setId: row.id, status: value.status, sections: AUDIO_SECTION_COUNT, questions: questions.length, audioFiles: stored.length },
        })
        return row
      })
      return {
        data: {
          id: created.id,
          title: value.title,
          educationLevel: refs.level(value.educationLevelId),
          subject: refs.subject(value.subjectId),
          status: value.status,
          statusLabel: AUDIO_STATUS_LABELS[value.status],
          questionCount: questions.length,
          sourceLabel: value.sourceLabel,
          instructions: value.instructions,
          sections: sections.map((s) => ({
            no: s.no,
            title: s.title,
            audioFileName: s.audioFileName,
            transcript: s.transcript,
            questionFrom: s.questionFrom,
            questionTo: s.questionTo,
          })),
          createdAt: toMytTimestamp(created.createdAt),
        },
        status: CONTENT_FLASH.audioCreated,
      }
    } catch (err) {
      for (const id of stored) await this.files.discard(id, 'audio_kbat')
      // The level or subject was deleted between the check and the insert (RESTRICT FK, Prisma P2003): same 422 as the check.
      const fk = curriculumFkField(err)
      if (fk) throw invalid({ [fk]: INVALID })
      throw err
    }
  }

  // --- helpers -----------------------------------------------------------------------------------

  /** `answers` missing (or empty) is "required"; anything else wrong is "invalid"; an unknown question number is "invalid". */
  private parseAttempt(raw: unknown, set: SetRow): AttemptBody {
    const body = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    const answers = body.answers
    if (answers === undefined || answers === null || (Array.isArray(answers) && answers.length === 0)) throw invalid({ answers: REQUIRED })
    const parsed = AudioKbatAttemptRequestSchema.safeParse({ answers })
    if (!parsed.success) throw invalid({ answers: INVALID })
    const known = new Set(set.questions.map((q) => q.no))
    if (parsed.data.answers.some((a) => !known.has(a.no))) throw invalid({ answers: INVALID })
    return parsed.data
  }

  private auditBase(who: Actor, action: string) {
    return {
      action,
      actorUserId: who.userId,
      actorRole: who.role,
      sessionRowId: who.sessionRowId,
      scopeLevel: who.scopeLevel,
      schoolId: who.schoolId,
      requestId: who.requestId,
      ip: who.ip,
      isTest: who.isTest,
    }
  }

  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }

  /** A read: pool or connection overload is 429 (retryable), never a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}

/** Score = sum of the marks of the correct answers; total = sum of the marks of every question (BR-M09-16). */
export function mark(questions: readonly StoredQuestion[], answers: readonly { no: number; choice: string }[]): { score: number; totalMarks: number } {
  const chosen = new Map(answers.map((a) => [a.no, a.choice]))
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
  const score = questions.reduce((sum, q) => (chosen.get(q.no) === q.correctAnswer ? sum + q.marks : sum), 0)
  return { score, totalMarks }
}

function pickSet(v: ParsedSetInput) {
  return {
    title: v.title,
    educationLevelId: v.educationLevelId,
    subjectId: v.subjectId,
    status: v.status,
    sourceLabel: v.sourceLabel,
    instructions: v.instructions,
  }
}
