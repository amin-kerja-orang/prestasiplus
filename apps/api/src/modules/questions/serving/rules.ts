/**
 * R1-B03 (lite): where is a bank question served to pupils, and if not, why. PURE: no database, no clock. `ServabilityService`
 * loads the facts in batch; `evaluate` applies the rules.
 *
 * The rules REUSE the readers' own predicates; nothing is re-implemented:
 *  - status / active / level / subject:  the same conditions as `QuestionsRepository.scope` (`NOT_PRIMARY_LEVEL_SQL`,
 *    `LEARNER_LEVEL_SQL`) and `SPM_SERVABLE_SQL`, written over the loaded level and subject facts (JS twin of the SQL);
 *  - Databank, Latih Tubi SPM, Bab:      `servableMcq` of the practice bridge (the draw's own verdict and reason);
 *  - Simulasi Kuiz:                       `markableLeaf` and `resolveStimuli` of the kuiz mapper (what `prepare` keeps);
 *  - Simulasi (kertas):                   `mapBe09Question` of the Bijak bridge (what `refusalsOf` reports) plus a published paper;
 *  - Jana Kertas:                         `describeQuestion` of exam-core (the pool's base eligibility) plus the bridge.
 * The SQL half (counts, draws) is `filters.ts`; the parity spec proves both halves agree with the real draws.
 *
 * D87 U2 / D92: Databank, Latih Tubi SPM and Bab stay text-only in R1; a question with a stimulus, a group or a picture is
 * reported with the reason, not hidden.
 */
import { describeQuestion, type IneligibleReason } from '@pp/exam-core'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  servabilityReasonMs,
  type ServabilityActivity,
  type ServabilityActivityResult,
  type ServabilityReason,
  type ServabilityReasonCode,
  type ServabilityReport,
} from '@pp/contract'

import { markableLeaf, leavesOf, optionImageIds, resolveStimuli } from '../../bijak/kuiz/kuiz.mapper'
import { BRIDGE_REFUSAL_REASONS_MS } from '../../bijak/question-bridge/refusals'
import { mapBe09Question, UnsupportedQuestionError, type BridgeMedia } from '../../bijak/question-bridge/be09-mapping'
import { servableMcq } from '../../practice/question-bridge/be09-practice-mapping'
import { OFFERED_LEVEL_CODES } from '../../practice/rules'
import type { QuestionRecord } from '../types'
import type { ServabilityFacts } from './types'

/**
 * Statuses a pupil can be served from.
 * TODO(T04 / R1-B01): `approved` is the only servable status once the lifecycle migration 0100 lands and `published` is gone; until
 * then the live version of a question is `published`, so both are accepted. Remove `published` here when T04 merges.
 */
export const SERVABLE_STATUSES: readonly string[] = ['approved', 'published']

const reason = (code: ServabilityReasonCode, activity: ServabilityActivity, detail?: string, phraseMs?: string): ServabilityReason => ({
  code,
  message: servabilityReasonMs(code, activity, phraseMs),
  ...(detail === undefined ? {} : { detail }),
})

/** The conditions every activity shares: a live, servable, active question a learner may see (not PKSK, not Darjah). */
function commonReasons(f: ServabilityFacts, activity: ServabilityActivity): ServabilityReason[] {
  const out: ServabilityReason[] = []
  const live = f.live
  if (live === null) {
    out.push(reason(f.latest.version.status === 'archived' ? 'archived' : 'not_approved', activity))
    return out
  }
  if (!SERVABLE_STATUSES.includes(live.version.status)) out.push(reason('not_approved', activity))
  if (!live.isActive) out.push(reason('withdrawn', activity))
  if (live.pksk) out.push(reason('pksk', activity))
  if (f.level !== null) {
    if (f.level.stage === 'primary') out.push(reason('level_primary', activity))
    else if (!f.level.isActive) out.push(reason('level_inactive', activity))
  }
  return out
}

/** JS twin of `SPM_SERVABLE_SQL` beyond the learner level: offered level (T4, T5), active subject linked to that level. */
function spmReasons(f: ServabilityFacts, activity: ServabilityActivity): ServabilityReason[] {
  const out: ServabilityReason[] = []
  if (f.level === null || !OFFERED_LEVEL_CODES.includes(f.level.code)) out.push(reason('level_not_offered', activity))
  if (f.subject === null || !f.subject.isActive || !f.subject.linkedToLevel) out.push(reason('subject_unavailable', activity))
  return out
}

/** The practice draw's own verdict (`servableMcq`), classified for the admin. A refusal always yields exactly one reason. */
function practiceShapeReasons(record: QuestionRecord, activity: ServabilityActivity): ServabilityReason[] {
  const verdict = servableMcq(record)
  if (verdict.ok) return []
  const v = record.version
  const leaf = v.parts.length === 1 ? v.parts[0] : undefined
  const hasStimulus = record.groupId !== null || v.stimulusIds.length > 0 || (leaf !== undefined && 'mode' in leaf && leaf.stimulusId != null)
  const hasOptionImage = leaf !== undefined && 'options' in leaf && leaf.options.some((o) => o.imageId != null)
  if (hasStimulus) return [reason('has_stimulus', activity, verdict.reason)]
  if (hasOptionImage) return [reason('has_option_image', activity, verdict.reason)]
  return [reason('shape_unsupported', activity, verdict.reason)]
}

