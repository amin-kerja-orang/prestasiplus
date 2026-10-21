import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { isUuid } from '../play/solo.repository'

export interface JutawanSession {
  id: string
  userId: string
  game: string
  subjectId: string | null
  level: number
  lifelines: number
  removed: number[]
  over: boolean
  checks: number
  correctCount: number
  isTest: boolean
  createdAt: Date
}

export interface JutawanItem {
  id: bigint
  position: number
  questionId: string
  keyIndex: number | null
  difficulty: number | null
}

/** Jutawan Ilmu runs: `game_sessions` (jutawan_* columns), `game_session_items` (the 15 questions) and `jutawan_stats`. Joins the ambient transaction. */
@Injectable()
export class JutawanRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  async stats(userId: string): Promise<{ bestLevel: number; games: number }> {
    const r = await this.db.jutawanStat.findUnique({ where: { userId: idFromString(userId) }, select: { bestLevel: true, games: true } })
    return { bestLevel: r?.bestLevel ?? 0, games: r?.games ?? 0 }
  }

  async create(input: { userId: string; darjah: number; subjectId: string; isTest: boolean; createdAt: Date; items: readonly { questionId: string; keyIndex: number; difficulty: number }[] }): Promise<string> {
    const row = await this.db.gameSession.create({
      data: {
        userId: idFromString(input.userId),
        game: 'jutawan',
        darjah: input.darjah,
        itemCount: input.items.length,
        jutawanSubjectId: idFromString(input.subjectId),
        jutawanLevel: 0,
        jutawanLifelines: 3,
        jutawanRemovedOptions: [],
        jutawanOver: false,
        isTest: input.isTest,
        createdAt: input.createdAt,
      },
      select: { id: true },
    })
    await this.db.gameSessionItem.createMany({
      data: input.items.map((it, i) => ({ sessionId: row.id, position: i + 1, questionId: idFromString(it.questionId), keyIndex: it.keyIndex, difficulty: it.difficulty })),
    })
    return row.id
  }

  /** Locks the caller's Jutawan session (`FOR UPDATE`); `null` for a malformed, unknown or foreign id. */
  async lockOwn(sessionId: string, userId: string): Promise<JutawanSession | null> {
    if (!isUuid(sessionId)) return null
    const uid = idFromString(userId)
    const locked = await this.db.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM game_sessions WHERE id = ${sessionId}::uuid AND user_id = ${uid}::bigint FOR UPDATE`
    if (locked.length === 0) return null
    const r = await this.db.gameSession.findUnique({ where: { id: sessionId } })
    if (!r) return null
    return {
      id: r.id,
      userId: idToString(r.userId),
      game: r.game,
      subjectId: r.jutawanSubjectId === null ? null : idToString(r.jutawanSubjectId),
      level: r.jutawanLevel ?? 0,
      lifelines: r.jutawanLifelines ?? 0,
      removed: r.jutawanRemovedOptions,
      over: r.jutawanOver,
      checks: r.checks,
      correctCount: r.correctCount,
      isTest: r.isTest,
      createdAt: r.createdAt,
    }
  }

  async itemAt(sessionId: string, position: number): Promise<JutawanItem | null> {
    const r = await this.db.gameSessionItem.findUnique({ where: { sessionId_position: { sessionId, position } } })
    return r ? { id: r.id, position: r.position, questionId: idToString(r.questionId), keyIndex: r.keyIndex, difficulty: r.difficulty } : null
  }

  /** When each answer was stored, in answer order. */
  async answerTimes(sessionId: string): Promise<Date[]> {
    const rows = await this.db.gameSessionItem.findMany({ where: { sessionId, checkedSeq: { not: null } }, orderBy: { checkedSeq: 'asc' }, select: { checkedAt: true } })
    return rows.map((r) => r.checkedAt as Date)
  }

  async storeAnswer(itemId: bigint, f: { seq: number; correct: boolean; optionId: number; at: Date }): Promise<void> {
    await this.db.gameSessionItem.update({ where: { id: itemId }, data: { checkedSeq: f.seq, correct: f.correct, answer: String(f.optionId), checkedAt: f.at } })
  }

  async update(
    id: string,
    data: { jutawanLevel?: number; jutawanLifelines?: number; jutawanRemovedOptions?: number[]; jutawanOver?: boolean; checks?: number; correctCount?: number; submittedAt?: Date; score?: number; coinsComputed?: number; coinsCredited?: number },
  ): Promise<void> {
    await this.db.gameSession.update({ where: { id }, data })
  }

  /** Best level and games count, atomically (one row per user). */
  async bumpStats(userId: string, level: number, isTest: boolean): Promise<void> {
    const uid = idFromString(userId)
    await this.db.$executeRaw`
      INSERT INTO jutawan_stats (user_id, best_level, games, is_test) VALUES (${uid}::bigint, ${level}, 1, ${isTest})
      ON CONFLICT (user_id) DO UPDATE SET best_level = GREATEST(jutawan_stats.best_level, ${level}), games = jutawan_stats.games + 1`
  }
}
