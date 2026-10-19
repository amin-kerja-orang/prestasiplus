import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  type AdminSchool,
  type ListMeta,
  SCHOOL_MESSAGES,
  SchoolInputSchema,
  type SchoolOption,
  type SchoolSummary,
  type SchoolType,
  V,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import type { AuthContext } from '../../common/scope/auth-context'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, SCHOOL_AUDIT, STATE_NAMES } from './schools.constants'
import {
  type MemberCounts,
  type SchoolRow,
  type SchoolSummaryRow,
  SchoolsRepository,
  type SchoolWriteInput,
} from './schools.repository'

/** Where the request came from, for the audit row. */
export interface RequestMeta {
  requestId: string | null
  ip: string | null
}

export const SCHOOLS_PAGE_SIZE = 30
export const SEARCH_DEFAULT_LIMIT = 20
export const SEARCH_MAX_LIMIT = 100
/** Longest accepted search text; longer input cannot match a name or code anyway. */
const MAX_TERM = 255
const MAX_PAGE = 1_000_000
const FIELD_ORDER = ['name', 'code', 'type', 'state', 'district', 'city', 'isActive'] as const

type Raw = Record<string, unknown>

export interface ListQuery {
  search?: unknown
  state?: unknown
  type?: unknown
  page?: unknown
}

export interface SearchQuery {
  q?: unknown
  state?: unknown
  limit?: unknown
  id?: unknown
}

/** A query value as trimmed text; blank, repeated or non-text values count as absent. */
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t === '' ? undefined : t.slice(0, MAX_TERM)
}

function isPlainObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A positive integer from a query value, or undefined. */
function positiveInt(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value.trim())) return undefined
  const n = Number(value.trim())
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}

function isPrismaUnique(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002'
}

function asBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  return undefined
}

function newJoinCode(): string {
  let out = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) out += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]
  return out
}

export function toSummary(s: SchoolSummaryRow): SchoolSummary {
  return {
    id: s.id,
    name: s.name,
    code: s.code ?? '',
    type: s.type as SchoolType,
    state: s.state as string,
    district: s.district,
    city: s.city,
  }
}

export function toAdminSchool(s: SchoolRow, counts: MemberCounts | undefined): AdminSchool {
  return {
    ...toSummary(s),
    joinCode: s.joinCode,
    isActive: s.isActive,
    createdAt: toMytTimestamp(s.createdAt),
    updatedAt: toMytTimestamp(s.updatedAt),
    studentCount: counts?.studentCount ?? 0,
    teacherCount: counts?.teacherCount ?? 0,
  }
}

function changedFields(before: SchoolRow, after: SchoolRow): string[] {
  const keys = ['name', 'code', 'type', 'state', 'district', 'city', 'isActive'] as const
  return keys.filter((k) => before[k] !== after[k])
}

