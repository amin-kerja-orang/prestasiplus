/**
 * Read port for Kedudukan (R1-MUR-18, API-RPT-13): the pupil's standing by current wallet balance. The real adapter is
 * `adapters/kedudukan.repository.ts` (wallets, users, enrolments, schools, answers). Defaults answer "nobody".
 */
export type KedudukanScope = 'kelas' | 'sekolah' | 'negeri' | 'kebangsaan'

/** One pupil of a scope pool with the inputs of the order chain (48 GAME-16). */
export interface KedudukanCandidate {
  userId: string
  /** The full stored name; the service turns it into a first name for everyone but the viewer. */
  name: string
  syiling: number
  /** Non-test answers of every mode (XS-8), all time. */
  answered: number
  correct: number
  bestStreak: number
}

export interface KedudukanViewer {
  syiling: number
  schoolId: string | null
  /** The state of the pupil's school; null when there is no school or it has no state. */
  state: string | null
  inClass: boolean
}

export interface KedudukanPool {
  /** Pupils of the pool (the viewer included). */
  total: number
  /** Pupils of the pool with a higher syiling than the viewer: all of them rank before the viewer. */
  higher: number
  /**
   * Complete syiling groups: the viewer's own group plus the whole groups holding the two nearest pupils above and the
   * two nearest below. Order is not guaranteed; the service applies the chain.
   */
  candidates: KedudukanCandidate[]
}

export interface KedudukanPort {
  /** Null when the user is unknown. */
  viewer(userId: string): Promise<KedudukanViewer | null>
  /** Null when the viewer is not in the pool of the scope. */
  pool(userId: string, scope: KedudukanScope): Promise<KedudukanPool | null>
}

export const KEDUDUKAN_PORT = Symbol('KEDUDUKAN_PORT')
