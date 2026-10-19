import { z } from '../zod'
import { PortalIdSchema, RoleCodeSchema, type PortalId, type RoleCode, type ScopeLevel } from '../common/enums'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { CapabilityKeySchema } from '../access/schema'
import { ScopeSchema, type Scope } from './scope'

/** Portal is a pure function of the active role (ADR-0017 item 3). */
export const ROLE_PORTAL: Readonly<Record<RoleCode, PortalId>> = {
  student: 'pembelajaran',
  teacher: 'pembelajaran',
  parent: 'pembelajaran',
  sponsor: 'pembelajaran',
  admin: 'pentadbiran',
  school_admin: 'pentadbiran',
  ppd_officer: 'pentadbiran',
}

/** Scope levels a role may carry (grant and active). parent: self = the account's linked children. */
export const ROLE_SCOPE_LEVELS: Readonly<Record<RoleCode, readonly ScopeLevel[]>> = {
  student: ['self'],
  parent: ['self'],
  sponsor: ['self'],
  teacher: ['school'],
  school_admin: ['school'],
  ppd_officer: ['district', 'state'],
  admin: ['national'],
}

function sameScope(a: Scope, b: Scope): boolean {
  return (
    a.level === b.level &&
    a.stateCode === b.stateCode &&
    a.districtCode === b.districtCode &&
    a.schoolId === b.schoolId &&
    a.label === b.label
  )
}

/** Roles that may enter Mod Pelajar (D33b): Admin Pusat and Admin Sekolah only. */
export const MOD_PELAJAR_ROLES: readonly RoleCode[] = ['admin', 'school_admin']
export function canEnterModPelajar(role: RoleCode): boolean {
  return MOD_PELAJAR_ROLES.includes(role)
}

/** Session modes. `kind` is an open union by design: add values, never change a meaning. */
export const MODE_KINDS = ['mod_pelajar'] as const
export const ModeKindSchema = z.enum(MODE_KINDS).meta({ id: 'ModeKind' })
export type ModeKind = z.infer<typeof ModeKindSchema>

export const SessionUserSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    email: z.string().nullable(),
    username: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    schoolId: IdSchema.nullable(),
  })
  .meta({ id: 'SessionUser' })
export type SessionUser = z.infer<typeof SessionUserSchema>

/** One role the account holds, with its server-derived scope. */
export const RoleGrantSchema = z
  .object({ role: RoleCodeSchema, portal: PortalIdSchema, scope: ScopeSchema })
  .meta({ id: 'RoleGrant' })
export type RoleGrant = z.infer<typeof RoleGrantSchema>

export const ACTIVE_VIA = ['direct', 'mod_pelajar'] as const
/** The role the session currently acts as. */
export const ActiveRoleSchema = z
  .object({
    role: RoleCodeSchema,
    portal: PortalIdSchema,
    scope: ScopeSchema,
    via: z.enum(ACTIVE_VIA).meta({ description: 'mod_pelajar while the student mode is on.' }),
  })
  .meta({ id: 'ActiveRole' })
export type ActiveRole = z.infer<typeof ActiveRoleSchema>

/** Mode in effect; `null` on the session means normal operation. Rows written are test data. */
export const ModeSchema = z
  .object({
    kind: ModeKindSchema,
    returnRole: RoleCodeSchema,
    since: TimestampSchema,
    isTest: z.literal(true).meta({ description: 'Data written under the mode is stamped is_test.' }),
  })
  .meta({ id: 'Mode' })
export type Mode = z.infer<typeof ModeSchema>

export const SessionSchema = z
  .object({
    user: SessionUserSchema,
    roles: z.array(RoleGrantSchema).min(1),
    active: ActiveRoleSchema,
    mode: ModeSchema.nullable(),
    capabilities: z
      .array(CapabilityKeySchema)
      .meta({ description: 'Keys from capabilitiesFor(role, scope): <item>.read, plus <item>.write for F/S modes.' }),
    landingPath: z.string().startsWith('/'),
    expiresAt: TimestampSchema,
    csrf: z.string().min(1),
    mustChangePassword: z.boolean().meta({
      description: 'True while a forced password change is pending; other routes answer 403 PASSWORD_CHANGE_REQUIRED.',
    }),
  })
  .superRefine((s, ctx) => {
    const bad = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    const codes = s.roles.map((g) => g.role)
    if (new Set(codes).size !== codes.length) bad(['roles'], 'roles must be unique')
    s.roles.forEach((g, i) => {
      if (g.portal !== ROLE_PORTAL[g.role]) bad(['roles', i, 'portal'], 'portal does not match role')
    })
    if (codes.includes('student') && codes.length > 1)
      bad(['roles'], 'student never combines with another role')
    if (codes.includes('admin') && codes.length > 1) bad(['roles'], 'admin is single-role')
    if (s.active.portal !== ROLE_PORTAL[s.active.role])
      bad(['active', 'portal'], 'portal does not match role')
    if ((s.mode !== null) !== (s.active.via === 'mod_pelajar'))
      bad(['mode'], 'mode and active.via must agree')
    s.roles.forEach((g, i) => {
      if (!ROLE_SCOPE_LEVELS[g.role].includes(g.scope.level))
        bad(['roles', i, 'scope', 'level'], `scope level ${g.scope.level} is not valid for ${g.role}`)
    })
    if (!ROLE_SCOPE_LEVELS[s.active.role].includes(s.active.scope.level))
      bad(['active', 'scope', 'level'], `scope level ${s.active.scope.level} is not valid for ${s.active.role}`)
    if (s.mode === null) {
      const grant = s.roles.find((g) => g.role === s.active.role)
      if (!grant) bad(['active', 'role'], 'active role must be one of roles')
      else if (!sameScope(grant.scope, s.active.scope))
        bad(['active', 'scope'], 'active scope must equal the grant scope')
    } else {
      if (s.active.role !== 'student' || s.active.scope.level !== 'self')
        bad(['active'], 'Mod Pelajar acts as student with self scope')
      if (!canEnterModPelajar(s.mode.returnRole))
        bad(['mode', 'returnRole'], 'returnRole may not use Mod Pelajar')
      if (!codes.includes(s.mode.returnRole))
        bad(['mode', 'returnRole'], 'returnRole must be one of roles')
    }
  })
  .meta({ id: 'Session' })
export type Session = z.infer<typeof SessionSchema>

/** POST /session/role. Strict: a scope (or anything else) from the client is rejected. */
export const SwitchRoleRequestSchema = z
  .strictObject({ role: RoleCodeSchema })
  .meta({ id: 'SwitchRoleRequest' })
export type SwitchRoleRequest = z.infer<typeof SwitchRoleRequestSchema>

/** POST /session/mode. */
export const EnterModeRequestSchema = z
  .strictObject({ mode: ModeKindSchema })
  .meta({ id: 'EnterModeRequest' })
export type EnterModeRequest = z.infer<typeof EnterModeRequestSchema>
