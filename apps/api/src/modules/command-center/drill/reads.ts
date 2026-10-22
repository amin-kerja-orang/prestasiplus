/**
 * Read-only SQL of the drill-down that the shared repository does not offer (BE-22, same precedent and rules as
 * `shared/command-center.repository.ts`: bound parameters only, `is_test` rows never counted, nothing written).
 * Tables read: `users`, `user_roles`, `teacher_profiles`, `streaks`, `practice_answers`, `practice_sessions`, `subjects`.
 */
import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

type Row = Record<string, unknown>
const n = (v: unknown): number => Number(v ?? 0)

function bigints(list: string[]): bigint[] {
  const out: bigint[] = []
  for (const id of list) {
    try {
      out.push(idFromString(id))
    } catch {
      /* a malformed id matches nothing */
    }
  }
  return out
}

export interface SubjectBreakdownRow {
  /** null = no session, or a session without a subject: free practice. */
  code: string | null
  name: string | null
  total: number
  correct: number
}

@Injectable()
export class DrillReads {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private q(query: Prisma.Sql): Promise<Row[]> {
    return this.prisma.client.$queryRaw<Row[]>(query)
  }

  /** Student users among the ids (active or not), with their active flag. */
  async studentsByIds(userIds: string[]): Promise<{ id: string; name: string; isActive: boolean }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS id, u.name, u.is_active FROM users u
       WHERE u.id = ANY(${bigints(userIds)}::bigint[]) AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')
       ORDER BY u.name ASC, u.id ASC`)
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), isActive: Boolean(r.is_active) }))
  }

  /** Free-text subject of the teacher profiles (trimmed; absent or blank = no entry). */
  async teacherSubjects(userIds: string[]): Promise<Map<string, string>> {
    const rows = await this.q(Prisma.sql`SELECT user_id::text AS id, subject FROM teacher_profiles WHERE user_id = ANY(${bigints(userIds)}::bigint[])`)
    const out = new Map<string, string>()
    for (const r of rows) {
      const text = typeof r.subject === 'string' ? r.subject.trim() : ''
      if (text) out.set(String(r.id), text)
    }
    return out
  }

  /** Current daily streak (the stored value; reads never decay it). 0 without a row. */
  async streakOf(userId: string): Promise<number> {
    const ids = bigints([userId])
    if (ids.length === 0) return 0
    const rows = await this.q(Prisma.sql`SELECT current FROM streaks WHERE user_id = ${ids[0] as bigint}`)
    return n(rows[0]?.current)
  }

  /**
   * One student's answers up to `to`, by the subject of the answer's SESSION (no session = free practice), as the mock's student
   * page "Pecahan Subjek" does. The board bars (`CommandCenterRepository.subjectTally`) use the ANSWER's subject, as the mock's
   * `subjectBars` does: the two rules differ on purpose (G4 minor 5).
   */
  async subjectBreakdown(userId: string, to: Date): Promise<SubjectBreakdownRow[]> {
    const ids = bigints([userId])
    if (ids.length === 0) return []
    const rows = await this.q(Prisma.sql`
      SELECT sub.code, sub.name, count(*)::int AS total, count(*) FILTER (WHERE a.is_correct)::int AS correct
        FROM practice_answers a
        LEFT JOIN practice_sessions ps ON ps.id = a.session_id
        LEFT JOIN subjects sub ON sub.id = ps.subject_id
       WHERE a.user_id = ${ids[0] as bigint} AND a.is_test = false AND a.answered_at <= ${to}
       GROUP BY sub.code, sub.name`)
    return rows.map((r) => ({ code: typeof r.code === 'string' ? r.code : null, name: typeof r.name === 'string' ? r.name : null, total: n(r.total), correct: n(r.correct) }))
  }
}
