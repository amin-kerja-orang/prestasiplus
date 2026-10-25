import { Inject, Injectable } from '@nestjs/common'
import {
  PERFORMANCE_HEADCOUNT_MESSAGES,
  PerformanceHeadcountAutoSetupRequestSchema,
  PerformanceHeadcountCreateRequestSchema,
  PerformanceHeadcountDropRequestSchema,
} from '@pp/contract'
import type { z } from 'zod'

import { AUDIT_ACTIONS, AuditService } from '../../../../common/audit'
import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import type { TxClient } from '../../../../db/client'
import { PrismaService } from '../../../../db/prisma.service'
import { viewerSchoolId } from '../domain/access-policy'
import { compareIds } from '../domain/rules'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort } from '../ports'
import type { Ctx } from '../services/types'
import { csvOf } from './headcount.csv'
import {
  HeadcountRepository,
  type HeadcountConfigRecord,
  type HeadcountEntryRecord,
  type NewHeadcountConfig,
} from './headcount.repository'
import { blankSlots } from './headcount.rules'
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
 * Headcount (TOV / RS) routes of M08 (BE-19): 7 reads and 5 writes. Roles admin, teacher and school_admin only (the controller
 * guards that). Scope: a teacher sees the own configs; a school admin the configs of the own school; an admin all. An
 * unknown config and a config outside the scope are ONE outcome, 404 `Not Found.` (OQ-3): no existence leak. The list and the
 * dashboard are the teacher's own configs (admin and school admin get empty ones, as in the mock).
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

  async list(ctx: Ctx): Promise<HeadcountListItem[]> {
    if (ctx.role !== 'teacher') return []
    const configs = await this.repo.configsOfTeacher(ctx.userId)
    const { infos, rosters } = await this.assemble(configs)
    return configs.map((c) => listItem(infos.get(c.id) as ConfigInfo, rosters.get(c.id) ?? []))
  }

  async dashboard(ctx: Ctx): Promise<{ configs: HeadcountDashboardConfig[] }> {
    if (ctx.role !== 'teacher') return { configs: [] }
    const configs = await this.repo.configsOfTeacher(ctx.userId)
    const { infos, rosters } = await this.assemble(configs)
    return { configs: configs.map((c) => dashboardItem(infos.get(c.id) as ConfigInfo, rosters.get(c.id) ?? [])) }
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
    const own = await this.repo.configsByIds(await this.repo.configIdsOfStudent(userId))
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
    const entries = (await this.repo.entriesOfStudent(userId, visible)).filter((e) => !e.dropped)
    const byConfig = new Map(visible.map((c) => [c.id, c]))
    const used = entries.flatMap((e) => {
      const c = byConfig.get(e.configId)
      return c ? [c] : []
    })
    const infos = await this.describe(used)
    const school = pupil.schoolId === null ? null : ((await this.directory.school(pupil.schoolId))?.name ?? null)
    const sections = entries
      .sort((a, b) => compareIds(a.configId, b.configId))
      .map((e) =>
        sectionOf(
          infos.get(e.configId) as ConfigInfo,
          { studentId: userId, name: pupil.name, marks: e.marks, rsRecordedAt: e.rsRecordedAt, dropped: false },
          school,
        ),
      )
    return { student: { id: pupil.id, name: pupil.name, school }, sections }
  }

  // --- writes ----------------------------------------------------------------------------

  async create(ctx: HeadcountWriteCtx, body: unknown): Promise<{ id: string }> {
    const raw = asRecord(body)
    const parsed = PerformanceHeadcountCreateRequestSchema.safeParse(raw)
    const fields: Record<string, string> = parsed.success ? {} : fieldsOf(parsed.error)
    const input = parsed.success ? parsed.data : null

    // A field without a schema error is a non-empty string, so it can be checked even when another field failed.
    if (fields.classroomId === undefined) {
      const classes = ctx.role === 'teacher' ? await this.ports.classes.classesForTeacher(ctx.userId) : []
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
    if (ctx.role !== 'teacher') return { created: 0 }

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
    const { config, lines } = await this.open(ctx, id)
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
    const { config } = await this.open(ctx, id)
    await this.prisma.transaction(async (tx) => {
      const entries = await this.repo.resetMarks(config.id, this.clock.now())
      await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIG_RESET, ctx, config.id, { entries })
    })
    return { reset: true }
  }

  async remove(ctx: HeadcountWriteCtx, id: string): Promise<{ deleted: true }> {
    const { config } = await this.open(ctx, id)
    await this.prisma.transaction(async (tx) => {
      await this.repo.deleteConfig(config.id)
      await this.record(tx, AUDIT_ACTIONS.HEADCOUNT_CONFIG_DELETED, ctx, config.id, {})
    })
    return { deleted: true }
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
        },
      ]),
    )
  }

  /** Names and rosters for a set of configs. Roster = active class members plus the pupils holding an entry. */
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
    const users = await this.directory.users([...everyone])
    for (const c of configs) {
      const lines = [...(idsOf.get(c.id) ?? [])].sort(compareIds).map((studentId): RosterLine => {
        const e = entryOf.get(`${c.id}:${studentId}`)
        return {
          studentId,
          name: users.get(studentId)?.name ?? `Murid ${studentId}`,
          marks: e?.marks ?? { tov: null, targets: blankSlots(c.activeOtrs), actuals: blankSlots(c.activeOtrs), etr: null, rs: null },
          rsRecordedAt: e?.rsRecordedAt ?? null,
          dropped: e?.dropped ?? false,
        }
      })
      rosters.set(c.id, lines)
    }
    return { infos, rosters }
  }
}
