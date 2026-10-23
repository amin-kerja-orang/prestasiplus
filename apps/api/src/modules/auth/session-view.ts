/**
 * Pure rules that turn the CURRENT account rows plus a session row into the contract `Session` and
 * the request `AuthContext`. Nothing here touches the database or the request, so the rules are
 * unit-tested directly.
 */
import {
  canEnterModPelajar,
  capabilitiesFor,
  type ActiveRole,
  type Mode,
  ROLE_CODES,
  ROLE_PORTAL,
  ROLE_SCOPE_LEVELS,
  type RoleCode,
  type RoleGrant,
  type Scope,
  type ScopeLevel,
  type Session,
} from '@pp/contract'

import type { AuthContext } from '../../common/scope/auth-context'
import { toMytTimestamp } from '../../common/time/myt'
import type { School, UserScope } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import type { AccountRecord } from './account.repository'
import { ROLE_PRIORITY } from './auth.constants'

/** Landing path per role (v2-frontend 4.4; the teacher and learner home is `/dashboard` as in the mock). */
export const LANDING_PATHS: Readonly<Record<RoleCode, string>> = {
  admin: '/admin',
  school_admin: '/admin',
  ppd_officer: '/admin/pemantauan/wilayah',
  teacher: '/dashboard',
  student: '/dashboard',
  parent: '/dashboard',
  sponsor: '/dashboard',
}

export const NATIONAL_LABEL = 'Seluruh Negara'
export const SELF_LABEL = 'Diri sendiri'
export const MOD_PELAJAR_LABEL = 'Mod Pelajar'

export const isRoleCode = (value: string): value is RoleCode => (ROLE_CODES as readonly string[]).includes(value)

function schoolScope(school: School): Scope {
  return { level: 'school', schoolId: idToString(school.id), label: school.name }
}

function districtScope(school: School, code: string | null): Scope | null {
  const districtCode = (code ?? school.district)?.slice(0, 32)
  // A district name is only unique inside its state: without the state there is no district scope.
  if (!districtCode || !school.state) return null
  return { level: 'district', districtCode, stateCode: school.state.slice(0, 16), label: districtCode }
}

/** A stored scope row that is ambiguous (a district without its state, a state without a code): the account is refused. */
const REFUSED = Symbol('refused')

/**
 * A stored scope row, if it is valid for the role; null so the scope is derived instead (a level the role
 * may not hold, or a school that cannot be found); `REFUSED` when the row is ambiguous and must not be
 * resolved to another area (ambiguous means deny).
 */
function scopeFromRow(role: RoleCode, row: UserScope, account: AccountRecord): Scope | null | typeof REFUSED {
  if (!(ROLE_SCOPE_LEVELS[role] as readonly string[]).includes(row.level)) return null
  switch (row.level as ScopeLevel) {
    case 'national':
      return { level: 'national', label: NATIONAL_LABEL }
    case 'self':
      return { level: 'self', label: SELF_LABEL }
    case 'school': {
      const id = row.schoolId ?? account.user.schoolId
      const school = id === null ? undefined : account.schools.get(id.toString())
      return school ? schoolScope(school) : null
    }
    case 'district': {
      const school = account.school ?? undefined
      if (row.districtCode && row.stateCode) {
        return {
          level: 'district',
          districtCode: row.districtCode.slice(0, 32),
          stateCode: row.stateCode.slice(0, 16),
          label: row.districtCode,
        }
      }
      // A stored district without its state, or a state without its district, is ambiguous: refuse, never
      // resolve it to the home school's area. Only a row with neither derives from the school.
      if (row.districtCode || row.stateCode) return REFUSED
      return school ? districtScope(school, null) : null
    }
    case 'state':
      return row.stateCode ? { level: 'state', stateCode: row.stateCode.slice(0, 16), label: row.stateCode } : REFUSED
    default:
      return null
  }
}

/** Scope of a role when no usable scope row exists (ADR-0017 item 4, D31a). */
function derivedScope(role: RoleCode, account: AccountRecord): Scope | null {
  switch (role) {
    case 'admin':
      return { level: 'national', label: NATIONAL_LABEL }
    case 'school_admin':
    case 'teacher':
      return account.school ? schoolScope(account.school) : null
    case 'ppd_officer':
      return account.school ? districtScope(account.school, null) : null
    default:
      return { level: 'self', label: SELF_LABEL }
  }
}

