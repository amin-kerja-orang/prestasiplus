import { Inject, Injectable } from '@nestjs/common'
import {
  REMEDIAL_MESSAGES,
  RemedialCancelRequestSchema,
  RemedialGenerateRequestSchema,
  type RemedialMineItem,
  type RemedialPreview,
  type RemedialProgress,
  type RemedialScan,
} from '@pp/contract'
import type { z } from 'zod'

import { AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { prngStream } from '../../../db/prng'
import { CurriculumRepository } from '../../curriculum'
import { PracticeRepository } from '../../practice'
import { flatFromVersion } from '../../questions/projection'
import { type QuestionRecord, QuestionsRepository } from '../../questions'
import type { ClassActor } from '../actor'
import { ClassesRepository } from '../classes.repository'
import { invalid, tryParseStrict } from '../strict-body'
import { MISSION_AUDIT, REMEDIAL_MAX_QUESTIONS } from './missions.constants'
import { MissionsRepository, type RemedialRecord } from './missions.repository'
import { QuestionPool } from './question-pool'
import { type AnswerFact, percent, round, shuffled, type TopicInfo, topicKeyOf, weakTopicsOf, type WeakTopic } from './remedial.rules'

const LETTERS = 'ABCDEFGH'
/** Parallel reads of the scan (per-pupil answer logs, SP lookups). */
const SCAN_CONCURRENCY = 8

/** A Postgres/Prisma unique violation (P2002 / 23505). */
const isUnique = (e: unknown): boolean => {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  return code === 'P2002' || code === '23505'
}

const notFound = (message?: string): ApiError => ApiError.of('NOT_FOUND', message ? { message } : {})
const refused = (message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message })

/** A canonical decimal id that is not zero. */
const isRealId = (s: string): boolean => isIdString(s) && s !== '0'
/** The id of a body value (a string or a whole number from 1), as a decimal string. */
const idText = (v: string | number): string => (typeof v === 'number' ? String(v) : v.trim())

const cmpId = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)

type GenerateBody = z.output<typeof RemedialGenerateRequestSchema>
type CancelBody = z.output<typeof RemedialCancelRequestSchema>

/**
 * Remedial tests (M10 S2/S3, BR-M10-11 to 13, M05 #20/#20b): the student reads, the teacher progress and the
 * Command Center scan, generate and cancel. A teacher sees only their own students and tests; the answer
 * rows come from `PracticeRepository`, questions from the bank, classes from `ClassesRepository`.
 */
