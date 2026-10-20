import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common'
import { PracticeReadCodeParamsSchema } from '@pp/contract'
import type { Request } from 'express'

import { listMeta, ok, okList } from '../../../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../../../common/scope'
import { ApiError } from '../../../../common/errors/api-error'
import { PRACTICE_READS_MESSAGES } from '@pp/contract'
import { OverviewService, type Reader } from './overview.service'

type Req = Request & RequestWithAuth

const unpaged = <T>(items: T[]) => okList(items, listMeta(1, Math.max(1, items.length), items.length))

function readerOf(req: Req): Reader {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, role: scope.role, isTest: scope.isTest }
}

/** A path code: a non-empty text of at most 32 characters, otherwise the record does not exist (404, never 500). */
function codeOf(raw: string): string {
  const parsed = PracticeReadCodeParamsSchema.safeParse({ code: raw })
  if (!parsed.success) throw ApiError.of('NOT_FOUND', { message: PRACTICE_READS_MESSAGES.notFound })
  return parsed.data.code
}

/**
 * M05 overview reads (SRS section 7 #1 to #3, #7, #8). Any signed-in role: the default-deny guard answers 401
 * without a session. Every figure is the caller's own (card AC4); staff read a student through the BE-19 and
 * BE-20 report endpoints. Read only: no CSRF header, no rate limit (contract).
 */
@Controller()
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly overview: OverviewService) {}

  @Get('dashboard')
  async dashboard(@Req() req: Req) {
    return ok(await this.overview.dashboard(readerOf(req)))
  }

  @Get('practice/subjects')
  async subjects() {
    return unpaged(await this.overview.subjects())
  }

  @Get('practice/subjects/:code')
  async subject(@Param('code') code: string, @Req() req: Req) {
    return ok(await this.overview.subjectConfig(readerOf(req), codeOf(code)))
  }

  @Get('practice/chapter-subjects')
  async chapterSubjects() {
    return unpaged(await this.overview.chapterSubjects())
  }

  @Get('practice/chapter-subjects/:code')
  async chapterSubject(@Param('code') code: string, @Query() query: Record<string, unknown>, @Req() req: Req) {
    const levelId = typeof query.levelId === 'string' ? query.levelId : undefined
    return ok(await this.overview.chapterSubject(readerOf(req), codeOf(code), levelId))
  }
}
