import { Inject, Injectable } from '@nestjs/common'

import { AnalyticsRepository, type SessionDayRow, type TeacherLine } from '../../reports/analytics/analytics.repository'
import { byName } from '../../reports/analytics/domain/rules'
import { ApiError } from '../../../common/errors/api-error'
import { SchoolsRepository } from '../../schools'
import { XS_ALL_TIME, XsQueries, type XsAnswerTotals, type XsMonthTally, type XsPupilTally, type XsScope, type XsWindow } from '../xs-queries'
import { chunk } from './windows'

export interface PupilFact {
  id: string
  name: string
  lastLoginAt: Date | null
}

/** Runs `fn` over the chunks of `ids` one after the other (a low-memory server must not fan out dozens of statements). */
async function each<T>(ids: readonly string[], fn: (part: string[]) => Promise<T>): Promise<T[]> {
  const out: T[] = []
  for (const part of chunk(ids)) out.push(await fn(part))
  return out
}

/** The school scope of the session (XS-6a: the school id is always the session's, never the request's). */
export const schoolScope = (schoolId: string): XsScope => ({ kind: 'school', schoolId })

/**
 * The people of one school and the chunked practice reads over them (BE-21 Part B). The school id is always the session's.
 * The population is defined once, in `xs-queries.ts` (S6-T03): pupils are XS-1 (active accounts, Tingkatan 1-5; pending,
 * deactivated and suspended accounts are not counted), teachers are XS-3 (approved, no school-admin account), "practised" is XS-2
 * and every answered / correct figure is XS-4 / XS-5 over the same rows. So the report counts equal the dashboard cards and the
 * Command Center (AC-XS-1). Session figures (completed sessions, seconds) stay session reads. Every `IN` list sent to the
 * database is cut into pieces of 1000 ids, so a large school never builds one huge statement.
 */
@Injectable()
export class SchoolPopulation {
  constructor(
    @Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(XsQueries) private readonly xs: XsQueries,
  ) {}

  /** `{ id, name }` of the session school. */
  async school(schoolId: string): Promise<{ id: string; name: string }> {
    const row = await this.schools.get(schoolId)
    if (!row) throw ApiError.of('NOT_FOUND')
    return { id: row.id, name: row.name }
  }

  /** The XS-1 pupils of the school, name A to Z, with their last login. */
  async pupils(schoolId: string): Promise<PupilFact[]> {
    const { ids } = await this.xs.pupils(schoolScope(schoolId))
    const lines = (await each(ids, (c) => this.analytics.studentsAmong(c))).flat()
    return lines.map((l) => ({ id: l.id, name: l.name, lastLoginAt: l.lastLoginAt })).sort(byName)
  }

  /** The XS-3 teachers of the school, id ascending. */
  async teachers(schoolId: string): Promise<TeacherLine[]> {
    const { ids } = await this.xs.teachers(schoolId)
    return (await each(ids, (c) => this.analytics.teachersAmong(c))).flat()
  }

  async sessions(ids: readonly string[], from: number, to: number): Promise<SessionDayRow[]> {
    return (await each(ids, (c) => this.analytics.sessionsByDay(c, new Date(from), new Date(to)))).flat()
  }

  private window(from: number | null, to: number | null): XsWindow {
    return { from: from === null ? null : new Date(from), to: to === null ? null : new Date(to) }
  }

  /** XS-2 all time ("pernah menjawab"): the XS-1 pupils with at least one answer row. */
  async practised(schoolId: string): Promise<Set<string>> {
    return new Set((await this.xs.activePupils(schoolScope(schoolId), XS_ALL_TIME)).ids)
  }

  /** XS-4 and XS-5 of the school in the window (epoch ms; inclusive bounds). */
  async answerTotals(schoolId: string, from: number | null, to: number | null): Promise<XsAnswerTotals> {
    return this.xs.answerTotals(schoolScope(schoolId), this.window(from, to))
  }

  /** XS-2 of the window: the number of XS-1 pupils with at least one answer row. */
  async activeCount(schoolId: string, from: number | null, to: number | null): Promise<number> {
    return this.xs.activePupilCount(schoolScope(schoolId), this.window(from, to))
  }

  /** XS-4 per pupil in the window (`null` bounds = all time). */
  async tallyByPupil(schoolId: string, from: number | null, to: number | null): Promise<Map<string, XsPupilTally>> {
    return this.xs.tallyByPupil(schoolScope(schoolId), this.window(from, to))
  }

  /** XS-4 and XS-2 per MYT month in the window. */
  async tallyByMonth(schoolId: string, from: number, to: number): Promise<Map<string, XsMonthTally>> {
    return this.xs.tallyByMonth(schoolScope(schoolId), this.window(from, to))
  }

  async seconds(ids: readonly string[], from: number, to: number): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    for (const part of await each(ids, (c) => this.analytics.secondsByUser(c, new Date(from), new Date(to)))) {
      for (const [k, v] of part) out.set(k, v)
    }
    return out
  }

  async subjectTallies(ids: readonly string[], from: number, to: number) {
    return (await each(ids, (c) => this.analytics.subjectTallies(c, new Date(from), new Date(to)))).flat()
  }
}
