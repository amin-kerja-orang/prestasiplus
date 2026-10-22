import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  CheckAnswerRequestSchema,
  ListSessionsQuerySchema,
  PRACTICE_MESSAGES,
  PRACTICE_MODES,
  type PracticeMode,
  StartSessionRequestSchema,
} from '@pp/contract'
import type { Request } from 'express'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { invalidModes } from './errors'
import { type Caller, PracticeService } from './practice.service'
import { HISTORY_MAX_PAGE, PRACTICE_LIMITS } from './rules'

type Req = Request & RequestWithAuth

/** The signed-in caller and whether Mod Pelajar is on (rows written are then stamped `is_test`). */
function callerOf(req: Req): Caller {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, isTest: scope.isTest }
}

/**
 * Parses a body with a contract schema; a failure is 422 `VALIDATION_ERROR` with the module's BM message
 * on the message and on every offending field (first issue per path). An unknown key of a strict schema
 * is named in `fields` itself (BE-NFR-05), never bound and never ignored.
 */
function parseBody<S extends z.ZodType>(schema: S, value: unknown, message: string): z.output<S> {
  const result = schema.safeParse(value ?? {})
  if (result.success) return result.data
  // Null prototype: an unknown key such as `__proto__` or `constructor` is reported like any other key.
  const fields: Record<string, string> = Object.create(null) as Record<string, string>
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fields[[...issue.path.map(String), key].join('.')] ??= message
      continue
    }
    fields[issue.path.length ? issue.path.map(String).join('.') : '_'] ??= message
  }
  throw ApiError.of('VALIDATION_ERROR', { message, fields })
}

/**
 * The start body in STRICT mode (BE-33 AC1c, #100): an unknown field (e.g. `ownerId`) is a 422, not silently
 * dropped. Local until the contract schema itself is `.strict()` (LEAD-owned `packages/contract`); then this
 * becomes a plain alias.
 */
const StrictStartSessionRequestSchema = StartSessionRequestSchema.strict()

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Practice sessions (SRS M05 section 7 #4 to #6 and #23). Any signed-in role: the default-deny guard
 * answers 401 without a session and the global CSRF guard answers 403 on a POST without the token.
 * Every write is limited per user; every answer is `Cache-Control: no-store` (answer data).
 */
@Controller('practice/sessions')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PracticeController {
  constructor(@Inject(PracticeService) private readonly practice: PracticeService) {}

  @Post()
  @RateLimit(PRACTICE_LIMITS.write)
  async start(@Body() body: unknown, @Req() req: Req) {
    return ok(await this.practice.start(callerOf(req), parseBody(StrictStartSessionRequestSchema, body, PRACTICE_MESSAGES.invalidValue)))
  }

  @Post(':id/check-answer')
  @HttpCode(200)
  @RateLimit(PRACTICE_LIMITS.write)
  async check(@Param('id') id: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await this.practice.check(callerOf(req), id, parseBody(CheckAnswerRequestSchema, body, PRACTICE_MESSAGES.invalidAnswer)))
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RateLimit(PRACTICE_LIMITS.write)
  async submit(@Param('id') id: string, @Body() body: unknown, @Req() req: Req) {
    // timeSpent is coerced, never rejected: anything but a number counts as 0.
    return ok(await this.practice.submit(callerOf(req), id, isRecord(body) ? body.timeSpent : undefined))
  }

  @Get()
  @RateLimit(PRACTICE_LIMITS.read)
  async list(@Query() query: Record<string, unknown>, @Req() req: Req) {
    const raw = typeof query.modes === 'string' ? query.modes : ''
    const modes = raw
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m !== '')
    if (modes.length === 0 || !modes.every((m): m is PracticeMode => (PRACTICE_MODES as readonly string[]).includes(m))) throw invalidModes()
    const parsed = parseBody(ListSessionsQuerySchema, { ...query, modes: raw }, PRACTICE_MESSAGES.invalidValue)
    if (parsed.page !== undefined && parsed.page > HISTORY_MAX_PAGE) {
      throw ApiError.of('VALIDATION_ERROR', { message: PRACTICE_MESSAGES.invalidValue, fields: { page: PRACTICE_MESSAGES.invalidValue } })
    }
    return this.practice.history(callerOf(req), {
      modes: modes as PracticeMode[],
      type: parsed.type ?? null,
      page: parsed.page,
      pageSize: parsed.pageSize,
    })
  }
}
