import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'

/** `spm_targets` (DATA-M05-04): the only doorway to the table. Every method is the caller's own rows. */
@Injectable()
export class SpmTargetsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** Subject id (decimal) to grade, own rows only. */
  async forUser(userId: string): Promise<Map<string, string>> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint; target_grade: string }[]>`
      SELECT subject_id, target_grade FROM spm_targets WHERE user_id = ${idFromString(userId)}::bigint`
    return new Map(rows.map((r) => [idToString(r.subject_id), r.target_grade]))
  }

  /**
   * BR-26: replaces the user's targets for `scopeIds` (the 20 subjects) in one transaction. `grades` holds
   * the subjects that keep a target; every other subject of `scopeIds` loses its row. Idempotent: an
   * unchanged row is not touched (same `updated_at`), so a second identical call changes nothing.
   */
  async replace(userId: string, scopeIds: readonly string[], grades: ReadonlyMap<string, string>, isTest: boolean, now: Date): Promise<void> {
    // Documented deviation: a save in Mod Pelajar flips is_test on the caller's own single row per subject
    // (there is no separate test row), and a save in normal mode flips it back.
    const uid = idFromString(userId)
    const keepIds = [...grades.keys()].map(idFromString)
    const keepGrades = [...grades.values()]
    await this.prisma.transaction(async () => {
      await this.db.$executeRaw`
        DELETE FROM spm_targets
        WHERE user_id = ${uid}::bigint AND subject_id = ANY(${scopeIds.map(idFromString)}::bigint[])
          AND NOT (subject_id = ANY(${keepIds}::bigint[]))`
      if (keepIds.length === 0) return
      await this.db.$executeRaw`
        INSERT INTO spm_targets (user_id, subject_id, target_grade, is_test, created_at, updated_at)
        SELECT ${uid}::bigint, s.subject_id, s.grade, ${isTest}::boolean, ${now}::timestamptz, ${now}::timestamptz
        FROM unnest(${keepIds}::bigint[], ${keepGrades}::text[]) AS s(subject_id, grade)
        ON CONFLICT (user_id, subject_id) DO UPDATE
          SET target_grade = EXCLUDED.target_grade, is_test = EXCLUDED.is_test, updated_at = EXCLUDED.updated_at
          WHERE spm_targets.target_grade IS DISTINCT FROM EXCLUDED.target_grade
             OR spm_targets.is_test IS DISTINCT FROM EXCLUDED.is_test`
    })
  }
}
