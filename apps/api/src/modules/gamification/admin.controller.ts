import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { listMeta, NoStoreInterceptor, ok, okList } from '../../common/http'
import { Roles } from '../../common/guards'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type AuditActor } from './actor'
import { GamificationAdminService } from './admin.service'
import { GAMIFICATION_LIMITS, STUDENTS_PAGE_SIZE, TRANSACTIONS_PAGE_SIZE } from './gamification.constants'

/**
 * M14 admin economy (S1 to S5): the `admin` role only (Admin Pusat). Bodies are read raw and validated in the
 * service so that field errors come in the mock's order. CSRF on every mutation is enforced by the session guard.
 * Reads and writes are rate limited per user (429 `RATE_LIMITED`); every answer is `no-store`.
 */
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(GAMIFICATION_LIMITS.adminRead)
@Controller('admin/gamification')
export class GamificationAdminController {
  constructor(private readonly admin: GamificationAdminService) {}

  @Get('overview')
  async overview() {
    return ok(await this.admin.overview())
  }

  @Get('tiers')
  async tiers() {
    return ok(await this.admin.tiers())
  }

  @Post('tiers')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async createTier(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.admin.createTier(actor, body))
  }

  @Put('tiers/:id')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async updateTier(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.updateTier(actor, id, body))
  }

  @Post('tiers/:id/toggle')
  @HttpCode(200)
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async toggleTier(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.admin.toggleTier(actor, id))
  }

  @Get('challenges')
  async challenges() {
    return ok(await this.admin.challenges())
  }

  @Post('challenges')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async createChallenge(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.admin.createChallenge(actor, body))
  }

  @Put('challenges/:id')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async updateChallenge(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.updateChallenge(actor, id, body))
  }

  @Post('challenges/:id/toggle')
  @HttpCode(200)
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async toggleChallenge(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.admin.toggleChallenge(actor, id))
  }

  @Delete('challenges/:id')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async deleteChallenge(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.admin.deleteChallenge(actor, id))
  }

  @Get('students')
  async students(@Query() query: Record<string, unknown>) {
    const r = await this.admin.students(query)
    return okList(r.rows, listMeta(r.page, STUDENTS_PAGE_SIZE, r.total))
  }

  @Post('award')
  @HttpCode(200)
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async award(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.admin.award(actor, body))
  }

  @Get('transactions')
  async transactions(@Query() query: Record<string, unknown>) {
    const r = await this.admin.transactions(query)
    return okList(r.rows, listMeta(r.page, TRANSACTIONS_PAGE_SIZE, r.total))
  }

  @Get('settings')
  async settings() {
    return ok(await this.admin.settings())
  }

  @Put('settings')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async saveSettings(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.admin.saveSettings(actor, body))
  }
}

/** M14 reward control and lucky draws (S10): `admin` only. */
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(GAMIFICATION_LIMITS.adminRead)
@Controller('admin/reward-control')
export class RewardControlController {
  constructor(private readonly admin: GamificationAdminService) {}

  @Get()
  async control() {
    return ok(await this.admin.rewardControl())
  }

  @Put('settings')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async saveSettings(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.admin.saveEconomySettings(actor, body))
  }

  @Put('rewards/:id/cost')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async setCost(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setRewardCost(actor, id, body))
  }

  @Post('draws')
  @RateLimit(GAMIFICATION_LIMITS.adminWrite)
  async createDraw(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.admin.createDraw(actor, body))
  }
}
