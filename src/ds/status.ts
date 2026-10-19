/** Status vocabulary of `DsStatusBadge` (glossary 4): status to icon, BM word and colour. */
import { dsCopy } from './copy'

export type DsStatus =
  | 'active'
  | 'inactive'
  | 'approved'
  | 'pending-approval'
  | 'awaiting-review'
  | 'rejected'
  | 'draft'
  | 'published'
  | 'done'
  | 'in-progress'
  | 'expired'
  | 'risk-low'
  | 'risk-mid'
  | 'risk-high'
  | 'new'
  | 'live'

export type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'secondary'

export const statusMap: Record<DsStatus, { icon: string; word: string; color: StatusColor }> = {
  active: { icon: 'check-circle', word: dsCopy.statusActive, color: 'success' },
  inactive: { icon: 'minus-circle', word: dsCopy.statusInactive, color: 'neutral' },
  approved: { icon: 'check-circle', word: dsCopy.statusApproved, color: 'success' },
  'pending-approval': { icon: 'hourglass', word: dsCopy.statusPendingApproval, color: 'warning' },
  'awaiting-review': { icon: 'clock', word: dsCopy.statusAwaitingReview, color: 'warning' },
  rejected: { icon: 'x-circle', word: dsCopy.statusRejected, color: 'error' },
  draft: { icon: 'pencil-simple', word: dsCopy.statusDraft, color: 'neutral' },
  published: { icon: 'upload-simple', word: dsCopy.statusPublished, color: 'success' },
  done: { icon: 'check', word: dsCopy.statusDone, color: 'success' },
  'in-progress': { icon: 'spinner-gap', word: dsCopy.statusInProgress, color: 'info' },
  expired: { icon: 'warning-circle', word: dsCopy.statusExpired, color: 'error' },
  'risk-low': { icon: 'shield-check', word: dsCopy.statusRiskLow, color: 'success' },
  'risk-mid': { icon: 'warning', word: dsCopy.statusRiskMid, color: 'warning' },
  'risk-high': { icon: 'warning-octagon', word: dsCopy.statusRiskHigh, color: 'error' },
  new: { icon: 'sparkle', word: dsCopy.statusNew, color: 'secondary' },
  live: { icon: 'broadcast', word: dsCopy.statusLive, color: 'error' },
}
