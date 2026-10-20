import { Inject, Injectable } from '@nestjs/common'
import {
  FosterApplicationInputSchema,
  KELUARGA_ANGKAT_EMAIL_SHAPE,
  KELUARGA_ANGKAT_FIELD_ORDER,
  KELUARGA_ANGKAT_MESSAGES,
  storedFosterReason,
  summarizeFosterFieldErrors,
  type FosterApplicationCreated,
  type KeluargaAngkatField,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { UsersRepository } from '../users'
import { FosterApplicationsRepository } from './foster-applications.repository'

/** The signed-in caller, taken from the request's `AuthContext` only. */
export interface SponsorshipActor {
  userId: string
  /** The role the request acts as (`student` while Mod Pelajar is on). */
  role: string
  /** True while Mod Pelajar is on: rows are stamped `is_test` (G-07). */
  isTest: boolean
}

type FieldErrors = Partial<Record<KeluargaAngkatField, string>>

/**
 * Mohon Keluarga Angkat (M21 #15, BR-M21-13, V-M21-03). Collects every field error and answers them together as one 422.
 *
 * Anti-enumeration (OQ-API-B4-20): when the e-mail has a valid shape, exactly ONE `UsersRepository.findByEmail` is made,
 * whatever the other fields hold, and a user who is not a student (teacher, parent, admin) is decided from that one
 * result with no further query: it takes the same path, and gives the same body, as an unknown e-mail.
 * `findByEmail` is case-insensitive and returns a user in any state (active, suspended, deactivated), so such an account
 * is accepted as long as it holds the role `student` (the mock had no state either).
 */
@Injectable()
export class SponsorshipService {
  constructor(
    @Inject(FosterApplicationsRepository) private readonly applications: FosterApplicationsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async apply(actor: SponsorshipActor, body: unknown): Promise<FosterApplicationCreated> {
    const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
    const parsed = FosterApplicationInputSchema.safeParse(input)

    // First message per field (the schema keeps the mock's message copy and the order is applied below).
    const found: FieldErrors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && (KELUARGA_ANGKAT_FIELD_ORDER as readonly string[]).includes(key)) {
          const field = key as KeluargaAngkatField
          found[field] ??= issue.message
        }
      }
    }

    // The one lookup, made whenever the e-mail is shape-valid (no schema issue on it), regardless of the other fields.
    let studentId: string | null = null
    if (found.studentEmail === undefined) {
      const email = String(input.studentEmail).trim()
      // Defence in depth: the schema and this check use the same shape; a mismatch would be a contract bug.
      if (!KELUARGA_ANGKAT_EMAIL_SHAPE.test(email)) {
        found.studentEmail = KELUARGA_ANGKAT_MESSAGES.invalidEmail
      } else {
        const user = await this.users.findByEmail(email)
        if (user !== null && user.roles.includes('student')) studentId = user.id
        else found.studentEmail = KELUARGA_ANGKAT_MESSAGES.studentNotFound
      }
    }

    // Insertion order of the mock: studentEmail, studentCategory, familyIncomeRange, reason.
    const fields: FieldErrors = {}
    for (const k of KELUARGA_ANGKAT_FIELD_ORDER) {
      const message = found[k]
      if (message !== undefined) fields[k] = message
    }
    if (!parsed.success || studentId === null) {
      throw ApiError.of('VALIDATION_ERROR', { fields: fields as Record<string, string>, message: summarizeFosterFieldErrors(fields) })
    }

    const id = await this.applications.create({
      studentId,
      applicantUserId: actor.userId,
      applicantRole: actor.role,
      studentCategory: parsed.data.studentCategory,
      familyIncomeRange: parsed.data.familyIncomeRange ?? null,
      reason: storedFosterReason(parsed.data.reason),
      isTest: actor.isTest,
      now: this.clock.now(),
    })
    return { id }
  }
}