@Injectable()
export class RemedialService {
  constructor(
    @Inject(MissionsRepository) private readonly repo: MissionsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(QuestionPool) private readonly pool: QuestionPool,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- student reads ----------------------------------------------------------------------------

  /** `GET /remedial-tests/mine`: the caller's `active` and `completed` tests, newest first (BR-32). */
  async mine(actor: ClassActor): Promise<RemedialMineItem[]> {
    const tests = (await this.repo.remedialForStudent(actor.userId, actor.isTest)).filter((t) => t.status !== 'cancelled')
    const [subjects, teachers] = await Promise.all([
      this.classes.subjectNames(tests.map((t) => t.subjectId)),
      this.classes.userNames(tests.map((t) => t.teacherId)),
    ])
    return tests.map((t) => ({
      id: t.id,
      subjectName: subjects.get(t.subjectId) ?? '',
      totalQuestions: t.totalQuestions,
      status: t.status as 'active' | 'completed',
      createdAt: toMytTimestamp(t.createdAt),
      teacherName: teachers.get(t.teacherId) ?? '',
    }))
  }

  /**
   * `GET /remedial-tests/:id` (M05 #20b): read-only preview with the answer key. Only the test's own teacher and
   * an admin; every other caller and an unknown id get the generic 404. Questions in stored order; one the bank
   * no longer has is skipped.
   */
  async preview(actor: ClassActor, id: string): Promise<RemedialPreview> {
    const test = isRealId(id) ? await this.repo.remedial(id) : null
    if (!test || !(actor.role === 'admin' || test.teacherId === actor.userId)) throw notFound()
    const items = await this.repo.remedialItems(test.id)
    const [records, subjects, names] = await Promise.all([
      this.pool.anyVersion(items.map((i) => i.questionId)),
      this.classes.subjectNames([test.subjectId]),
      this.classes.userNames([test.teacherId, test.studentId]),
    ])
    const questions = items.flatMap((i) => {
      const r = records.get(i.questionId)
      return r ? [previewQuestion(r)] : []
    })
    return {
      id: test.id,
      subjectName: subjects.get(test.subjectId) ?? '',
      status: test.status,
      totalQuestions: test.totalQuestions,
      createdAt: toMytTimestamp(test.createdAt),
      teacherName: names.get(test.teacherId) ?? '',
      studentName: names.get(test.studentId) ?? '',
      questions,
    }
  }

  // --- teacher progress (S3, BR-M10-13) ---------------------------------------------------------

  async progress(actor: ClassActor): Promise<RemedialProgress> {
    const tests = await this.repo.remedialForTeacher(actor.userId, actor.isTest)
    const counted = tests.filter((t) => t.status !== 'cancelled')
    const gains = counted.filter((t) => t.status === 'completed' && t.afterAccuracy !== null).map((t) => (t.afterAccuracy as number) - t.beforeAccuracy)
    const [students, subjects] = await Promise.all([
      this.classes.userNames(tests.map((t) => t.studentId)),
      this.classes.subjectNames(tests.map((t) => t.subjectId)),
    ])
    return {
      stats: {
        total: counted.length,
        completed: counted.filter((t) => t.status === 'completed').length,
        students: new Set(counted.map((t) => t.studentId)).size,
        avgImprovement: gains.length === 0 ? 0 : Math.round(gains.reduce((a, b) => a + b, 0) / gains.length),
      },
      rows: tests.map((t) => ({
        id: t.id,
        studentName: students.get(t.studentId) ?? '',
        subjectName: subjects.get(t.subjectId) ?? '',
        status: t.status,
        beforeAccuracy: t.beforeAccuracy,
        afterAccuracy: t.afterAccuracy,
      })),
    }
  }

  // --- scan (BR-M10-11) --------------------------------------------------------------------------

  /** The answer log of one student as scan facts (rows with a subject), oldest first. */
  private async factsOf(studentId: string): Promise<AnswerFact[]> {
    const rows = await this.practice.answers(studentId)
    return rows.flatMap((a) =>
      a.subjectId === null ? [] : [{ questionId: a.questionId, subjectId: a.subjectId, chapterId: a.chapterId, isCorrect: a.isCorrect }],
    )
  }

  /** `sp:` / `ch:` topic info of the questions among `ids` (live version first, else the latest). */
  private async topicInfo(ids: readonly string[]): Promise<Map<string, TopicInfo>> {
    const records = await this.pool.anyVersion([...new Set(ids)])
    return new Map([...records].map(([id, r]) => [id, { spId: r.version.spIds[0] ?? null, chapterId: r.version.chapterId }]))
  }

  private topicName(key: string, spNames: Map<string, string>, chapterNames: Map<string, string>): string {
    const [kind, id = ''] = key.split(':')
    return kind === 'sp' ? (spNames.get(id) ?? `SP ${id}`) : (chapterNames.get(id) ?? `Bab ${id}`)
  }

  /** `GET /guru/command-center/remedial/scan`. */
  async scan(actor: ClassActor): Promise<RemedialScan> {
    const studentIds = await this.classes.teacherStudentIds(actor.userId)
    const names = await this.classes.userNames(studentIds)
    const facts = new Map<string, AnswerFact[]>()
    // Bounded concurrency: a read per pupil, at most SCAN_CONCURRENCY at a time; the order of `studentIds` is kept.
    for (let i = 0; i < studentIds.length; i += SCAN_CONCURRENCY) {
      const batch = studentIds.slice(i, i + SCAN_CONCURRENCY)
      const rows = await Promise.all(batch.map((id) => this.factsOf(id)))
      batch.forEach((id, k) => facts.set(id, rows[k] ?? []))
    }
    const info = await this.topicInfo([...facts.values()].flatMap((l) => l.flatMap((a) => (a.questionId ? [a.questionId] : []))))

    const perStudent = studentIds.map((id) => ({ id, weak: weakTopicsOf(facts.get(id) ?? [], info) })).filter((s) => s.weak.length > 0)
    const keys = [...new Set(perStudent.flatMap((s) => s.weak.map((w) => w.key)))]
    const [spNames, chapterNames, subjects] = await Promise.all([
      this.spNames(keys),
      this.chapterNames(keys),
      this.classes.subjectNames(perStudent.flatMap((s) => s.weak.map((w) => w.subjectId))),
    ])
    const weakStudents: RemedialScan['weakStudents'] = []
    for (const s of perStudent) {
      const weakest = s.weak[0] as WeakTopic
      weakStudents.push({
        studentId: s.id,
        name: names.get(s.id) ?? '',
        weakTopics: s.weak.map((w) => ({
          subject: subjects.get(w.subjectId) ?? `Subjek ${w.subjectId}`,
          topicName: this.topicName(w.key, spNames, chapterNames),
          accuracy: w.accuracy,
        })),
        weakestAccuracy: weakest.accuracy,
      })
    }
    weakStudents.sort((a, b) => a.weakestAccuracy - b.weakestAccuracy || cmpId(a.studentId, b.studentId))

    const tests = await this.repo.remedialForTeacher(actor.userId, actor.isTest)
    return {
      weakStudents,
      existingRemedials: tests
        .filter((t) => t.status !== 'cancelled')
        .map((t) => ({
          id: t.id,
          studentId: t.studentId,
          status: t.status as 'active' | 'completed',
          totalQuestions: t.totalQuestions,
          afterAccuracy: t.afterAccuracy,
        })),
    }
  }

  /** One lookup per distinct SP among the topic keys, SCAN_CONCURRENCY at a time. */
  private async spNames(keys: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(keys.flatMap((k) => {
      const [kind, id = ''] = k.split(':')
      return kind === 'sp' && isRealId(id) ? [id] : []
    }))]
    const out = new Map<string, string>()
    for (let i = 0; i < ids.length; i += SCAN_CONCURRENCY) {
      const batch = ids.slice(i, i + SCAN_CONCURRENCY)
      const nodes = await Promise.all(batch.map((id) => this.curriculum.nodeById(idFromString(id))))
      batch.forEach((id, k) => {
        const node = nodes[k]
        if (node) out.set(id, node.title)
      })
    }
    return out
  }

