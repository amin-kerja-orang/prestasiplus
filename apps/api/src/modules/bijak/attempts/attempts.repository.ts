import { Inject, Injectable } from '@nestjs/common'
import type { BijakAttemptResult } from '@pp/contract'

import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { PartAnswer, SectionSnapshot } from './exam-core.adapter'

export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned'
export type AttemptMode = 'exam' | 'latihan'

export interface AttemptRow {
  id: string
  userId: string
  paperId: string | null
  paperKind: 'pilihan' | 'jana'
  title: string
  subject: string
  subjectName: string
  kertas: number
  code: string
  mode: AttemptMode
  status: AttemptStatus
  startedAt: Date
  deadlineAt: Date | null
  durationMin: number
  composition: SectionSnapshot[]
  flags: string[]
  picks: Record<string, string[]>
  position: number
  submittedAt: Date | null
  lateBySeconds: number | null
  idempotencyKey: string | null
  isTest: boolean
}

export interface AnswerRow {
  partId: string
  answer: PartAnswer
  rev: number
  savedAt: Date
}

export interface PhotoRow {
  partId: string
  key: string
  name: string
  size: number
}

export interface NewAttempt {
  userId: string
  paperId: string
  paperKind: 'pilihan' | 'jana'
  title: string
  subject: string
  subjectName: string
  kertas: number
  code: string
  mode: AttemptMode
  startedAt: Date
  deadlineAt: Date | null
  durationMin: number
  composition: SectionSnapshot[]
  isTest: boolean
}

export interface HistoryRecord {
  row: AttemptRow
  score: number | null
  max: number | null
}

type DbAttempt = Awaited<ReturnType<AttemptsRepository['rawFind']>>

/**
 * Persistence of attempts. Every method uses `prisma.client`, so inside `prisma.transaction(...)` it
 * joins the transaction. A mutating flow first calls `lock(id)` (SELECT ... FOR UPDATE): two
 * requests on one attempt (two submits, a save racing a submit, the sweeper racing a student) then
 * run one after the other and the second sees the first one's result.
 */
