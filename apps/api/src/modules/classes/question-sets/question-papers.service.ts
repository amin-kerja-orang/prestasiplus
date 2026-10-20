import { Inject, Injectable } from '@nestjs/common'
import { QuestionSetPaperSchema, type QuestionSetPaper } from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { CLOCK, type Clock, mytDay } from '../../../db/clock'
import type { ClassActor } from '../actor'
import { validatePaper, type RawPart } from './question-papers'
import { QUESTION_SET_AUDIT } from './question-sets.constants'
import { QuestionSetsPorts } from './question-sets.ports'

/**
 * The teacher question paper upload (S22, BR-M10-25). BE-18 validates the whole request, then hands the
 * declaration and the file buffers to the intake port (BE-37). It never stores or opens a file itself.
 */
@Injectable()
export class QuestionPapersService {
  constructor(
    @Inject(QuestionSetsPorts) private readonly ports: QuestionSetsPorts,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async submit(actor: ClassActor, body: unknown, parts: readonly RawPart[] | undefined): Promise<QuestionSetPaper> {
    const at = this.clock.now()
    const { declaration, files } = validatePaper(body, parts, Number(mytDay(at).slice(0, 4)))
    const paper = await this.ports.intake.submit({
      teacherId: actor.userId,
      role: actor.role,
      isTest: actor.isTest,
      declaration,
      files: files.map((f, index) => ({ index, name: f.originalname, size: f.size, declaredMime: f.mimetype, buffer: f.buffer })),
      at,
    })
    await this.audit.record({
      action: QUESTION_SET_AUDIT.PAPER_SUBMITTED,
      actorUserId: actor.userId,
      actorRole: actor.role,
      sessionRowId: actor.auth.sessionRowId,
      targetType: 'question_paper',
      targetId: paper.id,
      scopeLevel: actor.auth.active.scope.level,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
    })
    return QuestionSetPaperSchema.parse(paper)
  }
}
