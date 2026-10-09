/**
 * M02 write contract for the school admin (M27-T0a, XR-M27-17; M27 SRS Part B BR-M27-31…34, 41).
 *
 * `schoolAdminUsers` is the only way M27 changes a user: update a pupil or teacher of the own school, create
 * a teacher or a pupil (both active, G1-2), switch a teacher active / inactive (G1-1), reset a password. The
 * validation is M02's own (`handlers/users-rules.ts`, shared with the admin handlers), so BR-M02-08…12 are
 * defined once. Scope is enforced here, not trusted from the caller: a user of another school, or of a
 * different role than the one named, is `404`; an inactive account cannot be edited or reset (`403`); a role
 * the school admin may not manage (a peer school admin, parent, ...) is `403`.
 *
 * All methods are synchronous and validate before they write, so a refusal leaves nothing behind; the M27
 * handler runs each call inside its `ctx.transaction`. Messages: the success copy is M02's
 * (`MSG_USER_UPDATED`, `MSG_USER_CREATED` from `handlers/users-admin.ts`); the validation copy is the shared
 * Laravel default of `@/mock/define`. Only the three refusal texts below are new (INFERRED, no live copy).
 *
 * Input text is trimmed and a blank becomes absent (Laravel `TrimStrings` + `ConvertEmptyStringsToNull`,
 * as `users-input.ts`); passwords are never trimmed. Keys the contract does not name (`role`, `schoolId`,
 * `isActive`, `grade`, `icNumber`) are not read.
 */

import {
  max,
  min,
  required,
  rule,
  validationErrors,
  type RuleSet,
  type ValidationRule,
} from '@/mock/define'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { m02Config } from './m02-config'
import {
  changedPasswordRules,
  emailRules,
  nameRules,
  newUserPasswordRules,
  phoneRules,
} from './handlers/users-rules'
import { intOrNull } from './handlers/users-input'

/** The roles a school admin manages (BR-M27-31). */
export type ManagedRole = 'student' | 'teacher'

/** S12 (G1-9, BR-M27-41): the pupil password minimum for this entry point (M02's own is 6). */
export const PUPIL_PASSWORD_MIN = 8
/** S12 `name` minimum (BR-M27-41). */
export const PUPIL_NAME_MIN = 3

// INFERRED refusals (SRS M27 §5 has no live copy for them).
export const MSG_ACCOUNT_INACTIVE = 'Akaun ini tidak aktif.'
export const MSG_USER_NOT_FOUND = 'Pengguna tidak ditemui.'
export const MSG_ROLE_NOT_MANAGED = 'Anda tidak boleh mengurus akaun ini.'

export type SchoolAdminWriteStatus = 403 | 404 | 422

/** Thrown for every refusal; the M27 handler maps `status` (and `fields` for 422) to the error envelope. */
export class SchoolAdminWriteError extends Error {
  readonly status: SchoolAdminWriteStatus
  readonly fields?: Record<string, string>

  constructor(status: SchoolAdminWriteStatus, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'SchoolAdminWriteError'
    this.status = status
    if (fields) this.fields = fields
  }
}

export interface UpdateUserInput {
  name: string
  email: string
  phone?: string | null
  newPassword?: string
  newPasswordConfirmation?: string
}

export interface CreateTeacherInput {
  name: string
  email: string
  phone?: string | null
  password: string
  passwordConfirmation: string
}

export interface CreatePupilInput {
  name: string
  email: string
  password?: string
  classId?: number
}

export interface ResetPasswordInput {
  newPassword: string
  newPasswordConfirmation: string
}

/** Optional hook for the handler: the live `bulkImportDefaultPassword` (`adminDefaults(ctx)`), if overridden. */
export interface CreatePupilOptions {
  defaultPassword?: string
}

// --- helpers ---------------------------------------------------------------------------------------------

/** Trim a text value; blank becomes `null` (passwords are not passed through this). */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function refuse(fields: Record<string, string> | null): void {
  if (fields) {
    const first = Object.values(fields)[0] ?? 'The given data was invalid.'
    throw new SchoolAdminWriteError(422, first, fields)
  }
}

function check(data: Record<string, unknown>, rules: RuleSet): void {
  refuse(validationErrors(data, rules))
}

/** The managed user, 404 when it is not of the school / role, 403 for a role the school admin may not manage. */
function scoped(schoolId: number, role: ManagedRole, id: number): UserRow {
  if (role !== 'student' && role !== 'teacher') {
    throw new SchoolAdminWriteError(403, MSG_ROLE_NOT_MANAGED)
  }
  const row = users.get(id)
  if (row?.schoolId !== schoolId || row.role !== role) {
    throw new SchoolAdminWriteError(404, MSG_USER_NOT_FOUND)
  }
  return row
}

function requireActive(row: UserRow): void {
  if (!row.isActive) throw new SchoolAdminWriteError(403, MSG_ACCOUNT_INACTIVE)
}

function reload(id: number): UserRow {
  const saved = users.get(id)
  if (!saved) throw new Error('schoolAdminUsers: the user is missing')
  return saved
}

