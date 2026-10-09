import type { RouteRecordRaw } from 'vue-router'

import { manifest as m01 } from '@/modules/m01-authentication'
import { manifest as m02 } from '@/modules/m02-users-schools'
import { manifest as m03 } from '@/modules/m03-curriculum'
import { manifest as m04 } from '@/modules/m04-question-bank'
import { manifest as m05 } from '@/modules/m05-practice'
import { manifest as m06 } from '@/modules/m06-spm'
import { manifest as m07 } from '@/modules/m07-pksk'
import { manifest as m08 } from '@/modules/m08-student-performance'
import { manifest as m09 } from '@/modules/m09-content'
import { manifest as m10 } from '@/modules/m10-teacher-class'
import { manifest as m11 } from '@/modules/m11-teacher-analytics'
import { manifest as m12 } from '@/modules/m12-kirkpatrick'
import { manifest as m13 } from '@/modules/m13-cikgu-alesa'
import { manifest as m14 } from '@/modules/m14-gamification'
import { manifest as m15 } from '@/modules/m15-rewards-shop'
import { manifest as m16 } from '@/modules/m16-battle-games'
import { manifest as m17 } from '@/modules/m17-admin-dashboard'
import { manifest as m18 } from '@/modules/m18-ppd-jpn'
import { manifest as m20 } from '@/modules/m20-marketplace'
import { manifest as m21 } from '@/modules/m21-sponsorship'
import { manifest as m22 } from '@/modules/m22-support-tickets'
import { manifest as m25 } from '@/modules/m25-ai-centre'
import { manifest as m27 } from '@/modules/m27-school-admin'

/**
 * THE module registry (overview §4, ADR-0009).
 *
 * Ordered list of module manifests in phase order (M01 → M26). F-01 writes one entry for every
 * student-slice module (build-plan §S.3 rule 1); F-31 appends M11–M18 (the one registry extension
 * of batch 3, ADR-0009 Amendment 2). Other tasks do not edit this list. Each manifest comes from the
 * module's public entry `@/modules/<slug>`.
 */
export interface ModuleManifest {
  /** Module id, e.g. `'M01'`. */
  id: `M${number}`
  /** Folder / docs slug, e.g. `'m01-authentication'`. */
  slug: string
  /** The module's route table (`routes.ts`). Empty until the module's UI tasks add fragments. */
  routes: readonly RouteRecordRaw[]
}

export const modules: readonly ModuleManifest[] = [
  m01,
  m02,
  m03,
  m04,
  m05,
  m06,
  m07,
  m08,
  m09,
  m10,
  m11,
  m12,
  m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m20,
  m21,
  m22,
  m25,
  m27,
]
