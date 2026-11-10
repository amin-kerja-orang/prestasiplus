/**
 * User transform (BE-28, plan T-01..T-05, T-09). One .cloud account becomes one `users` row, one
 * `user_roles` row, an optional `teacher_profiles` row and an optional `user_scopes` row (admin: national,
 * ppd_officer: district of the officer's school, D31a). Pure: the loader resolves the school and
 * passes the facts in. The clear IC, the plaintext password, `faith`, `google_id` and every token are
 * never read into the output.
 */
import { PRIMARY_SCHOOL_TYPES, ROLE_MAP, ROLE_SOURCE_CODES, ROLES_LOADED_INACTIVE, ROLES_NOT_MIGRATED, SECONDARY_SCHOOL_TYPES, STATE_SCOPE_SOURCE_ROLES } from './enums'
import { enumKey, flag, integer, ok, reject, squash, stamps, text, type Outcome, type Staged } from './common'
import { decidePassword, type IcHasher, type ResetReason } from './secrets'

export interface UserContext {
  /** v2 id of the user's school; null when the source has none. `undefined` = a school id is set but not loaded (orphan). */
  schoolId: string | null | undefined
  /** The loaded v2 school (type for the grade, state and district for a PPD scope). */
  school: { type: string | null; state: string | null; district: string | null } | null
  ic: IcHasher
  defaultHashes: ReadonlySet<string>
  /**
   * T-B5: for this school, the grade of each class NAME that other pupils write with a number (`5 AMAN` -> `AMAN` -> 11); null = the name is
   * ambiguous (two grades). Used only when the pupil's own label gives no grade.
   */
  siblingGrades?: ReadonlyMap<string, number | null>
}

