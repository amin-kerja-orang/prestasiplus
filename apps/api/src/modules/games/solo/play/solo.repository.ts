import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import type { ItemRow } from './solo-items'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (text: unknown): text is string => typeof text === 'string' && UUID.test(text)

export interface SessionRecord {
  id: string
  userId: string
  game: string
  darjah: number | null
  itemCount: number | null
  maxScore: number | null
  submittedAt: Date | null
  moves: number
  fastMoves: number
  closedAt: Date | null
  openCardId: string | null
  checks: number
  correctCount: number
  isTest: boolean
  createdAt: Date
}

export interface ItemRecord {
  id: bigint
  position: number
  questionId: string
  cardId: string | null
  face: string | null
  pairKey: number | null
  matched: boolean
  keyIndex: number | null
  statementTrue: boolean | null
  difficulty: number | null
  points: number | null
  checkedSeq: number | null
  correct: boolean | null
  checkedAt: Date | null
}

/** Single-player sessions and their items (tables `game_sessions`, `game_session_items`, `personal_bests`). Joins the ambient transaction. */
@Injectable()
export class SoloRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /**
   * One open session per user and game: serialises starts of the pair (advisory lock until the end of the transaction),
   * then closes every unsubmitted, unclosed session of it. Call first inside the starting transaction.
   */
  async supersede(userId: string, game: string, at: Date): Promise<void> {
    const uid = idFromString(userId)
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'games:session:' + userId + ':' + game}))`
    await this.db.$executeRaw`UPDATE game_sessions SET closed_at = ${at}, jutawan_over = (jutawan_over OR game = 'jutawan') WHERE user_id = ${uid}::bigint AND game = ${game} AND submitted_at IS NULL AND closed_at IS NULL`
  }

  async createSession(input: { userId: string; game: string; darjah: number | null; itemCount: number; maxScore: number; isTest: boolean; createdAt: Date }): Promise<string> {
    const row = await this.db.gameSession.create({
      data: {
        userId: idFromString(input.userId),
        game: input.game,
        darjah: input.darjah,
        itemCount: input.itemCount,
        maxScore: input.maxScore,
        isTest: input.isTest,
        createdAt: input.createdAt,
      },
      select: { id: true },
    })
    return row.id
  }

  async addItems(sessionId: string, rows: readonly ItemRow[]): Promise<void> {
    if (rows.length === 0) return
    await this.db.gameSessionItem.createMany({
      data: rows.map((r) => ({
        sessionId,
        position: r.position,
        questionId: idFromString(r.questionId),
        keyIndex: r.keyIndex,
        statementTrue: r.statementTrue,
        difficulty: r.difficulty,
        points: r.points,
        cardId: r.cardId,
        face: r.face,
        pairKey: r.pairKey,
      })),
    })
  }

  /**
   * Locks the session row of `userId` (`FOR UPDATE`) until the end of the transaction: concurrent checks and submits of
   * one session are serialised. `null` when the id is malformed, unknown or somebody else's.
   */
  async lockOwn(sessionId: unknown, userId: string): Promise<SessionRecord | null> {
    if (!isUuid(sessionId)) return null
    const uid = idFromString(userId)
    const locked = await this.db.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM game_sessions WHERE id = ${sessionId}::uuid AND user_id = ${uid}::bigint FOR UPDATE`
    if (locked.length === 0) return null
    return this.session(sessionId)
  }

  async session(id: string): Promise<SessionRecord | null> {
    const r = await this.db.gameSession.findUnique({ where: { id } })
    if (!r) return null
    return {
      id: r.id,
      userId: idToString(r.userId),
      game: r.game,
      darjah: r.darjah,
      itemCount: r.itemCount,
      maxScore: r.maxScore,
      submittedAt: r.submittedAt,
      moves: r.moves,
      fastMoves: r.fastMoves,
      closedAt: r.closedAt,
      openCardId: r.openCardId,
      checks: r.checks,
      correctCount: r.correctCount,
      isTest: r.isTest,
      createdAt: r.createdAt,
    }
  }

  async items(sessionId: string): Promise<ItemRecord[]> {
    const rows = await this.db.gameSessionItem.findMany({ where: { sessionId }, orderBy: { position: 'asc' } })
    return rows.map(toItem)
  }

  async itemByQuestion(sessionId: string, questionId: string): Promise<ItemRecord | null> {
    let qid: bigint
    try {
      qid = idFromString(questionId)
    } catch {
      return null
    }
    const r = await this.db.gameSessionItem.findFirst({ where: { sessionId, questionId: qid }, orderBy: { position: 'asc' } })
    return r ? toItem(r) : null
  }

  async itemByCard(sessionId: string, cardId: string): Promise<ItemRecord | null> {
    const r = await this.db.gameSessionItem.findFirst({ where: { sessionId, cardId } })
    return r ? toItem(r) : null
  }

  /** Checked items in `checked_seq` order (the input of the server-side scoring). */
  async checkedItems(sessionId: string): Promise<ItemRecord[]> {
    const rows = await this.db.gameSessionItem.findMany({ where: { sessionId, checkedSeq: { not: null } }, orderBy: { checkedSeq: 'asc' } })
    return rows.map(toItem)
  }

  async storeCheck(itemId: bigint, f: { seq: number; correct: boolean; answer: string; at: Date; matched?: boolean }): Promise<void> {
    await this.db.gameSessionItem.update({
      where: { id: itemId },
      data: { checkedSeq: f.seq, correct: f.correct, answer: f.answer, checkedAt: f.at, ...(f.matched === undefined ? {} : { matched: f.matched }) },
    })
  }

  /** Kad Memori: marks the time of a mismatched move on a card (no `checked_seq`, so it is not a stored check). */
  async touch(itemId: bigint, at: Date): Promise<void> {
    await this.db.gameSessionItem.update({ where: { id: itemId }, data: { checkedAt: at } })
  }

  async updateSession(
    id: string,
    data: { fastMoves?: number; checks?: number; correctCount?: number; moves?: number; openCardId?: string | null; submittedAt?: Date; score?: number; coinsComputed?: number; coinsCredited?: number; isNewRecord?: boolean },
  ): Promise<void> {
    await this.db.gameSession.update({ where: { id }, data })
  }

  async bestOf(userId: string, game: string): Promise<number> {
    const r = await this.db.personalBest.findUnique({ where: { userId_game: { userId: idFromString(userId), game } }, select: { bestScore: true } })
    return r?.bestScore ?? 0
  }

  /**
   * BR-M16-27: the first result is a record (even 0), later ones only when they beat the stored best. The personal-best row is
   * locked, so two sessions of one user submitting at once cannot both claim the record.
   */
  async recordBest(userId: string, game: string, score: number, isTest: boolean, at: Date): Promise<boolean> {
    const uid = idFromString(userId)
    const inserted = await this.db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO personal_bests (user_id, game, best_score, is_test, updated_at)
      VALUES (${uid}::bigint, ${game}, ${score}, ${isTest}, ${at})
      ON CONFLICT (user_id, game) DO NOTHING RETURNING id`
    if (inserted.length > 0) return true
    const current = await this.db.$queryRaw<{ best: number }[]>`SELECT best_score AS best FROM personal_bests WHERE user_id = ${uid}::bigint AND game = ${game} FOR UPDATE`
    if (score <= (current[0]?.best ?? 0)) return false
    await this.db.$executeRaw`UPDATE personal_bests SET best_score = ${score}, updated_at = ${at} WHERE user_id = ${uid}::bigint AND game = ${game}`
    return true
  }
}

function toItem(r: {
  id: bigint
  position: number
  questionId: bigint
  cardId: string | null
  face: string | null
  pairKey: number | null
  matched: boolean
  keyIndex: number | null
  statementTrue: boolean | null
  difficulty: number | null
  points: number | null
  checkedSeq: number | null
  correct: boolean | null
  checkedAt: Date | null
}): ItemRecord {
  return {
    id: r.id,
    position: r.position,
    questionId: idToString(r.questionId),
    cardId: r.cardId,
    face: r.face,
    pairKey: r.pairKey,
    matched: r.matched,
    keyIndex: r.keyIndex,
    statementTrue: r.statementTrue,
    difficulty: r.difficulty,
    points: r.points,
    checkedSeq: r.checkedSeq,
    correct: r.correct,
    checkedAt: r.checkedAt,
  }
}
