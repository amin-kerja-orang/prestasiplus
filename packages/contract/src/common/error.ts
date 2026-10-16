import { z } from '../zod'

/**
 * Error format (master SRS 7.3, kept by ADR-0018 item 6; `requestId` and `details` are additions).
 * `message` is BM copy suitable for direct display. `code` is a string so modules can add codes;
 * the generic ones are listed in `ERROR_CODES`.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'SERVER_ERROR',
  'RATE_LIMITED',
] as const
export const ErrorCodeSchema = z.enum(ERROR_CODES).meta({ id: 'ErrorCode' })
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

/** HTTP status that goes with each generic code. */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  SERVER_ERROR: 500,
  RATE_LIMITED: 429,
}

export const ErrorPayloadSchema = z
  .object({
    code: z.string().min(1).meta({ description: 'Generic (ErrorCode) or module-specific code.' }),
    message: z.string().min(1).meta({ description: 'BM message for direct display.' }),
    fields: z
      .record(z.string(), z.string())
      .optional()
      .meta({ description: 'Field name to BM message, for VALIDATION_ERROR.' }),
    details: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({ description: 'Structured extras (e.g. candidate schools for AMBIGUOUS_USERNAME).' }),
    retryAfter: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .meta({ description: 'Seconds until a retry is allowed, for RATE_LIMITED.' }),
    requestId: z.string().optional().meta({ description: 'Correlation id, for support.' }),
  })
  .meta({ id: 'ErrorPayload' })
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>

export const ErrorBodySchema = z.object({ error: ErrorPayloadSchema }).meta({ id: 'ErrorBody' })
export type ErrorBody = z.infer<typeof ErrorBodySchema>
