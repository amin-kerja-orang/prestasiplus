import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type PkskActor } from './actor'
import { PkskStudentService } from './pksk-student.service'
import { PKSK_LIMITS } from './pksk.constants'

/**
 * Learner PKSK routes (M07-01 to M07-09): any signed-in role. The level gate (404 for a bad level, then 403 without
 * access) runs inside the service on every `:level` route before anything else is read. Responses are never cached.
 */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PkskStudentController {
  constructor(private readonly student: PkskStudentService) {}

  @Get('pksk/me/access')
  @RateLimit(PKSK_LIMITS.read)
  async access(@Actor() actor: PkskActor) {
    return ok(await this.student.access(actor))
  }

  @Get('pksk-domains')
  @RateLimit(PKSK_LIMITS.read)
  async domains() {
    return ok(await this.student.domainList())
  }

  @Get('pksk/levels/:level/dashboard')
  @RateLimit(PKSK_LIMITS.read)
  async dashboard(@Actor() actor: PkskActor, @Param('level') level: string) {
    return ok(await this.student.dashboard(actor, level))
  }

  @Get('pksk/levels/:level/domains')
  @RateLimit(PKSK_LIMITS.read)
  async sections(@Actor() actor: PkskActor, @Param('level') level: string) {
    return ok(await this.student.sections(actor, level))
  }

  @Get('pksk/levels/:level/domains/:code')
  @RateLimit(PKSK_LIMITS.attempt)
  async practiceSet(@Actor() actor: PkskActor, @Param('level') level: string, @Param('code') code: string) {
    return ok(await this.student.practiceSet(actor, level, code))
  }

  @Get('pksk/levels/:level/exam-attempts')
  @RateLimit(PKSK_LIMITS.read)
  async attempts(@Actor() actor: PkskActor, @Param('level') level: string) {
    return ok(await this.student.attempts(actor, level))
  }

  /** 201 (the Nest default for POST). */
  @Post('pksk/levels/:level/domains/:code/practice-sessions')
  @RateLimit(PKSK_LIMITS.attempt)
  async submitPractice(
    @Actor() actor: PkskActor,
    @Param('level') level: string,
    @Param('code') code: string,
    @Body() body: unknown,
  ) {
    return ok(await this.student.submitPractice(actor, level, code, body))
  }

  @Get('pksk/levels/:level/exam')
  @RateLimit(PKSK_LIMITS.attempt)
  async exam(@Actor() actor: PkskActor, @Param('level') level: string) {
    return ok(await this.student.exam(actor, level))
  }

  @Post('pksk/levels/:level/exam-attempts')
  @RateLimit(PKSK_LIMITS.attempt)
  async submitExam(@Actor() actor: PkskActor, @Param('level') level: string, @Body() body: unknown) {
    return ok(await this.student.submitExam(actor, level, body))
  }
}
