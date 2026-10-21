import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { PERFORMANCE_TIMELINE_LIMITS, PERFORMANCE_TIMELINE_MESSAGES } from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../../common/scope/auth-context'
import { rateLimited } from '../../../auth/auth.errors'

const MSG = PERFORMANCE_TIMELINE_MESSAGES

/** Photo part names the form may use (`photos` repeats, or `photos[]`). */
export const TIMELINE_PHOTO_FIELDS = ['photos', 'photos[]'] as const

/**
 * Hard multer limits (BE-NFR-25): at most 5 files of 2 MB, and a bounded number, name length and size of text fields
 * (title, category, eventDate, story and up to 5 captions fit in 12 fields; a story of 2000 characters is at most 8000
 * bytes). A body over a limit is cut off at that size and never buffered whole.
 */
export const TIMELINE_MULTER_LIMITS = {
  files: PERFORMANCE_TIMELINE_LIMITS.photosMax,
  fileSize: PERFORMANCE_TIMELINE_LIMITS.photoMaxBytes,
  fields: 12,
  fieldNameSize: 32,
  fieldSize: 8192,
  parts: 20,
  headerPairs: 50,
} as const

/** Largest declared body accepted before any byte is read: 5 photos, plus 64 KB for the text fields and framing. */
export const TIMELINE_MAX_BODY_BYTES =
  PERFORMANCE_TIMELINE_LIMITS.photosMax * PERFORMANCE_TIMELINE_LIMITS.photoMaxBytes + 64 * 1024

/** Uploads one user may have in flight at once (memory bound: this x 10 MB). */
export const TIMELINE_INFLIGHT_PER_USER = 2

/** Contract copy has none for a caption; captions are cut at 200 characters, so this only fires for a body far over that (limit: 8192 bytes). */
const CAPTION_TOO_LONG = 'Kapsyen terlalu panjang (maks 200 aksara).'

/**
 * Nest appends the offending part name to multer's message ("Field value too long - <name>"). The error is keyed by that
 * name with the contract's copy; a name the form does not use (or none) is the generic "no usable photo set" error.
 */
function tooLongFieldError(name: string | undefined): ApiError {
  const key = name?.trim() ?? ''
  const copy: Record<string, string> = {
    title: MSG.titleTooLong,
    story: MSG.storyTooLong,
    category: MSG.categoryInvalid,
    eventDate: MSG.dateInvalid,
  }
  const message = copy[key] ?? (/^captions(\[\d{1,2}\]|\.\d{1,2})?$/.test(key) ? CAPTION_TOO_LONG : undefined)
  if (message === undefined) return ApiError.of('VALIDATION_ERROR', { fields: { photos: MSG.photosRequired }, message: MSG.photosRequired })
  return ApiError.of('VALIDATION_ERROR', { fields: { [key]: message }, message })
}

/** Maps a multer failure to the contract's 422 `fields.photos` / `fields.story`. Exported for the unit test. */
export function multerFailureToApiError(err: unknown): ApiError | null {
  if (err instanceof PayloadTooLargeException) {
    return ApiError.of('VALIDATION_ERROR', { fields: { photos: MSG.photoInvalid }, message: MSG.photoInvalid })
  }
  if (err instanceof BadRequestException) {
    const message = err.message
    const tooLong = /^field value too long(?: - (.*))?$/i.exec(message)
    if (tooLong) return tooLongFieldError(tooLong[1])
    // too many files / parts / fields, a file in the wrong part, a malformed body: no usable photo set.
    return ApiError.of('VALIDATION_ERROR', { fields: { photos: MSG.photosRequired }, message: MSG.photosRequired })
  }
  return null
}

/**
 * Reads the multipart body of `POST /timeline` into memory with hard limits (the role, CSRF and rate limit ran
 * before this). Memory guards, before any byte is read: a `Content-Length` over `TIMELINE_MAX_BODY_BYTES` is a 422
 * on `photos`, and one user may have `TIMELINE_INFLIGHT_PER_USER` uploads in flight, else 429 with Retry-After
 * (the slot is released when the response closes, whatever the outcome).
 */
@Injectable()
export class TimelineUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor
  private readonly inflight = new Map<string, number>()

  constructor() {
    const Interceptor = FileFieldsInterceptor(
      TIMELINE_PHOTO_FIELDS.map((name) => ({ name, maxCount: PERFORMANCE_TIMELINE_LIMITS.photosMax })),
      { limits: { ...TIMELINE_MULTER_LIMITS } },
    )
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = ctx.switchToHttp()
    const req = http.getRequest<Request & RequestWithAuth>()
    const length = Number(req.headers['content-length'])
    if (Number.isFinite(length) && length > TIMELINE_MAX_BODY_BYTES) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { photos: MSG.photoInvalid }, message: MSG.photoInvalid })
    }
    const key = req[AUTH_CONTEXT_KEY]?.userId ?? 'anonymous'
    const active = this.inflight.get(key) ?? 0
    if (active >= TIMELINE_INFLIGHT_PER_USER) throw rateLimited(2)
    this.inflight.set(key, active + 1)
    let released = false
    const release = (): void => {
      if (released) return
      released = true
      const left = (this.inflight.get(key) ?? 1) - 1
      if (left <= 0) this.inflight.delete(key)
      else this.inflight.set(key, left)
    }
    http.getResponse<Response>().once('close', release)
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      release()
      throw multerFailureToApiError(err) ?? err
    }
  }
}
