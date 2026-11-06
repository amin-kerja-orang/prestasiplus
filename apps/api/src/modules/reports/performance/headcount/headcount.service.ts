import { Inject, Injectable } from '@nestjs/common'
import {
  PERFORMANCE_HEADCOUNT_MESSAGES,
  PerformanceHeadcountArRequestSchema,
  PerformanceHeadcountAutoSetupRequestSchema,
  PerformanceHeadcountCreateRequestSchema,
  PerformanceHeadcountDefaultsRequestSchema,
  PerformanceHeadcountDropRequestSchema,
  PerformanceHeadcountSettingsRequestSchema,
  PerformanceHeadcountTovRequestSchema,
  REPORT_SCOPE_MESSAGES,
} from '@pp/contract'
import type { z } from 'zod'

import { AUDIT_ACTIONS, AuditService } from '../../../../common/audit'
import { ApiError } from '../../../../common/errors/api-error'
import { isIdString } from '../../../../db/ids'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import type { TxClient } from '../../../../db/client'
import { PrismaService } from '../../../../db/prisma.service'
import { viewerSchoolId } from '../domain/access-policy'
import { compareIds, round } from '../domain/rules'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort } from '../ports'
import type { Ctx } from '../services/types'
import { autoArOf, withAutoAr } from './headcount.auto-ar'
import { csvOf } from './headcount.csv'
import {
  HeadcountRepository,
  type HeadcountConfigRecord,
  type HeadcountEntryRecord,
  type NewHeadcountConfig,
} from './headcount.repository'
import { resolveMarks } from './headcount.rules'
import {
  dashboardItem,
  detailOf,
  listItem,
  sectionOf,
  sortOf,
  summaryOf,
  type ConfigInfo,
  type HeadcountDashboardConfig,
  type HeadcountDetail,
  type HeadcountListItem,
  type HeadcountStudent,
  type HeadcountSummary,
  type RosterLine,
} from './headcount.views'

const MSG = PERFORMANCE_HEADCOUNT_MESSAGES

/** What the audit trail needs from the request (never read from the body). */
export interface HeadcountWriteCtx extends Ctx {
  requestId: string | null
  ip: string | null
  sessionRowId: string
  scopeLevel: string
}

export interface HeadcountFormOptions {
  classes: { id: string; name: string }[]
  subjects: { id: string; name: string; code: string }[]
  levels: { id: string; name: string }[]
  defaultYear: number
}

/** Laravel `ValidationException::summarize`: the first message, plus "(and N more error(s))". */
export function summarizeFields(fields: Record<string, string>): string {
  const messages = Object.values(fields)
  const first = messages[0] ?? ''
  const more = messages.length - 1
  return more <= 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

const invalid = (fields: Record<string, string>): ApiError =>
  ApiError.of('VALIDATION_ERROR', { fields, message: summarizeFields(fields) })

/** First message per top-level field of a failed contract parse. */
function fieldsOf(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    fields[key] ??= issue.message
  }
  return fields
}

/** Every issue of a failed contract parse by its full path (`marks.2.value`): the screens flag the row. */
function deepFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length === 0 ? '_' : issue.path.map(String).join('.')
    fields[key] ??= issue.message
  }
  return fields
}

/** Pupils of a write must be live roster members of the config (unknown and dropped ones are 422). */
function rosterFields(userIds: readonly string[], key: string, lines: readonly RosterLine[]): Record<string, string> {
  const live = new Set(lines.filter((l) => !l.dropped).map((l) => l.studentId))
  const fields: Record<string, string> = {}
  userIds.forEach((u, i) => {
    if (!live.has(u)) fields[`${key}.${String(i)}.userId`] = MSG.studentsInvalid
  })
  return fields
}

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

/** Postgres/Prisma unique violation (P2002 / 23505). */
function isUniqueViolation(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return code === 'P2002' || code === '23505'
}

/** A level code of auto-setup: `D1`..`D6` or `T1`..`T5`, upper-cased. */
const CODE = /^[DT][1-6]$/

