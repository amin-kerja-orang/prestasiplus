import type { RoleCode, Scope } from '@pp/contract'

/**
 * Read ports of the school dashboard (BE-21 slice). The dashboard owns no data: the Bijak figures come from BE-19's
 * `SchoolPerformanceService`, the class count from BE-17. Both are bound through a token with a FAIL-CLOSED default, so
 * with no provider the dashboard answers its empty aggregate (zeros), never an error and never a guess.
 *
 * NOT computed here: accuracy, level accuracy and the grade distribution all come from the BE-19 domain
 * (accuracy = gradedScore / gradedMax, levels t4 / t5, distribution from per-pupil accuracy; BE-19 OQ-3 and OQ-8).
 * The dashboard only maps them into its schema and applies the k-cohort suppression.
 */

/** Who is asking; the same shape as BE-19's `Ctx` (services never see Express). */
export interface SchoolPerformanceCtx {
  userId: string
  role: RoleCode
  scope: Scope
  /** Mod Pelajar is on. Test sittings are never counted either way (BE-19 OQ-13). */
  isTest: boolean
}

/**
 * The subset of BE-19's `PerformanceSchool` the dashboard reads. Every field is a structural subset of
 * `SchoolPerformanceService.school(ctx)`, so the real service is assignable to `SchoolPerformancePort` without an adapter
 * class. Marks are BE-19's (US-33.4); nothing here is recomputed.
 */
export interface SchoolPerformanceView {
  stats: {
    /** Pupils of the school (active or not), the cohort behind `sessions`. */
    students: number
    sessions: number
    answered: number
    /** 0..100, one decimal, `gradedScore / gradedMax` (BE-19). */
    accuracy: number
  }
  /** Grade rows with pupil counts (BE-19: zero rows until its GPS slice lands). */
  distribution: { grade: string; count: number; pct: number }[]
  /** `students` is the number of pupils behind the level (the cohort size). */
  levels: { code: string; accuracy: number; students: number }[]
}

export interface SchoolPerformancePort {
  school(ctx: SchoolPerformanceCtx): Promise<SchoolPerformanceView>
}

export const SCHOOL_PERFORMANCE_PORT = Symbol('SCHOOL_PERFORMANCE_PORT')

/** Default until BE-19 is merged and wired: no Bijak data at all. */
export class NoSchoolPerformance implements SchoolPerformancePort {
  async school(): Promise<SchoolPerformanceView> {
    return {
      stats: { students: 0, sessions: 0, answered: 0, accuracy: 0 },
      distribution: [],
      levels: [],
    }
  }
}

/** Active classes of a school, both kinds (BE-17 owns classes). */
export interface SchoolClassCountPort {
  activeClasses(schoolId: string): Promise<number>
}

export const SCHOOL_CLASS_COUNT_PORT = Symbol('SCHOOL_CLASS_COUNT_PORT')

/** Default until BE-17 is merged and wired: no classes. */
export class NoSchoolClasses implements SchoolClassCountPort {
  async activeClasses(): Promise<number> {
    return 0
  }
}

/*
 * BE-19 is wired: `SchoolAdminModule` binds `{ provide: SCHOOL_PERFORMANCE_PORT, useExisting: SchoolPerformanceService }`
 * (reports/performance/services/school-performance.service.ts). `SchoolPerformanceService.school(ctx: Ctx): Promise<PerformanceSchool>`
 * is structurally a `SchoolPerformancePort` (the view is a subset of `PerformanceSchool`), so there is no mapping code. The ctx is
 * `{ userId, role, scope: auth.active.scope, isTest }`. BE-19 gives no non-zero `distribution` rows (the GPS is not Bijak: it stays
 * null until an SPM card wires a future SpmGradesPort) and its `levels` stay empty until BE-17 provides the classes port; report, do not derive.
 *
 * TODO(BE-17 merge): register { provide: SCHOOL_CLASS_COUNT_PORT, useClass: <adapter over ClassesRepository> } where the adapter
 * returns the count of active classroom + school_class rows of the school (BE-17 ClassesRepository).
 */