/**
 * The role grants of an account, in `ROLE_PRIORITY` order, each with its server-derived scope.
 * Returns null when the account cannot hold a valid session: no role, an unknown role, `student` or
 * `admin` combined with another role, or a role whose scope cannot be derived (for example a
 * teacher without a school, or a ppd_officer whose school has no state: a district is only unique
 * inside its state, so a district scope always carries the state), or a stored scope row that is
 * ambiguous (a district without its state, a state without its code). Failing closed means such an
 * account is refused, never half-served.
 */
export function buildGrants(account: AccountRecord): RoleGrant[] | null {
  if (account.roles.length === 0 || !account.roles.every(isRoleCode)) return null
  const held = ROLE_PRIORITY.filter((r) => account.roles.includes(r))
  if (held.length > 1 && (held.includes('student') || held.includes('admin'))) return null
  const grants: RoleGrant[] = []
  for (const role of held) {
    const row = account.scopes.find((s) => s.role === role)
    const stored = row ? scopeFromRow(role, row, account) : null
    if (stored === REFUSED) return null
    const scope = stored ?? derivedScope(role, account)
    if (!scope) return null
    grants.push({ role, portal: ROLE_PORTAL[role], scope })
  }
  return grants
}

/** The part of a `sessions` row that decides the view. */
export interface SessionState {
  id: string
  activeRole: string
  modeKind: string | null
  modeReturnRole: string | null
  modeSince: Date | null
  expiresAt: Date
}

export interface Assembled {
  session: Session
  auth: AuthContext
  grants: RoleGrant[]
  /** The role the account acts as outside the mode (the return role while Mod Pelajar is on). */
  baseRole: RoleCode
  mode: { returnRole: RoleCode; since: Date } | null
  /** True when the stored role or mode no longer fit the account and were replaced. */
  repaired: boolean
}

/**
 * Builds the session view. If the stored active role is no longer in the account's role list, the
 * first grant is used and the mode is dropped; a mode whose return role may no longer use it is
 * dropped too (the next request after a permission change shows the new state, BE-NFR-39).
 */
export function assemble(account: AccountRecord, state: SessionState, csrf: string): Assembled | null {
  const grants = buildGrants(account)
  if (!grants || grants.length === 0) return null

  let repaired = false
  let grant = grants.find((g) => g.role === state.activeRole)
  if (!grant) {
    grant = grants[0] as RoleGrant
    repaired = true
  }

  let mode: Assembled['mode'] = null
  if (state.modeKind !== null) {
    const returnRole = state.modeReturnRole
    if (
      !repaired &&
      state.modeKind === 'mod_pelajar' &&
      returnRole === grant.role &&
      state.modeSince &&
      canEnterModPelajar(grant.role)
    ) {
      mode = { returnRole: grant.role, since: state.modeSince }
    } else {
      repaired = true
    }
  }

  const active: ActiveRole = mode
    ? {
        role: 'student',
        portal: ROLE_PORTAL.student,
        scope: { level: 'self', label: MOD_PELAJAR_LABEL },
        via: 'mod_pelajar',
      }
    : { role: grant.role, portal: grant.portal, scope: grant.scope, via: 'direct' }

  const modeBody: Mode | null = mode
    ? { kind: 'mod_pelajar', returnRole: mode.returnRole, since: toMytTimestamp(mode.since), isTest: true }
    : null

  const capabilities = [...new Set(capabilitiesFor(active.role, { level: active.scope.level }).map((c) => c.key))]

  const { user } = account
  const session: Session = {
    user: {
      id: idToString(user.id),
      name: user.name,
      email: user.email,
      username: user.username,
      avatarUrl: account.avatarUrl,
      schoolId: user.schoolId === null ? null : idToString(user.schoolId),
    },
    roles: grants,
    active,
    mode: modeBody,
    capabilities,
    landingPath: LANDING_PATHS[active.role],
    expiresAt: toMytTimestamp(state.expiresAt),
    csrf,
    mustChangePassword: account.user.mustResetPassword,
  }
  const auth: AuthContext = {
    sessionRowId: state.id,
    userId: session.user.id,
    roles: grants,
    active,
    mode: modeBody,
    capabilities,
    mustChangePassword: account.user.mustResetPassword,
  }
  return { session, auth, grants, baseRole: grant.role, mode, repaired }
}
