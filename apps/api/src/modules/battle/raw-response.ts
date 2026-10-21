/**
 * Raw (un-enveloped) error answers of the battle routes M16-02 to M16-14 (BE-44 AC 2).
 *
 *  - `{"error": "<BM text>"}` with the status of the catalogue            -> `throw new BattleRawError(422, text)`
 *  - an EMPTY body `{}` (M16-02 / M16-03 answer 422 and 403 this way)     -> `throw new BattleRawError(422)`
 *
 * Put `@UseFilters(BattleRawErrorFilter)` on the controller (or the route) that serves raw routes. The filter only
 * catches `BattleRawError`; every other error (401, 403 CSRF, 429, an unexpected 500) still goes to the global
 * `AllExceptionsFilter` and keeps the standard envelope. Env routes (M16-01, M16-15 to M16-21, M16-42 to M16-45) never
 * use this: they throw `ApiError` (`apps/api/src/common/errors/api-error.ts`).
 */
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common'
import type { Response } from 'express'

/** Body of a raw error: the BM text, or `null` for the empty `{}` answer. */
export class BattleRawError extends HttpException {
  readonly rawBody: { error: string } | Record<string, never>

  constructor(status: number, text?: string) {
    super(text ?? 'raw battle error', status)
    this.rawBody = text === undefined ? {} : { error: text }
  }
}

@Catch(BattleRawError)
export class BattleRawErrorFilter implements ExceptionFilter {
  catch(exception: BattleRawError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(exception.getStatus()).json(exception.rawBody)
  }
}

/** Statuses the catalogue uses for raw errors. */
export const rawNotFound = (text: string): BattleRawError => new BattleRawError(404, text)
export const rawConflict = (text: string): BattleRawError => new BattleRawError(409, text)
export const rawInvalid = (text?: string): BattleRawError => new BattleRawError(422, text)
export const rawForbidden = (text?: string): BattleRawError => new BattleRawError(403, text)
