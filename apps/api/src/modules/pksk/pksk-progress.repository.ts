import { Inject, Injectable } from '@nestjs/common'
import type { PkskGrade, PkskLevel } from '@pp/contract'

import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface AttemptRecord {
  id: string
  completedAt: Date
  scorePct: number
  bahagianBPct: number
  grade: PkskGrade
}

export interface NewAttempt {
  userId: string
  level: PkskLevel
  completedAt: Date
  scorePct: number
  bahagianAPct: number
  bahagianBPct: number
  bahagianCPct: number
  grade: PkskGrade
  isTest: boolean
}

/** Exam attempts, mastery and practice loads (BR-M07-09 to -12, -26). The only code that touches those three tables. */
@Injectable()
export class PkskProgressRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Completed attempts of the user at the level, newest first. Test rows are visible only in test mode (G-07). */
  async attempts(userId: string, level: PkskLevel, includeTest: boolean): Promise<AttemptRecord[]> {
    const rows = await this.prisma.client.pkskExamAttempt.findMany({
      where: { userId: idFromString(userId), level, ...(includeTest ? {} : { isTest: false }) },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((r) => ({
      id: idToString(r.id),
      completedAt: r.completedAt,
      scorePct: Number(r.scorePct),
      bahagianBPct: Number(r.bahagianBPct),
      grade: r.grade as PkskGrade,
    }))
  }

  async addAttempt(a: NewAttempt): Promise<{ id: string; completedAt: Date; scorePct: number; grade: PkskGrade }> {
    const row = await this.prisma.client.pkskExamAttempt.create({
      data: {
        userId: idFromString(a.userId),
        level: a.level,
        completedAt: a.completedAt,
        scorePct: a.scorePct,
        bahagianAPct: a.bahagianAPct,
        bahagianBPct: a.bahagianBPct,
        bahagianCPct: a.bahagianCPct,
        grade: a.grade,
        isTest: a.isTest,
      },
    })
    return { id: idToString(row.id), completedAt: row.completedAt, scorePct: Number(row.scorePct), grade: row.grade as PkskGrade }
  }

  /** Mastery per domain id (decimal string) at the level; absent means 0. A test row counts only in test mode. */
  async masteryMap(userId: string, level: PkskLevel, includeTest: boolean): Promise<Map<string, number>> {
    const rows = await this.prisma.client.pkskMastery.findMany({
      where: { userId: idFromString(userId), level, ...(includeTest ? {} : { isTest: false }) },
    })
    return new Map(rows.map((r) => [idToString(r.domainId), r.masteryPct]))
  }

  async setMastery(userId: string, level: PkskLevel, domainId: string, masteryPct: number, isTest: boolean): Promise<void> {
    const key = { userId: idFromString(userId), level, domainId: idFromString(domainId) }
    await this.prisma.client.pkskMastery.upsert({
      where: { userId_level_domainId: key },
      create: { ...key, masteryPct, isTest },
      update: { masteryPct, isTest },
    })
  }

  /** BR-M07-26 (1): records when a practice set was served (upsert). */
  async markLoaded(userId: string, level: PkskLevel, domainId: string, at: Date): Promise<void> {
    const key = { userId: idFromString(userId), level, domainId: idFromString(domainId) }
    await this.prisma.client.pkskPracticeLoad.upsert({
      where: { userId_level_domainId: key },
      create: { ...key, loadedAt: at },
      update: { loadedAt: at },
    })
  }

  /** The load time of the open practice page, removed by the submission; null when none. */
  async takeLoaded(userId: string, level: PkskLevel, domainId: string): Promise<Date | null> {
    const key = { userId: idFromString(userId), level, domainId: idFromString(domainId) }
    const row = await this.prisma.client.pkskPracticeLoad.findUnique({ where: { userId_level_domainId: key } })
    if (!row) return null
    await this.prisma.client.pkskPracticeLoad.deleteMany({ where: { id: row.id } })
    return row.loadedAt
  }
}
