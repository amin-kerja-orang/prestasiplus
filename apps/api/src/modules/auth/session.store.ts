import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../db/clock'
import type { Session as SessionRow } from '../../db/generated/client'
import { PrismaService } from '../../db/prisma.service'
import { AuthConfig } from './auth.config'
import { REMEMBER_YEARS, SESSION_IDLE_MS, SESSION_SLIDE_INTERVAL_MS } from './auth.constants'
import { deriveCsrf, hmacHex, newSessionToken, sha256Hex } from './tokens'

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
const USER_AGENT_MAX = 200

export interface ModeInit {
  kind: 'mod_pelajar'
  returnRole: string
  since: Date
}

export interface NewSession {
  userId: bigint
  activeRole: string
  remember: boolean
  mode?: ModeInit | null
  userAgent?: string | null
  ip?: string | null
  /** Kept when a session is regenerated, so a remembered session does not get a fresh 5 years. */
  createdAt?: Date
  expiresAt?: Date
}

export interface IssuedSession {
  row: SessionRow
  /** The raw cookie value. Exists only here, in memory, and in the cookie; the database keeps its hash. */
  token: string
}

/** `date` plus whole calendar years in Malaysia time (29 February falls back to 28 February). */
export function addCalendarYears(date: Date, years: number): Date {
  const local = new Date(date.getTime() + MYT_OFFSET_MS)
  const month = local.getUTCMonth()
  local.setUTCFullYear(local.getUTCFullYear() + years)
  if (local.getUTCMonth() !== month) local.setUTCDate(0)
  return new Date(local.getTime() - MYT_OFFSET_MS)
}

/** Postgres session store: one row per live session, looked up by the SHA-256 of the cookie value. */
@Injectable()
export class SessionStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuthConfig) private readonly config: AuthConfig,
  ) {}

  /** Expiry of a session created or slid at `at`: 5 calendar years from creation, or 120 minutes idle. */
  expiryFor(remember: boolean, at: Date, createdAt: Date): Date {
    return remember ? addCalendarYears(createdAt, REMEMBER_YEARS) : new Date(at.getTime() + SESSION_IDLE_MS)
  }

  async create(input: NewSession): Promise<IssuedSession> {
    const now = this.clock.now()
    const token = newSessionToken()
    const createdAt = input.createdAt ?? now
    const row = await this.prisma.client.session.create({
      data: {
        userId: input.userId,
        tokenHash: sha256Hex(token),
        csrfHash: sha256Hex(deriveCsrf(this.config.secret, token)),
        activeRole: input.activeRole,
        modeKind: input.mode?.kind ?? null,
        modeReturnRole: input.mode?.returnRole ?? null,
        modeSince: input.mode?.since ?? null,
        remember: input.remember,
        createdAt,
        lastSeenAt: now,
        expiresAt: input.expiresAt ?? this.expiryFor(input.remember, now, createdAt),
        userAgent: input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX) : null,
        ipHash: input.ip ? hmacHex(this.config.secret, 'ip', input.ip) : null,
      },
    })
    return { row, token }
  }

  findByToken(token: string): Promise<SessionRow | null> {
    return this.prisma.client.session.findUnique({ where: { tokenHash: sha256Hex(token) } })
  }

  /** A session is live while it is not revoked and `expiresAt` is in the future. */
  isLive(row: SessionRow, now: Date): boolean {
    return row.revokedAt === null && row.expiresAt.getTime() > now.getTime()
  }

  /**
   * Sliding expiry (card AC 4): a non-remembered session moves to now + 120 minutes, at most once
   * per minute. Returns the row to use (unchanged when nothing was written). A remembered session
   * never slides.
   */
  async slide(row: SessionRow, now: Date): Promise<{ row: SessionRow; moved: boolean }> {
    if (row.remember || now.getTime() - row.lastSeenAt.getTime() < SESSION_SLIDE_INTERVAL_MS) {
      return { row, moved: false }
    }
    const updated = await this.prisma.client.session.update({
      where: { id: row.id },
      data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_IDLE_MS) },
    })
    return { row: updated, moved: true }
  }

  /** Persists a repaired role or cleared mode (account changed under a live session). */
  setState(rowId: string, activeRole: string, mode: ModeInit | null): Promise<SessionRow> {
    return this.prisma.client.session.update({
      where: { id: rowId },
      data: {
        activeRole,
        modeKind: mode?.kind ?? null,
        modeReturnRole: mode?.returnRole ?? null,
        modeSince: mode?.since ?? null,
      },
    })
  }

  /**
   * New cookie value for the same login (login, role switch and mode change all call this): the
   * old row is deleted and a new one with a fresh token is created in the caller's transaction. If
   * the old row is already gone (a parallel request won) it returns null and nothing is created.
   */
  async regenerate(
    old: SessionRow,
    next: { activeRole: string; mode: ModeInit | null; userAgent?: string | null; ip?: string | null },
  ): Promise<IssuedSession | null> {
    const removed = await this.prisma.client.session.deleteMany({ where: { id: old.id, revokedAt: null } })
    if (removed.count === 0) return null
    const now = this.clock.now()
    return this.create({
      userId: old.userId,
      activeRole: next.activeRole,
      remember: old.remember,
      mode: next.mode,
      userAgent: next.userAgent ?? old.userAgent,
      ip: next.ip ?? null,
      createdAt: old.createdAt,
      expiresAt: old.remember ? old.expiresAt : this.expiryFor(false, now, now),
    })
  }

  /** Server-side logout: the row stops resolving at once. Idempotent. */
  async revokeByToken(token: string): Promise<boolean> {
    const res = await this.prisma.client.session.updateMany({
      where: { tokenHash: sha256Hex(token), revokedAt: null },
      data: { revokedAt: this.clock.now() },
    })
    return res.count > 0
  }

  async revokeRow(rowId: string): Promise<void> {
    await this.prisma.client.session.updateMany({
      where: { id: rowId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    })
  }
}
