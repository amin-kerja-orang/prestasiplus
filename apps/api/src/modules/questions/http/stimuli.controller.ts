import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  QuestionCreateRequestSchema,
  STIMULUS_MESSAGES,
  StimulusCreateRequestSchema,
  StimulusGroupCreateRequestSchema,
  StimulusGroupListQuerySchema,
  StimulusListQuerySchema,
  StimulusGroupMemberRequestSchema,
  StimulusGroupMembersSetRequestSchema,
  StimulusGroupMergeRequestSchema,
  StimulusGroupMoveRequestSchema,
  StimulusGroupReorderRequestSchema,
  StimulusGroupRetireRequestSchema,
  StimulusGroupUpdateRequestSchema,
  StimulusUpdateRequestSchema,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { StimuliService } from '../stimuli.service'
import { Actor, type HttpActor } from './actor'
import { QUESTIONS_WRITE_LIMIT } from './admin.controller'
import { flash, parseBody, parseQuery } from './parse'
import { questionView } from './views'

/**
 * Admin routes of the stimulus library and the stimulus groups (R1-T32, D90): the `admin` role only (Admin Pusat), CSRF on every
 * mutation by the session guard, writes rate limited with the other question writes (D57). Audit rows carry ids and counts only.
 */
@Roles('admin')
@Controller()
@UseGuards(RateLimitGuard)
export class StimuliController {
  constructor(
    @Inject(StimuliService) private readonly stimuli: StimuliService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private write(actor: HttpActor, action: string, targetType: 'stimulus' | 'stimulus_group' | 'question', targetId: string | null, details: Record<string, unknown>): Promise<void> {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.roleCode,
      scopeLevel: actor.scopeLevel ?? null,
      targetType,
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }

  // --- stimuli ------------------------------------------------------------------------------------

  @Get('stimuli')
  @UseInterceptors(NoStoreInterceptor)
  async listStimuli(@Query() query: unknown) {
    const q = parseQuery(StimulusListQuerySchema, query)
    const res = await this.stimuli.listStimuli(q)
    return { data: res.rows, meta: listMeta(q.page, q.pageSize, res.total) }
  }

  @Get('stimulus-groups')
  @UseInterceptors(NoStoreInterceptor)
  async listGroups(@Query() query: unknown) {
    const q = parseQuery(StimulusGroupListQuerySchema, query)
    const res = await this.stimuli.listGroups({ ...q, joinable: q.joinable === 'true' })
    return { data: res.rows, meta: listMeta(q.page, q.pageSize, res.total) }
  }

  @Post('stimuli')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async createStimulus(@Actor() actor: HttpActor, @Body() body: unknown) {
    const res = await this.stimuli.createStimulus(parseBody(StimulusCreateRequestSchema, body))
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_CREATED, 'stimulus', res.result.id, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.created)
  }

  @Get('stimuli/:id')
  async getStimulus(@Param('id') id: string) {
    return ok(await this.stimuli.getStimulus(id))
  }