@Injectable()
export class SchoolsService {
  constructor(
    @Inject(SchoolsRepository) private readonly repo: SchoolsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ---- admin reads ----

  async list(query: ListQuery): Promise<{ data: AdminSchool[]; meta: ListMeta }> {
    const page = Math.min(positiveInt(query.page) ?? 1, MAX_PAGE)
    const search = text(query.search)
    const state = text(query.state)
    const type = text(query.type)
    const [result, counts, types] = await Promise.all([
      this.repo.list({
        page,
        pageSize: SCHOOLS_PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(state ? { state } : {}),
        ...(type ? { type } : {}),
      }),
      this.repo.counts(),
      this.repo.types(),
    ])
    const members = await this.repo.memberCounts(result.rows.map((r) => r.id))
    return {
      data: result.rows.map((r) => toAdminSchool(r, members.get(r.id))),
      meta: { ...listMeta(page, SCHOOLS_PAGE_SIZE, result.total), counts, types },
    }
  }

  options(): Promise<SchoolOption[]> {
    return this.repo.options()
  }

  async get(id: string): Promise<AdminSchool> {
    const row = await this.repo.get(id)
    if (!row) throw ApiError.of('NOT_FOUND')
    return this.present(row)
  }

  // ---- admin writes ----

  async create(body: unknown, auth: AuthContext, meta: RequestMeta): Promise<{ data: AdminSchool; status: string }> {
    const input = await this.validate(body, null, true)
    for (let attempt = 0; ; attempt++) {
      try {
        const row = await this.prisma.transaction(async (tx) => {
          await this.repo.lockCodeWrites()
          await this.assertCodeFree(input.code, null)
          const created = await this.repo.create({ ...input, joinCode: newJoinCode() }, this.clock.now())
          await this.audit.record({
            ...this.actor(auth, meta),
            action: SCHOOL_AUDIT.CREATED,
            targetType: 'school',
            targetId: created.id,
            schoolId: created.id,
            details: { isActive: created.isActive },
            tx,
          })
          return created
        })
        return { data: toAdminSchool(row, undefined), status: SCHOOL_MESSAGES.saved }
      } catch (e) {
        // A join-code collision (31^8 codes) is retried with a new code; a code collision is a 422.
        if (isPrismaUnique(e) && attempt < 4) {
          await this.assertCodeFree(input.code, null)
          continue
        }
        throw e
      }
    }
  }

  async update(id: string, body: unknown, auth: AuthContext, meta: RequestMeta): Promise<{ data: AdminSchool; status: string }> {
    const current = await this.repo.get(id)
    if (!current) throw ApiError.of('NOT_FOUND')
    const input = await this.validate(body, id, current.isActive)
    try {
      const row = await this.prisma.transaction(async (tx) => {
        await this.repo.lockCodeWrites()
        await this.assertCodeFree(input.code, id)
        const updated = await this.repo.update(id, input, this.clock.now())
        if (!updated) throw ApiError.of('NOT_FOUND')
        await this.audit.record({
          ...this.actor(auth, meta),
          action: SCHOOL_AUDIT.UPDATED,
          targetType: 'school',
          targetId: id,
          schoolId: id,
          details: { changed: changedFields(current, updated) },
          tx,
        })
        return updated
      })
      return { data: await this.present(row), status: SCHOOL_MESSAGES.saved }
    } catch (e) {
      if (isPrismaUnique(e)) throw this.codeTaken()
      throw e
    }
  }

  async toggle(id: string, auth: AuthContext, meta: RequestMeta): Promise<{ data: { isActive: boolean }; status: string }> {
    const isActive = await this.prisma.transaction(async (tx) => {
      const value = await this.repo.toggle(id, this.clock.now())
      if (value === null) throw ApiError.of('NOT_FOUND')
      await this.audit.record({
        ...this.actor(auth, meta),
        action: SCHOOL_AUDIT.TOGGLED,
        targetType: 'school',
        targetId: id,
        schoolId: id,
        details: { isActive: value },
        tx,
      })
      return value
    })
    return { data: { isActive }, status: SCHOOL_MESSAGES.toggled }
  }

  // ---- public lookups ----

  async search(query: SearchQuery): Promise<SchoolSummary[]> {
    const id = text(query.id)
    const q = text(query.q)
    const state = text(query.state)
    const requested = positiveInt(query.limit) ?? SEARCH_DEFAULT_LIMIT
    const rows = await this.repo.search({
      limit: Math.min(requested, SEARCH_MAX_LIMIT),
      ...(id ? { id } : {}),
      ...(q ? { q } : {}),
      ...(state ? { state } : {}),
    })
    return rows.map(toSummary)
  }

  // ---- helpers ----

  private async present(row: SchoolRow): Promise<AdminSchool> {
    const members = await this.repo.memberCounts([row.id])
    return toAdminSchool(row, members.get(row.id))
  }

  private actor(auth: AuthContext, meta: RequestMeta) {
    return {
      actorUserId: auth.userId,
      actorRole: auth.active.role,
      sessionRowId: auth.sessionRowId,
      scopeLevel: auth.active.scope.level,
      requestId: meta.requestId,
      ip: meta.ip,
      isTest: auth.mode !== null,
    }
  }

  private codeTaken(): ApiError {
    return ApiError.of('VALIDATION_ERROR', { fields: { code: V.taken('code') } })
  }

  private async assertCodeFree(code: string, ignoreId: string | null): Promise<void> {
    const hit = await this.repo.findByCode(code)
    if (hit && hit.id !== ignoreId) throw this.codeTaken()
  }

  /**
   * The mock's field rules in one pass: the contract schema (strict keys, required, length, enum,
   * boolean) plus the two checks only the server can make (known state, unique code). Every failing
   * field is reported together, one message per field, in the mock's field order.
   */
  private async validate(body: unknown, ignoreId: string | null, defaultActive: boolean): Promise<SchoolWriteInput> {
    const raw = isPlainObject(body) ? body : {}
    const parsed = SchoolInputSchema.safeParse(raw)
    const errors: Record<string, string> = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.code === 'unrecognized_keys') {
          for (const key of issue.keys) errors[key] ??= `The ${key} field is not allowed.`
          continue
        }
        errors[issue.path.length ? issue.path.map(String).join('.') : '_'] ??= issue.message
      }
    }
    const candidate = parsed.success ? parsed.data : undefined
    const state = typeof raw.state === 'string' ? raw.state.trim() : ''
    const code = typeof raw.code === 'string' ? raw.code.trim() : ''
    if (!errors.state && state !== '' && !STATE_NAMES.includes(state)) errors.state = V.invalid('state')
    if (!errors.code && code !== '' && code.length <= 20) {
      const hit = await this.repo.findByCode(code)
      if (hit && hit.id !== ignoreId) errors.code = V.taken('code')
    }
    if (Object.keys(errors).length > 0 || !candidate) {
      const ordered: Record<string, string> = {}
      for (const f of FIELD_ORDER) if (errors[f]) ordered[f] = errors[f]
      for (const [k, v] of Object.entries(errors)) ordered[k] ??= v
      throw ApiError.of('VALIDATION_ERROR', { fields: ordered })
    }
    return {
      name: candidate.name,
      code: candidate.code,
      type: candidate.type,
      state: candidate.state,
      district: candidate.district ? candidate.district : null,
      city: candidate.city ? candidate.city : null,
      isActive: asBoolean(candidate.isActive) ?? defaultActive,
    }
  }
}
