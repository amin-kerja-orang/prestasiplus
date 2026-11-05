import { Inject, Injectable } from '@nestjs/common'
import {
  GAMES_ADMIN_SETTING_KEYS,
  GAMES_ADMIN_SETTINGS,
  GamesAdminSettingsUpdateRequestSchema,
  GamesAdminSpinSegmentsUpdateRequestSchema,
  type GamesAdminOverview,
  type GamesAdminSettingsResult,
  type GamesAdminSpinSegments,
} from '@pp/contract'

import { AuditService } from '../../../../common/audit/audit.service'
import { strictFieldsOf } from '../../../../common/validation/strict-body'
import { CLOCK, type Clock } from '../../../../db/clock'
import type { TxClient } from '../../../../db/client'
import { PrismaService } from '../../../../db/prisma.service'
import { GameSettingsService } from '../../core/game-settings.service'
import { adminSettingsInvalid } from '../../errors'
import { DEFAULT_QUIZ_TILES, GAMES_ADMIN_WRITE_TX, GAMES_AUDIT } from '../../games.constants'
import { RoomsRepository } from '../rooms.repository'

/** Who is saving: the signed-in admin and the request facts the audit row needs. */
export interface GamesAdminActor {
  userId: string
  role: string
  sessionRowId: string
  scopeLevel: string
  schoolId: string | null
  isTest: boolean
  requestId: string | null
  ip: string | null
}

type Issues = Parameters<typeof strictFieldsOf>[0]

/** 422 of a failed strict parse. An unknown key has an English message, so it never becomes the top-level message. */
function invalid(issues: Issues) {
  return adminSettingsInvalid(strictFieldsOf(issues), issues.find((i) => i.code !== 'unrecognized_keys')?.message)
}

const sameSegments = (a: GamesAdminSpinSegments, b: GamesAdminSpinSegments): boolean =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i]
    return y !== undefined && x.position === y.position && x.label === y.label && x.syiling === y.syiling && x.weight === y.weight && x.active === y.active
  })

const StrictSettingsUpdate = GamesAdminSettingsUpdateRequestSchema.strict()

/** The audit names keep to the request's keys, so before and after read like the body that was sent. */
const auditKeyOf = (key: keyof GamesAdminSettingsResult): string => (key === 'boardgameQuizTiles' ? 'boardgame_quiz_tiles' : key)

/**
 * Admin game settings (M16-51, M16-52, API-ADM-08, API-ADM-23). Statistics exclude test rooms. `boardgame_quiz_tiles`
 * stays in `game_settings` (`RoomsRepository`); the other keys are the `gamification_settings` rows of
 * `GameSettingsService`. A save only changes the stored value, so it reaches later events and never recalculates.
 */
@Injectable()
export class AdminGamesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoomsRepository) private readonly repo: RoomsRepository,
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async overview(): Promise<GamesAdminOverview> {
    return { stats: await this.repo.stats(), settings: await this.readSettings() }
  }

  /** Partial and all or nothing: a parse failure saves nothing; a save that changes nothing writes no audit row. */
  async saveSettings(actor: GamesAdminActor, body: unknown): Promise<GamesAdminSettingsResult> {
    const parsed = StrictSettingsUpdate.safeParse(body)
    if (!parsed.success) throw invalid(parsed.error.issues)
    const input = parsed.data
    const now = this.clock.now()
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockAdminSettings('settings')
      const before = await this.readSettings(tx)
      const changed = GAMES_ADMIN_SETTING_KEYS.filter((key) => input[key] !== undefined && input[key] !== before[key])
      const tiles = input.boardgame_quiz_tiles
      const tilesChanged = tiles !== undefined && tiles !== before.boardgameQuizTiles
      if (!tilesChanged && changed.length === 0) return before

      if (tilesChanged) await this.repo.setQuizTiles(tiles, now)
      await this.settings.setMany(
        changed.map((key) => ({ key, value: input[key] as number, label: GAMES_ADMIN_SETTINGS[key].label })),
        now,
        tx,
      )
      const after = await this.readSettings(tx)
      const keys: (keyof GamesAdminSettingsResult)[] = [...(tilesChanged ? (['boardgameQuizTiles'] as const) : []), ...changed]
      await this.record(tx, actor, GAMES_AUDIT.SETTINGS_UPDATED, 'game_settings', {
        before: Object.fromEntries(keys.map((key) => [auditKeyOf(key), before[key]])),
        after: Object.fromEntries(keys.map((key) => [auditKeyOf(key), after[key]])),
      })
      return after
    }, GAMES_ADMIN_WRITE_TX)
  }

  async spinSegments(): Promise<GamesAdminSpinSegments> {
    return this.repo.spinSegments()
  }

  /** The 8 rows are saved together with the audit row; the same 8 rows write no audit row. */
  async saveSpinSegments(actor: GamesAdminActor, body: unknown): Promise<GamesAdminSpinSegments> {
    const parsed = GamesAdminSpinSegmentsUpdateRequestSchema.safeParse(body)
    if (!parsed.success) throw invalid(parsed.error.issues)
    const rows = [...parsed.data.segments].sort((a, b) => a.position - b.position)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockAdminSettings('spin-segments')
      const before = await this.repo.spinSegments()
      if (sameSegments(before, rows)) return before
      await this.repo.saveSpinSegments(rows)
      await this.record(tx, actor, GAMES_AUDIT.SPIN_SEGMENTS_UPDATED, 'spin_segments', { before, after: rows })
      return rows
    }, GAMES_ADMIN_WRITE_TX)
  }

  private async readSettings(tx?: TxClient): Promise<GamesAdminSettingsResult> {
    const tiles = await this.repo.quizTiles()
    return { boardgameQuizTiles: tiles ?? DEFAULT_QUIZ_TILES, ...(await this.settings.getMany(GAMES_ADMIN_SETTING_KEYS, tx)) }
  }

  private async record(tx: TxClient, actor: GamesAdminActor, action: string, targetType: string, details: Record<string, unknown>): Promise<void> {
    await this.audit.record({
      tx,
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      sessionRowId: actor.sessionRowId,
      scopeLevel: actor.scopeLevel,
      schoolId: actor.schoolId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      targetType,
      details,
    })
  }
}
