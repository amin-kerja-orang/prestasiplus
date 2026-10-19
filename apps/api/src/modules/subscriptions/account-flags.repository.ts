import { Inject, Injectable } from '@nestjs/common'

import { idFromString, isIdString } from '../../db/ids'
import { dateToDay } from './dates'
import { PrismaService } from '../../db/prisma.service'

export interface AccessFacts {
  schoolId: string | null
  trialQuestionsUsed: number
  /** `YYYY-MM-DD` the complimentary package ends (that day included), or null for any other user. */
  compExpiresOn: string | null
}

/**
 * The few `users` columns the student import and the complimentary register must set and that
 * `UsersRepository.createManyWithRole` does not carry (`id_delima`, `is_complimentary`), plus two
 * lookups (existing IC hashes) and the per-school import lock. Small by design; the rows themselves
 * are created through `UsersRepository` (deviation log 2026-10-20, BE-25: `NewUserRow` lives in the
 * users lane, which this card may not change).
 *
 * Methods use `prisma.client`, so they join the caller's transaction.
 */
@Injectable()
export class AccountFlagsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Sets `id_delima` of the new accounts (`ids[i]` gets `values[i]`). */
  async setIdDelima(ids: readonly string[], values: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    const userIds = ids.map(idFromString)
    await this.prisma.client.$executeRaw`
      UPDATE users u SET id_delima = x.v
        FROM unnest(${userIds}::bigint[], ${[...values]}::text[]) AS x(id, v)
       WHERE u.id = x.id`
  }

  async markComplimentary(ids: readonly string[]): Promise<void> {
    const userIds = ids.filter(isIdString).map(idFromString)
    if (userIds.length === 0) return
    await this.prisma.client.user.updateMany({ where: { id: { in: userIds } }, data: { isComplimentary: true } })
  }

  /** Which of these IC hashes already belong to an account. */
  async existingIcHashes(hashes: readonly string[]): Promise<Set<string>> {
    const unique = [...new Set(hashes)]
    if (unique.length === 0) return new Set()
    const rows = await this.prisma.client.$queryRaw<{ h: string }[]>`
      SELECT DISTINCT ic_hash AS h FROM users WHERE ic_hash = ANY(${unique}::text[])`
    return new Set(rows.map((r) => r.h))
  }

  /** Serialises the student imports of one school, so two imports cannot both pass the quota check. Transaction scoped. */
  async lockSchoolImports(schoolId: string): Promise<void> {
    const key = `students.import:${schoolId}`
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
  }

  // --- access facts (SubscriptionService) -------------------------------------------------------

  /** What `isSubscribed` and `trial` need from one user; null for an unknown id. */
  async accessFacts(userId: string): Promise<AccessFacts | null> {
    if (!isIdString(userId)) return null
    const row = await this.prisma.client.user.findUnique({
      where: { id: idFromString(userId) },
      select: { schoolId: true, trialQuestionsUsed: true, compStudent: { select: { packageExpiresOn: true } } },
    })
    if (!row) return null
    return {
      schoolId: row.schoolId === null ? null : row.schoolId.toString(),
      trialQuestionsUsed: row.trialQuestionsUsed,
      compExpiresOn: row.compStudent ? dateToDay(row.compStudent.packageExpiresOn) : null,
    }
  }

  /** Adds exactly 1 to the trial counter in one atomic statement; returns the new value, or null for an unknown id. */
  async incrementTrial(userId: string): Promise<number | null> {
    if (!isIdString(userId)) return null
    const rows = await this.prisma.client.$queryRaw<{ n: number }[]>`
      UPDATE users SET trial_questions_used = trial_questions_used + 1
       WHERE id = ${idFromString(userId)}
   RETURNING trial_questions_used AS n`
    return rows[0]?.n ?? null
  }
}
