import { Inject, Injectable } from '@nestjs/common'
import type { PkskLevel, PkskPackageLevel } from '@pp/contract'

import type { Prisma } from '../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { dateToDay, dayToDate, mytDay } from '../subscriptions/dates'

export interface AccessRecord {
  id: string
  userId: string
  packageId: string
  packageName: string
  packageLevel: PkskPackageLevel
  grantedById: string | null
  grantedAt: Date
  /** `YYYY-MM-DD` or null. */
  expiresAt: string | null
  status: 'active' | 'revoked'
  revokedAt: Date | null
}

const INCLUDE = { package: true } as const

type Row = Prisma.PkskAccessGetPayload<{ include: typeof INCLUDE }>

function toRecord(r: Row): AccessRecord {
  return {
    id: idToString(r.id),
    userId: idToString(r.userId),
    packageId: idToString(r.packageId),
    packageName: r.package.name,
    packageLevel: r.package.level as PkskPackageLevel,
    grantedById: r.grantedById === null ? null : idToString(r.grantedById),
    grantedAt: r.grantedAt,
    expiresAt: r.expiresAt === null ? null : dateToDay(r.expiresAt),
    status: r.status as 'active' | 'revoked',
    revokedAt: r.revokedAt,
  }
}

/** The access grants (BR-M07-14 to -17). The only code that reads or writes `pksk_accesses`. */
@Injectable()
export class PkskAccessRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Stored `active` rows of one user (the caller applies the expiry rule). */
  async activeOf(userId: string): Promise<AccessRecord[]> {
    if (!isIdString(userId)) return []
    const rows = await this.prisma.client.pkskAccess.findMany({
      where: { userId: idFromString(userId), status: 'active' },
      include: INCLUDE,
    })
    return rows.map(toRecord)
  }

  async get(id: string): Promise<AccessRecord | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.pkskAccess.findUnique({ where: { id: idFromString(id) }, include: INCLUDE })
    return row ? toRecord(row) : null
  }

  /**
   * `granted_at` descending, then id descending. `userIds`: undefined = every user; an array restricts to those users
   * (an empty array matches nothing).
   */
  async list(opts: { userIds?: readonly string[]; page: number; pageSize: number }): Promise<{ rows: AccessRecord[]; total: number }> {
    const where: Prisma.PkskAccessWhereInput =
      opts.userIds === undefined ? {} : { userId: { in: opts.userIds.filter(isIdString).map(idFromString) } }
    const [total, rows] = await Promise.all([
      this.prisma.client.pkskAccess.count({ where }),
      this.prisma.client.pkskAccess.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ])
    return { rows: rows.map(toRecord), total }
  }

  /** BR-M07-08: rows that are active today (not revoked, not expired); a Kombo counts in T1 and T4. */
  async stats(now: Date): Promise<{ activeTotal: number; t1: number; t4: number }> {
    const live: Prisma.PkskAccessWhereInput = {
      status: 'active',
      OR: [{ expiresAt: null }, { expiresAt: { gte: dayToDate(mytDay(now)) } }],
    }
    const levelCount = (level: PkskLevel) =>
      this.prisma.client.pkskAccess.count({ where: { AND: [live, { package: { level: { in: [level, 'ALL'] } } }] } })
    const [activeTotal, t1, t4] = await Promise.all([
      this.prisma.client.pkskAccess.count({ where: live }),
      levelCount('T1'),
      levelCount('T4'),
    ])
    return { activeTotal, t1, t4 }
  }

  async grant(input: { userId: string; packageId: string; grantedById: string; expiresAt: string | null; now: Date }): Promise<AccessRecord> {
    const row = await this.prisma.client.pkskAccess.create({
      data: {
        userId: idFromString(input.userId),
        packageId: idFromString(input.packageId),
        grantedById: idFromString(input.grantedById),
        grantedAt: input.now,
        expiresAt: input.expiresAt === null ? null : dayToDate(input.expiresAt),
        status: 'active',
      },
      include: INCLUDE,
    })
    return toRecord(row)
  }

  /** Revokes only a row that is still stored `active`; false when the row changed meanwhile (a parallel revoke). */
  async revoke(id: string, now: Date): Promise<boolean> {
    const res = await this.prisma.client.pkskAccess.updateMany({
      where: { id: idFromString(id), status: 'active' },
      data: { status: 'revoked', revokedAt: now },
    })
    return res.count === 1
  }
}