  @Put('stimuli/:id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async updateStimulus(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getStimulus(id) // a missing record is 404 before a bad body is 422
    const res = await this.stimuli.updateStimulus(id, parseBody(StimulusUpdateRequestSchema, body))
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_UPDATED, 'stimulus', id, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.updated)
  }

  @Delete('stimuli/:id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async deleteStimulus(@Actor() actor: HttpActor, @Param('id') id: string) {
    const res = await this.stimuli.deleteStimulus(id)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_DELETED, 'stimulus', id, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.deleted)
  }

  // --- groups -------------------------------------------------------------------------------------

  /** API-Q-35 (declared before the `:id` routes): merges one group into another. */
  @Post('stimulus-groups/merge')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async mergeGroups(@Actor() actor: HttpActor, @Body() body: unknown) {
    const input = parseBody(StimulusGroupMergeRequestSchema, body)
    const res = await this.stimuli.mergeGroups(input.fromGroupId, input.intoGroupId)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_MERGED, 'stimulus_group', input.intoGroupId, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.groupUpdated)
  }

  @Post('stimulus-groups')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async createGroup(@Actor() actor: HttpActor, @Body() body: unknown) {
    const res = await this.stimuli.createGroup(parseBody(StimulusGroupCreateRequestSchema, body))
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_CREATED, 'stimulus_group', res.result.id, { ...res.audit, questionIds: res.result.questionIds })
    return flash(res.result, STIMULUS_MESSAGES.groupCreated)
  }

  @Get('stimulus-groups/:id')
  async getGroup(@Param('id') id: string) {
    return ok(await this.stimuli.getGroup(id))
  }

  @Put('stimulus-groups/:id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async updateGroup(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    const res = await this.stimuli.updateGroup(id, parseBody(StimulusGroupUpdateRequestSchema, body))
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_UPDATED, 'stimulus_group', id, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.groupUpdated)
  }

  @Delete('stimulus-groups/:id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async deleteGroup(@Actor() actor: HttpActor, @Param('id') id: string) {
    const res = await this.stimuli.deleteGroup(id)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_DELETED, 'stimulus_group', id, { ...res.audit, questionIds: res.result.releasedQuestionIds })
    return flash(res.result, STIMULUS_MESSAGES.groupDeleted)
  }

  @Post('stimulus-groups/:id/members')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async addMember(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    const input = parseBody(StimulusGroupMemberRequestSchema, body)
    const res = await this.stimuli.addMember(id, input.questionId)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_MEMBERS_CHANGED, 'stimulus_group', id, { ...res.audit, questionId: input.questionId })
    return flash(res.result, STIMULUS_MESSAGES.memberAdded)
  }

  @Delete('stimulus-groups/:id/members/:questionId')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async removeMember(@Actor() actor: HttpActor, @Param('id') id: string, @Param('questionId') questionId: string) {
    const res = await this.stimuli.removeMember(id, questionId)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_MEMBERS_CHANGED, 'stimulus_group', id, { ...res.audit, questionId })
    return flash(res.result, STIMULUS_MESSAGES.memberRemoved)
  }

  @Put('stimulus-groups/:id/members')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async setMembers(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    const input = parseBody(StimulusGroupMembersSetRequestSchema, body)
    const res = await this.stimuli.setMembers(id, input.questionIds)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_MEMBERS_CHANGED, 'stimulus_group', id, { ...res.audit, set: true })
    return flash(res.result, STIMULUS_MESSAGES.membersReordered)
  }

  @Put('stimulus-groups/:id/members/order')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async reorderMembers(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    const input = parseBody(StimulusGroupReorderRequestSchema, body)
    const res = await this.stimuli.reorderMembers(id, input.questionIds)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_MEMBERS_CHANGED, 'stimulus_group', id, { ...res.audit, reordered: true })
    return flash(res.result, STIMULUS_MESSAGES.membersReordered)
  }

  @Post('stimulus-groups/:id/questions')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async createQuestion(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    const input = parseBody(QuestionCreateRequestSchema, body)
    const created = await this.stimuli.createQuestionInGroup(id, input, actor)
    await this.write(actor, AUDIT_ACTIONS.QUESTION_CREATED, 'question', created.id, { status: created.version.status, groupId: id })
    return flash(questionView(created), STIMULUS_MESSAGES.questionAdded)
  }

  // --- group actions (S1-T01, API-Q-31..34) -------------------------------------------------------

  /** API-Q-31 `Terbitkan kumpulan`: every member `Diluluskan` together, or nothing changes. */
  @Post('stimulus-groups/:id/publish')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async publishGroup(@Actor() actor: HttpActor, @Param('id') id: string) {
    const res = await this.stimuli.publishGroup(id, actor)
    // On a draft copy the copy is gone after the swap: the audit row names the live group (its id never changes) and `details.fromDraftId`.
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_PUBLISHED, 'stimulus_group', res.result.id, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.groupUpdated)
  }

  /** API-Q-32 `Sunting kumpulan`: the draft copy of the group (one open copy per group). */
  @Post('stimulus-groups/:id/edit-as-draft')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async editGroupAsDraft(@Actor() actor: HttpActor, @Param('id') id: string) {
    const res = await this.stimuli.editAsDraft(id, actor)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_DRAFT_COPIED, 'stimulus_group', id, res.audit)
    return flash(res.result, STIMULUS_MESSAGES.groupDraftCreated(res.result.id))
  }

  /** API-Q-32 `Buang draf kumpulan`: discards the draft copy only. */
  @Delete('stimulus-groups/:id/draft')
  @HttpCode(204)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async discardGroupDraft(@Actor() actor: HttpActor, @Param('id') id: string): Promise<void> {
    const res = await this.stimuli.discardDraft(id)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_DRAFT_DISCARDED, 'stimulus_group', id, res.audit)
  }

  /** API-Q-33 `Arkibkan kumpulan`: every member archived in one transaction; the answer names the Terbit papers that place a member. */
  @Post('stimulus-groups/:id/retire')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async retireGroup(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    parseBody(StimulusGroupRetireRequestSchema, body)
    const res = await this.stimuli.retireGroup(id, actor)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_RETIRED, 'stimulus_group', id, res.audit)
    return ok(res.result)
  }

  /** API-Q-34 `Pindah ke kumpulan lain`: a member moves to the end of another group. */
  @Post('stimulus-groups/:id/members/:questionId/move')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async moveMember(@Actor() actor: HttpActor, @Param('id') id: string, @Param('questionId') questionId: string, @Body() body: unknown) {
    await this.stimuli.getGroup(id)
    const input = parseBody(StimulusGroupMoveRequestSchema, body)
    const res = await this.stimuli.moveMember(id, questionId, input.toGroupId)
    await this.write(actor, AUDIT_ACTIONS.STIMULUS_GROUP_MEMBER_MOVED, 'stimulus_group', id, res.audit)
    return ok(res.result)
  }
}
