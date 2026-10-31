/**
 * Whether Terbitkan is off and why. Local issues (the live blueprint check) win, then a failed review
 * call, then the server's own blockers. Unsaved edits do NOT block (V2: Jana set + Terbitkan = 2 clicks):
 * Terbitkan saves first, then reviews and publishes; a stale review is ignored while dirty.
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
  if (i.reviewFailed) return { blocked: true, count: 0, reason: t.publishCheckFailed }
  if (!i.dirty && i.blockers > 0) return { blocked: true, count: i.blockers, reason: t.publishDisabledWhy(i.blockers) }
  return { blocked: false, count: 0, reason: '' }
}
