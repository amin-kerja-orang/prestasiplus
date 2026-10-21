import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface NewFosterApplication {
  /** Decimal-string id of the student found by e-mail. */
  studentId: string
  /** Decimal-string id of the session user. */
  applicantUserId: string
  applicantRole: string
  studentCategory: string
  familyIncomeRange: string | null
  /** Already cut to 5,000 characters; stored as given. */
  reason: string
  isTest: boolean
  now: Date
}

/**
 * The only doorway to `foster_applications`. B1 only inserts (write-only data about minors: there is no read, no list and
 * no status change). The status is not a parameter: a new row is always `pending`.
 *
 * A failed insert is rethrown as a plain `Error` WITHOUT the driver message: Prisma's message can echo the arguments, and
 * the reason, category and income must never reach a log (SEC-M21-07). Uses `prisma.client`, so it joins a caller's transaction.
 */
@Injectable()
export class FosterApplicationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Inserts one `pending` application and returns its id as a decimal string. */
  async create(input: NewFosterApplication): Promise<string> {
    try {
      const row = await this.prisma.client.fosterApplication.create({
        data: {
          studentId: idFromString(input.studentId),
          applicantUserId: idFromString(input.applicantUserId),
          applicantRole: input.applicantRole,
          studentCategory: input.studentCategory,
          familyIncomeRange: input.familyIncomeRange,
          reason: input.reason,
          status: 'pending',
          createdAt: input.now,
          isTest: input.isTest,
        },
        select: { id: true },
      })
      return idToString(row.id)
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : 'unknown'
      throw new Error(`foster application insert failed (${code})`)
    }
  }
}