/** A password that may be empty (default) or `PUPIL_PASSWORD_MIN`…255 characters (S12). */
const pupilPasswordRules = (): ValidationRule[] => [min(PUPIL_PASSWORD_MIN), max(255)]

// --- the contract ---------------------------------------------------------------------------------------

export const schoolAdminUsers = {
  /**
   * S9 / S10. BR-M02-08…12 (name, unique e-mail, phone max 14, optional new password min 6 and confirmed);
   * role, school, status and grade are never changed.
   */
  updateUser(
    schoolId: number,
    role: ManagedRole,
    id: number,
    input: UpdateUserInput,
    now: number,
  ): UserRow {
    const row = scoped(schoolId, role, id)
    requireActive(row)
    const data = {
      name: text(input.name),
      email: text(input.email),
      phone: text(input.phone),
      newPassword: input.newPassword === '' ? undefined : input.newPassword,
      newPasswordConfirmation: input.newPasswordConfirmation,
    }
    check(data, {
      name: nameRules(),
      email: emailRules(id),
      phone: phoneRules(),
      newPassword: changedPasswordRules(),
    })
    users.update(
      id,
      {
        name: String(data.name),
        email: String(data.email),
        ...('phone' in input ? { phone: data.phone } : {}),
      },
      now,
    )
    if (typeof data.newPassword === 'string') users.setPassword(id, data.newPassword)
    return reload(id)
  },

  /** S11 (BR-M27-33): a teacher of the school, active (G1-2), `createdById` = the acting school admin. */
  createTeacher(
    schoolId: number,
    input: CreateTeacherInput,
    actorId: number,
    now: number,
  ): UserRow {
    const data = {
      name: text(input.name),
      email: text(input.email),
      phone: text(input.phone),
      password: input.password,
      passwordConfirmation: input.passwordConfirmation,
    }
    check(data, {
      name: nameRules(),
      email: emailRules(),
      phone: phoneRules(),
      password: newUserPasswordRules(),
    })
    const row = users.create(
      {
        name: String(data.name),
        email: String(data.email),
        role: 'teacher',
        phone: data.phone,
        schoolId,
        isActive: true,
        createdById: actorId,
      },
      now,
    )
    users.setPassword(row.id, String(data.password))
    return reload(row.id)
  },

  /**
   * S12 (BR-M27-41, G1-9): a pupil of the school, active. `name` 3 to 255, `password` empty (the
   * `bulkImportDefaultPassword`) or 8 to 255, `classId` a `classroom` of the school, enrolled with source
   * `school_admin`. The plaintext password is returned once and stored nowhere.
   */
  createPupil(
    schoolId: number,
    input: CreatePupilInput,
    actorId: number,
    now: number,
    options: CreatePupilOptions = {},
  ): { user: UserRow; password: string } {
    const classId = input.classId === undefined ? null : intOrNull(input.classId)
    const data = {
      name: text(input.name),
      email: text(input.email),
      password: input.password === '' ? undefined : input.password,
      classId: input.classId,
    }
    check(data, {
      name: [...nameRules(), min(PUPIL_NAME_MIN)],
      email: emailRules(),
      password: pupilPasswordRules(),
      classId: [
        rule('class_id', () => {
          const cls = classId === null ? undefined : classrooms.get('classroom', classId)
          return cls?.schoolId === schoolId ? null : 'The selected :attribute is invalid.'
        }),
      ],
    })
    const password =
      data.password ?? options.defaultPassword ?? m02Config().bulkImportDefaultPassword
    const user = users.create(
      {
        name: String(data.name),
        email: String(data.email),
        role: 'student',
        schoolId,
        isActive: true,
        createdById: actorId,
      },
      now,
    )
    users.setPassword(user.id, password)
    if (classId !== null) {
      classrooms.enrol(
        { kind: 'classroom', classId, studentId: user.id, source: 'school_admin' },
        now,
      )
    }
    return { user: reload(user.id), password }
  },

  /** G1-1: a teacher of the school may be switched either way, including an inactive one; pupils are read-only. */
  setTeacherActive(schoolId: number, id: number, isActive: boolean, now: number): UserRow {
    const row = users.get(id)
    if (row?.schoolId !== schoolId) throw new SchoolAdminWriteError(404, MSG_USER_NOT_FOUND)
    if (row.role !== 'teacher') throw new SchoolAdminWriteError(403, MSG_ROLE_NOT_MANAGED)
    users.update(id, { isActive }, now)
    return reload(id)
  },

  /** BR-M27-34: the new password replaces the hash at once (min 6, confirmed); the account must be active. */
  resetPassword(
    schoolId: number,
    role: ManagedRole,
    id: number,
    input: ResetPasswordInput,
    now: number,
  ): void {
    const row = scoped(schoolId, role, id)
    requireActive(row)
    check(
      { newPassword: input.newPassword, newPasswordConfirmation: input.newPasswordConfirmation },
      { newPassword: [required(), ...changedPasswordRules()] },
    )
    users.setPassword(id, input.newPassword)
    users.update(id, {}, now) // `updatedAt` ("Kemaskini") follows the reset
  },
}

export type SchoolAdminUsers = typeof schoolAdminUsers
