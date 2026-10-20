import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  CIKGU_BULK_IDS_MAX,
  CIKGU_BULK_IDS_TOO_MANY,
  CIKGU_MESSAGE_MAX,
  CIKGU_PAGE_SIZE,
  CIKGU_PBD_CSV_HEADER,
  CIKGU_RPH_FOLLOW_UP,
  CikguRphCreateRequestSchema,
  cikguCodePoints,
  cikguLevelLabel,
  cikguRphFieldErrors,
  cikguSkorOf,
  cikguSummarizeFieldErrors,
  cikguTierOf,
  cikguTokensIn,
  cikguTokensOut,
  cikguTpOf,
  cikguRphConfirmation,
  type CikguBulkApproveResult,
  type CikguChatTier,
  type CikguEssayListItem,
  type CikguEssayMarking,
  type CikguLevelCode,
  type CikguPbdQueueItem,
  type CikguRollupResult,
  type CikguRph,
  type CikguRphListItem,
  type CikguSendResponse,
  type ListMeta,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock, mytDay, startOfMytDay } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { ClassesRepository } from '../classes'
import { CurriculumRepository } from '../curriculum'
import { PracticeRepository } from '../practice'
import { UsersRepository } from '../users'
import { CIKGU_AI, CikguAiUnavailableError, type CikguAiPort, type CikguAiTokens } from './ai.port'
import { OVERLOAD_RETRY_AFTER, WRITE_TX } from './cikgu.constants'
import { aiUnavailable } from './cikgu.errors'
import {
  CikguRepository,
  type EssayRecord,
  type PbdTagRecord,
  type RphRecord,
} from './cikgu.repository'
import { type ChatTool, csvCell, dateLabelOf, parseHandoff, parseRphRequest, routeOf, spOf } from './rules'

const DAY_MS = 24 * 60 * 60 * 1000

/** Malay, case-insensitive A to Z (BR-M13-13). */
const collator = new Intl.Collator('ms', { sensitivity: 'base' })

/** Who is calling a Cikgu Alesa route, read from the request's `AuthContext` (never from the query or body). */
export interface CikguActor {
  userId: string
  /** The ACTIVE role (a Mod Pelajar session acts as `student`). */
  role: string
  /** Mod Pelajar is on: what the actor writes is test data. */
  isTest: boolean
}

export type SendOutcome =
  | { kind: 'blank' }
  | { kind: 'too_long' }
  | { kind: 'quota' }
  | { kind: 'ok'; body: CikguSendResponse }

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/** Page number of a list: a missing, non-numeric or < 1 value is page 1 (not an error). */
export function pageOf(raw: unknown): number {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d+$/.test(t)) return 1
  const n = Number(t)
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 1_000_000) : 1
}

/** A class or tag id given as a digit string (trimmed) or a non-negative integer; null for anything else or an id out of range. */
export function idLike(v: unknown): string | null {
  let text: string | null = null
  if (typeof v === 'number') text = Number.isSafeInteger(v) && v >= 0 ? String(v) : null
  else if (typeof v === 'string' && /^\d+$/.test(v.trim())) text = v.trim()
  if (text === null) return null
  try {
    return String(idFromString(String(BigInt(text))))
  } catch {
    return null
  }
}

const compareIds = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)

const toRph = (r: RphRecord): CikguRph => ({
  id: r.id,
  userId: r.userId,
  subjectName: r.subjectName,
  level: r.level as CikguLevelCode,
  tajuk: r.tajuk,
  className: r.className,
  lessonDate: r.lessonDate,
  durationMinutes: r.durationMinutes,
  timeSlot: r.timeSlot,
  tema: r.tema,
  pengajaranKeperluan: r.pengajaranKeperluan,
  status: r.status as 'generated',
  source: r.source as 'form' | 'chat',
  content: r.content,
  threadId: r.threadId,
  createdAt: toMytTimestamp(r.createdAt),
})

const toRphItem = (r: RphRecord): CikguRphListItem => ({
  id: r.id,
  lessonDate: r.lessonDate,
  subjectName: r.subjectName,
  level: r.level as CikguLevelCode,
  tajuk: r.tajuk,
  status: r.status as 'generated',
})

const toEssay = (e: EssayRecord): CikguEssayMarking => ({
  id: e.id,
  userId: e.userId,
  rubricKey: e.rubricKey as CikguEssayMarking['rubricKey'],
  subjectName: e.subjectName,
  level: e.level,
  studentName: e.studentName,
  essayTitle: e.essayTitle,
  essayText: e.essayText,
  marks: e.marks,
  maxMarks: e.maxMarks,
  comment: e.comment,
  threadId: e.threadId,
  createdAt: toMytTimestamp(e.createdAt),
})

