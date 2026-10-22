import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  IntakeAcceptRequestSchema,
  IntakeBulkRequestSchema,
  IntakeDuplicateRequestSchema,
  IntakeExtractRequestSchema,
  IntakeItemCreateRequestSchema,
  IntakeItemListQuerySchema,
  IntakeItemPatchSchema,
  IntakeRejectRequestSchema,
  IntakeStimulusCreateRequestSchema,
  IntakeStimulusUpdateRequestSchema,
  type IntakeBulkRequest,
  type IntakeDuplicateRequest,
  type IntakeItemCreateRequest,
  type IntakeItemListQuery,
  type IntakeItemPatch,
  type IntakeRejectRequest,
  type IntakeStimulusCreateRequest,
  type IntakeStimulusUpdateRequest,
} from '@pp/contract'
import type { Request, Response } from 'express'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { IntakeExtractionService, type CallerInfo } from './extraction.service'
import { IntakeReviewService } from './review.service'
import { IntakeStimuliService } from './stimuli.service'
import { REVIEW_LIMITS } from './workflow.constants'
import { IntakeTeacherGate } from '../intake-teacher.gate'

type Req = Request & RequestWithAuth

function authOf(req: Req): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function infoOf(req: Request): CallerInfo {
  return { ip: req.ip ?? req.socket.remoteAddress ?? null, requestId: requestIdOf(req) ?? null }
}

/**
 * Extraction and the review of its items (BE-38). Guru on own batches, Admin Pusat on all; Admin Sekolah and PPD are 403,
 * an id outside the caller's scope is 404. The AI port is not reachable from here: only a signed-in human calls accept.
 */
@Controller('intake')
@Roles('teacher', 'admin')
@UseGuards(IntakeTeacherGate, RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class IntakeWorkflowController {
  constructor(
    @Inject(IntakeExtractionService) private readonly extraction: IntakeExtractionService,
    @Inject(IntakeReviewService) private readonly review: IntakeReviewService,
    @Inject(IntakeStimuliService) private readonly stimuli: IntakeStimuliService,
  ) {}

  @Post('batches/:id/extract')
  @RateLimit(REVIEW_LIMITS.extract)
  async extract(
    @Req() req: Req,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(IntakeExtractRequestSchema)) _body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { run, status } = await this.extraction.request(authOf(req), id, infoOf(req))
    res.status(status)
    return ok(run)
  }

  @Get('batches/:id/review')
  @RateLimit(REVIEW_LIMITS.read)
  async summary(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.review.review(authOf(req), id))
  }

  @Post('batches/:id/items')
  @HttpCode(201)
  @RateLimit(REVIEW_LIMITS.write)
  async addItem(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeItemCreateRequestSchema)) body: IntakeItemCreateRequest) {
    return ok(await this.review.addItem(authOf(req), id, body, infoOf(req)))
  }

  @Post('batches/:id/stimuli')
  @HttpCode(201)
  @RateLimit(REVIEW_LIMITS.write)
  async addStimulus(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeStimulusCreateRequestSchema)) body: IntakeStimulusCreateRequest) {
    return ok(await this.stimuli.create(authOf(req), id, body, infoOf(req)))
  }

  @Patch('stimuli/:id')
  @RateLimit(REVIEW_LIMITS.write)
  async patchStimulus(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeStimulusUpdateRequestSchema)) body: IntakeStimulusUpdateRequest) {
    return ok(await this.stimuli.update(authOf(req), id, body, infoOf(req)))
  }

  @Delete('stimuli/:id')
  @RateLimit(REVIEW_LIMITS.write)
  async removeStimulus(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.stimuli.remove(authOf(req), id, infoOf(req)))
  }

  @Get('items')
  @RateLimit(REVIEW_LIMITS.read)
  async list(@Req() req: Req, @Query(new ZodValidationPipe(IntakeItemListQuerySchema)) query: IntakeItemListQuery) {
    return await this.review.list(authOf(req), query)
  }

  // Declared before `items/:id/...` so the literal segment can never be read as an id.
  @Post('items/bulk')
  @HttpCode(200)
  @RateLimit(REVIEW_LIMITS.bulk)
  async bulk(@Req() req: Req, @Body(new ZodValidationPipe(IntakeBulkRequestSchema)) body: IntakeBulkRequest) {
    return ok(await this.review.bulk(authOf(req), body, infoOf(req)))
  }

  @Get('items/:id')
  @RateLimit(REVIEW_LIMITS.read)
  async one(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.review.get(authOf(req), id))
  }

  @Patch('items/:id')
  @RateLimit(REVIEW_LIMITS.write)
  async patch(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeItemPatchSchema)) body: IntakeItemPatch) {
    return await this.review.patch(authOf(req), id, body, infoOf(req))
  }

  @Post('items/:id/accept')
  @HttpCode(200)
  @RateLimit(REVIEW_LIMITS.write)
  async accept(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeAcceptRequestSchema)) _body: unknown) {
    void _body
    return ok(await this.review.accept(authOf(req), id, infoOf(req)))
  }

  @Post('items/:id/reject')
  @HttpCode(200)
  @RateLimit(REVIEW_LIMITS.write)
  async reject(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeRejectRequestSchema)) body: IntakeRejectRequest) {
    return ok(await this.review.reject(authOf(req), id, body, infoOf(req)))
  }

  @Post('items/:id/duplicate')
  @HttpCode(200)
  @RateLimit(REVIEW_LIMITS.write)
  async duplicate(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(IntakeDuplicateRequestSchema)) body: IntakeDuplicateRequest) {
    return ok(await this.review.duplicate(authOf(req), id, body, infoOf(req)))
  }
}
