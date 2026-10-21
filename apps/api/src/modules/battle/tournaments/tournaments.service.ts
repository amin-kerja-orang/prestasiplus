import { Inject, Injectable } from '@nestjs/common'
import type { z } from 'zod'
import {
  BATTLE_MESSAGES,
  BattleTournamentActiveSchema,
  BattleTournamentFormOptionsSchema,
  BattleTournamentListItemSchema,
} from '@pp/contract'
import type { Tournament } from '../../../db/generated/client'

import { toMytTimestamp } from '../../../common/time/myt'
import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { BattleDeps } from '../battle.deps'
import { SPM_COUNTS } from './spm-counts'
import { parseTournamentBody } from './tournaments.validation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface TournamentViewer {
  userId: string
  isAdmin: boolean
  /** Mod Pelajar session: sees and writes test rows. */
  isTest: boolean
}

type ActiveStatus = 'registration' | 'ongoing'
type Shown = 'draft' | 'registration' | 'ongoing' | 'completed'

/** `registration` past its close date reads as `ongoing` (derived on read, BR-M16-32; no job runs). */
function shownStatus(t: Pick<Tournament, 'status' | 'registrationClosesAt'>, now: Date): Shown {
  if (t.status === 'registration' && t.registrationClosesAt !== null && t.registrationClosesAt.getTime() <= now.getTime()) {
    return 'ongoing'
  }
  return t.status as Shown
}

@Injectable()
export class TournamentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleDeps) private readonly deps: BattleDeps,
  ) {}

  /** Registration or ongoing tournaments in banner order: opening date (null last), then creation time. */
  private async activeRows(viewer: TournamentViewer): Promise<(Tournament & { shown: ActiveStatus })[]> {
    const now = this.clock.now()
    const rows = await this.prisma.client.tournament.findMany({
      where: { status: { in: ['registration', 'ongoing'] }, ...(viewer.isTest ? {} : { isTest: false }) },
      orderBy: [{ registrationOpensAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.flatMap((t) => {
      const shown = shownStatus(t, now)
      return shown === 'registration' || shown === 'ongoing' ? [{ ...t, shown }] : []
    })
  }

  async active(viewer: TournamentViewer): Promise<z.infer<typeof BattleTournamentActiveSchema>[]> {
    return (await this.activeRows(viewer)).map((t) => ({ uuid: t.id, title: t.title, status: t.shown, live_match: null }))
  }

  async list(viewer: TournamentViewer): Promise<z.infer<typeof BattleTournamentListItemSchema>[]> {
    return (await this.activeRows(viewer)).map((t) => ({ uuid: t.id, title: t.title, status: t.shown }))
  }

  async formOptions(): Promise<z.infer<typeof BattleTournamentFormOptionsSchema>> {
    const subjects = (await this.deps.subjects())
      .map((s) => ({ id: s.id, name: s.name, code: s.code }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ms') || (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    return {
      educationLevels: [
        { id: 'tingkatan4', name: 'Tingkatan 4' },
        { id: 'tingkatan5', name: 'Tingkatan 5' },
        { id: 'spm', name: 'SPM (Tingkatan 4 & 5)' },
      ],
      subjects,
      examPapers: [],
      spmCounts: { ...SPM_COUNTS },
    }
  }

  async create(viewer: TournamentViewer, body: unknown): Promise<{ uuid: string; status: 'draft' | 'registration' }> {
    const subjects = await this.deps.subjects()
    const input = parseTournamentBody(body, new Set(subjects.map((s) => s.id)))
    const status = input.action === 'draft' ? 'draft' : 'registration'
    const row = await this.prisma.transaction(async (tx) =>
      tx.tournament.create({
        data: {
          title: input.title,
          description: input.description,
          educationLevelId: input.educationLevelId,
          format: input.format,
          groupsCount: input.groupsCount,
          questionMode: input.questionMode,
          subjectId: input.subjectId === null ? null : idFromString(input.subjectId),
          examPaperId: null,
          totalQuestions: input.totalQuestions,
          timeWindowMinutes: input.timeWindowMinutes,
          topNScoring: input.topNScoring,
          minParticipants: input.minParticipants,
          registrationOpensAt: input.registrationOpensAt,
          registrationClosesAt: input.registrationClosesAt,
          status,
          createdBy: idFromString(viewer.userId),
          isTest: viewer.isTest,
          createdAt: this.clock.now(),
          subjects: { create: input.mixedSubjectIds.map((id) => ({ subjectId: idFromString(id) })) },
        },
      }),
    )
    return { uuid: row.id, status }
  }

  async detail(viewer: TournamentViewer, uuid: string) {
    const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: BATTLE_MESSAGES.tournamentNotFound })
    if (!UUID.test(uuid)) throw notFound()
    const t = await this.prisma.client.tournament.findUnique({
      where: { id: uuid.toLowerCase() },
      include: { subjects: { orderBy: { id: 'asc' } } },
    })
    if (!t || (t.status === 'draft' && !viewer.isAdmin) || (t.isTest && !viewer.isTest)) throw notFound()
    return {
      uuid: t.id,
      title: t.title,
      description: t.description,
      status: shownStatus(t, this.clock.now()),
      educationLevelId: t.educationLevelId,
      format: t.format,
      groupsCount: t.groupsCount,
      questionMode: t.questionMode,
      subjectId: t.subjectId === null ? null : idToString(t.subjectId),
      examPaperId: null,
      mixedSubjectIds: t.subjects.map((s) => idToString(s.subjectId)),
      totalQuestions: t.totalQuestions,
      timeWindowMinutes: t.timeWindowMinutes,
      topNScoring: t.topNScoring,
      minParticipants: t.minParticipants,
      registrationOpensAt: t.registrationOpensAt === null ? null : toMytTimestamp(t.registrationOpensAt),
      registrationClosesAt: t.registrationClosesAt === null ? null : toMytTimestamp(t.registrationClosesAt),
      liveMatch: null,
      createdAt: toMytTimestamp(t.createdAt),
    }
  }
}