export interface UserValues {
  name: string
  email: string | null
  username: string | null
  password_hash: string | null
  must_reset_password: boolean
  ic_hash: string | null
  ic_masked: string | null
  phone: string | null
  school_id: string | null
  grade: number | null
  class_label: string | null
  bio: string | null
  is_active: boolean
  is_suspended: boolean
  is_complimentary: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface ScopeValues {
  role: string
  level: 'national' | 'state' | 'district'
  state_code: string | null
  district_code: string | null
  school_id: null
}

export interface UserOutput {
  user: UserValues
  role: string
  teacher: { subject: string | null; qualification: string | null; experience_years: number } | null
  /** The scope row, or null when none applies. */
  scope: ScopeValues | null
  /** A ppd_officer whose district cannot be derived (listed in the report by id only). */
  ppdUnscoped: boolean
  /** Flags for the report counts (ids and counts only, never values). */
  notes: {
    icInvalid: boolean
    icPresent: boolean
    emailInvalid: boolean
    experienceInvalid: boolean
    /** The source role is one of `ROLES_LOADED_INACTIVE`: the account is stored inactive (T-B5). */
    loadedInactive: boolean
    /** A teacher with no school: V3 needs a school scope and V2 has none, so the account loads inactive (T-B5b). */
    teacherWithoutSchool: boolean
    /** The pupil's grade came from the same-named numbered class of the school (T-B5 rule 2). */
    gradeFromSiblingClass: boolean
    resetReasons: readonly ResetReason[]
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+$/

/**
 * The grade (1..11) of a pupil from the class label: an explicit `Darjah / Tahun N` or `Tingkatan / Form N`
 * decides; otherwise the leading number is read through the school type (primary N, secondary 6 + N).
 */
export function gradeFromClassLabel(kelas: string | null, schoolType: string | null): number | null {
  if (kelas === null) return null
  const primary = /\b(?:darjah|tahun)\s*(\d)\b/i.exec(kelas)
  if (primary && Number(primary[1]) >= 1 && Number(primary[1]) <= 6) return Number(primary[1])
  const secondary = /\b(?:tingkatan|form)\s*(\d)\b/i.exec(kelas)
  if (secondary && Number(secondary[1]) >= 1 && Number(secondary[1]) <= 5) return 6 + Number(secondary[1])
  const lead = /^\s*(\d{1,2})(?!\d)/.exec(kelas)
  if (!lead || schoolType === null) return null
  const n = Number(lead[1])
  if (PRIMARY_SCHOOL_TYPES.has(schoolType) && n >= 1 && n <= 6) return n
  if (SECONDARY_SCHOOL_TYPES.has(schoolType) && n >= 1 && n <= 5) return 6 + n
  return null
}

/**
 * The class NAME of a label: the label without its leading number, upper case, spaces folded (`5 Amanah` -> `AMANAH`); null when it has no name or is
 * itself only a number. T-B5 rule 2 matches a name-only label (`AMANAH`) with the numbered label of the same school.
 */
export function classLabelName(kelas: string | null): string | null {
  if (kelas === null) return null
  const name = kelas.replace(/^\s*\d{1,2}(?!\d)\s*/, '').replace(/\s+/g, ' ').trim().toUpperCase()
  return name === '' ? null : name
}

/** Report label of a role that was rejected: the role name when it is one of `ROLES_NOT_MIGRATED`, else `other` (never raw text). */
export function roleRejectLabel(raw: string | null | undefined): string {
  const k = enumKey(raw)
  return k !== null && ROLES_NOT_MIGRATED.includes(k) ? k : 'other'
}

/**
 * A role outside `ROLE_MAP` is UNKNOWN_ENUM on `role` (the code is stored only when it looks like one). A role in
 * `ROLES_NOT_MIGRATED` takes the same path, so reconciliation counts it as rejected; the loader counts it by name.
 */
export function transformUser(row: Staged, ctx: UserContext): Outcome<UserOutput> {
  const roleKey = enumKey(row.role)
  const role = roleKey === null ? undefined : ROLE_MAP[roleKey]
  if (role === undefined) {
    return reject('UNKNOWN_ENUM', 'role', { enumValue: row.role ?? '', allowedCodes: ROLE_SOURCE_CODES })
  }
  if (ctx.schoolId === undefined) return reject('ORPHAN_PARENT', 'school_id')
  const name = squash(row.name)
  if (name === null) return reject('INVALID_VALUE', 'name')
  const parsedActive = flag(row.is_active, true)
  if (parsedActive === 'invalid') return reject('INVALID_VALUE', 'is_active')
  const loadedInactive = roleKey !== null && ROLES_LOADED_INACTIVE.includes(roleKey)
  // T-B5b: V2 holds NO scope for a pegawai_ppd / jpn_officer (no ppd/jpn column, school_id null) and V3 needs a district/state scope
  // (ROLE_SCOPE_LEVELS), or a school for a teacher, else sign-in is refused. Such an account loads inactive (admin assigns the scope, then activates).
  const teacherWithoutSchool = role === 'teacher' && ctx.schoolId === null
  const suspended = flag(row.is_suspended, false)
  if (suspended === 'invalid') return reject('INVALID_VALUE', 'is_suspended')
  const complimentary = flag(row.is_complimentary, false)
  if (complimentary === 'invalid') return reject('INVALID_VALUE', 'is_complimentary')

  const rawEmail = text(row.email)?.toLowerCase() ?? null
  const email = rawEmail !== null && EMAIL.test(rawEmail) ? rawEmail : null
  const username = text(row.username)
  const password = decidePassword(row.password, {
    defaultHashes: ctx.defaultHashes,
    // PO decision KP-7 (10 Nov 2026): roster accounts keep their default password; no forced reset unless the operator opts in.
    rosterAccount: process.env.PP_MIGRATE_ROSTER_FORCE_RESET === '1' && username !== null && email === null,
  })
  const icText = text(row.ic)
  const ic = ctx.ic.parts(icText)
  const kelas = squash(row.kelas)
  const ownGrade = role === 'student' ? gradeFromClassLabel(kelas, ctx.school?.type ?? null) : null
  const siblingName = role === 'student' && ownGrade === null && kelas !== null && !/^\s*\d/.test(kelas) ? classLabelName(kelas) : null
  const siblingGrade = siblingName === null ? null : (ctx.siblingGrades?.get(siblingName) ?? null)

  let teacher: UserOutput['teacher'] = null
  let experienceInvalid = false
  if (role === 'teacher') {
    const subject = squash(row.teaching_subject)
    const qualification = squash(row.teaching_qualification)
    const years = integer(row.teaching_experience_years)
    experienceInvalid = years === 'invalid' || (typeof years === 'number' && years < 0)
    const experience = typeof years === 'number' && years >= 0 && years <= 32767 ? years : 0
    if (subject !== null || qualification !== null || years !== null) {
      teacher = { subject, qualification, experience_years: experience }
    }
  }

  let scope: ScopeValues | null = null
  let ppdUnscoped = false
  if (role === 'admin') {
    scope = { role, level: 'national', state_code: null, district_code: null, school_id: null }
  } else if (role === 'ppd_officer' && roleKey !== null && STATE_SCOPE_SOURCE_ROLES.includes(roleKey)) {
    // A JPN officer: a ppd_officer scoped to the state of the school (ck_user_scopes_shape: state needs state_code).
    const s = ctx.school
    if (s !== null && s.state !== null) {
      scope = { role, level: 'state', state_code: s.state, district_code: null, school_id: null }
    } else {
      ppdUnscoped = true
    }
  } else if (role === 'ppd_officer') {
    const s = ctx.school
    if (s !== null && s.state !== null && s.district !== null) {
      scope = { role, level: 'district', state_code: s.state, district_code: s.district, school_id: null }
    } else {
      ppdUnscoped = true
    }
  }

  const active = loadedInactive || ppdUnscoped || teacherWithoutSchool ? false : parsedActive

  return ok({
    user: {
      name,
      email,
      username,
      password_hash: password.passwordHash,
      must_reset_password: password.mustResetPassword,
      ic_hash: ic?.hash ?? null,
      ic_masked: ic?.masked ?? null,
      phone: text(row.phone),
      school_id: ctx.schoolId,
      grade: ownGrade ?? siblingGrade,
      class_label: kelas,
      bio: text(row.bio),
      is_active: active,
      is_suspended: suspended,
      is_complimentary: complimentary,
      last_login_at: text(row.last_login_at),
      ...stamps(row),
    },
    role,
    teacher,
    scope,
    ppdUnscoped,
    notes: {
      icInvalid: icText !== null && ic === null,
      icPresent: icText !== null,
      emailInvalid: rawEmail !== null && email === null,
      experienceInvalid,
      loadedInactive,
      teacherWithoutSchool,
      gradeFromSiblingClass: ownGrade === null && siblingGrade !== null,
      resetReasons: password.reasons,
    },
  })
}
