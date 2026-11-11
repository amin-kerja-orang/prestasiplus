import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { PRACTICE_READS_STRUCTURED_SEARCH_MAX } from '@pp/contract'
import type { PracticeReadStructuredAttemptResult, PracticeReadStructuredDetail, PracticeReadStructuredListResponseSchema } from '@pp/contract'
import type { z } from 'zod'

import { ApiError, DEFAULT_ERROR_MESSAGES } from '../../../../common/errors/api-error'
import { listMeta } from '../../../../common/http/respond'
import { toMytTimestamp } from '../../../../common/time/myt'
import { idToString } from '../../../../db/ids'
import { ownStimuliOf } from '../../../bijak/kuiz/own-stimuli'
import { CurriculumRepository } from '../../../curriculum'
import { FilesService } from '../../../files'
import { mediaFileIds, placeholderStimulus, practiceMediaOf } from '../../question-bridge/practice-media'
import { PracticePorts, type PracticeStructuredAudit } from '../../ports'
import { isStructuredVisible, QuestionsRepository, type QuestionPart, type QuestionRecord } from '../../../questions'
import { SchoolsRepository } from '../../../schools'
import { UsersRepository } from '../../../users'
import { StructuredAttemptsRepository } from './attempts.repository'
import { StructuredListingRepository, type DegradedSet } from './listing.repository'
import { flatten } from './flatten'
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
} from './rules'

type Scope = 'spm' | null
type Track = 'bahasa' | null

export interface StructuredCaller {
  userId: string
  isTest: boolean
  /** Who to attribute the submit audit line to (the session context and request coordinates); absent: a system line. */
  audit?: PracticeStructuredAudit
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

const totalMarks = (subs: readonly { marks: number }[]): number => subs.reduce((n, s) => n + s.marks, 0)

/** KBAT 1 to 6 (BR-23): the cognitive level of the live version, 1 when the set has none. */
const kbatOf = (cognitiveLevel: number | null): number => Math.min(6, Math.max(1, cognitiveLevel ?? 1))

/** What a list card is built from: a hydrated set, or the rows of one the bank cannot hydrate. */
interface CardSource {
  id: string
  createdById: string | null
  stemMs: string | null
  firstPrompt: string
  subjectId: string | null
  cognitive: number
  educationLevelId: string | null
  subs: { top: boolean; marks: number }[]
}

/** The attempt title is the start of the stem (or of the first part). */
const TITLE_MAX_CHARS = 100

const invalid = (fields: Record<string, string>): ApiError => {
  const [message] = Object.values(fields)
  return ApiError.of('VALIDATION_ERROR', { message: message ?? DEFAULT_ERROR_MESSAGES.VALIDATION_ERROR, fields })
}

/** JS twin of `ALL_LEAVES_KEYED_SQL` (the list's `markable` rule): some leaf part has no answer key. */
function hasUnkeyedLeaf(parts: readonly QuestionPart[]): boolean {
  return parts.some((p) => ('mode' in p ? p.key == null : hasUnkeyedLeaf(p.children)))
}

/**
 * Structured questions for students (S10, Q3) and the attempt (#15 to #17). The sets are read from the
 * BE-09 bank through `QuestionsRepository` only: the LIVE version of a published, active set of
 * Tingkatan 4 or 5 (BR-M04-03). Model answers and keys never leave in a read; they come back in the
 * attempt result.
 *
 * The attempt is a Bijak attempt (S5-T11): `PracticePorts.structuredAttempts` creates, grades with the one
 * grader and closes it; this service keeps the body checks and the wire shape. Nothing is written to
 * `structured_attempts` any more (the table and its readers stay).
 */
@Injectable()
export class StructuredService {
  private readonly logger = new Logger(StructuredService.name)

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(StructuredAttemptsRepository) private readonly attempts: StructuredAttemptsRepository,
    @Inject(StructuredListingRepository) private readonly listing: StructuredListingRepository,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
    /** Public tokens of the pictures of the set's stimuli. Absent (a unit test): a set with a picture shows the KP-15 placeholder. */
    @Optional() @Inject(FilesService) private readonly files?: Pick<FilesService, 'publicIdsOf'>,
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
    // Lenient read (as the list's hydrate): a leaf without a key row still parses. A set that is not markable (a leaf without a key, or a
    // present but invalid stored key, which the repository reports as SERVER_ERROR) is not visible: 404, never 500. Same rule as the list.
    let r: QuestionRecord | null
    try {
      r = (await this.questions.getMany([id], 'live', 'exclude', { lenientKeys: true }))[0] ?? null
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SERVER_ERROR') {
        this.logger.warn(`structured ${id}: unreadable stored key, treated as not visible`)
        return null
      }
      throw e
    }
    if (!r || !isStructuredVisible(r, levels)) return null
    return hasUnkeyedLeaf(r.version.parts) ? null : r
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
  private async authors(records: readonly { createdById: string | null }[]): Promise<Map<string, { author: string; school: string | null }>> {
    const out = new Map<string, { author: string; school: string | null }>()
    for (const creatorId of new Set(records.map((r) => r.createdById).filter((v): v is string => v !== null))) {
      const user = await this.users.get(creatorId)
      if (!user || !user.roles.includes('teacher')) continue
      const school = user.schoolId !== null ? await this.schools.get(user.schoolId) : null
      out.set(creatorId, { author: user.name, school: school?.name ?? null })
    }
    return out
  }

