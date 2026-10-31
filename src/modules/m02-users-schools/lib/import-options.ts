/**
 * S4 bulk user import / S5 DELIMa student import lookups and helpers (SRS FR-M02-51…64; BR-14…17, BR-21).
 * Full class strings live in the components (overview §8.2 rule 2); this file holds the finite lookups.
 */

import type { BulkImportRole, ImportClassLevel, ImportMode } from '../api/imports'

export const BULK_IMPORT_PATH = '/admin/users/bulk-import'
export const STUDENT_IMPORT_PATH = '/admin/import-students'

export const IMPORT_ROUTES = {
  bulk: 'm02.imports.users',
  students: 'm02.imports.students',
} as const

/** FR-M02-52: the four S4 role cards, none checked by default. `icon` keys are resolved in the page. */
export const BULK_ROLE_OPTIONS: readonly {
  value: BulkImportRole
  label: string
  icon: 'teacher' | 'parent' | 'admin' | 'ppd'
}[] = [
  { value: 'teacher', label: 'Guru', icon: 'teacher' },
  { value: 'parent', label: 'Ibu Bapa', icon: 'parent' },
  { value: 'school_admin', label: 'Admin', icon: 'admin' },
  { value: 'ppd_officer', label: 'PPD', icon: 'ppd' },
]

/** FR-M02-52: the school picker shows for these roles only (BR-14). */
export function roleNeedsSchool(role: BulkImportRole | ''): boolean {
  return role === 'teacher' || role === 'school_admin'
}

export interface ClassLevelOption {
  value: ImportClassLevel
  label: string
}

/** FR-M02-61 group "Sekolah Menengah". */
export const SECONDARY_CLASS_LEVELS: readonly ClassLevelOption[] = (
  ['T1', 'T2', 'T3', 'T4', 'T5'] as const
).map((value) => ({ value, label: `Tingkatan ${value.slice(1)}` }))

export type ClassGroup = 'secondary'

/** FR-M02-61: v2 is secondary only, so only the "Sekolah Menengah" group (T1–T5) is ever offered. */
export function visibleClassGroups(): ClassGroup[] {
  return ['secondary']
}

/** FR-M02-60 class filter: T1–T5. */
export function existingClassFilter(): readonly ClassLevelOption[] {
  return SECONDARY_CLASS_LEVELS.map((o) => ({ value: o.value, label: o.value }))
}

/** FR-M02-59: progress bar width = min(100, round(used × 100 / quota))%. */
export function quotaPercent(used: number, quota: number): number {
  if (quota <= 0) return 100
  return Math.min(100, Math.round((used * 100) / quota))
}

/** FR-M02-60: the list is capped at 200 rows (BR-17). */
export const EXISTING_STUDENTS_CAP = 200

export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  paste: 'Paste Manual',
  csv: 'Upload CSV',
}

/** FR-M02-54 / FR-M02-62 paste placeholders (DV-M02-17: the sample name is generic). */
export const BULK_PASTE_PLACEHOLDER =
  'Paste data CSV:\n\nNama, Emel, Telefon\nMuhammad Fulan bin Fulan, ahmad@email.com, 0123456789'

export const DELIMA_PASTE_PLACEHOLDER =
  'Paste data dari DELIMa (3-4 baris per pelajar):\n\nNAMA PELAJAR\nm-XXXXXXXX@moe-dl.edu.my\nkatalaluan\n031215101234\n\nNAMA PELAJAR 2\nm-YYYYYYYY@moe-dl.edu.my\nkatalaluan2'
