import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import {
  STUDIO_GROUP_MESSAGES,
  StudioDskpQuerySchema,
  StudioGroupCreateRequestSchema,
  StudioGroupMemberAddRequestSchema,
  StudioGroupMembersRequestSchema,
  StudioGroupUpdateRequestSchema,
  StudioStimulusInputSchema,
  StudioStimulusPatchSchema,
} from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { Roles } from '../../../common/guards'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { QUESTIONS_WRITE_LIMIT } from '../http/admin.controller'
import { Actor, type HttpActor } from '../http/actor'
import { flash, parseBody } from '../http/parse'
import { StudioDskpService } from './studio-dskp.service'
import { StudioGroupsService } from './studio-groups.service'

const M = STUDIO_GROUP_MESSAGES

/**
 * Admin Studio writes that the question CRUD does not cover (R1-F03b): stimulus groups (D90) and the DSKP picker. Admin Pusat
 * only. CSRF on every mutation comes from the session guard; writes are rate limited with the question writes. The prefix
 * `questions/studio` has two path segments, so it never meets `questions/:id`.
 */
@Roles('admin')
@Controller('questions/studio')
@UseGuards(RateLimitGuard)
export class StudioController {
  constructor(
    @Inject(StudioGroupsService) private readonly groups: StudioGroupsService,
    @Inject(StudioDskpService) private readonly dskp: StudioDskpService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get('dskp')
  async units(@Query() query: unknown) {
    const q = parseBody(StudioDskpQuerySchema, query)
    return ok(await this.dskp.units(q.subjectId, q.educationLevelId))
  }

  @Post('groups')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async create(@Actor() actor: HttpActor, @Body() body: unknown) {
    const group = await this.groups.create(parseBody(StudioGroupCreateRequestSchema, body))
    await this.record(actor, 'question_group.created', group.id, { members: group.memberCount, stimuli: group.stimuli.length })
    return flash(group, M.created)
  }

  @Get('groups/:id')
  async get(@Param('id') id: string) {
    return ok(await this.groups.get(id))
  }

  @Patch('groups/:id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async update(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    const group = await this.groups.update(id, parseBody(StudioGroupUpdateRequestSchema, body))
    await this.record(actor, 'question_group.updated', group.id)
    return flash(group, M.updated)
  }

  @Delete('groups/:id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async dissolve(@Actor() actor: HttpActor, @Param('id') id: string) {
    const res = await this.groups.dissolve(id)
    await this.record(actor, 'question_group.dissolved', res.id, { detached: res.detachedQuestionIds.length })
    return flash(res, M.dissolved)
  }

  @Post('groups/:id/stimuli')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async addStimulus(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    const group = await this.groups.addStimulus(id, parseBody(StudioStimulusInputSchema, body))
    await this.record(actor, 'question_group.stimulus_added', group.id, { stimuli: group.stimuli.length })
    return flash(group, M.updated)
  }

  @Patch('groups/:id/stimuli/:stimulusId')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async patchStimulus(@Actor() actor: HttpActor, @Param('id') id: string, @Param('stimulusId') stimulusId: string, @Body() body: unknown) {
    const group = await this.groups.patchStimulus(id, stimulusId, parseBody(StudioStimulusPatchSchema, body))
    await this.record(actor, 'question_group.stimulus_updated', group.id, { stimulusId })
    return flash(group, M.updated)
  }

  @Delete('groups/:id/stimuli/:stimulusId')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async removeStimulus(@Actor() actor: HttpActor, @Param('id') id: string, @Param('stimulusId') stimulusId: string) {
    const group = await this.groups.removeStimulus(id, stimulusId)
    await this.record(actor, 'question_group.stimulus_removed', group.id, { stimulusId })
    return flash(group, M.updated)
  }

  @Put('groups/:id/members')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async replaceMembers(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    const group = await this.groups.replaceMembers(id, parseBody(StudioGroupMembersRequestSchema, body))
    await this.record(actor, 'question_group.members_set', group.id, { members: group.memberCount })
    return flash(group, M.membersUpdated)
  }

  @Post('groups/:id/members')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async addMember(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    const input = parseBody(StudioGroupMemberAddRequestSchema, body)
    const group = await this.groups.addMember(id, input)
    await this.record(actor, 'question_group.member_added', group.id, { questionId: input.questionId })
    return flash(group, M.membersUpdated)
  }

  @Delete('groups/:id/members/:questionId')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async removeMember(@Actor() actor: HttpActor, @Param('id') id: string, @Param('questionId') questionId: string) {
    const group = await this.groups.removeMember(id, questionId)
    await this.record(actor, 'question_group.member_removed', group.id, { questionId })
    return flash(group, M.membersUpdated)
  }

  /** Ids and counts only; never stimulus text or question content (BE-NFR-08). */
  private record(actor: HttpActor, action: string, targetId: string, details: Record<string, unknown> = {}): Promise<void> {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.roleCode,
      scopeLevel: actor.scopeLevel ?? null,
      targetType: 'question_group',
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }
}
