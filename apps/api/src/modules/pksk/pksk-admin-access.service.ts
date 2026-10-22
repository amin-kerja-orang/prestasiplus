import { Inject, Injectable } from '@nestjs/common'
import {
  PKSK_ADMIN_FLASH,
  PKSK_ADMIN_MESSAGES,
  PkskAdminAccessGrantSchema,
  PkskAdminAccessListQuerySchema,
  pkskAdminFieldErrors,
  type PkskAdminAccessItem,
  type PkskAdminAccessStats,
  type PkskPackage,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import type { Caller } from '../users/caller'
import { UsersRepository, type UserRecord } from '../users'
import { invalid } from './errors'
import { PkskAccessRepository, type AccessRecord } from './pksk-access.repository'
import { PkskDomainsRepository } from './pksk-domains.repository'
import { PAGE_SIZE, PKSK_AUDIT, SEARCH_USER_LIMIT, WRITE_TX } from './pksk.constants'
import { displayStatusOf, isRealDay } from './rules'

const M = PKSK_ADMIN_MESSAGES

/** Access grants screen (S8) and the package list (M07-17 to M07-21). Admin only (enforced by the controller). */
@Injectable()
export class PkskAdminAccessService {
  constructor(
    @Inject(PkskAccessRepository) private readonly access: PkskAccessRepository,
    @Inject(PkskDomainsRepository) private readonly domains: PkskDomainsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** M07-17. `search` matches the user's name or e-mail (case-insensitive substring); `pageSize` is not read. */
  async list(query: unknown): Promise<{ data: PkskAdminAccessItem[]; meta: ReturnType<typeof listMeta> }> {
    const { search, page } = parseListQuery(query)
    let userIds: string[] | undefined
    if (search !== '') userIds = (await this.users.search({ q: search, limit: SEARCH_USER_LIMIT })).map((u) => u.id)
    const { rows, total } = await this.access.list({ ...(userIds ? { userIds } : {}), page, pageSize: PAGE_SIZE })
    return { data: await this.items(rows), meta: listMeta(page, PAGE_SIZE, total) }
  }

  /** M07-18. */
  stats(): Promise<PkskAdminAccessStats> {
    return this.access.stats(this.clock.now())
  }

  /** M07-21. */
  async packages(): Promise<PkskPackage[]> {
    return (await this.domains.listPackages()).map((p) => ({ id: p.id, name: p.name, level: p.level }))
  }

  /** M07-19: every field error is returned together and nothing is written when any fails. */
  async grant(caller: Caller, body: unknown): Promise<{ data: PkskAdminAccessItem; status: string }> {
    const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? { ...(body as Record<string, unknown>) } : {}
    // The mock also reads a blank string as "no expiry"; the canonical form is an absent key or null.
    if (typeof input.expiresAt === 'string' && input.expiresAt.trim() === '') delete input.expiresAt
    const parsed = PkskAdminAccessGrantSchema.safeParse(input)
    const fields = parsed.success ? {} : pkskAdminFieldErrors(parsed.error)
    if (typeof input.expiresAt === 'string' && !fields.expiresAt && !isRealDay(input.expiresAt)) fields.expiresAt = M.expiresAt
    const userId = typeof input.userId === 'string' && !fields.userId ? input.userId : null
    const packageId = typeof input.packageId === 'string' && !fields.packageId ? input.packageId : null
    const user = userId !== null ? await this.users.get(userId) : null
    if (userId !== null && user === null) fields.userId = M.userNotFound
    const pkg = packageId !== null ? await this.domains.getPackage(packageId) : null
    if (packageId !== null && pkg === null) fields.packageId = M.package
    if (Object.keys(fields).length > 0 || !parsed.success || user === null || pkg === null) throw invalid(fields)

    const now = this.clock.now()
    const expiresAt = parsed.data.expiresAt ?? null
    const row = await this.write(async () => {
      const saved = await this.access.grant({ userId: user.id, packageId: pkg.id, grantedById: caller.userId, expiresAt, now })
      await this.record(caller, PKSK_AUDIT.ACCESS_GRANTED, saved.id, { userId: user.id, packageId: pkg.id })
      return saved
    })
    const [item] = await this.items([row], new Map([[user.id, user]]))
    return { data: item as PkskAdminAccessItem, status: PKSK_ADMIN_FLASH.accessGranted }
  }

  /** M07-20: 404 for an unknown id, 409 for a row that is already revoked or expired. */
  async revoke(caller: Caller, id: string): Promise<{ data: PkskAdminAccessItem; status: string }> {
    const now = this.clock.now()
    const row = await this.access.get(id)
    if (!row) throw ApiError.of('NOT_FOUND', { message: M.accessNotFound })
    if (displayStatusOf(row, now) !== 'active') throw ApiError.of('CONFLICT', { message: M.accessNotActive })
    await this.write(async () => {
      // A parallel revoke may have won: the conditional update changes nothing then.
      if (!(await this.access.revoke(row.id, now))) throw ApiError.of('CONFLICT', { message: M.accessNotActive })
      await this.record(caller, PKSK_AUDIT.ACCESS_REVOKED, row.id, { userId: row.userId, packageId: row.packageId })
    })
    const fresh = (await this.access.get(row.id)) as AccessRecord
    const [item] = await this.items([fresh])
    return { data: item as PkskAdminAccessItem, status: PKSK_ADMIN_FLASH.accessRevoked }
  }

  /** G-14: ids only, never a name, e-mail or question text. */
  private record(caller: Caller, action: string, targetId: string, details: Record<string, unknown>): Promise<unknown> {
    return this.audit.record({
      action,
      actorUserId: caller.userId,
      actorRole: caller.role,
      sessionRowId: caller.auth.sessionRowId,
      targetType: 'pksk_access',
      targetId,
      scopeLevel: caller.auth.active.scope.level,
      requestId: caller.requestId,
      ip: caller.ip,
      isTest: caller.auth.mode !== null,
      details,
    })
  }

  private async items(rows: readonly AccessRecord[], known: Map<string, UserRecord> = new Map()): Promise<PkskAdminAccessItem[]> {
    const now = this.clock.now()
    const need = new Set<string>()
    for (const r of rows) {
      if (!known.has(r.userId)) need.add(r.userId)
      if (r.grantedById !== null && !known.has(r.grantedById)) need.add(r.grantedById)
    }
    const byId = new Map(known)
    if (need.size > 0) for (const u of await this.users.getMany([...need])) byId.set(u.id, u)
    return rows.map((r) => {
      const user = byId.get(r.userId)
      const granter = r.grantedById === null ? undefined : byId.get(r.grantedById)
      return {
        id: r.id,
        user: { id: r.userId, name: user?.name ?? '-', email: user?.email ?? null },
        package: { id: r.packageId, name: r.packageName, level: r.packageLevel },
        grantedBy: granter ? { id: granter.id, name: granter.name } : null,
        grantedAt: toMytTimestamp(r.grantedAt),
        expiresAt: r.expiresAt,
        status: r.status,
        displayStatus: displayStatusOf(r, now),
      }
    })
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}

/** `search` (trimmed) and `page` (an invalid page is read as 1). `pageSize` is accepted and ignored: the size is fixed at 20. */
export function parseListQuery(query: unknown): { search: string; page: number } {
  const raw = typeof query === 'object' && query !== null ? (query as Record<string, unknown>) : {}
  const { page: rawPage, ...rest } = raw
  delete rest.pageSize // accepted and ignored: the page size is fixed at 20
  const parsed = PkskAdminAccessListQuerySchema.omit({ page: true }).safeParse(rest)
  if (!parsed.success) throw invalid(pkskAdminFieldErrors(parsed.error))
  const page = Number(rawPage)
  return { search: (parsed.data.search ?? '').trim(), page: Number.isInteger(page) && page >= 1 ? page : 1 }
}
