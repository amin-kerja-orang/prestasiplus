import { Inject, Injectable } from '@nestjs/common'
import type { PracticeReadStructuredAttemptResult, PracticeReadStructuredDetail, PracticeReadStructuredListResponseSchema } from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../../../common/errors/api-error'
import { listMeta } from '../../../../common/http/respond'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idToString } from '../../../../db/ids'
import { CurriculumRepository } from '../../../curriculum'
import { QuestionsRepository, type QuestionRecord } from '../../../questions'
import { SchoolsRepository } from '../../../schools'
import { UsersRepository } from '../../../users'
import { StructuredAttemptsRepository } from './attempts.repository'
import { StructuredListingRepository } from './listing.repository'
import { flatten, type SubQuestion } from './flatten'
import {
  BAHASA_SUBJECT_CODES,
  DEFAULT_AUTHOR,
  KBAT_LEVELS,
  MAX_ANSWER_CHARS,
  MESSAGES,
  PREVIEW_LENGTH,
  STRUCTURED_LEVEL_CODES,
  STRUCTURED_PAGE_SIZE,
  SUBJEKTIF_SUBJECT_CODES,
  markStructured,
} from './rules'

type Scope = 'spm' | null
type Track = 'bahasa' | null

export interface StructuredCaller {
  userId: string
  isTest: boolean
}

/** The raw query values of the list and detail routes (a repeated key arrives as an array: the first wins). */
export type RawQuery = Record<string, unknown>

const first = (query: RawQuery, key: string): string | undefined => {
  const v = query[key]
  const one = Array.isArray(v) ? v[0] : v
  return typeof one === 'string' ? one : undefined
}

/** `scope` is `spm` or ignored; `track` is `bahasa` only together with `scope=spm`. */
function variant(query: RawQuery): { scope: Scope; track: Track } {
  const scope: Scope = first(query, 'scope')?.trim() === 'spm' ? 'spm' : null
  const track: Track = scope === 'spm' && first(query, 'track')?.trim() === 'bahasa' ? 'bahasa' : null
  return { scope, track }
}

type Filter = { kind: 'none' } | { kind: 'value'; value: string } | { kind: 'nothing' }

/** Empty or absent = no filter; a non-number matches nothing (SRS section 5). */
function filterOf(query: RawQuery, key: string): Filter {
  const raw = first(query, key)?.trim()
  if (raw === undefined || raw === '') return { kind: 'none' }
  return /^\d{1,18}$/.test(raw) ? { kind: 'value', value: raw.replace(/^0+(?=\d)/, '') } : { kind: 'nothing' }
}