  /**
   * Hydrates the page. All at once first (lenient: a leaf without a key row still parses); when that throws (a present but invalid
   * stored key), per set, and the sets that still throw come back as `broken` with their row facts. Logged once, ids only.
   */
  private async hydrate(ids: readonly string[], markable: boolean): Promise<[Map<string, QuestionRecord>, Map<string, DegradedSet>]> {
    const opts = { lenientKeys: true }
    const ok = new Map<string, QuestionRecord>()
    try {
      for (const r of await this.questions.getMany(ids, 'live', 'exclude', opts)) ok.set(r.id, r)
      return [ok, new Map()]
    } catch {
      const bad: string[] = []
      for (const id of ids) {
        try {
          for (const r of await this.questions.getMany([id], 'live', 'exclude', opts)) ok.set(r.id, r)
        } catch {
          bad.push(id)
        }
      }
      if (bad.length > 0) this.logger.warn(`structured list: sets with an unreadable stored key (markable=${String(markable)}): ${bad.join(',')}`)
      return [ok, new Map((await this.listing.degraded(bad)).map((d) => [d.id, d]))]
    }
  }

  // --- #15 list ------------------------------------------------------------------------------------

  async list(caller: StructuredCaller, query: RawQuery): Promise<z.output<typeof PracticeReadStructuredListResponseSchema>> {
    const { scope, track } = variant(query)
    const [levels, subjects] = await Promise.all([this.levels(), this.subjects()])
    const options = this.subjectOptions(scope, track, subjects)
    const page = pageOf(query)
    const subject = filterOf(query, 'subjectId')
    const kbat = filterOf(query, 'kbatLevel')
    const text = first(query, 'q')?.trim() ?? ''
    if (text.length > PRACTICE_READS_STRUCTURED_SEARCH_MAX) throw invalid({ q: MESSAGES.searchTooLong(PRACTICE_READS_STRUCTURED_SEARCH_MAX) })
    const markable = ['1', 'true'].includes(first(query, 'markable')?.trim().toLowerCase() ?? '')

    const empty =
      subject.kind === 'nothing' ||
      kbat.kind === 'nothing' ||
      (kbat.kind === 'value' && !KBAT_LEVELS.includes(Number(kbat.value))) ||
      (scope !== null && subject.kind === 'value' && !options.some((o) => o.id === subject.value)) ||
      (scope === null && subject.kind === 'value' && !subjects.has(subject.value))

    let ids: string[] = []
    let hydrated = new Map<string, QuestionRecord>()
    let broken = new Map<string, DegradedSet>()
    let total = 0
    let pendingSchemeCount = 0
    if (!empty) {
      // One id query (filters, order, LIMIT/OFFSET) and one count; only the page slice is hydrated.
      const res = await this.listing.page({
        levelIds: [...levels.keys()],
        subjectIds: subject.kind === 'value' ? [subject.value] : scope !== null ? options.map((o) => o.id) : null,
        kbat: kbat.kind === 'value' ? Number(kbat.value) : null,
        // Tracking A Bahasa: BM sets before BI sets. The Subjektif variant merges the subjects newest first.
        subjectOrder: track === 'bahasa' && subject.kind !== 'value',
        q: text === '' ? null : text,
        markable,
        limit: STRUCTURED_PAGE_SIZE,
        offset: (page - 1) * STRUCTURED_PAGE_SIZE,
      })
      total = res.total
      pendingSchemeCount = res.pendingScheme
      ids = res.ids
      ;[hydrated, broken] = await this.hydrate(res.ids, markable)
      // A set that cannot be hydrated (present but invalid key) is not markable: dropped under `markable`, else listed from its rows.
      // `pendingSchemeCount` is SQL (a leaf without a key row) and so does not count these: it may undercount broken keys.
      if (markable) ids = ids.filter((id) => !broken.has(id))
    }
    const sources: CardSource[] = ids.flatMap((id) => {
      const r = hydrated.get(id)
      if (r) {
        const subs = flatten(r.id, r.version.parts)
        return [{ id: r.id, createdById: r.createdById, stemMs: r.version.stemMs, firstPrompt: r.version.parts[0]?.prompt.ms ?? '', subjectId: r.version.subjectId, cognitive: kbatOf(r.version.cognitiveLevel), educationLevelId: r.version.educationLevelId, subs }]
      }
      const d = broken.get(id)
      return d ? [{ id: d.id, createdById: d.createdById, stemMs: d.stemMs, firstPrompt: d.firstPrompt, subjectId: d.subjectId, cognitive: kbatOf(d.cognitiveLevel), educationLevelId: d.educationLevelId, subs: d.subs }] : []
    })
    const authors = await this.authors(sources)
    const best = await this.attempts.bestFor(caller.userId, sources.map((r) => r.id))
    const data = sources.map((r) => {
      const subs = r.subs
      const who = (r.createdById !== null ? authors.get(r.createdById) : undefined) ?? { author: DEFAULT_AUTHOR, school: null }
      const sid = r.subjectId
      return {
        id: r.id,
        subjectId: sid ?? '',
        subjectName: (sid !== null ? subjects.get(sid)?.name : undefined) ?? '',
        kbatLevel: r.cognitive,
        // v2 has no estimated-minutes column: one mark is one minute (same as BE-09's structured detail).
        estimatedMinutes: totalMarks(subs),
        isTrial: false,
        preview: preview(r.stemMs ?? r.firstPrompt),
        topic: null,
        author: who.author,
        school: who.school,
        subQuestionCount: subs.length,
        levelName: levels.get(r.educationLevelId ?? '') ?? '',
        parts: subs.filter((s) => s.top).length,
        marks: totalMarks(subs),
        bestScore: best.get(r.id) ?? null,
      }
    })
    return { data, meta: { ...listMeta(page, STRUCTURED_PAGE_SIZE, total), scope, track, subjectOptions: options, pendingSchemeCount } }
  }

