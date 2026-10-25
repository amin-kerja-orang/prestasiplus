import { isHttpMode } from '@/api'

/**
 * Roles of the M10 routes whose API is teacher-only (S1 `/guru`, S4 `/guru/kelas`, S5 `/guru/kelas/cipta`,
 * S6 `/guru/pelajar`; DV-M10-37). The real API (`GET /api/guru/dashboard`, `/classes`, `/students`) answers
 * 403 to an admin, so in http mode only the teacher is admitted. The mock replicates live and admits the
 * admin (SRS §2, §9). The mode is a build-time constant, so this is computed once at module load.
 */
export const GURU_API_ROLES = isHttpMode()
  ? (['teacher'] as const)
  : (['teacher', 'admin'] as const)

/**
 * Roles of S4 `/guru/kelas`, S5 `/guru/kelas/cipta` and S6 `/guru/pelajar` in both modes (DV-M10-48): their API
 * (`GET`/`POST /api/guru/classes`, `GET /api/guru/students`) is teacher-only and answers 403 to an admin, so the
 * admin is redirected even in mock mode. S1 keeps `GURU_API_ROLES`.
 */
export const GURU_CLASS_ROLES = ['teacher'] as const
