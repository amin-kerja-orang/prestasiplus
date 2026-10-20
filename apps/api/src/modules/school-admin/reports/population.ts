import { Inject, Injectable } from '@nestjs/common'

import { AnalyticsRepository, type PupilStat, type SessionDayRow, type TeacherLine } from '../../reports/analytics/analytics.repository'
import { byName } from '../../reports/analytics/domain/rules'
import { ApiError } from '../../../common/errors/api-error'
import { SchoolsRepository } from '../../schools'
import { UsersRepository } from '../../users'
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

/**
 * The people of one school and the chunked practice reads over them (BE-21 Part B). The school id is always the session's.
 * Pupils come from the users owner (`UsersRepository.studentsOfSchool`, active students only), teachers from BE-20's
 * `teachersOfSchool` (active teachers: a pending or deactivated teacher is not listed). Every `IN` list sent to the database is
 * cut into pieces of 1000 ids, so a large school never builds one huge statement.
 */
@Injectable()
export class SchoolPopulation {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
  ) {}

  /** `{ id, name }` of the session school. */
  async school(schoolId: string): Promise<{ id: string; name: string }> {
    const row = await this.schools.get(schoolId)
    if (!row) throw ApiError.of('NOT_FOUND')
    return { id: row.id, name: row.name }
  }

  /** Active pupils of the school, name A to Z, with their last login. */
  async pupils(schoolId: string): Promise<PupilFact[]> {
    const rows = await this.users.studentsOfSchool(schoolId, '', '')
    const ids = rows.filter((r) => r.isActive && r.schoolId === schoolId).map((r) => r.id)
    const lines = (await each(ids, (c) => this.analytics.studentsAmong(c))).flat()
    return lines.map((l) => ({ id: l.id, name: l.name, lastLoginAt: l.lastLoginAt })).sort(byName)
  }

  teachers(schoolId: string): Promise<TeacherLine[]> {
    return this.analytics.teachersOfSchool(schoolId)
  }

  async sessions(ids: readonly string[], from: number, to: number): Promise<SessionDayRow[]> {
    return (await each(ids, (c) => this.analytics.sessionsByDay(c, new Date(from), new Date(to)))).flat()
  }

  async stats(ids: readonly string[]): Promise<Map<string, PupilStat>> {
    const out = new Map<string, PupilStat>()
    for (const part of await each(ids, (c) => this.analytics.pupilStats(c))) for (const [k, v] of part) out.set(k, v)
    return out
  }

  async practised(ids: readonly string[]): Promise<Set<string>> {
    const out = new Set<string>()
    for (const part of await each(ids, (c) => this.analytics.practisedAmong(c))) for (const id of part) out.add(id)
    return out
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
