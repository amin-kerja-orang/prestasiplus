import { HttpException } from '@nestjs/common'
import { ERROR_STATUS, type ErrorCode } from '@pp/contract'

/** Generic messages, identical to the mock's `DEFAULT_ERROR_MESSAGES` (src/mock/server/respond.ts). */
export const DEFAULT_ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Unauthenticated.',
  FORBIDDEN: 'This action is unauthorized.',
  NOT_FOUND: 'Not Found.',
  SERVER_ERROR: 'Server Error',
  RATE_LIMITED: 'Too Many Attempts.',
  CONFLICT: 'Conflict.',
  VALIDATION_ERROR: 'The given data was invalid.',
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
