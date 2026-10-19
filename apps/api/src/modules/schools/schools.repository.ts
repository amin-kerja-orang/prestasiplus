import { Inject, Injectable } from '@nestjs/common'

import type { Prisma, School } from '../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

/** A school as the rest of the API sees it: decimal-string ids, no `legacy_*` columns. */
export interface SchoolRow {
  id: string
  name: string
  /** MOE code; null when the source has none (the wire shows ''). */
  code: string | null
  type: string | null
  state: string | null
  district: string | null
  city: string | null
  joinCode: string | null
  jpnId: string | null
  ppdId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** The public projection (no join code). */
export interface SchoolSummaryRow {
  id: string
  name: string
  code: string | null
  type: string | null
  state: string | null
  district: string | null
  city: string | null
}

export interface SchoolOptionRow {
  id: string
  name: string
}

export interface JpnRow {
  id: string
  code: string
  name: string
}

export interface PpdRow {
  id: string
  jpnId: string
  code: string
  name: string
}

export interface SchoolSearchInput {
  /** Substring of name or code (case-insensitive). */
  q?: string
  /** Exact full state name. */
  state?: string
  /** Maximum rows; the caller has already defaulted and capped it. */
  limit: number
  /** One school by id (only if active); the other filters are ignored. */
  id?: string
}

export interface SchoolListFilter {
  search?: string
  state?: string
  type?: string
  page: number
  pageSize: number
}

export interface SchoolWriteInput {
  name: string
  code: string
  type: string
  state: string
  district: string | null
  city: string | null
  isActive: boolean
}

export interface MemberCounts {
  studentCount: number
  teacherCount: number
}

const SELECT = {
  id: true,
  name: true,
  code: true,
  type: true,
  state: true,
  district: true,
  city: true,
  joinCode: true,
  jpnId: true,
  ppdId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

type SchoolDb = Pick<School, keyof typeof SELECT>

function toRow(s: SchoolDb): SchoolRow {
  return {
    id: idToString(s.id),
    name: s.name,
    code: s.code,
    type: s.type,
    state: s.state,
    district: s.district,
    city: s.city,
    joinCode: s.joinCode,
    jpnId: s.jpnId === null ? null : idToString(s.jpnId),
    ppdId: s.ppdId === null ? null : idToString(s.ppdId),
    isActive: s.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

function toSummary(s: SchoolRow): SchoolSummaryRow {
  return { id: s.id, name: s.name, code: s.code, type: s.type, state: s.state, district: s.district, city: s.city }
}

/** Ordering of every school list: name A to Z, ties by id (mock `schools.list`). */
const BY_NAME: Prisma.SchoolOrderByWithRelationInput[] = [{ name: 'asc' }, { id: 'asc' }]

/** Prisma passes `contains` to LIKE unescaped, so `%`, `_` and the escape character are escaped here (they match themselves). */
const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

const textSearch = (term: string): Prisma.SchoolWhereInput => {
  const safe = escapeLike(term)
  return {
    OR: [
      { name: { contains: safe, mode: 'insensitive' } },
      { code: { contains: safe, mode: 'insensitive' } },
    ],
  }
}

/**
 * The only doorway to the `schools`, `jpns` and `ppds` tables (ADR-0014). Other modules (users,
 * imports, subscriptions) call `get`, `exists`, `getMany`, `options` and `search`. Ids in and out
 * are decimal strings; a malformed id is "not found", never an error.
 *
 * Methods use `prisma.client`, so they join the caller's transaction when there is one.
 */
@Injectable()
export class SchoolsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** One school (active or not) or null. */
  async get(id: string): Promise<SchoolRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.school.findUnique({ where: { id: idFromString(id) }, select: SELECT })
    return row ? toRow(row) : null
  }

  async exists(id: string): Promise<boolean> {
    if (!isIdString(id)) return false
    const row = await this.prisma.client.school.findUnique({ where: { id: idFromString(id) }, select: { id: true } })
    return row !== null
  }

  /** Schools by id, in no particular order; unknown and malformed ids are skipped. */
  async getMany(ids: readonly string[]): Promise<SchoolRow[]> {
    const valid = [...new Set(ids.filter(isIdString))].map(idFromString)
    if (valid.length === 0) return []
    const rows = await this.prisma.client.school.findMany({ where: { id: { in: valid } }, select: SELECT })
    return rows.map(toRow)
  }

  /** Every school (active and inactive) as `{id, name}`, name A to Z. */
  async options(): Promise<SchoolOptionRow[]> {
    const rows = await this.prisma.client.school.findMany({
      select: { id: true, name: true },
      orderBy: BY_NAME,
    })
    return rows.map((r) => ({ id: idToString(r.id), name: r.name }))
  }

  /** Active schools for the public picker, name A to Z. */
  async search(input: SchoolSearchInput): Promise<SchoolSummaryRow[]> {
    if (input.id !== undefined) {
      if (!isIdString(input.id)) return []
      const row = await this.prisma.client.school.findFirst({
        where: { id: idFromString(input.id), isActive: true },
        select: SELECT,
      })
      return row ? [toSummary(toRow(row))] : []
    }
    const and: Prisma.SchoolWhereInput[] = [{ isActive: true }]
    if (input.state) and.push({ state: input.state })
    if (input.q) and.push(textSearch(input.q))
    const rows = await this.prisma.client.school.findMany({
      where: { AND: and },
      select: SELECT,
      orderBy: BY_NAME,
      take: input.limit,
    })
    return rows.map((r) => toSummary(toRow(r)))
  }

  /** A page of the admin list with the number of rows matching the filters. */
  async list(filter: SchoolListFilter): Promise<{ rows: SchoolRow[]; total: number }> {
    const and: Prisma.SchoolWhereInput[] = []
    if (filter.state) and.push({ state: filter.state })
    if (filter.type) and.push({ type: filter.type })
    if (filter.search) and.push(textSearch(filter.search))
    const where: Prisma.SchoolWhereInput = and.length > 0 ? { AND: and } : {}
    const [rows, total] = await Promise.all([
      this.prisma.client.school.findMany({
        where,
        select: SELECT,
        orderBy: BY_NAME,
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.client.school.count({ where }),
    ])
    return { rows: rows.map(toRow), total }
  }

  /** Stat cards: all schools, ignoring every filter. */
  async counts(): Promise<{ total: number; active: number; inactive: number }> {
    const [total, active] = await Promise.all([
      this.prisma.client.school.count(),
      this.prisma.client.school.count({ where: { isActive: true } }),
    ])
    return { total, active, inactive: total - active }
  }

  /** The distinct types present, in code-unit order like the mock (`['MRSM', 'SBP', 'SJK(C)', ...]`). */
  async types(): Promise<string[]> {
    const rows = await this.prisma.client.school.findMany({
      where: { type: { not: null } },
      select: { type: true },
      distinct: ['type'],
    })
    return rows.map((r) => r.type as string).sort()
  }

  /** The school whose code equals `code` (trimmed, case-insensitive), or null. A blank code never matches. */
  async findByCode(code: string): Promise<SchoolRow | null> {
    const term = code.trim()
    if (term === '') return null
    // An exact comparison: `lower() = lower()`, not ILIKE, so `%` and `_` in the code match themselves.
    const hit = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM schools WHERE lower(code) = lower(${term}) LIMIT 1`
    const id = hit[0]?.id
    return id === undefined ? null : this.get(idToString(id))
  }

  /**
   * Student and teacher counts per school, derived from `users` and `user_roles` (mock
   * `users.countWhere({role, schoolId})`). A read-only aggregate: see the deviations log (2026-10-19,
   * BE-05) for why this is not a call to the users repository.
   */
  async memberCounts(ids: readonly string[]): Promise<Map<string, MemberCounts>> {
    const valid = [...new Set(ids.filter(isIdString))].map(idFromString)
    const out = new Map<string, MemberCounts>(ids.map((id) => [id, { studentCount: 0, teacherCount: 0 }]))
    if (valid.length === 0) return out
    const rows = await this.prisma.client.$queryRaw<{ school_id: bigint; role: string; n: number }[]>`
      SELECT u.school_id, r.role, count(*)::int AS n
        FROM users u
        JOIN user_roles r ON r.user_id = u.id
       WHERE u.school_id = ANY(${valid}::bigint[]) AND r.role IN ('student', 'teacher')
       GROUP BY u.school_id, r.role`
    for (const row of rows) {
      const entry = out.get(idToString(row.school_id))
      if (!entry) continue
      if (row.role === 'student') entry.studentCount = row.n
      else entry.teacherCount = row.n
    }
    return out
  }

  /** Serialises code and join-code writes so the case-insensitive uniqueness check cannot race (transaction scoped). */
  async lockCodeWrites(): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schools.code'))`
  }

  /** The JPN and PPD a school with this state and district belongs to (names and codes match exactly). */
  async resolveRegion(state: string | null, district: string | null): Promise<{ jpnId: bigint | null; ppdId: bigint | null }> {
    const jpn = state ? await this.prisma.client.jpn.findFirst({ where: { name: state }, select: { id: true } }) : null
    const ppd =
      district && jpn
        ? await this.prisma.client.ppd.findFirst({ where: { code: district, jpnId: jpn.id }, select: { id: true } })
        : null
    return { jpnId: jpn?.id ?? null, ppdId: ppd?.id ?? null }
  }

  async create(
    input: SchoolWriteInput & { joinCode: string },
    now: Date,
  ): Promise<SchoolRow> {
    const region = await this.resolveRegion(input.state, input.district)
    const row = await this.prisma.client.school.create({
      data: { ...input, ...region, createdAt: now, updatedAt: now },
      select: SELECT,
    })
    return toRow(row)
  }

  /** Replaces every editable field; the join code is never changed here. Null when the school does not exist. */
  async update(id: string, input: SchoolWriteInput, now: Date): Promise<SchoolRow | null> {
    if (!isIdString(id)) return null
    const region = await this.resolveRegion(input.state, input.district)
    const result = await this.prisma.client.school.updateMany({
      where: { id: idFromString(id) },
      data: { ...input, ...region, updatedAt: now },
    })
    return result.count === 0 ? null : this.get(id)
  }

  /** Flips `is_active` in one statement (no read-modify-write race). Returns the new value, or null for an unknown school. */
  async toggle(id: string, now: Date): Promise<boolean | null> {
    if (!isIdString(id)) return null
    const rows = await this.prisma.client.$queryRaw<{ is_active: boolean }[]>`
      UPDATE schools SET is_active = NOT is_active, updated_at = ${now}
       WHERE id = ${idFromString(id)} RETURNING is_active`
    return rows[0] ? rows[0].is_active : null
  }

  /** `GET /api/jpn`: every JPN by id. */
  async jpnList(): Promise<JpnRow[]> {
    const rows = await this.prisma.client.jpn.findMany({ select: { id: true, code: true, name: true }, orderBy: { id: 'asc' } })
    return rows.map((r) => ({ id: idToString(r.id), code: r.code, name: r.name }))
  }

  /** `GET /api/jpn/:id/ppd`: the PPDs of one JPN by code, or null when the JPN does not exist. */
  async ppdList(jpnId: string): Promise<PpdRow[] | null> {
    if (!isIdString(jpnId)) return null
    const id = idFromString(jpnId)
    const jpn = await this.prisma.client.jpn.findUnique({ where: { id }, select: { id: true } })
    if (!jpn) return null
    const rows = await this.prisma.client.ppd.findMany({
      where: { jpnId: id },
      select: { id: true, jpnId: true, code: true, name: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    })
    return rows.map((r) => ({ id: idToString(r.id), jpnId: idToString(r.jpnId), code: r.code, name: r.name }))
  }
}
