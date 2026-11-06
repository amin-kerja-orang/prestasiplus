/**
 * Read port for the XS-1 pupil population (S6-T03, `school-admin/xs-queries.ts`): a pupil account, active and not suspended,
 * Tingkatan 1-5. Analitik Adaptif (S10-T04 part 2) takes its roster from here and intersects it with the class members.
 * The real adapter is `XsPupilRosterAdapter`; tests fake it.
 */
export type PupilRosterScope = { kind: 'school'; schoolId: string } | { kind: 'teacher'; teacherId: string }

export interface PupilRosterPort {
  /** Ids of the XS-1 pupils of the scope (ascending decimal ids). */
  xsPupilIds(scope: PupilRosterScope): Promise<string[]>
}

export const PUPIL_ROSTER_PORT = Symbol('PUPIL_ROSTER_PORT')