  /**
   * The rajah of a set (KP-15, D90/D105): the stimulus of its group and the stimuli linked straight to it, read by the one reader the drills and the
   * quiz use. A linked figure always shows; one that cannot be shown (no file token, shared but not grouped, unknown kind) shows the placeholder
   * "Gambar tiada", never the text without its figure. A set with no stimulus has none.
   */
  private async stimuliOf(q: QuestionRecord): Promise<NonNullable<PracticeReadStructuredDetail['stimuli']>> {
    const group = q.groupId === null ? null : ((await this.questions.groupsByIds([q.groupId]))[0] ?? null)
    const own = await ownStimuliOf(this.questions, [q], new Map(group === null || q.groupId === null ? [] : [[q.groupId, group] as const]))
    const files = mediaFileIds(q, group, own)
    const tokens = files.length === 0 || this.files === undefined ? new Map<string, string>() : await this.files.publicIdsOf(files)
    const media = practiceMediaOf(q, group, own, tokens)
    if (media === null) return [placeholderStimulus(q.id)]
    return media.stimuli
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
      stimuli: await this.stimuliOf(q),
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

    const subjects = await this.subjects()
    const subject = subjects.get(q.version.subjectId ?? '')
    const firstText = q.version.stemMs ?? q.version.parts[0]?.prompt.ms ?? ''
    const stored = [...answers].map(([subQuestionId, text]) => ({ subQuestionId, text }))
    const pathOf = new Map(subs.map((s) => [s.id, s.label]))
    const graded = await this.ports.structuredAttempts.submit({
      userId: caller.userId,
      isTest: caller.isTest,
      ...(caller.audit ? { audit: caller.audit } : {}),
      questionId: q.id,
      versionNo: q.version.versionNo,
      title: firstText.trim().slice(0, TITLE_MAX_CHARS) || null,
      subject: subject?.code ?? null,
      subjectName: subject?.name ?? null,
      scope,
      track,
      answers: stored.map((a) => ({ path: pathOf.get(a.subQuestionId) as string, text: a.text })),
    })
    const byPath = new Map(graded.parts.map((p) => [p.path, p]))
    // One entry per sub-question of the set, branches included (max 0). A part the grader leaves to the pupil (`pending`) counts 0 until she marks it.
    const marks = subs.map((s) => {
      const part = byPath.get(s.label)
      return { subQuestionId: s.id, awarded: part?.awarded ?? 0, max: part?.max ?? s.marks }
    })
    const totalAwarded = marks.reduce((n, m) => n + m.awarded, 0)
    const totalMax = marks.reduce((n, m) => n + m.max, 0)
    return {
      id: graded.attemptId,
      attemptId: graded.attemptId,
      userId: caller.userId,
      structuredQuestionId: q.id,
      scope,
      track,
      answers: stored,
      marks,
      totalAwarded,
      totalMax,
      submittedAt: toMytTimestamp(graded.submittedAt),
      modelAnswers: subs.map((s) => ({ subQuestionId: s.id, text: s.modelAnswer })),
    }
  }
}
