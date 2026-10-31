import { Inject, Injectable } from '@nestjs/common'
import type { AccountFaith, AccountSettings } from '@pp/contract'

import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { SPM_SERVABLE_SQL } from '../questions/learner-visibility'

/**
 * The public question count follows the practice draws (BR-11, D72): live-version, active, non-PKSK, objective (mcq) questions of a
 * learner-visible level that is one of the OFFERED_LEVEL_CODES (T4, T5), of an active subject linked to that level: exactly the sum of the subject cards.
 * R1-B06: the level / subject / PKSK part is the shared SPM_SERVABLE_SQL (static text, the codes are constants).
 */
export const QUESTION_COUNT_SQL = `SELECT count(*) AS c FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no WHERE q.is_active AND v.status = 'published' AND v.type = 'mcq' AND ${SPM_SERVABLE_SQL.sql}`

export interface ResetRow {
  id: string
  userId: string
  tokenHash: string
  channel: string
  expiresAt: Date
  usedAt: Date | null
}

export interface PlatformCounts {
  questionCount: number
  subjectCount: number
  levelCount: number
}

/** `time(0)` is stored as a Date on 1970-01-01 (UTC); the wire is `HH:mm`. */
export const toTimeColumn = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00.000Z`)
export const fromTimeColumn = (value: Date): string => value.toISOString().slice(11, 16)

/**
 * The tables the account module owns (`password_resets`, `user_settings`) and the few reads it
 * makes next to other modules' tables (`files` for the avatar, `sessions` to end the other
 * sessions, the question bank counters). `users` and `schools` are reached only through
 * `UsersRepository` and `SchoolsRepository`. Methods use `prisma.client`, so they join the caller's transaction.
 */
@Injectable()
export class AccountDataRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- password_resets -----------------------------------------------------------------------------

  /** Serialises token issuing and redemption for one user, so at most one live token per channel exists (released at commit). */
  async lockUser(userId: string): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'pwreset:' + userId}))`
  }

  /**
   * One live token per user AND channel: the open tokens of that channel are spent. Without a channel every
   * open token is spent (a successful reset). A request on one channel never kills a valid token of the other.
   */
  async spendOpenTokens(userId: string, at: Date, channel?: 'email' | 'ic'): Promise<void> {
    await this.prisma.client.passwordReset.updateMany({
      where: { userId: idFromString(userId), usedAt: null, ...(channel ? { channel } : {}) },
      data: { usedAt: at },
    })
  }

  async insertToken(input: { userId: string; tokenHash: string; channel: 'email' | 'ic'; expiresAt: Date; at: Date }): Promise<string> {
    const row = await this.prisma.client.passwordReset.create({
      data: {
        userId: idFromString(input.userId),
        tokenHash: input.tokenHash,
        channel: input.channel,
        expiresAt: input.expiresAt,
        createdAt: input.at,
      },
      select: { id: true },
    })
    return idToString(row.id)
  }

  async findToken(tokenHash: string): Promise<ResetRow | null> {
    const row = await this.prisma.client.passwordReset.findUnique({ where: { tokenHash } })
    return row
      ? { id: idToString(row.id), userId: idToString(row.userId), tokenHash: row.tokenHash, channel: row.channel, expiresAt: row.expiresAt, usedAt: row.usedAt }
      : null
  }

  /** Single use: true only for the one request that flips `used_at` (atomic, so two parallel resets cannot both win). */
  async consumeToken(id: string, at: Date): Promise<boolean> {
    const res = await this.prisma.client.passwordReset.updateMany({
      where: { id: idFromString(id), usedAt: null, expiresAt: { gt: at } },
      data: { usedAt: at },
    })
    return res.count === 1
  }

  /** Public token of the newest avatar file, or null. */
  async avatarToken(userId: string): Promise<string | null> {
    const row = await this.prisma.client.file.findFirst({
      where: { ownerUserId: idFromString(userId), purpose: 'avatar' },
      select: { publicId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row?.publicId ?? null
  }

  // --- user_settings -------------------------------------------------------------------------------

  async getSettings(userId: string): Promise<AccountSettings | null> {
    const row = await this.prisma.client.userSettings.findUnique({ where: { userId: idFromString(userId) } })
    if (!row) return null
    return {
      spiritualMode: row.spiritualMode,
      showBismillahSplash: row.showBismillahSplash,
      subuhPushEnabled: row.subuhPushEnabled,
      subuhPushTime: fromTimeColumn(row.subuhPushTime),
      ramadanModeEnabled: row.ramadanModeEnabled,
      sahurPushTime: fromTimeColumn(row.sahurPushTime),
      faith: (row.faith as AccountFaith | null) ?? null,
    }
  }

  async saveSettings(userId: string, s: AccountSettings, at: Date): Promise<void> {
    const data = {
      spiritualMode: s.spiritualMode,
      showBismillahSplash: s.showBismillahSplash,
      subuhPushEnabled: s.subuhPushEnabled,
      subuhPushTime: toTimeColumn(s.subuhPushTime),
      ramadanModeEnabled: s.ramadanModeEnabled,
      sahurPushTime: toTimeColumn(s.sahurPushTime),
      faith: s.faith,
      updatedAt: at,
    }
    await this.prisma.client.userSettings.upsert({
      where: { userId: idFromString(userId) },
      create: { userId: idFromString(userId), ...data, createdAt: at },
      update: data,
    })
  }

  // --- avatar (files, written by FilesService) ---------------------------------------------------

  /** Public tokens of the user's avatar files, newest first. */
  async avatarTokens(userId: string): Promise<string[]> {
    const rows = await this.prisma.client.file.findMany({
      where: { ownerUserId: idFromString(userId), purpose: 'avatar' },
      select: { publicId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((r) => r.publicId)
  }

  // --- sessions ------------------------------------------------------------------------------------

  /** Ends the user's live sessions except one (a password change keeps the caller signed in). */
  async revokeOtherSessions(userId: string, keepRowId: string, at: Date): Promise<number> {
    const res = await this.prisma.client.session.updateMany({
      where: { userId: idFromString(userId), revokedAt: null, id: { not: keepRowId } },
      data: { revokedAt: at },
    })
    return res.count
  }

  // --- public counters ---------------------------------------------------------------------------

  /**
   * Counts of the question bank and the curriculum, per request (BR-21). The tables belong to BE-08
   * and BE-09, which are not merged yet: a table or column that does not exist counts as 0 (checked
   * against the catalogue, never by catching an SQL error). Rules: published AND active questions
   * (`questions.live_version_no` set, D54a), active subjects, active education levels.
   */
  async platformCounts(): Promise<PlatformCounts> {
    const have = await this.prisma.client.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND ((table_name = 'questions' AND column_name = 'live_version_no')
           OR (table_name = 'subjects' AND column_name = 'is_active')
           OR (table_name = 'education_levels' AND column_name = 'is_active'))`
    const present = new Set(have.map((r) => r.table_name))
    const count = async (table: string, sql: string): Promise<number> => {
      if (!present.has(table)) return 0
      // Fixed statements, no input: $queryRawUnsafe only because the table may not exist at build time.
      const rows = await this.prisma.client.$queryRawUnsafe<{ c: bigint }[]>(sql)
      return Number(rows[0]?.c ?? 0)
    }
    return {
      questionCount: await count('questions', QUESTION_COUNT_SQL),
      subjectCount: await count('subjects', 'SELECT count(*) AS c FROM subjects WHERE is_active'),
      levelCount: await count('education_levels', 'SELECT count(*) AS c FROM education_levels WHERE is_active'),
    }
  }
}
