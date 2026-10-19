/**
 * S6-S8 complimentary-student lookups (SRS FR-M02-65…75; BR-18). Paths, route names, the bulk-action
 * buttons and the small helpers the three pages share.
 */

import { clock } from '@/lib/time'

import type { CompBulkAction } from '../api/comp-students'

export const COMP_LIST_PATH = '/admin/comp-students'
export const COMP_CREATE_PATH = '/admin/comp-students/create'

export const COMP_ROUTES = {
  list: 'm02.comp-students.list',
  create: 'm02.comp-students.create',
  detail: 'm02.comp-students.detail',
} as const

export const compDetailPath = (id: number): string => `${COMP_LIST_PATH}/${String(id)}`

export interface BulkButton {
  action: CompBulkAction
  label: string
  /** Phosphor icon class. */
  icon: string
  /** Nuxt UI button colour (a token colour, never a raw one). */
  color: 'error' | 'warning' | 'neutral' | 'success'
}

/** The four bulk-bar submit buttons in live order (FR-M02-67). */
export const BULK_BUTTONS: readonly BulkButton[] = [
  { action: 'coins_off', label: 'Matikan syiling', icon: 'i-ph-prohibit', color: 'error' },
  { action: 'coins_on', label: 'Hidupkan syiling', icon: 'i-ph-coins', color: 'warning' },
  { action: 'deactivate', label: 'Nyahaktif akaun', icon: 'i-ph-user-minus', color: 'neutral' },
  { action: 'activate', label: 'Aktifkan akaun', icon: 'i-ph-user-check', color: 'success' },
]

/** S7 "Tarikh tamat pakej" default: 31 December of the current year (FR-M02-72). */
export function defaultPackageExpiry(): string {
  return `${String(clock.date().getFullYear())}-12-31`
}

/** S7 textarea placeholder: the same line twice (FR-M02-72). */
export const COMP_PASTE_PLACEHOLDER = 'NAMA PENUH, NOMBOR KP\nNAMA PENUH, NOMBOR KP'

/** Badge colour of "AKTIF" / "TIDAK AKTIF" (S6 "Akaun", S8 "Status akaun"). */
export const accountColor = (active: boolean): 'success' | 'neutral' =>
  active ? 'success' : 'neutral'

/** Badge colour of the coins state: "ON" is warning (amber), "OFF" error (S6 "Syiling"). */
export const coinsColor = (enabled: boolean): 'warning' | 'error' => (enabled ? 'warning' : 'error')
