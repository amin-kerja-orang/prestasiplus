import { z } from '../zod'
import { AccessModeSchema, ScopeLevelSchema } from '../common/enums'

/** Roles that can enter Portal Pentadbiran (v2-portals section 4.1). Others are Pembelajaran-only. */
export const ADMIN_PORTAL_ROLES = ['admin', 'ppd_officer', 'school_admin'] as const
export const AdminPortalRoleSchema = z.enum(ADMIN_PORTAL_ROLES).meta({ id: 'AdminPortalRole' })
export type AdminPortalRole = z.infer<typeof AdminPortalRoleSchema>

/** Stable ids of the nine Pentadbiran menu groups, in menu order (D30, v2-portals section 5). */
export const GROUP_IDS = [
  'papan-pemuka',
  'pemantauan',
  'bank-soalan',
  'kertas-spm',
  'kurikulum-kandungan',
  'pengguna-sekolah',
  'penglibatan',
  'kewangan',
  'sistem',
] as const
export const AccessGroupIdSchema = z.enum(GROUP_IDS).meta({ id: 'AccessGroupId' })
export type AccessGroupId = z.infer<typeof AccessGroupIdSchema>

/**
 * Per-role access mode of one item. A missing role means hidden (the "-" cell of the doc): no menu
 * entry, no Ctrl+K result, no direct-URL data. Roles outside the Pentadbiran portal are never keys.
 */
export const RoleModesSchema = z
  .object({
    admin: AccessModeSchema.optional(),
    ppd_officer: AccessModeSchema.optional(),
    school_admin: AccessModeSchema.optional(),
  })
  .meta({
    id: 'AccessRoleModes',
    description: 'Access mode per role. A missing key means hidden for that role.',
  })
export type RoleModes = z.infer<typeof RoleModesSchema>

export const AccessGroupSchema = z
  .object({
    id: AccessGroupIdSchema,
    order: z.number().int().min(1),
    labelBm: z.string().min(1),
  })
  .meta({ id: 'AccessGroup' })
export type AccessGroup = z.infer<typeof AccessGroupSchema>

export const MatrixItemSchema = z
  .object({
    id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
    group: AccessGroupIdSchema,
    labelBm: z.string().min(1),
    route: z.string().regex(/^\/admin(\/[a-z0-9-]+)*$/),
    capability: z.string().regex(/^admin(\.[a-z0-9-]+){3}$/),
    modes: RoleModesSchema,
    ppdOnly: z
      .boolean()
      .describe('Visible to a PPD (district) officer only, hidden for JPN (state) officers.'),
    prototypeScope: z
      .boolean()
      .describe(
        'D43: true when the item maps to a row of role-access-matrix.md for school_admin (shown in the v2 prototype). False for the admin and ppd_officer views.',
      ),
  })
  .meta({ id: 'AccessMatrixItem' })
export type MatrixItem = z.infer<typeof MatrixItemSchema>

/** Learner-side menu roles (v2-portals section 8). */
export const LEARNING_ROLES = ['student', 'teacher', 'parent', 'sponsor'] as const
export const LearningRoleSchema = z.enum(LEARNING_ROLES).meta({ id: 'LearningRole' })
export type LearningRole = z.infer<typeof LearningRoleSchema>

export const LearningMenuGroupSchema = z
  .object({
    role: LearningRoleSchema,
    order: z.number().int().min(1),
    labelBm: z.string().nullable().describe('null = unlabelled top block.'),
    items: z.array(z.string().min(1)).describe('Item labels where the requirements name them.'),
    inV2Prototype: z
      .boolean()
      .describe('D43: the group hosts at least one prototype item of role-access-matrix.md.'),
    labelSource: z
      .enum(['doc', 'proposed'])
      .describe('proposed = the doc describes the group but gives no exact copy.'),
  })
  .meta({ id: 'LearningMenuGroup' })
export type LearningMenuGroup = z.infer<typeof LearningMenuGroupSchema>

/**
 * Capability key as produced by `capabilitiesFor`: `admin.<group>.<item-slug>.read|write`.
 * `Session.capabilities` is a list of these keys (the keys of the `Capability` entries).
 */
export const CapabilityKeySchema = z
  .string()
  .regex(/^admin(\.[a-z0-9-]+){2}\.(read|write)$/)
  .meta({ id: 'CapabilityKey' })
export type CapabilityKey = z.infer<typeof CapabilityKeySchema>

/** One entry of the capability list computed by the server (`capabilitiesFor`). */
export const CapabilitySchema = z
  .object({
    key: CapabilityKeySchema,
    itemId: z.string().nullable(),
    mode: AccessModeSchema,
    kind: z.enum(['read', 'write']),
  })
  .meta({ id: 'AccessCapability' })
export type Capability = z.infer<typeof CapabilitySchema>

/** Learner-side or account item named by role-access-matrix.md (D43). */
export const PrototypeItemSchema = z
  .object({
    role: z.enum(['student', 'teacher', 'school_admin']),
    row: z.number().int().min(0).describe('Row # of role-access-matrix.md section B; 0 = section A.'),
    section: z.string().min(1),
    labelBm: z.string().min(1),
    inV2Prototype: z.boolean(),
  })
  .meta({ id: 'PrototypeItem' })
export type PrototypeItem = z.infer<typeof PrototypeItemSchema>

/** Scope of the active role, as far as the access matrix needs it. */
export const AccessScopeSchema = z.object({ level: ScopeLevelSchema }).meta({ id: 'AccessScope' })
export type AccessScope = z.infer<typeof AccessScopeSchema>

export interface AccessOptions {
  scope?: AccessScope
  /** D43: restrict to items shown in the v2 prototype. Admin and ppd_officer then yield nothing. */
  prototypeOnly?: boolean
}