  private async chapterNames(keys: readonly string[]): Promise<Map<string, string>> {
    const ids = keys.flatMap((k) => {
      const [kind, id = ''] = k.split(':')
      return kind === 'ch' && isRealId(id) ? [idFromString(id)] : []
    })
    if (ids.length === 0) return new Map()
    return new Map((await this.curriculum.chaptersByIds(ids)).map((c) => [idToString(c.id), c.name]))
  }

  // --- generate (BR-M10-12) ----------------------------------------------------------------------

  /** A subject named by an id, a code or a name; case-insensitive (the mock `resolveSubject`). */
  private async resolveSubject(value: string): Promise<{ id: string; name: string } | null> {
    const wanted = value.trim().toLowerCase()
    if (wanted === '') return null
    const all = await this.curriculum.subjects()
    const hit =
      all.find((s) => idToString(s.id) === wanted) ??
      all.find((s) => s.code.toLowerCase() === wanted) ??
      all.find((s) => s.name.toLowerCase() === wanted)
    return hit ? { id: idToString(hit.id), name: hit.name } : null
  }

  /**
   * `POST /guru/command-center/remedial/generate`. Order of the mock: body fields (reported together), then the
   * student must be one of the caller's own (403), then the subject (422 on `subject`), then the refusals.
   */
  async generate(actor: ClassActor, raw: unknown): Promise<{ quizId: string; totalQuestions: number }> {
    const parsed = tryParseStrict(RemedialGenerateRequestSchema, raw)
    if (!parsed.data) throw invalid(parsed.fields)
    const body: GenerateBody = parsed.data
    const studentId = idText(body.studentId)
    const own = await this.classes.teacherStudentIds(actor.userId)
    if (!own.includes(studentId)) throw ApiError.of('FORBIDDEN', { message: REMEDIAL_MESSAGES.notYourStudent })
    const subject = await this.resolveSubject(body.subject)
    if (!subject) throw invalid({ subject: REMEDIAL_MESSAGES.noSubject })

    const now = this.clock.now()
    const test = await this.generateTx(actor, studentId, subject, now)
    return { quizId: test.id, totalQuestions: test.totalQuestions }
  }

