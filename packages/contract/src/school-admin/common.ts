import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * Internal helpers and shared pieces of the school-admin contract (BE-21, M27 plus the four M18
 * Amaran routes). Not re-exported from the package index.
 *
 * Teachers, pupils, classes and schools are owned by BE-05 / BE-17, which are not merged yet, so this
 * folder carries LOCAL `SchoolAdmin...` twins of the few shapes it needs and imports nothing from
 * another domain folder.
 *
 * TODO(BE-05, BE-17): once the school, class and user owners are merged, dedupe the local twins
 * (`SchoolAdminSchoolRef`, `SchoolAdminSchoolInfo`, the user detail / row shapes and the class row)
 * against the owner contracts and import them instead of keeping copies.
 */

/** A non-negative integer (counts). */
export const count = z.number().int().min(0)

/** Password length bounds of EVERY password field of this contract (create, update, reset). */
export const PASSWORD_MIN_LENGTH = 8
/** Upper bound that keeps oversized input away from the hasher. */
export const PASSWORD_MAX_LENGTH = 255

/**
 * The new-password pair of an update or reset: 8 to 255 characters, confirmed by the second field.
 * The M27 mock (UI placeholder "Minimum 6 aksara") accepts 6; this contract aligns with the
 * create-pupil rule and the form options (`passwordMinLength` 8), see the deviations log.
 */
export const password8 = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .meta({ writeOnly: true, description: '8 to 255 characters.' })
export const passwordConfirmation = z
  .string()
  .max(PASSWORD_MAX_LENGTH)
  .meta({ writeOnly: true, description: 'Must equal the password; at most 255 characters.' })

/** A text with at most `max` characters that is not blank (the server trims; a blank text is "absent"). */
export const nonBlank = (max: number) => z.string().max(max).regex(/\S/, 'must not be blank')

/** `{ id, name }` of the caller school (`SchoolRef`). */
export const SchoolAdminSchoolRefSchema = z
  .object({ id: IdSchema, name: z.string() })
  .meta({ id: 'SchoolAdminSchoolRef' })
export type SchoolAdminSchoolRef = z.infer<typeof SchoolAdminSchoolRefSchema>

/** The caller school with its public fields (`SchoolInfo`). `code` / `district` are null when blank. */
export const SchoolAdminSchoolInfoSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    code: z.string().nullable(),
    district: z.string().nullable(),
    state: z.string(),
  })
  .meta({ id: 'SchoolAdminSchoolInfo' })
export type SchoolAdminSchoolInfo = z.infer<typeof SchoolAdminSchoolInfoSchema>

/** Refusal and flash texts of the M27 routes (exact BM copy from the mock). */
export const SCHOOL_ADMIN_MESSAGES = {
  /** Owner-contract refusal texts (`school-admin-writes.ts`); the routes check scope first, see the open questions. */
  accountInactive: 'Akaun ini tidak aktif.',
  userNotFound: 'Pengguna tidak ditemui.',
  roleNotManaged: 'Anda tidak boleh mengurus akaun ini.',
  /**
   * Refusal when the target of a toggle is the caller's own account (an admin cannot deactivate
   * themself). PROPOSED copy: the M27 mock has no such refusal (see the toggle route description).
   */
  selfToggle: 'Anda tidak boleh menyahaktifkan akaun sendiri.',
  /** Hint of the create-pupil form. */
  passwordHint: 'Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).',
} as const

/** `status` flash texts of the write responses (exact BM copy). */
export const SCHOOL_ADMIN_FLASH = {
  updated: 'Pengguna berjaya dikemaskini.',
  created: 'Pengguna berjaya didaftarkan.',
  statusToggled: 'Status pengguna berjaya dikemaskini.',
  /** `Pelajar "{name}" berjaya dicipta.` */
  pupilCreated: (name: string) => `Pelajar "${name}" berjaya dicipta.`,
} as const

/** The role label shown on the dashboard. */
export const SCHOOL_ADMIN_ROLE_LABEL = 'Admin Sekolah'

/** Rows per page of the user and class lists (fixed, there is no `pageSize` query). */
export const SCHOOL_ADMIN_PAGE_SIZE = 25
