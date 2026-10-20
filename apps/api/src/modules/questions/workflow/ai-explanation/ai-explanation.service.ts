import { Inject, Injectable } from '@nestjs/common'
import { QUESTION_WORKFLOW_AI_MESSAGES } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { isIdString } from '../../../../db/ids'
import { QuestionWorkflowPorts } from '../ports'
import { cannedExplanation, nextVariant } from './canned-explanation'

export interface AiExplanationResult {
  ok: true
  message: string
  stub: true
}

/**
 * AI explanation of a question: a STUB (OD-7, BR-M04-24). It never calls a network or an AI provider;
 * the text is canned and deterministic, and the response says `stub: true`.
 */
@Injectable()
export class AiExplanationService {
  constructor(@Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts) {}

  async generate(id: string, force: boolean): Promise<AiExplanationResult> {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    const bank = this.ports.questionBank
    const source = await bank.getExplanationSource(id)
    if (!source) throw ApiError.of('NOT_FOUND')
    const existing = source.explanation !== null && source.explanation.trim() !== ''
    if (existing && !force) return { ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.kept, stub: true }
    const text = cannedExplanation(source, nextVariant(existing ? source.explanation : null, id))
    if (!(await bank.setExplanation(id, text))) throw ApiError.of('NOT_FOUND')
    return { ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.generated, stub: true }
  }
}