/** What `refusalsOf` of the Bijak bridge would report for the live version: the mapper's refusal, or null when it is served. */
export function bridgeRefusal(f: ServabilityFacts, record: QuestionRecord | null = f.live): UnsupportedQuestionError | null {
  const live = record
  if (live === null) return null
  const inGroup = new Set(f.group?.stimuli.map((s) => s.id) ?? [])
  const outside = new Map<string, { kind: string; assetFileId: string | null }>()
  for (const id of live.version.stimulusIds) {
    const asset = f.linkedAssets.get(id)
    if (!inGroup.has(id) && asset) outside.set(id, asset)
  }
  const media: BridgeMedia = { tokens: f.fileTokens, outside }
  try {
    mapBe09Question(live, f.group, { subjectCode: '', unitLabel: '', unitCode: null }, media)
    return null
  } catch (e) {
    if (e instanceof UnsupportedQuestionError) return e
    throw e
  }
}

function bridgeReasons(f: ServabilityFacts, activity: ServabilityActivity, record: QuestionRecord | null = f.live): ServabilityReason[] {
  const refusal = bridgeRefusal(f, record)
  if (refusal === null) return []
  if (refusal.code === 'file_missing') return [reason('image_missing', activity, refusal.reasonCode)]
  return [reason('bridge_refused', activity, refusal.reasonCode, BRIDGE_REFUSAL_REASONS_MS[refusal.code])]
}

const JANA_REASON: Readonly<Record<IneligibleReason, ServabilityReasonCode>> = {
  no_unit: 'untagged_legacy',
  no_tp: 'dskp_incomplete',
  no_marks: 'no_marks',
  no_key: 'no_key',
  tag_review: 'tag_review',
}

/**
 * Simulasi (kertas). The PAPER is the authority, not the live flag: the Bijak bridge serves the LIVE version of a placed question
 * whatever its `is_active`, and keeps serving the version that was live when the question was archived after publication
 * (`Be09BijakQuestionSource.load`). So none of the draw rules (active, level) apply here; a question that is neither live nor
 * archived-after-publication is not served, and a served question must sit on a published paper.
 */
function simulasiPaperReasons(f: ServabilityFacts): ServabilityReason[] {
  const activity = 'simulasi_paper' as const
  const archivedPublished = f.latest.version.status === 'archived' && f.latest.version.publishedAt !== null ? f.latest : null
  const record = f.live ?? archivedPublished
  if (record === null) return [reason(f.latest.version.status === 'archived' ? 'archived' : 'not_approved', activity)]
  return [...bridgeReasons(f, activity, record), ...(f.onPublishedPaper ? [] : [reason('not_on_published_paper', activity)])]
}

function activityReasons(f: ServabilityFacts, activity: ServabilityActivity): ServabilityReason[] {
  const live = f.live as QuestionRecord
  switch (activity) {
    case 'latih_tubi_spm':
    case 'databank': {
      const out = spmReasons(f, activity)
      const listed = activity === 'databank' ? f.subject?.databankListed : f.subject?.spmListed
      if (f.subject !== null && !listed) out.push(reason('subject_not_listed', activity))
      return [...out, ...practiceShapeReasons(live, activity)]
    }
    case 'bab':
      return [...(live.version.chapterId === null ? [reason('no_chapter', activity)] : []), ...practiceShapeReasons(live, activity)]
    case 'simulasi_kuiz': {
      const out: ServabilityReason[] = []
      const leaves = leavesOf(live.id, live.version.parts)
      const only = leaves[0]
      if (live.version.type !== 'mcq' || leaves.length !== 1 || only === undefined || markableLeaf(only) === null) {
        out.push(reason('shape_unsupported', activity))
      } else if (!resolveStimuli(live, f.group, f.linkedAssets).complete) {
        out.push(reason('shape_unsupported', activity, 'a linked stimulus has neither a group home nor a picture'))
      }
      return out
    }
    case 'simulasi_paper':
      return simulasiPaperReasons(f)
    case 'jana_kertas': {
      if (f.janaFacts === null) return [reason('subject_unavailable', activity)]
      const own = describeQuestion(f.janaFacts).reasons.map((r) => reason(JANA_REASON[r], activity, r))
      return [...own, ...bridgeReasons(f, activity)]
    }
  }
}

/** One activity: served when no rule objects; otherwise the reasons in the order they were checked. */
export function evaluate(f: ServabilityFacts, activity: ServabilityActivity): ServabilityActivityResult {
  if (activity === 'simulasi_paper') {
    const reasons = simulasiPaperReasons(f)
    return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: reasons.length === 0, reasons }
  }
  const common = commonReasons(f, activity)
  const reasons = common.length > 0 || f.live === null ? common : activityReasons(f, activity)
  return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: reasons.length === 0, reasons }
}

/** All six activities, in the contract order. */
export function evaluateAll(f: ServabilityFacts): ServabilityReport {
  const results = SERVABILITY_ACTIVITIES.map((a) => evaluate(f, a))
  return {
    questionId: f.latest.id,
    versionNo: f.live?.version.versionNo ?? null,
    activities: results,
    servedCount: results.filter((r) => r.served).length,
    total: results.length,
  }
}

/** Files whose public token the bridge needs for this question (group stimuli, option pictures, linked pictures). */
export function fileIdsOf(live: QuestionRecord, groupAssetIds: readonly string[], linkedAssetIds: readonly string[]): string[] {
  return [...new Set([...groupAssetIds, ...linkedAssetIds, ...optionImageIds(live)])]
}
