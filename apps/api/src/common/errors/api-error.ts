import { HttpException } from '@nestjs/common'
import { ERROR_STATUS, type ErrorCode } from '@pp/contract'

/** Generic messages, identical to the mock's `DEFAULT_ERROR_MESSAGES` (src/mock/server/respond.ts). */
export const DEFAULT_ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Sesi anda telah tamat. Sila log masuk semula.',
  FORBIDDEN: 'Anda tidak dibenarkan melakukan tindakan ini.',
  NOT_FOUND: 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
  SERVER_ERROR: 'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.',
  RATE_LIMITED: 'Terlalu banyak percubaan. Sila cuba sebentar lagi.',
  CONFLICT: 'Tindakan ini bercanggah dengan keadaan semasa. Muat semula dan cuba lagi.',
  VALIDATION_ERROR: 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.',
  PASSWORD_CHANGE_REQUIRED: 'Sila tukar kata laluan anda sebelum meneruskan.',
  BAD_REQUEST: 'Permintaan tidak sah. Sila muat semula halaman dan cuba lagi.',
  PAYLOAD_TOO_LARGE: 'Fail atau data terlalu besar. Saiz maksimum ialah {n} MB.',
  UNSUPPORTED_MEDIA_TYPE: 'Jenis fail tidak disokong.',
  BAD_GATEWAY: 'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.',
  SERVICE_UNAVAILABLE: 'Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit.',
  TIMEOUT: 'Permintaan mengambil masa terlalu lama. Cuba lagi.',
}

export interface ApiErrorOptions {
  /** Generic `ErrorCode` or a module-specific code. */
  code: string
  status: number
  message?: string
  fields?: Record<string, string>
  details?: Record<string, unknown>
  retryAfter?: number
}

/** Throw this from any service/controller; the filter renders it as the contract error body. */
export class ApiError extends HttpException {
  readonly code: string
  readonly fields?: Record<string, string>
  readonly details?: Record<string, unknown>
  readonly retryAfter?: number

  constructor(opts: ApiErrorOptions) {
    const message = opts.message ?? DEFAULT_ERROR_MESSAGES[opts.code as ErrorCode] ?? 'Error'
    super(message, opts.status)
    this.code = opts.code
    if (opts.fields) this.fields = opts.fields
    if (opts.details) this.details = opts.details
    if (opts.retryAfter !== undefined) this.retryAfter = opts.retryAfter
  }

  /** Generic error with the contract's status for `code`. */
  static of(code: ErrorCode, extra: Omit<ApiErrorOptions, 'code' | 'status'> = {}): ApiError {
    return new ApiError({ ...extra, code, status: ERROR_STATUS[code] })
  }
}
