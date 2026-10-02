/**
 * Ordered list of module mock plugins (overview §6.10, ADR-0009).
 *
 * F-01 writes one lazy import for every student-slice module (build-plan §S.3 rule 1); F-31 appends
 * M11–M18 (the one registry extension of batch 3, ADR-0009 Amendment 2). Other tasks do not edit
 * this list. F-06 defines the real plugin type in `src/mock/define.ts`. The loader type
 * here is structural (`{ id }` only), so the real plugins satisfy it and this registry needs no edit.
 */
export interface MockModuleStub {
  /** Module id, e.g. `'M01'`. */
  id: `M${number}`
}

export type MockPluginLoader = () => Promise<{ default: MockModuleStub }>

export const mockPlugins: readonly MockPluginLoader[] = [
  () => import('@/modules/m01-authentication/mock'),
  () => import('@/modules/m02-users-schools/mock'),
  () => import('@/modules/m03-curriculum/mock'),
  () => import('@/modules/m04-question-bank/mock'),
  () => import('@/modules/m05-practice/mock'),
  () => import('@/modules/m06-spm/mock'),
  () => import('@/modules/m07-pksk/mock'),
  () => import('@/modules/m08-student-performance/mock'),
  () => import('@/modules/m09-content/mock'),
  () => import('@/modules/m10-teacher-class/mock'),
  () => import('@/modules/m11-teacher-analytics/mock'),
  () => import('@/modules/m12-kirkpatrick/mock'),
  () => import('@/modules/m13-cikgu-alesa/mock'),
  () => import('@/modules/m14-gamification/mock'),
  () => import('@/modules/m15-rewards-shop/mock'),
  () => import('@/modules/m16-battle-games/mock'),
  () => import('@/modules/m17-admin-dashboard/mock'),
  () => import('@/modules/m18-ppd-jpn/mock'),
]