/**
 * Headcount (TOV / RS) routes of M08 (BE-19, S10-T02). Reads: roles admin, teacher, school_admin and, for the two `me` routes,
 * student. Scope: a teacher sees the own configs; a school admin the configs of the own school; an admin all. An unknown
 * config and a config outside the scope are ONE outcome, 404 NOT_FOUND (generic BM default) (OQ-3): no existence leak.
 * Writes: the owning teacher only. A school admin or admin who can see the config gets 403, one who cannot gets the same 404.
 */
@Injectable()
export class HeadcountService {
  constructor(
    @Inject(HeadcountRepository) private readonly repo: HeadcountRepository,
    @Inject(PerformancePorts) private readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) private readonly directory: DirectoryPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- reads -----------------------------------------------------------------------------

  /** The configs a caller lists: teacher own, school admin the own school, admin all. */
  private async configsInScope(ctx: Ctx): Promise<HeadcountConfigRecord[]> {
    if (ctx.role === 'teacher') return this.repo.configsOfTeacher(ctx.userId)
    if (ctx.role === 'school_admin') {
      const school = viewerSchoolId(ctx)
      return school === null ? [] : this.repo.configsOfSchool(school)
    }
    if (ctx.role === 'admin') return this.repo.allConfigs()
    return []
  }

  /**
   * S6-T13 PM-24: Admin Pusat who sends `schoolId` lists the configs of that ONE school (422 `fields.schoolId` when malformed,
   * 404 when unknown), the same list as that school's admin. Without `schoolId` the admin list is unchanged (all configs).
   * Other roles ignore `schoolId`.
   */
  private async centralConfigs(rawSchoolId: unknown): Promise<HeadcountConfigRecord[]> {
    const raw = typeof rawSchoolId === 'string' ? rawSchoolId.trim() : ''
    if (!/^[1-9]\d{0,18}$/.test(raw) || !isIdString(raw)) {
      const message = REPORT_SCOPE_MESSAGES.schoolIdRequired
      throw ApiError.of('VALIDATION_ERROR', { message, fields: { schoolId: message } })
    }
    if (!(await this.directory.school(raw))) throw ApiError.of('NOT_FOUND')
    return this.repo.configsOfSchool(raw)
  }

  async list(ctx: Ctx, rawSchoolId?: unknown): Promise<HeadcountListItem[]> {
    const configs = ctx.role === 'admin' && rawSchoolId !== undefined ? await this.centralConfigs(rawSchoolId) : await this.configsInScope(ctx)
    const { infos, rosters } = await this.assemble(configs)
    return configs.map((c) => listItem(infos.get(c.id) as ConfigInfo, rosters.get(c.id) ?? []))
  }

  async dashboard(ctx: Ctx): Promise<{ configs: HeadcountDashboardConfig[] }> {
    const configs = await this.configsInScope(ctx)
    const { infos, rosters } = await this.assemble(configs)
    return { configs: configs.map((c) => dashboardItem(infos.get(c.id) as ConfigInfo, rosters.get(c.id) ?? [])) }
  }

  // --- the pupil's own view (API-RPT-08) -------------------------------------------------