  private async generateTx(actor: ClassActor, studentId: string, subject: { id: string; name: string }, now: Date): Promise<RemedialRecord> {
    try {
      return await this.generateIn(actor, studentId, subject, now)
    } catch (err) {
      // The partial unique index of open tests is the last line of defence behind the advisory lock.
      if (isUnique(err)) throw refused(REMEDIAL_MESSAGES.alreadyOpen)
      throw err
    }
  }

  private generateIn(actor: ClassActor, studentId: string, subject: { id: string; name: string }, now: Date): Promise<RemedialRecord> {
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockGeneration(actor.userId, studentId, subject.id)
      if (await this.repo.hasOpen(actor.userId, studentId, subject.id)) throw refused(REMEDIAL_MESSAGES.alreadyOpen)

      const facts = await this.factsOf(studentId)
      const info = await this.topicInfo(facts.flatMap((a) => (a.questionId ? [a.questionId] : [])))
      const weak = weakTopicsOf(facts, info).filter((w) => w.subjectId === subject.id)
      if (weak.length === 0) throw refused(REMEDIAL_MESSAGES.noQuestions)

      const picked = await this.pick(actor.userId, studentId, subject.id, facts, info, weak)
      if (picked.length === 0) throw refused(REMEDIAL_MESSAGES.noQuestions)

      const answered = facts.filter((a) => a.subjectId === subject.id)
      const before = round(percent(answered.filter((a) => a.isCorrect).length, answered.length), 1)
      const created = await this.repo.createRemedial({
        teacherId: actor.userId,
        studentId,
        subjectId: subject.id,
        beforeAccuracy: before,
        isTest: actor.isTest,
        now,
        items: picked,
      })
      await this.audit.record({
        tx,
        action: MISSION_AUDIT.REMEDIAL_GENERATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.auth.sessionRowId,
        targetType: 'remedial_test',
        targetId: created.id,
        schoolId: actor.schoolId,
        scopeLevel: actor.auth.active.scope.level,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        details: { studentId, subjectId: subject.id, totalQuestions: picked.length },
      })
      return created
    })
  }

  /**
   * BR-M10-12: up to 10 eligible questions, in this order: (1) questions the student answered wrongly inside the
   * weak topics, newest first; (2) a top-up per weak topic, weakest first (an SP topic is drawn by its SP, a chapter
   * topic by its chapter); (3) the subject pool at the student's level. The draws are seeded, so the same history
   * gives the same test. Only published, active `mcq` questions are chosen; each is stored at its live version.
   */
  private async pick(
    teacherId: string,
    studentId: string,
    subjectId: string,
    facts: readonly (AnswerFact)[],
    info: ReadonlyMap<string, TopicInfo>,
    weak: readonly WeakTopic[],
  ): Promise<{ questionId: string; questionVersionNo: number }[]> {
    const weakKeys = new Set(weak.map((w) => w.key))
    const picked: string[] = []
    const taken = new Set<string>()

    const candidates: string[] = []
    for (let i = facts.length - 1; i >= 0; i--) {
      const a = facts[i] as AnswerFact
      if (a.isCorrect || a.subjectId !== subjectId || a.questionId === null || candidates.includes(a.questionId)) continue
      const key = topicKeyOf(info, a)
      if (key !== null && weakKeys.has(key)) candidates.push(a.questionId)
    }
    const live = await this.pool.eligible(candidates)
    for (const id of candidates) {
      if (picked.length >= REMEDIAL_MAX_QUESTIONS) break
      if (!live.has(id)) continue
      taken.add(id)
      picked.push(id)
    }

    const grade = (await this.classes.studentLines([studentId], ''))[0]?.grade ?? null
    const level = grade === null ? null : await this.curriculum.levelForGrade(grade)
    const educationLevelId = level ? idToString(level.id) : undefined
    const seedBase = `remedial:${teacherId}:${studentId}:${subjectId}:${String(await this.repo.countForStudent(studentId))}`
    const take = (ids: readonly string[]): void => {
      for (const id of ids) {
        if (picked.length >= REMEDIAL_MAX_QUESTIONS) break
        if (taken.has(id)) continue
        taken.add(id)
        picked.push(id)
      }
    }
    const base = { subjectId, ...(educationLevelId ? { educationLevelId } : {}) }
    // Read at most once, and only when a chapter topic needs it; filtered in memory for every topic.
    let catalog: Awaited<ReturnType<QuestionPool['catalog']>> | null = null

    for (const w of weak) {
      if (picked.length >= REMEDIAL_MAX_QUESTIONS) break
      const [kind, id = ''] = w.key.split(':')
      const rng = prngStream(`${seedBase}:${w.key}`)
      const want = REMEDIAL_MAX_QUESTIONS - picked.length
      if (kind === 'sp') {
        take(await this.questions.sample({ ...base, type: 'mcq', spId: id, excludeIds: [...taken] }, want, rng))
      } else {
        catalog ??= await this.pool.catalog(base)
        const inChapter = catalog.filter((e) => e.chapterId === id && !taken.has(e.id)).map((e) => e.id)
        take(shuffled(inChapter, rng).slice(0, want))
      }
    }
    if (picked.length < REMEDIAL_MAX_QUESTIONS) {
      take(await this.questions.sample({ ...base, type: 'mcq', excludeIds: [...taken] }, REMEDIAL_MAX_QUESTIONS - picked.length, prngStream(seedBase)))
    }

    const versions = await this.pool.eligible(picked)
    return picked.flatMap((questionId) => {
      const r = versions.get(questionId)
      return r ? [{ questionId, questionVersionNo: r.version.versionNo }] : []
    })
  }

  // --- cancel -------------------------------------------------------------------------------------

  /**
   * `POST /guru/command-center/remedial/cancel`: an active test of the caller becomes `cancelled`. Unknown or another
   * teacher's test (also for an admin) is the same 404; a test that is not active is 409 (a repeat cancel included).
   */
  async cancel(actor: ClassActor, raw: unknown): Promise<{ success: true }> {
    const parsed = tryParseStrict(RemedialCancelRequestSchema, raw)
    if (!parsed.data) throw invalid(parsed.fields)
    const body: CancelBody = parsed.data
    const quizId = idText(body.quizId)
    const test: RemedialRecord | null = isRealId(quizId) ? await this.repo.remedial(quizId) : null
    if (!test || test.teacherId !== actor.userId) throw notFound(REMEDIAL_MESSAGES.testNotFound)
    const now = this.clock.now()
    const done = await this.prisma.transaction(async (tx) => {
      const changed = await this.repo.cancelRemedial(test.id, actor.userId, now)
      if (changed) {
        await this.audit.record({
          tx,
          action: MISSION_AUDIT.REMEDIAL_CANCELLED,
          actorUserId: actor.userId,
          actorRole: actor.role,
          sessionRowId: actor.auth.sessionRowId,
          targetType: 'remedial_test',
          targetId: test.id,
          schoolId: actor.schoolId,
          scopeLevel: actor.auth.active.scope.level,
          requestId: actor.requestId,
          ip: actor.ip,
          isTest: actor.isTest,
          details: { studentId: test.studentId },
        })
      }
      return changed
    })
    if (!done) throw ApiError.of('CONFLICT', { message: REMEDIAL_MESSAGES.testNotActive })
    return { success: true }
  }
}

/** One question of the preview: flat fields of the stored version, with the answer key. */
function previewQuestion(r: QuestionRecord): RemedialPreview['questions'][number] {
  const flat = flatFromVersion(r.version)
  return {
    id: r.id,
    questionText: flat.questionText,
    textDirection: flat.textDirection,
    scriptType: flat.scriptType,
    options: (flat.options ?? []).map((text, i) => ({ id: i, label: LETTERS[i] ?? String(i), text })),
    correctOptionId: flat.correctAnswer,
  }
}
