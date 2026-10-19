/**
 * The M02 write rules shared by the admin user handlers (`users-admin.ts`, BR-M02-08…12) and the school-admin
 * write contract (`../school-admin-writes.ts`, M27-T0a): one definition of the name, e-mail, phone and
 * password rules so no entry point restates them.
 */

import { confirmed, email, max, min, required, unique, type ValidationRule } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

/** BR-M02-08: password minimum of the admin forms (S2 create, S3 edit "newPassword"). */
export const M02_PASSWORD_MIN = 6

/** `name`: required, at most 255 characters. */
export const nameRules = (): ValidationRule[] => [required(), max(255)]

/** `email`: required, valid, at most 255, unique (the user `exceptId` itself excluded). */
export const emailRules = (exceptId?: number): ValidationRule[] => [
  required(),
  email(),
  max(255),
  unique((value) => {
    const other = users.findByEmail(String(value))
    return other !== undefined && other.id !== exceptId
  }),
]

/** `phone`: optional, at most 14 characters. */
export const phoneRules = (): ValidationRule[] => [max(14)]
/** A required, confirmed password of at least `M02_PASSWORD_MIN`. */
export const newUserPasswordRules = (): ValidationRule[] => [
  required(),
  min(M02_PASSWORD_MIN),
  confirmed(),
]
/** An optional (filled when changing) confirmed password of at least `M02_PASSWORD_MIN`. */
export const changedPasswordRules = (): ValidationRule[] => [min(M02_PASSWORD_MIN), confirmed()]