  /** The pupil's configs of the current MYT calendar year, by class membership (not only entry rows). A dropped pupil sees none. */
  private async ownConfigs(ctx: Ctx): Promise<{ configs: HeadcountConfigRecord[]; infos: Map<string, ConfigInfo>; rosters: Map<string, RosterLine[]> }> {
    const classIds = (await this.ports.classes.classIdsOfStudent(ctx.userId)) ?? []
    const year = this.currentYear()
    const all = (await this.repo.configsOfClassrooms(classIds)).filter((c) => c.academicYear === year)
    const { infos, rosters } = await this.assemble(all)
    const configs = all.filter((c) => (rosters.get(c.id) ?? []).some((l) => l.studentId === ctx.userId && !l.dropped))
    // Newest first, ties by id descending (same order as the staff list).
    configs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || -compareIds(a.id, b.id))
    return { configs, infos, rosters }
  }

  async listOwn(ctx: Ctx): Promise<HeadcountListItem[]> {
    const { configs, infos, rosters } = await this.ownConfigs(ctx)
    return configs.map((c) => {
      const lines = rosters.get(c.id) ?? []
      return listItem(infos.get(c.id) as ConfigInfo, lines, lines.find((l) => l.studentId === ctx.userId))
    })
  }

  /** Own line of one config (omitted `configId`: the config last updated). A foreign or unknown config is 404; no classmate data. */
  async detailOwn(ctx: Ctx, configId: string | undefined): Promise<HeadcountStudent> {
    const pupil = (await this.directory.users([ctx.userId])).get(ctx.userId)
    if (!pupil) throw ApiError.of('NOT_FOUND')
    const { configs, infos, rosters } = await this.ownConfigs(ctx)
    let chosen: HeadcountConfigRecord | undefined
    if (configId !== undefined) {
      chosen = configs.find((c) => c.id === configId)
      if (!chosen) throw ApiError.of('NOT_FOUND')
    } else chosen = configs[0]
    const school = pupil.schoolId === null ? null : ((await this.directory.school(pupil.schoolId))?.name ?? null)
    const sections = chosen
      ? (() => {
          const line = (rosters.get(chosen.id) ?? []).find((l) => l.studentId === ctx.userId) as RosterLine
          return [sectionOf(infos.get(chosen.id) as ConfigInfo, line, school)]
        })()
      : []
    return { student: { id: pupil.id, name: pupil.name, school }, sections }
  }

  async formOptions(ctx: Ctx): Promise<HeadcountFormOptions> {
    const [classes, subjects, levels] = await Promise.all([
      ctx.role === 'teacher' ? this.ports.classes.classesForTeacher(ctx.userId) : Promise.resolve([]),
      this.repo.activeSubjects(),
      this.repo.headcountLevels(),
    ])
    return {
      classes: classes.filter((c) => c.kind === 'classroom').map((c) => ({ id: c.id, name: c.name })),
      subjects,
      levels: levels.map((l) => ({ id: l.id, name: l.name })),
      defaultYear: this.currentYear(),
    }
  }

  async summary(ctx: Ctx, id: string): Promise<HeadcountSummary> {
    const { info, lines } = await this.open(ctx, id)
    return summaryOf(info, lines)
  }

  async detail(ctx: Ctx, id: string, sort: string | undefined): Promise<HeadcountDetail> {
    const { info, lines } = await this.open(ctx, id)
    return detailOf(info, lines, sortOf(sort))
  }

  async exportCsv(ctx: Ctx, id: string, sort: string | undefined): Promise<{ filename: string; csv: string }> {
    const { config, info, lines } = await this.open(ctx, id)
    return { filename: `headcount-${config.id}.csv`, csv: csvOf(detailOf(info, lines, sortOf(sort))) }
  }

  /** S15: the sections of one pupil, only from configs the caller may see. Unknown, non-student and out-of-scope: 404. */
  async student(ctx: Ctx, userId: string): Promise<HeadcountStudent> {
    const pupil = (await this.directory.users([userId])).get(userId)
    if (!pupil || !pupil.isStudent) throw ApiError.of('NOT_FOUND')
    // The pupil's configs: those holding an entry row AND those of the pupil's own classes. A class pupil needs no entry row to be on
    // a config (the teacher's table lists the whole roster; an Auto pupil's AR comes from the answer store), so neither path may
    // depend on one (AC-CHAIN-5: an Auto pupil with no entry row had no section).
    const classIds = (await this.ports.classes.classIdsOfStudent(userId)) ?? []
    const byEntry = await this.repo.configsByIds(await this.repo.configIdsOfStudent(userId))
    const byClass = classIds.length === 0 ? [] : await this.repo.configsOfClassrooms(classIds)
    const own = [...new Map([...byEntry, ...byClass].map((c) => [c.id, c])).values()]
    let visible: HeadcountConfigRecord[]
    if (ctx.role === 'admin') {
      visible = own
    } else if (ctx.role === 'school_admin') {
      const school = viewerSchoolId(ctx)
      if (school === null || pupil.schoolId !== school) throw ApiError.of('NOT_FOUND')
      const schools = await this.repo.schoolOfConfigs(own)
      visible = own.filter((c) => schools.get(c.id) === school)
    } else if (ctx.role === 'teacher') {
      // A teacher opens pupils of the own classes, and sees them through the own configs only.
      const mine = own.filter((c) => c.teacherId === ctx.userId)
      const related = mine.length > 0 || (await this.ports.classes.isMemberOfTeacher(ctx.userId, userId))
      if (!related) throw ApiError.of('NOT_FOUND')
      visible = mine
    } else {
      throw ApiError.of('NOT_FOUND')
    }
    // The pupil's line comes from the one roster and mark assembler (entry or class defaults, live Auto AR), so it equals the row of
    // the teacher's table; a dropped pupil has no section.
    const { infos, rosters } = await this.assemble(visible)
    const school = pupil.schoolId === null ? null : ((await this.directory.school(pupil.schoolId))?.name ?? null)
    const sections = [...visible]
      .sort((a, b) => compareIds(a.id, b.id))
      .flatMap((c) => {
        const line = (rosters.get(c.id) ?? []).find((l) => l.studentId === userId)
        return line === undefined || line.dropped ? [] : [sectionOf(infos.get(c.id) as ConfigInfo, { ...line, name: pupil.name }, school)]
      })
    return { student: { id: pupil.id, name: pupil.name, school }, sections }
  }

  // --- writes ----------------------------------------------------------------------------

  async create(ctx: HeadcountWriteCtx, body: unknown): Promise<{ id: string }> {
    if (ctx.role !== 'teacher') throw ApiError.of('FORBIDDEN')
    const raw = asRecord(body)
    const parsed = PerformanceHeadcountCreateRequestSchema.safeParse(raw)
    const fields: Record<string, string> = parsed.success ? {} : fieldsOf(parsed.error)
    const input = parsed.success ? parsed.data : null

    // A field without a schema error is a non-empty string, so it can be checked even when another field failed.
    if (fields.classroomId === undefined) {
      const classes = await this.ports.classes.classesForTeacher(ctx.userId)
      const own = classes.some((c) => c.kind === 'classroom' && c.id === raw.classroomId)
      // A foreign, an unknown and an inactive class give the same message.
      if (!own) fields.classroomId = MSG.classInvalid
    }
    if (fields.subjectId === undefined && !(await this.repo.subjectExists(String(raw.subjectId)))) {
      fields.subjectId = MSG.subjectInvalid
    }
    if (fields.educationLevelId === undefined) {
      const levels = await this.repo.headcountLevels()
      if (!levels.some((l) => l.id === raw.educationLevelId)) fields.educationLevelId = MSG.levelInvalid
    }
    if (Object.keys(fields).length > 0 || input === null) throw invalid(fields)

    const row: NewHeadcountConfig = {
      teacherId: ctx.userId,
      classroomId: input.classroomId,
      subjectId: input.subjectId,
      educationLevelId: input.educationLevelId,
      academicYear: Number(input.academicYear),
      activeOtrs: Number(input.activeOtrs),
      mode: input.mode,
      now: this.clock.now(),
    }
    const duplicate = (): ApiError => ApiError.of('CONFLICT', { message: MSG.duplicate[row.mode] })
    try {
      // The key lock serialises this with a concurrent create or auto-setup of the same (class, subject, year);
      // the unique index stays the backstop for the same mode.
      return await this.prisma.transaction(async (tx) => {
        await this.repo.lockConfigKey(row.classroomId, row.subjectId, row.academicYear)
        if (await this.repo.duplicateOf(row)) throw duplicate()
        const id = await this.repo.createConfig(row)
        await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIG_CREATED, ctx, id, {
          classroomId: row.classroomId,
          subjectId: row.subjectId,
          educationLevelId: row.educationLevelId,
          academicYear: row.academicYear,
          activeOtrs: row.activeOtrs,
          mode: row.mode,
        })
        return { id }
      })
    } catch (err) {
      // A concurrent twin won the unique index.
      if (isUniqueViolation(err)) throw duplicate()
      throw err
    }
  }

  /** BR-M08-21: one Auto config (3 OTRs) per own active class of the chosen levels that has a subject. Idempotent. */
  async autoSetup(ctx: HeadcountWriteCtx, body: unknown): Promise<{ created: number }> {
    if (ctx.role !== 'teacher') throw ApiError.of('FORBIDDEN')
    const parsed = PerformanceHeadcountAutoSetupRequestSchema.safeParse(asRecord(body))
    if (!parsed.success) throw invalid(fieldsOf(parsed.error))
    const ids: string[] = []
    const codes: string[] = []
    for (const v of parsed.data.levels) {
      const text = String(v).trim()
      if (CODE.test(text.toUpperCase())) codes.push(text.toUpperCase())
      else ids.push(text)
    }
    const levels = await this.repo.levelsByIdOrCode(ids, codes)
    const known = new Set(levels.flatMap((l) => [l.id, l.code]))
    if (![...ids, ...codes].every((v) => known.has(v))) throw invalid({ levels: MSG.levelInvalid })
    const bySlug = new Map(levels.map((l) => [l.code.toLowerCase(), l.id]))
    const classes = (await this.ports.classes.classesForTeacher(ctx.userId)).filter(
      (c) => c.kind === 'classroom' && c.subjectId !== null && bySlug.has(c.levelSlug),
    )
    if (classes.length === 0) return { created: 0 }
    const year = this.currentYear()
    const now = this.clock.now()
    // Under the per-(class, subject, year) locks (sorted, so two runs cannot deadlock) the existence read is final: a
    // concurrent manual or auto create of the same key is either already committed here or waits for this run.
    return {
      created: await this.prisma.transaction(async (tx) => {
        const keys = [...new Set(classes.map((c) => `${c.id}:${c.subjectId as string}`))].sort()
        for (const key of keys) {
          const [classroomId, subjectId] = key.split(':') as [string, string]
          await this.repo.lockConfigKey(classroomId, subjectId, year)
        }
        const existing = new Set(
          (await this.repo.configsOfClassrooms(classes.map((c) => c.id)))
            .filter((c) => c.academicYear === year)
            .map((c) => `${c.classroomId}:${c.subjectId}`),
        )
        const rows: NewHeadcountConfig[] = classes
          .filter((c) => !existing.has(`${c.id}:${c.subjectId as string}`))
          .map((c) => ({
            teacherId: ctx.userId,
            classroomId: c.id,
            subjectId: c.subjectId as string,
            educationLevelId: bySlug.get(c.levelSlug) as string,
            academicYear: year,
            activeOtrs: 3,
            mode: 'auto' as const,
            now,
          }))
        // ON CONFLICT DO NOTHING stays as the backstop for the unique index.
        const created = await this.repo.createConfigsIfAbsent(rows)
        // One row for the run; a run that created nothing wrote nothing and leaves no row.
        if (created > 0) await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIGS_AUTO_SETUP, ctx, null, { created })
        return created
      }),
    }
  }

  async dropStudents(ctx: HeadcountWriteCtx, id: string, body: unknown): Promise<{ updated: number }> {
    const { config, lines } = await this.openOwn(ctx, id)
    const raw = asRecord(body)
    const parsed = PerformanceHeadcountDropRequestSchema.safeParse(raw)
    const fields: Record<string, string> = parsed.success ? {} : fieldsOf(parsed.error)
    if (fields.studentIds === undefined && Array.isArray(raw.studentIds)) {
      const roster = new Set(lines.map((l) => l.studentId))
      // The same message for a pupil of another class and for one that does not exist.
      if (!raw.studentIds.every((s) => typeof s === 'string' && roster.has(s))) fields.studentIds = MSG.studentsInvalid
    }
    if (Object.keys(fields).length > 0 || !parsed.success) throw invalid(fields)
    const dropping = parsed.data.action === 'drop'
    const updated = await this.prisma.transaction(async (tx) => {
      const n = await this.repo.setDropped(config.id, [...new Set(parsed.data.studentIds)], dropping, this.clock.now())
      // The count only, never the pupil ids. A call that changed nothing writes nothing and leaves no row.
      if (n > 0) {
        await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_STUDENTS_DROPPED, ctx, config.id, {
          action: parsed.data.action,
          [dropping ? 'dropped' : 'restored']: n,
        })
      }
      return n
    })
    return { updated }
  }

  async reset(ctx: HeadcountWriteCtx, id: string): Promise<{ reset: true }> {
    const { config } = await this.openOwn(ctx, id)
    await this.prisma.transaction(async (tx) => {
      const entries = await this.repo.resetMarks(config.id, this.clock.now())
      await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIG_RESET, ctx, config.id, { entries })
    })
    return { reset: true }
  }

  async remove(ctx: HeadcountWriteCtx, id: string): Promise<{ deleted: true }> {
    const { config } = await this.openOwn(ctx, id)
    await this.prisma.transaction(async (tx) => {
      await this.repo.deleteConfig(config.id)
      await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIG_DELETED, ctx, config.id, {})
    })
    return { deleted: true }
  }

  // --- S10-T02 writes (API-RPT-10, API-RPT-16): the owning teacher only ------------------------

  /** Key-in AR of one checkpoint (Manual only). Auto config or a checkpoint outside 1..activeOtrs is 404. */
  async saveAr(ctx: HeadcountWriteCtx, id: string, body: unknown): Promise<HeadcountDetail> {
    const { config, lines } = await this.openOwn(ctx, id)
    const raw = asRecord(body)
    if (config.mode === 'auto') throw ApiError.of('NOT_FOUND')
    if (typeof raw.checkpoint === 'number' && Number.isInteger(raw.checkpoint) && (raw.checkpoint < 1 || raw.checkpoint > config.activeOtrs)) {
      throw ApiError.of('NOT_FOUND')
    }
    const parsed = PerformanceHeadcountArRequestSchema.safeParse(raw)
    if (!parsed.success) throw invalid(deepFields(parsed.error))
    if (parsed.data.checkpoint > config.activeOtrs) throw ApiError.of('NOT_FOUND')
    const fields = rosterFields(parsed.data.marks.map((m) => m.userId), 'marks', lines)
    if (Object.keys(fields).length > 0) throw invalid(fields)
    // The last value of a repeated pupil wins.
    const byPupil = new Map(parsed.data.marks.map((m) => [m.userId, m.value === null ? null : round(m.value, 1)]))
    await this.prisma.transaction(async () => {
      await this.repo.saveActuals(
        config.id,
        parsed.data.checkpoint,
        [...byPupil].map(([studentId, value]) => ({ studentId, value })),
        this.clock.now(),
      )
    })
    return this.detail(ctx, id, undefined)
  }

  /** Edit TOV / ETR / RS rows. Only the keys present in a row are written; null clears. */
  async saveTov(ctx: HeadcountWriteCtx, id: string, body: unknown): Promise<HeadcountDetail> {
    const { config, lines } = await this.openOwn(ctx, id)
    const parsed = PerformanceHeadcountTovRequestSchema.safeParse(asRecord(body))
    if (!parsed.success) throw invalid(deepFields(parsed.error))
    const fields = rosterFields(parsed.data.rows.map((r) => r.userId), 'rows', lines)
    const now = this.clock.now()
    const today = mytDay(now)
    const stored = await this.repo.rsOf(config.id, parsed.data.rows.map((r) => r.userId))
    const one = (v: number | null | undefined): number | null | undefined => (v === undefined || v === null ? v : round(v, 1))
    const out = parsed.data.rows.map((r, i) => {
      const had = stored.get(r.userId)
      const rs = one(r.rs)
      const row: { studentId: string; tov?: number | null; etr?: number | null; rs?: number | null; rsRecordedAt?: Date | null } = { studentId: r.userId }
      const tov = one(r.tov)
      const etr = one(r.etr)
      if (tov !== undefined) row.tov = tov
      if (etr !== undefined) row.etr = etr
      if (rs !== undefined) row.rs = rs
      if (r.rsRecordedAt !== undefined && r.rsRecordedAt !== null && r.rsRecordedAt > today) {
        fields[`rows.${String(i)}.rsRecordedAt`] = MSG.rsDateFuture
      }
      const hadRs = had?.rs ?? null
      const effectiveRs = rs !== undefined ? rs : hadRs
      if (effectiveRs === null && r.rsRecordedAt !== undefined && r.rsRecordedAt !== null) {
        fields[`rows.${String(i)}.rsRecordedAt`] ??= MSG.rsDateNeedsRs
      }
      if (effectiveRs === null) {
        // No RS: no record date either; an RS cleared with null clears its date.
        if (rs === null || had?.rsRecordedAt != null) row.rsRecordedAt = null
      } else if (r.rsRecordedAt !== undefined && r.rsRecordedAt !== null) {
        row.rsRecordedAt = new Date(`${r.rsRecordedAt}T00:00:00+08:00`)
      } else if (r.rsRecordedAt === null || (rs !== undefined && (hadRs === null || had?.rsRecordedAt == null))) {
        // First RS save (or no stored date): today in MYT.
        row.rsRecordedAt = new Date(`${today}T00:00:00+08:00`)
      }
      return row
    })
    if (Object.keys(fields).length > 0) throw invalid(fields)
    await this.prisma.transaction(async () => {
      await this.repo.saveEntryValues(config.id, out, now)
    })
    return this.detail(ctx, id, undefined)
  }

  /** Tetapan: Bilangan OTR 2..5. Lowering below a checkpoint that has AR marks asks CF-05 (409) and, confirmed, deletes them. */
  async saveSettings(ctx: HeadcountWriteCtx, id: string, body: unknown): Promise<HeadcountDetail> {
    const { config } = await this.openOwn(ctx, id)
    const parsed = PerformanceHeadcountSettingsRequestSchema.safeParse(asRecord(body))
    if (!parsed.success) throw invalid(deepFields(parsed.error))
    const n = Number(parsed.data.activeOtrs)
    if (n !== config.activeOtrs) {
      await this.prisma.transaction(async (tx) => {
        // CF-05 check and delete in ONE transaction, so a concurrent Key-in cannot be deleted unasked. An Auto config has no
        // keyed AR to protect (its AR is derived), so it is trimmed without the prompt.
        if (config.mode !== 'auto' && n < config.activeOtrs && parsed.data.confirm !== true) {
          const above = await this.repo.firstCheckpointAbove(config.id, n)
          if (above !== null) throw ApiError.of('CONFLICT', { message: MSG.otrLoweringConfirm(n + 1) })
        }
        const deleted = await this.repo.setActiveOtrs(config.id, n, this.clock.now())
        await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIG_OTRS_CHANGED, ctx, config.id, { from: config.activeOtrs, to: n, marksDeleted: deleted })
      })
    }
    return this.detail(ctx, id, undefined)
  }

  /** "Simpan Sasaran": the class defaults of one config (API-RPT-16). */
  async saveDefaults(ctx: HeadcountWriteCtx, id: string, body: unknown): Promise<HeadcountDetail> {
    const { config } = await this.openOwn(ctx, id)
    const parsed = PerformanceHeadcountDefaultsRequestSchema.safeParse(asRecord(body))
    if (!parsed.success) throw invalid(deepFields(parsed.error))
    const v = (x: number | null): number | null => (x === null ? null : round(x, 1))
    await this.prisma.transaction(async () => {
      await this.repo.setDefaults(config.id, { defaultTov: v(parsed.data.defaultTov), defaultEtr: v(parsed.data.defaultEtr) }, this.clock.now())
    })
    return this.detail(ctx, id, undefined)
  }

  // --- internals -------------------------------------------------------------------------

  /** Audit row of a destructive change. The detail names no pupil. */
  private async record(
    tx: TxClient,
    action: string,
    ctx: HeadcountWriteCtx,
    configId: string | null,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      tx,
      action,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      sessionRowId: ctx.sessionRowId,
      targetType: 'headcount_config',
      targetId: configId,
      schoolId: viewerSchoolId(ctx),
      scopeLevel: ctx.scopeLevel,
      requestId: ctx.requestId,
      ip: ctx.ip,
      isTest: ctx.isTest,
      details: configId === null ? details : { configId, ...details },
    })
  }

  private currentYear(): number {
    return Number(mytDay(this.clock.now()).slice(0, 4))
  }

  /** The config, its names and its roster, or the ONE 404 for an unknown config and for one outside the caller's scope. */
  private async open(ctx: Ctx, id: string): Promise<{ config: HeadcountConfigRecord; info: ConfigInfo; lines: RosterLine[] }> {
    const config = await this.repo.configById(id)
    if (!config || !(await this.mayUse(ctx, config))) throw ApiError.of('NOT_FOUND')
    const { infos, rosters } = await this.assemble([config])
    return { config, info: infos.get(config.id) as ConfigInfo, lines: rosters.get(config.id) ?? [] }
  }

  /** Write guard: the owning teacher. A school admin or admin who may read the config gets 403, anyone else the 404. */
  private async openOwn(ctx: Ctx, id: string): Promise<{ config: HeadcountConfigRecord; info: ConfigInfo; lines: RosterLine[] }> {
    const opened = await this.open(ctx, id)
    if (ctx.role !== 'teacher') throw ApiError.of('FORBIDDEN')
    return opened
  }

  private async mayUse(ctx: Ctx, config: HeadcountConfigRecord): Promise<boolean> {
    switch (ctx.role) {
      case 'admin':
        return true
      case 'teacher':
        return config.teacherId === ctx.userId
      case 'school_admin': {
        const school = viewerSchoolId(ctx)
        return school !== null && (await this.repo.schoolOfConfigs([config])).get(config.id) === school
      }
      default:
        return false
    }
  }

  /** Names for a set of configs: class, subject, level and teacher. A fixed number of reads. */
  private async describe(configs: readonly HeadcountConfigRecord[]): Promise<Map<string, ConfigInfo>> {
    if (configs.length === 0) return new Map()
    const [classes, subjects, levels, teachers] = await Promise.all([
      this.ports.classes.classesByIds([...new Set(configs.map((c) => c.classroomId))]),
      this.repo.subjectNames(configs.map((c) => c.subjectId)),
      this.repo.levelNames(configs.map((c) => c.educationLevelId)),
      this.directory.users([...new Set(configs.map((c) => c.teacherId))]),
    ])
    const className = new Map(classes.map((c) => [c.id, c.name]))
    return new Map(
      configs.map((c) => [
        c.id,
        {
          id: c.id,
          className: className.get(c.classroomId) ?? '',
          subjectName: subjects.get(c.subjectId) ?? `Subjek ${c.subjectId}`,
          levelId: c.educationLevelId,
          levelName: levels.get(c.educationLevelId) ?? `Tahap ${c.educationLevelId}`,
          year: c.academicYear,
          mode: c.mode,
          activeOtrs: c.activeOtrs,
          teacherName: teachers.get(c.teacherId)?.name ?? '',
          defaultTov: c.defaultTov,
          defaultEtr: c.defaultEtr,
        },
      ]),
    )
  }

  /**
   * Names and rosters for a set of configs. Roster = active class members plus the pupils holding an entry. Marks come from the
   * one assembler (`resolveMarks`: defaults, computed OTR targets); an Auto config then reads the AR from the answer store.
   */
  private async assemble(configs: readonly HeadcountConfigRecord[]): Promise<{ infos: Map<string, ConfigInfo>; rosters: Map<string, RosterLine[]> }> {
    const infos = await this.describe(configs)
    const rosters = new Map<string, RosterLine[]>()
    if (configs.length === 0) return { infos, rosters }
    const [members, entries] = await Promise.all([
      this.ports.classes.membersOf([...new Set(configs.map((c) => c.classroomId))]),
      this.repo.entriesOf(configs),
    ])
    const entryOf = new Map<string, HeadcountEntryRecord>(entries.map((e) => [`${e.configId}:${e.studentId}`, e]))
    const idsOf = new Map<string, Set<string>>(configs.map((c) => [c.id, new Set(members.get(c.classroomId) ?? [])]))
    for (const e of entries) idsOf.get(e.configId)?.add(e.studentId)
    const everyone = new Set<string>()
    for (const set of idsOf.values()) for (const s of set) everyone.add(s)
    const [users, auto] = await Promise.all([
      this.directory.users([...everyone]),
      autoArOf(this.ports, configs, (id) => [...(idsOf.get(id) ?? [])]),
    ])
    for (const c of configs) {
      const lines = [...(idsOf.get(c.id) ?? [])].sort(compareIds).map((studentId): RosterLine => {
        const e = entryOf.get(`${c.id}:${studentId}`)
        const base = e?.marks ?? resolveMarks(null, c)
        const ar = auto.get(c.id)
        return {
          studentId,
          name: users.get(studentId)?.name ?? `Murid ${studentId}`,
          marks: ar === undefined ? base : withAutoAr(base, ar.get(studentId) ?? null),
          rsRecordedAt: e?.rsRecordedAt ?? null,
          dropped: e?.dropped ?? false,
        }
      })
      rosters.set(c.id, lines)
    }
    return { infos, rosters }
  }
}
