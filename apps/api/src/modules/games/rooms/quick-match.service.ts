import { Inject, Injectable } from '@nestjs/common'
import {
  GamesQuickMatchStartRequestSchema,
  type GamesQuickMatchPollResponse,
  type GamesRoomSubject,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { GameSettingsService } from '../core/game-settings.service'
import { GameUsers } from '../core/game-users'
import { enumOfGrade, gradeFits } from '../core/grades'
import { type Caller, RoomsService } from './rooms.service'
import { RoomsRepository, type SearchRow } from './rooms.repository'

/** BR-M16-24: the third poll matches; a search older than the game setting `battle_queue_seconds` (default 120 s) expires (clock injected). */
export const QUICK_MATCH_ON_POLL = 3

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
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
  ) {}

  /** The queue time in ms, read from `battle_queue_seconds` on each request. */
  private async expiresMs(): Promise<number> {
    return (await this.settings.get('battle_queue_seconds')) * 1000
  }

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
    const expiresMs = await this.expiresMs()
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
      if (this.clock.now().getTime() - s.createdAt.getTime() >= expiresMs) {
        await this.repo.updateSearch(s.id, { status: 'expired', polls })
        return { status: 'expired' } as const
      }
      // Ruling 16: a pupil is matched before the robot; the third poll only brings the robot when no pupil fits.
      const paired = await this.pairWithPupil(caller, s, expiresMs)
      if (paired !== null) {
        await this.repo.updateSearch(s.id, { status: 'matched', polls, roomCode: paired })
        return { status: 'matched', room_code: paired } as const
      }
      if (polls < QUICK_MATCH_ON_POLL) {
        await this.repo.updateSearch(s.id, { polls })
        return { status: 'searching' } as const
      }
      const viewer = await this.users.get(caller.userId)
      const code = await this.rooms.createRoom(caller, 'papan-bijak', {
        subject: s.subject as GamesRoomSubject,
        gradeLevel: enumOfGrade(viewer?.grade ?? null) ?? 'TINGKATAN_4', // no Darjah in any game level (FR-MUR-21-3)
        matchMode: s.matchMode,
        gradeMin: null,
        gradeMax: null,
        maxPlayers: 4,
      })
      const room = await this.repo.room(code)
      if (room) await this.rooms.addRobots(room, await this.repo.players(code))
      await this.repo.updateSearch(s.id, { status: 'matched', polls, roomCode: code })
      return { status: 'matched', room_code: code } as const
    })
  }

  /**
   * Cari Lawan Auto, 48 GAME-R: the oldest other pupil searching with the same subject and match mode (same Tingkatan for
   * `same_grade`, the same level for `same_level`; Mod Pelajar only meets Mod Pelajar). The poller's search row is already
   * locked; the other row is locked with SKIP LOCKED, so two pupils polling at once never wait for each other and never make
   * two rooms: the one that cannot lock tries again on its next poll. The poller is the host and both are seated as players;
   * the other pupil is marked matched and reads the same room code on their next poll. Until R2 the engine still simulates
   * every non-host seat, so play is host-driven. Returns the room code, or null when nobody fits.
   */
  private async pairWithPupil(caller: Caller, s: SearchRow, expiresMs: number): Promise<string | null> {
    const now = this.clock.now()
    const viewer = await this.users.get(caller.userId)
    const room = {
      gradeLevel: enumOfGrade(viewer?.grade ?? null) ?? 'TINGKATAN_4', // no Darjah in any game level (FR-MUR-21-3)
      matchMode: s.matchMode,
      gradeMin: null,
      gradeMax: null,
    }
    const candidates = await this.repo.pairCandidates(s, new Date(now.getTime() - expiresMs), 25)
    for (const c of candidates) {
      const other = await this.users.get(c.userId)
      if (!other || !gradeFits(room, other.grade ?? null)) continue
      const locked = await this.repo.lockSearchSkipLocked(c.id)
      if (locked?.status !== 'searching' || now.getTime() - locked.createdAt.getTime() >= expiresMs) continue
      const code = await this.rooms.createRoom(caller, 'papan-bijak', {
        subject: s.subject as GamesRoomSubject,
        gradeLevel: room.gradeLevel,
        matchMode: s.matchMode,
        gradeMin: null,
        gradeMax: null,
        maxPlayers: 4,
      })
      await this.repo.addPlayer(code, locked.userId, locked.isTest, now)
      await this.repo.updateSearch(locked.id, { status: 'matched', roomCode: code })
      return code
    }
    return null
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
