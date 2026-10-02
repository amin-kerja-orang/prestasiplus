/**
 * S6-S8 complimentary-student lookups (SRS FR-M02-65…75; BR-18). Paths, route names, the bulk-action
 * buttons and the small helpers the three pages share.
 */

import { Ban, Coins, UserCheck, UserX } from '@lucide/vue'
import type { Component } from 'vue'

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
  icon: Component
  /** Full class strings (finite lookup, overview §8.2 rule 2). */
  cls: string
}

/** The four bulk-bar submit buttons in live order (FR-M02-67). */
export const BULK_BUTTONS: readonly BulkButton[] = [
  {
    action: 'coins_off',
    label: 'Matikan syiling',
    icon: Ban,
    cls: 'bg-rose-600 text-white hover:bg-rose-700',
  },
  {
    action: 'coins_on',
    label: 'Hidupkan syiling',
    icon: Coins,
    cls: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  {
    action: 'deactivate',
    label: 'Nyahaktif akaun',
    icon: UserX,
    cls: 'bg-slate-600 text-white hover:bg-slate-700',
  },
  {
    action: 'activate',
    label: 'Aktifkan akaun',
    icon: UserCheck,
    cls: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
]

/** S7 "Tarikh tamat pakej" default: 31 December of the current year (FR-M02-72). */
export function defaultPackageExpiry(): string {
  return `${String(clock.date().getFullYear())}-12-31`
}

/** S7 textarea placeholder: the same line twice (FR-M02-72). */
export const COMP_PASTE_PLACEHOLDER = 'NAMA PENUH, NOMBOR KP\nNAMA PENUH, NOMBOR KP'

/** "AKTIF" / "TIDAK AKTIF" text colour (S6 "Akaun", S8 "Status akaun"). */
export const accountClass = (active: boolean): string =>
  active ? 'text-emerald-700' : 'text-slate-500'

/** "OFF" rose / "ON" amber (S6 "Syiling"). */
export const coinsClass = (enabled: boolean): string =>
  enabled ? 'text-amber-700' : 'text-rose-600'
