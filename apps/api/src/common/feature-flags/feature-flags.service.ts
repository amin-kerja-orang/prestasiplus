import { Inject, Injectable } from '@nestjs/common'
import { FEATURE_LOCKED_CODE, FEATURE_MESSAGES, type FeatureToggle } from '@pp/contract'

import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { AUDIT_ACTIONS } from '../audit/audit-actions'
import { AuditService } from '../audit/audit.service'
import { ApiError } from '../errors/api-error'

/** DM-34: staleness of the in-process flag map is bounded by this TTL; a PUT drops it at once on this node. */
export const FEATURE_CACHE_TTL_MS = 5000

/** Who performed the write: what the audit row records. No request content. */
export interface FeatureActor {
  userId: string
  role: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

interface Snapshot {
  at: number
  /** key -> effective state (enabled and not locked). */
  map: Map<string, boolean>
}

/** Kawalan Ciri (DM-34, API-ADM-09): the flag store, the cached read the guard and the session use, the audited toggle. */
@Injectable()
export class FeatureFlagsService {
  private snapshot: Snapshot | null = null
  /** Bumped on every write so a read that started before the write cannot store its stale result. */
  private generation = 0

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** All toggles ordered by sort_order (never cached: the admin page must show the stored truth). */
  async list(): Promise<FeatureToggle[]> {
    const rows = await this.prisma.client.featureFlag.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] })
    return rows.map(toToggle)
  }

  /**
   * Effective state per stored key (a locked key is OFF whatever `enabled` says). A key with no row is absent here and
   * counts as ON for the caller (FR-ADM-N06.4). Cached for 5 s. When the database cannot be read the last map is used
   * (any age); with none, an empty map (fail-open), which is not cached.
   */
  async featureMap(): Promise<Record<string, boolean>> {
    return Object.fromEntries(await this.effective())
  }

  /** True unless the key has a row that is OFF or locked. */
  async isEnabled(key: string): Promise<boolean> {
    return (await this.effective()).get(key) ?? true
  }

  /** Drops the cache (called after a write). */
  invalidate(): void {
    this.generation += 1
    this.snapshot = null
  }

  async setEnabled(actor: FeatureActor, key: string, enabled: boolean): Promise<FeatureToggle> {
    const updated = await this.prisma.transaction(async (tx) => {
      const row = await tx.featureFlag.findUnique({ where: { key } })
      if (!row) throw ApiError.of('NOT_FOUND', { message: FEATURE_MESSAGES.unknownKey })
      // INV-29 (also a CHECK in the table): a locked key is never switched on.
      if (row.locked && enabled) throw new ApiError({ code: FEATURE_LOCKED_CODE, status: 409, message: FEATURE_MESSAGES.lockedOn })
      // A write of the value already stored is a no-op: no update, no audit row, the cache stays valid.
      if (row.enabled === enabled) return row
      const next = await tx.featureFlag.update({ where: { key }, data: { enabled, updatedBy: BigInt(actor.userId) } })
      await this.audit.record({
        action: AUDIT_ACTIONS.FEATURE_FLAG_TOGGLED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'feature_flag',
        details: { key, old: row.enabled, new: next.enabled },
        tx,
      })
      return next
    })
    this.invalidate()
    return toToggle(updated)
  }

  private async effective(): Promise<Map<string, boolean>> {
    const now = this.clock.now().getTime()
    const held = this.snapshot
    if (held && now - held.at < FEATURE_CACHE_TTL_MS) return held.map
    const generation = this.generation
    try {
      const rows = await this.prisma.client.featureFlag.findMany({ select: { key: true, enabled: true, locked: true } })
      const map = new Map(rows.map((r) => [r.key, r.enabled && !r.locked] as const))
      if (generation === this.generation) this.snapshot = { at: now, map }
      return map
    } catch {
      return held?.map ?? new Map()
    }
  }
}

function toToggle(row: { key: string; labelMs: string; audience: string; enabled: boolean; locked: boolean }): FeatureToggle {
  return { key: row.key, labelMs: row.labelMs, audience: row.audience as FeatureToggle['audience'], enabled: row.enabled, locked: row.locked }
}
