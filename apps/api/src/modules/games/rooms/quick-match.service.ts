import { Inject, Injectable } from '@nestjs/common'
import {
  GamesQuickMatchStartRequestSchema,
  type GamesQuickMatchPollResponse,
  type GamesRoomSubject,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { GameUsers } from '../core/game-users'
import { enumOfGrade } from '../core/grades'
import { type Caller, RoomsService } from './rooms.service'
import { RoomsRepository } from './rooms.repository'

/** BR-M16-24: the third poll matches; a search older than 120 s expires (clock injected). */
export const QUICK_MATCH_ON_POLL = 3
export const QUICK_MATCH_EXPIRES_MS = 120_000

export type QuickStart = { ok: true; body: { status: 'searching' } } | { ok: false; error: string }

/** Papan Bijak quick match (M16-29..31). Returns raw bodies; the controller sets the status. */
@Injectable()
export class QuickMatchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoomsRepository) private readonly repo: RoomsRepository,
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async start(caller: Caller, body: unknown): Promise<QuickStart> {
    const r = GamesQuickMatchStartRequestSchema.safeParse(
      typeof body === 'object' && body !== null ? body : {},
    )
    if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Subjek tidak sah.' }
    await this.repo.insertSearch(
      caller.userId,
      r.data.subject,
      r.data.match_mode,
      caller.isTest,
      this.clock.now(),
    )
    return { ok: true, body: { status: 'searching' } }
  }

  async poll(caller: Caller): Promise<GamesQuickMatchPollResponse> {
    const latest = await this.repo.latestSearch(caller.userId)
    if (!latest || latest.status === 'cancelled') return { status: 'cancelled' }
    if (latest.status === 'expired') return { status: 'expired' }
    if (latest.status === 'matched')
      return { status: 'matched', room_code: latest.roomCode as string }
    return this.prisma.transaction(async () => {
      // Lock the search row: two overlapping polls never create two rooms.
      const s = await this.repo.lockSearch(latest.id)
      if (!s || s.status === 'cancelled') return { status: 'cancelled' } as const
      if (s.status === 'expired') return { status: 'expired' } as const
      if (s.status === 'matched')
        return { status: 'matched', room_code: s.roomCode as string } as const
      const polls = s.polls + 1
      if (this.clock.now().getTime() - s.createdAt.getTime() >= QUICK_MATCH_EXPIRES_MS) {
        await this.repo.updateSearch(s.id, { status: 'expired', polls })
        return { status: 'expired' } as const
      }
      if (polls < QUICK_MATCH_ON_POLL) {
        await this.repo.updateSearch(s.id, { polls })
        return { status: 'searching' } as const
      }
      const viewer = await this.users.get(caller.userId)
      const code = await this.rooms.createRoom(caller, 'papan-bijak', {
        subject: s.subject as GamesRoomSubject,
        gradeLevel: enumOfGrade(viewer?.grade ?? null) ?? 'DARJAH_4',
        matchMode: s.matchMode,
        gradeMin: null,
        gradeMax: null,
        maxPlayers: 4,
      })
      const room = await this.repo.room(code)
      if (room) await this.rooms.addBot(room, await this.repo.players(code))
      await this.repo.updateSearch(s.id, { status: 'matched', polls, roomCode: code })
      return { status: 'matched', room_code: code } as const
    })
  }

  async cancel(caller: Caller): Promise<{ status: 'cancelled' }> {
    await this.prisma.transaction(async () => {
      const s = await this.repo.latestSearch(caller.userId)
      if (s && s.status === 'searching') {
        const locked = await this.repo.lockSearch(s.id)
        if (locked?.status === 'searching')
          await this.repo.updateSearch(s.id, { status: 'cancelled' })
      }
    })
    return { status: 'cancelled' }
  }
}
