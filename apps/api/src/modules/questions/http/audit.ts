
import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import type { HttpActor } from './actor'

/**
 * Audit rows of the question writes: ids and counts only, never question content (BE-NFR-08).
 * `QUESTION_STATUS_CHANGED` is written by the lifecycle (BE-10) through the same registry.
 */
export class QuestionAudit {
  constructor(private readonly audit: AuditService) {}

  private write(
    action: string,
    actor: HttpActor,
    targetId: string | null,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.roleCode,
      scopeLevel: actor.scopeLevel ?? null,
      targetType: 'question',
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }

  created(actor: HttpActor, id: string, status: string): Promise<void> {
    return this.write(AUDIT_ACTIONS.QUESTION_CREATED, actor, id, { status })
  }

  updated(actor: HttpActor, id: string): Promise<void> {
    return this.write(AUDIT_ACTIONS.QUESTION_UPDATED, actor, id)
  }

  deleted(actor: HttpActor, id: string): Promise<void> {
    return this.write(AUDIT_ACTIONS.QUESTION_DELETED, actor, id)
  }

  /** A filter-based bulk action: the filter keys used (names only, no values), the counts and the ids changed (at most 200). */
  bulkFilter(actor: HttpActor, action: string, filter: object, matched: number, processed: number, affected: number, ids: readonly string[]): Promise<void> {
    return this.write(AUDIT_ACTIONS.QUESTION_BULK_ACTION, actor, null, { action, mode: 'filter', filterKeys: Object.keys(filter), matched, requested: processed, affected, ids: ids.slice(0, 200) })
  }

  /** Ids of the questions changed (ids only, at most 200). */
  bulk(actor: HttpActor, action: string, requested: number, affected: number, ids: readonly string[] = []): Promise<void> {
    return this.write(AUDIT_ACTIONS.QUESTION_BULK_ACTION, actor, null, { action, requested, affected, ids: ids.slice(0, 200) })
  }
}
