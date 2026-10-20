/**
 * Credentials for the http-mode (real API) specs. Users default to the seed demo accounts; passwords
 * are NEVER in the repo: per role `BIJAK_<ROLE>_PASS`, else one `E2E_DEMO_PASSWORD` for all roles.
 * Users can be overridden per role with `BIJAK_<ROLE>_USER`. A missing password makes the spec skip.
 */
export type DemoRole = 'student' | 'guru' | 'adminSekolah' | 'adminPusat'

const DEFAULTS: Record<DemoRole, { user: string; env: string }> = {
  student: { user: 'pelajar@demo.test', env: 'STUDENT' },
  guru: { user: 'guru@demo.test', env: 'GURU' },
  adminSekolah: { user: 'adminsekolah@demo.test', env: 'ADMIN_SEKOLAH' },
  adminPusat: { user: 'admin@demo.test', env: 'ADMIN_PUSAT' },
}

export interface DemoCreds {
  user: string
  pass: string | undefined
}

export function demoCreds(role: DemoRole): DemoCreds {
  const d = DEFAULTS[role]
  return {
    user: process.env[`BIJAK_${d.env}_USER`] || d.user,
    pass: process.env[`BIJAK_${d.env}_PASS`] || process.env.E2E_DEMO_PASSWORD || undefined,
  }
}

/** Skip reason when the password is missing. */
export const NEEDS_PASSWORD = 'needs E2E_DEMO_PASSWORD (or the per-role BIJAK_*_PASS)'