@Injectable()
export class AttemptsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private rawFind(id: string) {
    return this.prisma.client.examAttempt.findUnique({ where: { id } })
  }

  private toRow(r: NonNullable<DbAttempt>): AttemptRow {
    return {
      id: r.id,
      userId: idToString(r.userId),
      paperId: r.paperId === null ? null : idToString(r.paperId),
      paperKind: r.paperKind as AttemptRow['paperKind'],
      title: r.title,
      subject: r.subject,
      subjectName: r.subjectName,
      kertas: r.kertas,
      code: r.paperCode,
      mode: r.mode as AttemptMode,
      status: r.status as AttemptStatus,
      startedAt: r.startedAt,
      deadlineAt: r.deadlineAt,
      durationMin: r.durationMin,
      composition: r.composition as unknown as SectionSnapshot[],
      flags: r.flags,
      picks: r.picks as unknown as Record<string, string[]>,
      position: r.position,
      submittedAt: r.submittedAt,
      lateBySeconds: r.lateBySeconds,
      idempotencyKey: r.idempotencyKey,
      isTest: r.isTest,
    }
  }

  async find(id: string): Promise<AttemptRow | null> {
    const r = await this.rawFind(id)
    return r ? this.toRow(r) : null
  }

  /** Row lock for the rest of the transaction. Returns false when the attempt does not exist. */
  async lock(id: string): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<{ id: string }[]>`select id::text as id from exam_attempts where id = ${id}::uuid for update`
    return rows.length > 0
  }

  /** Serialises concurrent starts of one user on one paper (transaction-scoped advisory lock). */
  async lockStart(userId: string, paperId: string): Promise<void> {
    await this.prisma.client.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`bijak-start:${userId}:${paperId}`}, 0))`
  }

  /** Open attempts of the user on the paper, newest first. */
  async openFor(userId: string, paperId: string): Promise<AttemptRow[]> {
    const rows = await this.prisma.client.examAttempt.findMany({
      where: { userId: idFromString(userId), paperId: idFromString(paperId), status: 'in_progress' },
      orderBy: { startedAt: 'desc' },
    })
    return rows.map((r) => this.toRow(r))
  }

  async abandonMany(ids: string[]): Promise<void> {
    if (!ids.length) return
    await this.prisma.client.examAttempt.updateMany({ where: { id: { in: ids }, status: 'in_progress' }, data: { status: 'abandoned' } })
  }

  async create(input: NewAttempt): Promise<AttemptRow> {
    const r = await this.prisma.client.examAttempt.create({
      data: {
        userId: idFromString(input.userId),
        paperId: idFromString(input.paperId),
        paperKind: input.paperKind,
        title: input.title,
        subject: input.subject,
        subjectName: input.subjectName,
        kertas: input.kertas,
        paperCode: input.code,
        mode: input.mode,
        startedAt: input.startedAt,
        deadlineAt: input.deadlineAt,
        durationMin: input.durationMin,
        composition: input.composition as unknown as object,
        isTest: input.isTest,
      },
    })
    return this.toRow(r)
  }

  async setMeta(id: string, meta: { flags?: string[]; picks?: Record<string, string[]>; position?: number }): Promise<void> {
    if (meta.flags === undefined && meta.picks === undefined && meta.position === undefined) return
    await this.prisma.client.examAttempt.update({
      where: { id },
      data: {
        ...(meta.flags !== undefined ? { flags: meta.flags } : {}),
        ...(meta.picks !== undefined ? { picks: meta.picks } : {}),
        ...(meta.position !== undefined ? { position: meta.position } : {}),
      },
    })
  }

  /** Closes an open attempt. Returns false when it was not open any more (the caller holds the lock, so this is a safety net). */
  async close(
    id: string,
    data: { status: 'submitted' | 'auto_submitted'; submittedAt: Date; lateBySeconds: number | null; idempotencyKey: string | null },
  ): Promise<boolean> {
    const res = await this.prisma.client.examAttempt.updateMany({
      where: { id, status: 'in_progress' },
      data: { status: data.status, submittedAt: data.submittedAt, lateBySeconds: data.lateBySeconds, idempotencyKey: data.idempotencyKey },
    })
    return res.count === 1
  }

  async answers(attemptId: string): Promise<Map<string, AnswerRow>> {
    const rows = await this.prisma.client.attemptAnswer.findMany({ where: { attemptId } })
    return new Map(rows.map((r) => [r.partId, { partId: r.partId, answer: r.answer as unknown as PartAnswer, rev: r.rev, savedAt: r.savedAt }]))
  }

  /** Conditional upsert: a row is only replaced by a HIGHER revision (belt and braces next to the in-memory check). */
  async upsertAnswers(attemptId: string, rows: AnswerRow[]): Promise<void> {
    if (!rows.length) return
    const payload = JSON.stringify(rows.map((r) => ({ part_id: r.partId, answer: r.answer, rev: r.rev, saved_at: r.savedAt.toISOString() })))
    await this.prisma.client.$executeRaw`
      insert into attempt_answers (attempt_id, part_id, answer, rev, saved_at)
      select ${attemptId}::uuid, x.part_id, x.answer, x.rev, x.saved_at
        from jsonb_to_recordset(${payload}::jsonb) as x(part_id text, answer jsonb, rev int, saved_at timestamptz)
      on conflict (attempt_id, part_id) do update
        set answer = excluded.answer, rev = excluded.rev, saved_at = excluded.saved_at, updated_at = now()
        where attempt_answers.rev < excluded.rev`
  }

  async checkCounts(attemptId: string): Promise<{ order: string[]; counts: Map<string, number> }> {
    const rows = await this.prisma.client.attemptCheck.findMany({ where: { attemptId }, orderBy: { id: 'asc' } })
    return { order: rows.map((r) => r.questionId), counts: new Map(rows.map((r) => [r.questionId, r.checkCount])) }
  }

  async saveCheck(attemptId: string, questionId: string, count: number, result: unknown): Promise<void> {
    await this.prisma.client.attemptCheck.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, checkCount: count, result: result as object },
      update: { checkCount: count, result: result as object },
    })
  }

  async photos(attemptId: string): Promise<PhotoRow[]> {
    const rows = await this.prisma.client.attemptPhoto.findMany({ where: { attemptId }, orderBy: { id: 'asc' } })
    if (!rows.length) return []
    const files = await this.prisma.client.file.findMany({ where: { id: { in: rows.map((r) => r.fileId) } }, select: { id: true, publicId: true } })
    const key = new Map(files.map((f) => [f.id, f.publicId]))
    return rows.flatMap((r) => {
      const publicId = key.get(r.fileId)
      return publicId ? [{ partId: r.partId, key: publicId, name: r.name, size: r.sizeBytes }] : []
    })
  }

  async addPhoto(input: { attemptId: string; partId: string; filePublicId: string; name: string; size: number }): Promise<void> {
    const file = await this.prisma.client.file.findUnique({ where: { publicId: input.filePublicId }, select: { id: true } })
    if (!file) throw new Error('Photo file row missing')
    await this.prisma.client.attemptPhoto.create({
      data: { attemptId: input.attemptId, partId: input.partId, fileId: file.id, name: input.name, sizeBytes: input.size },
    })
  }

  async result(attemptId: string): Promise<BijakAttemptResult | null> {
    const r = await this.prisma.client.attemptResult.findUnique({ where: { attemptId } })
    if (!r) return null
    const graded = r.graded as unknown as Pick<BijakAttemptResult, 'sections' | 'questions'>
    const score = Number(r.score)
    const max = Number(r.maxScore)
    return {
      score,
      max,
      percent: max ? Math.round((score / max) * 1000) / 10 : 0,
      provisional: r.provisional,
      pendingReview: r.pendingReview,
      sections: graded.sections,
      questions: graded.questions,
      coins: r.coins ?? score * 2,
      points: r.points ?? score * 10,
    }
  }

  /** Stores (or replaces, on a late-sync regrade) the result. One row per attempt: the primary key is the attempt id. */
  async saveResult(attemptId: string, result: BijakAttemptResult): Promise<void> {
    const data = {
      score: result.score,
      maxScore: result.max,
      provisional: result.provisional,
      pendingReview: result.pendingReview,
      coins: result.coins,
      points: result.points,
      graded: { sections: result.sections, questions: result.questions } as unknown as object,
    }
    await this.prisma.client.attemptResult.upsert({ where: { attemptId }, create: { attemptId, ...data }, update: data })
  }

  async history(userId: string, limit: number): Promise<HistoryRecord[]> {
    const rows = await this.prisma.client.examAttempt.findMany({
      where: { userId: idFromString(userId) },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { result: { select: { score: true, maxScore: true } } },
    })
    return rows.map((r) => ({
      row: this.toRow(r),
      score: r.result ? Number(r.result.score) : null,
      max: r.result ? Number(r.result.maxScore) : null,
    }))
  }

  /** Open exam attempts whose deadline is before `cutoff` (deadline + grace has passed). */
  async expiredIds(cutoff: Date, limit: number, userId?: string): Promise<string[]> {
    const rows = await this.prisma.client.examAttempt.findMany({
      where: {
        status: 'in_progress',
        deadlineAt: { lt: cutoff },
        ...(userId ? { userId: idFromString(userId) } : {}),
      },
      orderBy: { deadlineAt: 'asc' },
      take: limit,
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }
}