const toEssayItem = (e: EssayRecord): CikguEssayListItem => ({
  id: e.id,
  studentName: e.studentName,
  subjectName: e.subjectName,
  rubricKey: e.rubricKey as CikguEssayMarking['rubricKey'],
  essayTitle: e.essayTitle,
  marks: e.marks,
  maxMarks: e.maxMarks,
  createdAt: toMytTimestamp(e.createdAt),
})

/** What a turn decided before anything is stored. */
interface TurnPlan {
  reply: string
  tool: ChatTool | null
  tokens: CikguAiTokens
  essay?: { rubricKey: string; subject: string | null; level: string | null; student: string | null; title: string | null; essayText: string; marks: number; maxMarks: number }
  rph?: { subject: string; level: CikguLevelCode; tajuk: string; lessonDate: string; content: string }
}

/**
 * Cikgu Alesa (M13, BE-43): the chat turn and the teacher tools (RPH, essay markings, PBD tags). Business rules live here
 * and in `rules.ts`; tables are reached only through `CikguRepository`; other owners' data (users, subjects, classes,
 * practice answers) only through their repositories. PRIVACY (PDPA, minors): this class never logs a message, a reply,
 * an essay or a student name.
 */
@Injectable()
export class CikguService {
  private readonly logger = new Logger(CikguService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CikguRepository) private readonly repo: CikguRepository,
    @Inject(CIKGU_AI) private readonly ai: CikguAiPort,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
  ) {}

  // --- chat (S1) ----------------------------------------------------------------------------------

  /**
   * One chat turn (FR-M13-24 to 28, BR-M13-03 to 07). The AI is called BEFORE the transaction (so a slow provider never
   * holds the per-user lock or a connection); the quota is then counted again under the lock and the turn stored, so
   * concurrent turns cannot exceed the limit. A provider failure stores nothing and consumes no turn.
   */
  async send(actor: CikguActor, body: unknown): Promise<SendOutcome> {
    const input = asRecord(body)
    const raw = input.message
    if (typeof raw !== 'string' || raw.trim() === '') return { kind: 'blank' }
    if (cikguCodePoints(raw) > CIKGU_MESSAGE_MAX) return { kind: 'too_long' }
    const message = raw.trim()
    const threadId = typeof input.thread_id === 'string' ? input.thread_id : null

    const now = this.clock.now()
    const { tier, dailyTurns } = cikguTierOf(actor.role)
    const dayStart = startOfMytDay(now)
    const dayEnd = new Date(dayStart.getTime() + DAY_MS)

    // Cheap early refusal (no AI call, no lock). The authoritative check is repeated under the lock below.
    if ((await this.guard(() => this.repo.countUserTurns(actor.userId, dayStart, dayEnd))) >= dailyTurns) return { kind: 'quota' }

    const plan = await this.plan(actor, message, now)

    const stored = await this.write(async () => {
      await this.repo.lockUserChat(actor.userId)
      const used = await this.repo.countUserTurns(actor.userId, dayStart, dayEnd)
      if (used >= dailyTurns) return null
      const existing = threadId === null ? null : await this.repo.ownThreadId(actor.userId, threadId)
      let id: string
      if (existing === null) id = await this.repo.createThread(actor.userId, actor.isTest, now)
      else {
        id = existing
        await this.repo.touchThread(id, now)
      }
      if (plan.essay) {
        await this.repo.createEssay({
          userId: actor.userId,
          rubricKey: plan.essay.rubricKey,
          subjectName: plan.essay.subject,
          level: plan.essay.level,
          studentName: plan.essay.student,
          essayTitle: plan.essay.title,
          essayText: plan.essay.essayText,
          marks: plan.essay.marks,
          maxMarks: plan.essay.maxMarks,
          comment: plan.reply,
          threadId: id,
          isTest: actor.isTest,
          now,
        })
      }
      if (plan.rph) {
        await this.repo.createRph({
          userId: actor.userId,
          subjectName: plan.rph.subject,
          level: plan.rph.level,
          tajuk: plan.rph.tajuk,
          className: null,
          lessonDate: plan.rph.lessonDate,
          durationMinutes: 60,
          timeSlot: null,
          tema: null,
          pengajaranKeperluan: null,
          source: 'chat',
          content: plan.rph.content,
          threadId: id,
          isTest: actor.isTest,
          now,
        })
      }
      const hops = plan.tool === null ? 0 : 1
      await this.repo.addMessage({ threadId: id, userId: actor.userId, role: 'user', text: message, tool: null, toolHops: 0, tokensIn: 0, tokensOut: 0, isTest: actor.isTest, now })
      await this.repo.addMessage({ threadId: id, userId: actor.userId, role: 'bot', text: plan.reply, tool: plan.tool, toolHops: hops, tokensIn: plan.tokens.in, tokensOut: plan.tokens.out, isTest: actor.isTest, now })
      return { threadId: id, used, hops }
    })
    if (stored === null) return { kind: 'quota' }
    return {
      kind: 'ok',
      body: {
        thread_id: stored.threadId,
        reply: plan.reply,
        tier: tier as CikguChatTier,
        turns_remaining: dailyTurns - (stored.used + 1),
        tool_hops: stored.hops as 0 | 1,
        tokens: { in: plan.tokens.in, out: plan.tokens.out },
      },
    }
  }

  /** Routes the message and asks the AI port for what it provides. Throws `CikguAiUnavailableError` when the provider fails. */
  private async plan(actor: CikguActor, message: string, now: Date): Promise<TurnPlan> {
    const estimate = (reply: string): CikguAiTokens => ({ in: cikguTokensIn(message), out: cikguTokensOut(reply) })
    try {
      const route = routeOf(message)
      if (route === 'mark_essay') {
        const h = parseHandoff(message)
        // The student's name is NOT given to the AI port (card open question 2).
        const out = await this.ai.markEssay({ rubric: h.rubric, subject: h.subject, level: h.level, title: h.title, essay: h.essay })
        if (!Number.isInteger(out.marks) || out.marks < 0 || out.marks > h.rubric.max || out.reply.trim() === '') throw new CikguAiUnavailableError()
        return {
          reply: out.reply,
          tool: 'mark_essay',
          tokens: out.tokens ?? estimate(out.reply),
          essay: { rubricKey: h.rubric.key, subject: h.subject, level: h.level, student: h.student, title: h.title, essayText: h.essay, marks: out.marks, maxMarks: h.rubric.max },
        }
      }
      if (route === 'rph') {
        const subjects = (await this.guard(() => this.curriculum.subjects({ active: true }))).map((s) => s.name)
        const p = parseRphRequest(message, subjects)
        if (!p) return { reply: CIKGU_RPH_FOLLOW_UP, tool: null, tokens: estimate(CIKGU_RPH_FOLLOW_UP) }
        const today = mytDay(now)
        const lessonDate = p.tomorrow ? mytDay(new Date(now.getTime() + DAY_MS)) : today
        const label = dateLabelOf(lessonDate)
        const plan = await this.ai.rphPlan({
          subjectName: p.subject,
          level: p.level,
          levelLabel: cikguLevelLabel(p.level),
          tajuk: p.tajuk,
          className: null,
          dateLabel: label,
          durationMinutes: 60,
          timeSlot: null,
          tema: null,
          pengajaranKeperluan: null,
        })
        const reply = cikguRphConfirmation(p.tajuk, p.subject, p.level, label)
        return { reply, tool: 'rph', tokens: plan.tokens ?? estimate(reply), rph: { subject: p.subject, level: p.level, tajuk: p.tajuk, lessonDate, content: plan.text } }
      }
      const out = await this.ai.chatReply({ route: route === 'practice' ? 'practice' : 'general', message })
      return { reply: out.text, tool: route === 'practice' ? 'practice' : null, tokens: out.tokens ?? estimate(out.text) }
    } catch (err) {
      if (err instanceof CikguAiUnavailableError) throw err
      if (err instanceof ApiError || isOverloadError(err)) throw err
      // Any provider failure is "unavailable". Only the error class is logged: a message could echo user content.
      this.logger.warn(`AI provider failed (${err instanceof Error ? err.name : 'error'})`)
      throw new CikguAiUnavailableError()
    }
  }

  // --- RPH (T2 to T4) ---------------------------------------------------------------------------------

  async listRph(actor: CikguActor, query: Record<string, unknown>): Promise<{ data: CikguRphListItem[]; meta: ListMeta }> {
    const page = pageOf(query.page)
    const { rows, total } = await this.guard(() => this.repo.rphPage(actor.userId, page, CIKGU_PAGE_SIZE))
    return { data: rows.map(toRphItem), meta: listMeta(page, CIKGU_PAGE_SIZE, total) }
  }

  async getRph(actor: CikguActor, id: string): Promise<CikguRph> {
    const row = await this.guard(() => this.repo.rphOf(actor.userId, id))
    if (!row) throw ApiError.of('NOT_FOUND')
    return toRph(row)
  }

  /** `POST /cikgu/rph` (BR-M13-12): all field errors together, then the plan text from the AI port, then the row. */
  async createRph(actor: CikguActor, body: unknown): Promise<CikguRph> {
    const input = asRecord(body)
    const fields = cikguRphFieldErrors(input)
    if (Object.keys(fields).length > 0) {
      throw ApiError.of('VALIDATION_ERROR', { fields: fields as Record<string, string>, message: cikguSummarizeFieldErrors(fields) })
    }
    const v = CikguRphCreateRequestSchema.parse(input)
    const now = this.clock.now()
    const lessonDate = v.lessonDate === undefined || v.lessonDate === '' ? mytDay(now) : v.lessonDate
    const durationMinutes = v.durationMinutes ?? 60
    const level = v.level as CikguLevelCode
    const className = v.className ?? null
    const timeSlot = v.timeSlot ?? null
    const tema = v.tema ?? null
    const keperluan = v.pengajaranKeperluan ?? null
    let content: string
    try {
      content = (
        await this.ai.rphPlan({
          subjectName: v.subjectName,
          level,
          levelLabel: cikguLevelLabel(level),
          tajuk: v.tajuk,
          className,
          dateLabel: dateLabelOf(lessonDate),
          durationMinutes,
          timeSlot,
          tema,
          pengajaranKeperluan: keperluan,
        })
      ).text
    } catch (err) {
      if (!(err instanceof CikguAiUnavailableError)) this.logger.warn(`AI provider failed (${err instanceof Error ? err.name : 'error'})`)
      throw aiUnavailable()
    }
    const row = await this.write(() =>
      this.repo.createRph({
        userId: actor.userId,
        subjectName: v.subjectName,
        level,
        tajuk: v.tajuk,
        className,
        lessonDate,
        durationMinutes,
        timeSlot,
        tema,
        pengajaranKeperluan: keperluan,
        source: 'form',
        content,
        threadId: null,
        isTest: actor.isTest,
        now,
      }),
    )
    return toRph(row)
  }

  // --- essays (T5, T6) --------------------------------------------------------------------------------

  async listEssays(actor: CikguActor, query: Record<string, unknown>): Promise<{ data: CikguEssayListItem[]; meta: ListMeta }> {
    const page = pageOf(query.page)
    const { rows, total } = await this.guard(() => this.repo.essayPage(actor.userId, page, CIKGU_PAGE_SIZE))
    return { data: rows.map(toEssayItem), meta: listMeta(page, CIKGU_PAGE_SIZE, total) }
  }

  async getEssay(actor: CikguActor, id: string): Promise<CikguEssayMarking> {
    const row = await this.guard(() => this.repo.essayOf(actor.userId, id))
    if (!row) throw ApiError.of('NOT_FOUND')
    return toEssay(row)
  }

  // --- PBD (T7 to T10) --------------------------------------------------------------------------------

  /** Names of students by id (one read of the users owner). */
  private async namesOf(ids: readonly string[]): Promise<Map<string, string>> {
    const users = await this.guard(() => this.users.getMany(ids))
    return new Map(users.map((u) => [u.id, u.name]))
  }

  async pbdQueue(actor: CikguActor, query: Record<string, unknown>): Promise<{ data: CikguPbdQueueItem[]; meta: ListMeta }> {
    const page = pageOf(query.page)
    const tags = await this.guard(() => this.repo.pendingTags(actor.userId))
    const names = await this.namesOf(tags.map((t) => t.studentId))
    const nameOf = (t: PbdTagRecord): string => names.get(t.studentId) ?? ''
    // Newest roll-up first, then student name A to Z (Malay collation, case and diacritic insensitive), then id.
    const sorted = [...tags].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || collator.compare(nameOf(a), nameOf(b)) || compareIds(a.id, b.id),
    )
    const slice = sorted.slice((page - 1) * CIKGU_PAGE_SIZE, page * CIKGU_PAGE_SIZE)
    return {
      data: slice.map((t) => ({ id: t.id, studentId: t.studentId, studentName: nameOf(t), classroomId: t.classroomId, sp: t.sp, skor: t.skor, tp: t.tp })),
      meta: listMeta(page, CIKGU_PAGE_SIZE, sorted.length),
    }
  }

  /**
   * BR-M13-15: PBD roll-up of one class of the caller. A missing, malformed, foreign or subject-less class is the zero
   * result and changes nothing (never reveals a foreign class).
   */
  async rollup(actor: CikguActor, body: unknown): Promise<CikguRollupResult> {
    const result: CikguRollupResult = { created: 0, updated: 0, skipped: 0 }
    const classroomId = idLike(asRecord(body).classroomId)
    if (classroomId === null) return result
    const cls = await this.guard(() => this.classes.get(classroomId))
    if (!cls || cls.teacherId !== actor.userId || cls.subjectId === null) return result
    const subjectName = (await this.guard(() => this.classes.subjectNames([cls.subjectId]))).get(cls.subjectId as string) ?? ''
    const sp = spOf(subjectName)
    const subjectId = cls.subjectId
    const memberIds = await this.guard(() => this.classes.memberIds(cls.id))
    // Scores first (reads of the practice owner; `is_test` answers are excluded by the owner's default), writes after.
    const scores: { studentId: string; skor: number; tp: number }[] = []
    for (const studentId of memberIds) {
      const answers = await this.guard(() => this.practice.answers(studentId, { subjectId }))
      if (answers.length === 0) continue
      const skor = cikguSkorOf(answers.filter((a) => a.isCorrect).length, answers.length)
      scores.push({ studentId, skor, tp: cikguTpOf(skor) })
    }
    if (scores.length === 0) return result
    const now = this.clock.now()
    await this.write(async () => {
      await this.repo.lockUserPbd(actor.userId)
      const existing = await this.repo.tagsOf(actor.userId, cls.id, scores.map((s) => s.studentId), sp)
      for (const s of scores) {
        const tags = existing.filter((t) => t.studentId === s.studentId)
        const pending = tags.find((t) => t.status === 'pending')
        if (pending) {
          await this.repo.refreshPendingTag(pending.id, s.skor, s.tp, now)
          result.updated++
        } else if (tags.length > 0) {
          result.skipped++
        } else {
          await this.repo.createTag({ userId: actor.userId, classroomId: cls.id, studentId: s.studentId, sp, skor: s.skor, tp: s.tp, isTest: actor.isTest, now })
          result.created++
        }
      }
    })
    return result
  }

  /** BR-M13-16: approves the caller's pending tags among `ids`; more than 100 items is a 422 on `ids`. */
  async bulkApprove(actor: CikguActor, body: unknown): Promise<CikguBulkApproveResult> {
    const ids = asRecord(body).ids
    if (!Array.isArray(ids) || ids.length === 0) return { approved: 0 }
    if (ids.length > CIKGU_BULK_IDS_MAX) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { ids: CIKGU_BULK_IDS_TOO_MANY }, message: CIKGU_BULK_IDS_TOO_MANY })
    }
    const keep = [...new Set((ids as unknown[]).flatMap((v) => { const k = idLike(v); return k === null ? [] : [k] }))]
    if (keep.length === 0) return { approved: 0 }
    const now = this.clock.now()
    const approved = await this.write(() => this.repo.approve(actor.userId, keep, now))
    return { approved }
  }

  /** BR-M13-17: the CSV of the caller's approved tags (header line only when there is none). */
  async exportCsv(actor: CikguActor): Promise<string> {
    const tags = await this.guard(() => this.repo.approvedTags(actor.userId))
    const [names, classes] = await Promise.all([
      this.namesOf(tags.map((t) => t.studentId)),
      this.guard(() => this.classes.byIds([...new Set(tags.map((t) => t.classroomId))])),
    ])
    const className = new Map(classes.map((c) => [c.id, c.name]))
    const at = (t: PbdTagRecord): Date => t.approvedAt ?? t.createdAt
    const sorted = [...tags].sort(
      (a, b) =>
        at(a).getTime() - at(b).getTime() ||
        collator.compare(names.get(a.studentId) ?? '', names.get(b.studentId) ?? '') ||
        compareIds(a.id, b.id),
    )
    const lines = [CIKGU_PBD_CSV_HEADER]
    for (const t of sorted) {
      lines.push(
        [names.get(t.studentId) ?? '', className.get(t.classroomId) ?? '', t.sp, t.skor.toFixed(1), t.tp, mytDay(at(t))].map(csvCell).join(','),
      )
    }
    return `${lines.join('\n')}\n`
  }

  // --- plumbing -----------------------------------------------------------------------------------------

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: OVERLOAD_RETRY_AFTER })
      throw err
    }
  }

  /** A read: pool or connection overload is 429 (retryable), never a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: OVERLOAD_RETRY_AFTER })
      throw err
    }
  }
}
