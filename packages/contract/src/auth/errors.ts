import { z } from '../zod'

/**
 * Auth and session error codes (v2-frontend 4.3, ADR-0017). They travel in the standard
 * `{ error: { code, message } }` body; `RATE_LIMITED` and `VALIDATION_ERROR` are the generic codes
 * of `common/error.ts`.
 */
export const AUTH_ERROR_CODES = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_INACTIVE',
  'SCHOOL_INACTIVE',
  'AMBIGUOUS_USERNAME',
  'ROLE_NOT_ALLOWED',
  'MODE_ACTIVE',
  'MODE_ALREADY_ACTIVE',
  'MODE_NOT_ALLOWED',
  'NO_MODE_ACTIVE',
] as const
export const AuthErrorCodeSchema = z.enum(AUTH_ERROR_CODES).meta({
  id: 'AuthErrorCode',
  description: 'Error codes of the auth and session endpoints, in addition to the generic ones.',
})
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>

/** HTTP status that goes with each auth code. */
export const AUTH_ERROR_STATUS: Readonly<Record<AuthErrorCode, number>> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  SCHOOL_INACTIVE: 403,
  AMBIGUOUS_USERNAME: 422,
  ROLE_NOT_ALLOWED: 403,
  MODE_ACTIVE: 409,
  MODE_ALREADY_ACTIVE: 409,
  MODE_NOT_ALLOWED: 403,
  NO_MODE_ACTIVE: 409,
}

/**
 * BM messages. INVALID_CREDENTIALS, ACCOUNT_INACTIVE and SCHOOL_INACTIVE are the exact live copy
 * (v2-portals AC-01.4, AC-01.5, AC-01.6); a failed login never reveals which part was wrong.
 * The rest is proposed copy (no live source).
 */
export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'E-mel/Nama pengguna atau kata laluan tidak sah.',
  ACCOUNT_INACTIVE: 'Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir.',
  SCHOOL_INACTIVE: 'Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah.',
  AMBIGUOUS_USERNAME:
    'Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda.',
  ROLE_NOT_ALLOWED: 'Peranan ini tidak tersedia untuk akaun anda.',
  MODE_ACTIVE: 'Sila keluar daripada Mod Pelajar sebelum menukar peranan.',
  MODE_ALREADY_ACTIVE: 'Mod Pelajar sedang aktif.',
  MODE_NOT_ALLOWED: 'Mod Pelajar tidak tersedia untuk peranan anda.',
  NO_MODE_ACTIVE: 'Tiada mod yang sedang aktif.',
  RATE_LIMITED: 'Terlalu banyak percubaan. Sila cuba sebentar lagi.',
} as const satisfies Record<AuthErrorCode | 'RATE_LIMITED', string>
