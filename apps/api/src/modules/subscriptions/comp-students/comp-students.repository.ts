import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { dateToDay, dayToDate } from '../dates'

/** A complimentary student with the user columns the list and detail show. `id` is the USER id. */
export interface CompRow {
  id: string
  name: string
  email: string | null
  username: string | null
  icMasked: string | null
  grade: number | null
  isActive: boolean
  schoolId: string | null
  schoolName: string | null
  coinsEnabled: boolean
  /** `YYYY-MM-DD`. */
  packageExpiresOn: string
  originalSchoolName: string | null
  createdAt: Date
}

const INCLUDE = { user: { include: { school: { select: { name: true } } } } } satisfies Prisma.CompStudentInclude
type CompDb = Prisma.CompStudentGetPayload<{ include: typeof INCLUDE }>

function toRow(r: CompDb): CompRow {
  return {
    id: idToString(r.userId),
    name: r.user.name,
    email: r.user.email,
    username: r.user.username,
    icMasked: r.user.icMasked,
    grade: r.user.grade,
    isActive: r.user.isActive,
    schoolId: r.user.schoolId === null ? null : idToString(r.user.schoolId),
    schoolName: r.user.school?.name ?? null,
    coinsEnabled: r.coinsEnabled,
    packageExpiresOn: dateToDay(r.packageExpiresOn),
    originalSchoolName: r.originalSchoolName,
    createdAt: r.createdAt,
  }
}

/** The only doorway to `comp_students`. Methods use `prisma.client`, so they join the caller's transaction. */
@Injectable()
export class CompStudentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Newest first (mock FR-M02-66), `skip`/`take` already clamped by the caller. */
  async list(skip: number, take: number): Promise<{ rows: CompRow[]; total: number; coinsOff: number }> {
    const [rows, total, coinsOff] = await Promise.all([
      this.prisma.client.compStudent.findMany({ include: INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.client.compStudent.count(),
      this.prisma.client.compStudent.count({ where: { coinsEnabled: false } }),
    ])
    return { rows: rows.map(toRow), total, coinsOff }
  }

  /** The complimentary student whose USER id is `userId`, or null (also for a user that is not one). */
  async get(userId: string): Promise<CompRow | null> {
    if (!isIdString(userId)) return null
    const row = await this.prisma.client.compStudent.findUnique({ where: { userId: idFromString(userId) }, include: INCLUDE })
    return row ? toRow(row) : null
  }

  /** The complimentary students among these user ids (unknown and malformed ids are skipped). */
  async getMany(userIds: readonly string[]): Promise<CompRow[]> {
    const ids = [...new Set(userIds.filter(isIdString))].map(idFromString)
    if (ids.length === 0) return []
    const rows = await this.prisma.client.compStudent.findMany({ where: { userId: { in: ids } }, include: INCLUDE, orderBy: { id: 'asc' } })
    return rows.map(toRow)
  }

  /** Locks the user rows for the rest of the transaction, so a toggle reads and flips one value. */
  async lockUsers(userIds: readonly string[]): Promise<void> {
    const ids = userIds.filter(isIdString).map(idFromString)
    if (ids.length === 0) return
    await this.prisma.client.$queryRaw`SELECT id FROM users WHERE id = ANY(${ids}::bigint[]) ORDER BY id FOR UPDATE`
  }

  async createMany(
    rows: readonly { userId: string; packageExpiresOn: string; originalSchoolName: string | null }[],
    now: Date,
  ): Promise<void> {
    if (rows.length === 0) return
    await this.prisma.client.compStudent.createMany({
      data: rows.map((r) => ({
        userId: idFromString(r.userId),
        coinsEnabled: false,
        packageExpiresOn: dayToDate(r.packageExpiresOn),
        originalSchoolName: r.originalSchoolName,
        createdAt: now,
        updatedAt: now,
      })),
    })
  }

  /** Serialises complimentary registers, so the IC duplicate check cannot race. Transaction scoped. */
  async lockRegister(): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('comp.register'))`
  }

  async setCoins(userIds: readonly string[], coinsEnabled: boolean, now: Date): Promise<void> {
    const ids = userIds.filter(isIdString).map(idFromString)
    if (ids.length === 0) return
    await this.prisma.client.compStudent.updateMany({ where: { userId: { in: ids } }, data: { coinsEnabled, updatedAt: now } })
  }
}
