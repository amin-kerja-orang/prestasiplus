/**
 * Whether Terbitkan is off and why. Local issues (the live blueprint check) win, then unsaved edits
 * (the server review is stale), then a failed review call, then the server's own blockers.
 */
import { builderCopy as t } from './copy'

export interface PublishGateInput {
  localIssues: number
  dirty: boolean
  reviewFailed: boolean
  blockers: number
}
export interface PublishGate {
  blocked: boolean
  count: number
  reason: string
}

export function publishGate(i: PublishGateInput): PublishGate {
  if (i.localIssues > 0) return { blocked: true, count: i.localIssues, reason: t.publishDisabledWhy(i.localIssues) }
  if (i.dirty) return { blocked: true, count: 0, reason: t.publishSaveFirst }
  if (i.reviewFailed) return { blocked: true, count: 0, reason: t.publishCheckFailed }
  if (i.blockers > 0) return { blocked: true, count: i.blockers, reason: t.publishDisabledWhy(i.blockers) }
  return { blocked: false, count: 0, reason: '' }
}
