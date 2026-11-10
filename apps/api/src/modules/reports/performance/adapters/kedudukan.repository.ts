import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { XS_PUPIL_SQL, XsQueries } from '../../../school-admin/xs-queries'
import type {
  KedudukanCandidate,
  KedudukanPool,
  KedudukanPort,
  KedudukanScope,
  KedudukanViewer,
} from '../ports/kedudukan.port'

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

/** The classes the viewer is an active, non-test member of (one active classroom each). */
const MY_CLASSES = (me: bigint): Prisma.Sql => Prisma.sql`
  SELECT e.classroom_id FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id
   WHERE e.student_id = ${me} AND e.status = 'active' AND NOT e.is_test AND c.is_active AND c.kind = 'classroom'`

/** The members of the scope, as a condition on `users u` (the viewer is always added by the caller). */
function scopeSql(scope: KedudukanScope, me: bigint): Prisma.Sql {
  switch (scope) {
    case 'kelas':
      return Prisma.sql`u.id IN (SELECT e2.student_id FROM enrolments e2
        WHERE e2.status = 'active' AND NOT e2.is_test AND e2.classroom_id IN (${MY_CLASSES(me)}))`
    case 'sekolah':
      return Prisma.sql`u.school_id = (SELECT m.school_id FROM users m WHERE m.id = ${me})`
    case 'negeri':
      return Prisma.sql`u.school_id IN (SELECT s.id FROM schools s
        WHERE s.state = (SELECT ms.state FROM users m JOIN schools ms ON ms.id = m.school_id WHERE m.id = ${me}))`
    case 'kebangsaan':
      return Prisma.sql`true`
  }
}

/**
 * Real `KedudukanPort`. The pool is every active pupil of the scope (XS-1, the one pupil definition) plus the viewer,
 * valued by the CURRENT wallet balance (`wallets.current_syiling`, which the V2 migration carries over as it was; a pupil
 * without a wallet counts 0). A wallet whose owner holds only test credits (Mod Pelajar) is left out. Only the viewer's
 * syiling group and the groups at the edges of "Sekitar anda" are read in full; everything else is counted in SQL.
 */
@Injectable()
export class KedudukanRepository implements KedudukanPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(XsQueries) private readonly xs: XsQueries,
  ) {}

  private q(query: Prisma.Sql): Promise<Row[]> {
    return this.prisma.client.$queryRaw<Row[]>(query)
  }

  async viewer(userId: string): Promise<KedudukanViewer | null> {
    if (!isIdString(userId)) return null
    const me = idFromString(userId)
    const [r] = await this.q(Prisma.sql`
      SELECT COALESCE(w.current_syiling, 0)::bigint AS syiling, u.school_id, s.state,
             EXISTS (${MY_CLASSES(me)}) AS in_class
        FROM users u LEFT JOIN wallets w ON w.user_id = u.id LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.id = ${me}`)
    if (r === undefined) return null
    const state = typeof r.state === 'string' && r.state.trim() !== '' ? r.state : null
    return {
      syiling: num(r.syiling),
      schoolId: r.school_id === null || r.school_id === undefined ? null : idToString(r.school_id as bigint),
      state,
      inClass: r.in_class === true,
    }
  }

  async pool(userId: string, scope: KedudukanScope): Promise<KedudukanPool | null> {
    if (!isIdString(userId)) return null
    const me = idFromString(userId)
    const rows = await this.q(Prisma.sql`
      WITH pool AS (
        SELECT u.id, u.name, COALESCE(w.current_syiling, 0)::bigint AS syiling,
               COALESCE((SELECT max(st.best) FROM streaks st WHERE st.user_id = u.id), 0)::int AS best
          FROM users u LEFT JOIN wallets w ON w.user_id = u.id
         WHERE u.id = ${me}
            OR (${XS_PUPIL_SQL('u')} AND ${scopeSql(scope, me)}
                AND (w.id IS NULL
                     OR NOT EXISTS (SELECT 1 FROM coin_ledger t WHERE t.user_id = u.id AND t.is_test AND t.amount > 0)
                     OR w.total_syiling_earned > (SELECT COALESCE(SUM(t.amount), 0) FROM coin_ledger t WHERE t.user_id = u.id AND t.is_test AND t.amount > 0)))
      ),
      m AS (SELECT syiling AS s FROM pool WHERE id = ${me}),
      va AS (SELECT syiling FROM pool WHERE syiling > (SELECT s FROM m) ORDER BY syiling ASC OFFSET 1 LIMIT 1),
      vb AS (SELECT syiling FROM pool WHERE syiling < (SELECT s FROM m) ORDER BY syiling DESC OFFSET 1 LIMIT 1)
      SELECT p.id, p.name, p.syiling, p.best,
             (SELECT count(*) FROM pool)::int AS total,
             (SELECT count(*) FROM pool WHERE syiling > (SELECT s FROM m))::int AS higher
        FROM pool p
       WHERE p.syiling BETWEEN COALESCE((SELECT syiling FROM vb), -9223372036854775807) AND COALESCE((SELECT syiling FROM va), 9223372036854775807)`)
    if (rows.length === 0 || !rows.some((r) => idToString(r.id as bigint) === userId)) return null
    const ids = rows.map((r) => idToString(r.id as bigint))
    const tallies = await this.xs.tallyOfPupils(ids)
    const candidates: KedudukanCandidate[] = rows.map((r, i) => {
      const id = ids[i] as string
      const t = tallies.get(id)
      return { userId: id, name: String(r.name ?? ''), syiling: num(r.syiling), answered: t?.answered ?? 0, correct: t?.correct ?? 0, bestStreak: num(r.best) }
    })
    const first = rows[0] as Row
    return { total: num(first.total), higher: num(first.higher), candidates }
  }
}