/** The page: a missing or invalid value means page 1 (Laravel). */
function pageOf(query: RawQuery): number {
  const raw = first(query, 'page')?.trim()
  if (raw === undefined || !/^\d+$/.test(raw)) return 1
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const preview = (text: string): string => (text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}...` : text)

const totalMarks = (subs: readonly SubQuestion[]): number => subs.reduce((n, s) => n + s.marks, 0)

/** KBAT 1 to 6 (BR-23): the cognitive level of the live version, 1 when the set has none. */
const kbatOf = (r: QuestionRecord): number => Math.min(6, Math.max(1, r.version.cognitiveLevel ?? 1))

const invalid = (fields: Record<string, string>): ApiError => {
  const [message] = Object.values(fields)
  return ApiError.of('VALIDATION_ERROR', { message: message ?? 'The given data was invalid.', fields })
}

/**
 * Structured questions for students (S10, Q3) and the attempt (#15 to #17). The sets are read from the
 * BE-09 bank through `QuestionsRepository` only: the LIVE version of a published, active set of
 * Tingkatan 4 or 5 (BR-M04-03). Model answers and keys never leave in a read; they come back in the
 * attempt result.
 *
 * Marking is the mock placeholder (LS-7): see `markStructured`. `@pp/exam-core` is not used: the wire
 * carries free text per sub-question (no option, number or mapping kind), and the subjective modes it
 * marks need a human or AI mark, so it does not map onto the mock's rule.
 */
@Injectable()
export class StructuredService {
  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(StructuredAttemptsRepository) private readonly attempts: StructuredAttemptsRepository,
    @Inject(StructuredListingRepository) private readonly listing: StructuredListingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- lookups -------------------------------------------------------------------------------------

  private async levels(): Promise<Map<string, string>> {
    const all = await this.curriculum.levels()
    return new Map(all.filter((l) => STRUCTURED_LEVEL_CODES.includes(l.code)).map((l) => [idToString(l.id), l.name]))
  }

  private async subjects(): Promise<Map<string, { code: string; name: string; active: boolean }>> {
    const all = await this.curriculum.subjects()
    return new Map(all.map((s) => [idToString(s.id), { code: s.code, name: s.name, active: s.isActive }]))
  }

  private async getVisible(id: string, levels: Map<string, string>): Promise<QuestionRecord | null> {
    const r = await this.questions.get(id, 'live')
    if (!r || !r.isActive || r.version.status !== 'published' || r.version.type !== 'structured') return null
    return r.version.educationLevelId !== null && levels.has(r.version.educationLevelId) ? r : null
  }

  private subjectOptions(scope: Scope, track: Track, subjects: Map<string, { code: string; name: string; active: boolean }>): { id: string; name: string }[] {
    if (scope === null) {
      return [...subjects.entries()]
        .filter(([, s]) => s.active)
        .map(([id, s]) => ({ id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
    }
    const byCode = new Map([...subjects.entries()].map(([id, s]) => [s.code, { id, name: s.name }]))
    return (track === 'bahasa' ? BAHASA_SUBJECT_CODES : SUBJEKTIF_SUBJECT_CODES).flatMap((code) => {
      const s = byCode.get(code)
      return s ? [s] : []
    })
  }

  /** Author name and school: a teacher creator shows both, any other creator "Guru Pakar" (no school). */
  private async authors(records: readonly QuestionRecord[]): Promise<Map<string, { author: string; school: string | null }>> {
    const out = new Map<string, { author: string; school: string | null }>()
    for (const creatorId of new Set(records.map((r) => r.createdById).filter((v): v is string => v !== null))) {
      const user = await this.users.get(creatorId)
      if (!user || !user.roles.includes('teacher')) continue
      const school = user.schoolId !== null ? await this.schools.get(user.schoolId) : null
      out.set(creatorId, { author: user.name, school: school?.name ?? null })
    }
    return out
  }

  // --- #15 list ------------------------------------------------------------------------------------

  async list(query: RawQuery): Promise<z.output<typeof PracticeReadStructuredListResponseSchema>> {
    const { scope, track } = variant(query)
    const [levels, subjects] = await Promise.all([this.levels(), this.subjects()])
    const options = this.subjectOptions(scope, track, subjects)
    const page = pageOf(query)
    const subject = filterOf(query, 'subjectId')
    const kbat = filterOf(query, 'kbatLevel')

    const empty =
      subject.kind === 'nothing' ||
      kbat.kind === 'nothing' ||
      (kbat.kind === 'value' && !KBAT_LEVELS.includes(Number(kbat.value))) ||
      (scope !== null && subject.kind === 'value' && !options.some((o) => o.id === subject.value)) ||
      (scope === null && subject.kind === 'value' && !subjects.has(subject.value))

    let slice: QuestionRecord[] = []
    let total = 0
    if (!empty) {
      // One id query (filters, order, LIMIT/OFFSET) and one count; only the page slice is hydrated.
      const res = await this.listing.page({
        levelIds: [...levels.keys()],
        subjectIds: subject.kind === 'value' ? [subject.value] : scope !== null ? options.map((o) => o.id) : null,
        kbat: kbat.kind === 'value' ? Number(kbat.value) : null,
        // Tracking A Bahasa: BM sets before BI sets. The Subjektif variant merges the subjects newest first.
        subjectOrder: track === 'bahasa' && subject.kind !== 'value',
        limit: STRUCTURED_PAGE_SIZE,
        offset: (page - 1) * STRUCTURED_PAGE_SIZE,
      })
      total = res.total
      slice = await this.questions.getMany(res.ids, 'live')
    }
    const authors = await this.authors(slice)
    const data = slice.map((r) => {
      const subs = flatten(r.id, r.version.parts)
      const who = (r.createdById !== null ? authors.get(r.createdById) : undefined) ?? { author: DEFAULT_AUTHOR, school: null }
      const sid = r.version.subjectId
      return {
        id: r.id,
        subjectId: sid ?? '',
        subjectName: (sid !== null ? subjects.get(sid)?.name : undefined) ?? '',
        kbatLevel: kbatOf(r),
        // v2 has no estimated-minutes column: one mark is one minute (same as BE-09's structured detail).
        estimatedMinutes: totalMarks(subs),
        isTrial: false,
        preview: preview(r.version.stemMs ?? r.version.parts[0]?.prompt.ms ?? ''),
        topic: null,
        author: who.author,
        school: who.school,
        subQuestionCount: subs.length,
        levelName: levels.get(r.version.educationLevelId ?? '') ?? '',
        parts: subs.filter((s) => s.top).length,
        marks: totalMarks(subs),
      }
    })
    return { data, meta: { ...listMeta(page, STRUCTURED_PAGE_SIZE, total), scope, track, subjectOptions: options } }
  }

  // --- #16 detail ----------------------------------------------------------------------------------

  async detail(id: string, query: RawQuery): Promise<PracticeReadStructuredDetail> {
    const levels = await this.levels()
    const q = await this.getVisible(id, levels)
    if (!q) throw ApiError.of('NOT_FOUND', { message: MESSAGES.notFound })
    const { scope, track } = variant(query)
    const subjects = await this.subjects()
    const sid = q.version.subjectId ?? ''
    return {
      id: q.id,
      subjectId: sid,
      subjectName: subjects.get(sid)?.name ?? '',
      levelName: levels.get(q.version.educationLevelId ?? '') ?? '',
      stimulus: q.version.stemMs ?? '',
      // The bank stores the image as a file id; there is no student URL for it yet (BE-04 owns file URLs).
      stimulusImage: null,
      subQuestions: flatten(q.id, q.version.parts).map((s) => ({ id: s.id, label: s.label, text: s.text, marks: s.marks })),
      backUrl:
        scope === null
          ? '/latihan-berstruktur'
          : `/latihan-berstruktur?subject_id=${sid}&scope=spm${track === 'bahasa' ? '&track=bahasa' : ''}`,
    }
  }

  // --- #17 attempt ---------------------------------------------------------------------------------

  async attempt(caller: StructuredCaller, id: string, body: unknown): Promise<PracticeReadStructuredAttemptResult> {
    const levels = await this.levels()
    const q = await this.getVisible(id, levels)
    if (!q) throw ApiError.of('NOT_FOUND', { message: MESSAGES.notFound })
    const b = isObject(body) ? body : {}

    // scope / track: optional; only `spm` / `bahasa` (or null) are accepted, and `track` needs scope 'spm'.
    const rawScope = b.scope ?? null
    const rawTrack = b.track ?? null
    if (rawScope !== null && rawScope !== 'spm') throw invalid({ scope: MESSAGES.invalidScope })
    if (rawTrack !== null && (rawTrack !== 'bahasa' || rawScope !== 'spm')) throw invalid({ track: MESSAGES.invalidScope })
    const scope: Scope = rawScope === 'spm' ? 'spm' : null
    const track: Track = rawTrack === 'bahasa' ? 'bahasa' : null

    const subs = flatten(q.id, q.version.parts)
    const raw = b.answers
    if (!Array.isArray(raw)) throw invalid({ answers: MESSAGES.invalidAnswer })
    const valid = new Set(subs.map((s) => s.id))
    const answers = new Map<string, string>()
    for (const [i, a] of raw.entries()) {
      const key = `answers.${String(i)}`
      if (!isObject(a) || typeof a.subQuestionId !== 'string' || typeof a.text !== 'string') throw invalid({ [key]: MESSAGES.invalidAnswer })
      if (!valid.has(a.subQuestionId) || answers.has(a.subQuestionId)) throw invalid({ [key]: MESSAGES.invalidAnswer })
      if (a.text.length > MAX_ANSWER_CHARS) throw invalid({ [key]: MESSAGES.answerTooLong(MAX_ANSWER_CHARS) })
      answers.set(a.subQuestionId, a.text)
    }

    const marks = markStructured(subs, answers)
    const totalAwarded = marks.reduce((n, m) => n + m.awarded, 0)
    const totalMax = marks.reduce((n, m) => n + m.max, 0)
    const submittedAt = this.clock.now()
    const stored = [...answers].map(([subQuestionId, text]) => ({ subQuestionId, text }))
    const attemptId = await this.attempts.add({
      userId: caller.userId,
      questionId: q.id,
      questionVersionNo: q.version.versionNo,
      scope,
      track,
      answers: stored,
      marks,
      totalAwarded,
      totalMax,
      submittedAt,
      isTest: caller.isTest,
    })
    return {
      id: attemptId,
      userId: caller.userId,
      structuredQuestionId: q.id,
      scope,
      track,
      answers: stored,
      marks,
      totalAwarded,
      totalMax,
      submittedAt: toMytTimestamp(submittedAt),
      modelAnswers: subs.map((s) => ({ subQuestionId: s.id, text: s.modelAnswer })),
    }
  }
}
