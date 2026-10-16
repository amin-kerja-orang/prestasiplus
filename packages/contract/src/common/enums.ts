import { z } from '../zod'

/**
 * Role codes (English codes, BM labels in the UI only; ADR-0018 item 6).
 *
 * Source: `docs/architecture/v2-frontend.md` section 4.3 (`RoleCode`) and the existing app
 * (`src/stores/session-types.ts`). `docs/requirements/v2-portals.md` section 2 lists "proposed"
 * keys `admin_sekolah` / `pegawai_ppd` (and `pegawai_jpn`); D31(a) keeps ONE PPD/JPN role. The
 * architecture codes are used here; renaming is a one-line change in this list if the owner prefers
 * the requirements keys (flagged to the Delivery Lead).
 */
export const ROLE_CODES = [
  'admin',
  'school_admin',
  'ppd_officer',
  'teacher',
  'student',
  'parent',
  'sponsor',
] as const
export const RoleCodeSchema = z.enum(ROLE_CODES).meta({
  id: 'RoleCode',
  description:
    'Role code. admin = Admin Pusat, school_admin = Admin Sekolah, ppd_officer = Pegawai PPD/JPN, teacher = Guru, student = Murid, parent = Ibu Bapa, sponsor = Penaja.',
})
export type RoleCode = z.infer<typeof RoleCodeSchema>

export const PORTAL_IDS = ['pentadbiran', 'pembelajaran'] as const
export const PortalIdSchema = z.enum(PORTAL_IDS).meta({ id: 'PortalId' })
export type PortalId = z.infer<typeof PortalIdSchema>

/** Scope levels, widest to narrowest (v2-portals section 2). */
export const SCOPE_LEVELS = ['national', 'state', 'district', 'school', 'class', 'self'] as const
export const ScopeLevelSchema = z.enum(SCOPE_LEVELS).meta({ id: 'ScopeLevel' })
export type ScopeLevel = z.infer<typeof ScopeLevelSchema>

/** Access mode of a capability for the active role: Full, Read-only, Scoped, Dashboard-only. */
export const ACCESS_MODES = ['F', 'R', 'S', 'D'] as const
export const AccessModeSchema = z.enum(ACCESS_MODES).meta({ id: 'AccessMode' })
export type AccessMode = z.infer<typeof AccessModeSchema>
