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
 * D105 (supersedes D87 U2 / D92-1): every drill (Databank, Latih Tubi SPM, Bab) serves figure questions and WHOLE stimulus groups.
 * Until the screen that renders them lands, a surface is listed in `GROUP_SURFACES` only when it can show a group; on the others
 * the practice bridge's text-only rule still holds and a question with a stimulus, a group or a picture is reported with the reason
 * (`practiceShapeReasons`), not hidden. The surfaces the PRD excludes for good (Remedial, Misi, PKSK, games) are not activities here.
 */
import { describeQuestion, type IneligibleReason } from '@pp/exam-core'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  servabilityReasonMs,
  type QuestionPart,
  type ServabilityActivity,
  type ServabilityActivityResult,
  type ServabilityReason,
  type ServabilityReasonCode,
  type ServabilityReport,
} from '@pp/contract'

import { stimulusReferenceOf } from '../../intake/workflow/figure-links'
import { markableLeaf, leavesOf, optionImageIds, resolveStimuli } from '../../bijak/kuiz/kuiz.mapper'
import { BRIDGE_REFUSAL_REASONS_MS } from '../../bijak/question-bridge/refusals'
import { mapBe09Question, UnsupportedQuestionError, type BridgeMedia } from '../../bijak/question-bridge/be09-mapping'
import { servableMcq } from '../../practice/question-bridge/be09-practice-mapping'
import { OFFERED_LEVEL_CODES } from '../../practice/rules'
import { SERVABLE_STATUS } from '../learner-visibility'
import type { QuestionRecord } from '../types'
import type { ServabilityFacts } from './types'

/** Statuses a pupil can be served from: `approved` only (ADR-0027, R1-B01); the one constant of `learner-visibility`. */
export const SERVABLE_STATUSES: readonly string[] = [SERVABLE_STATUS]

/**
 * The surfaces that serve figure questions and whole stimulus groups (D105, S1-T06). On a surface in this set a question outside a
 * group, with or without a figure, and a member of a COMPLETE group are served (`wholeGroups`, whole-group predicate); on a surface
 * NOT in it the text-only practice shape holds and `has_stimulus` / `has_option_image` explain a refusal.
 * Starts as what already renders groups today: Bijak papers (`simulasi_paper`) and the Jana set (`jana_kertas`). S5-T03 adds
 * `latih_tubi_spm` and `bab` in the PR of its Part B (QuizRunner.vue), S3-T07 adds `databank` (one line each, cross-sector).
 * `simulasi_kuiz` reads its own mapper and is not decided by this set. Games (`permainan`) are never in it (FR-X1-4e, 46 section 5.1).
 */
export const GROUP_SURFACES: readonly ServabilityActivity[] = ['simulasi_paper', 'jana_kertas']

/** Every INCLUDE surface of 46 section 5.1 among the six activities: what the unit tests run with. */
export const ALL_GROUP_SURFACES: readonly ServabilityActivity[] = ['latih_tubi_spm', 'databank', 'bab', 'simulasi_paper', 'simulasi_kuiz', 'jana_kertas']

const reason = (code: ServabilityReasonCode, activity: ServabilityActivity, detail?: string, phraseMs?: string, count?: number): ServabilityReason => ({
  code,
  message: servabilityReasonMs(code, activity, phraseMs, count),
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
  // S1-T07: the flag and the key checks are part of the servable rule (JS twins of NOT_FLAGGED_SQL and ALL_LEAVES_KEYED_SQL).
  out.push(...flagReasons(live, activity), ...keyReasons(live, activity))
  return out
}

/** The text a question shows: stem, every part prompt and every option, Malay then English (what the detectors read, 45 section 6.6.1). */
function textsOf(version: QuestionRecord['version']): string[] {
  const out: (string | undefined | null)[] = [version.stemMs, version.stemEn]
  const walk = (parts: readonly QuestionPart[]): void => {
    for (const p of parts) {
      out.push(p.prompt.ms, p.prompt.en)
      if ('options' in p) for (const o of p.options) out.push(o.body.ms, o.body.en)
      if ('children' in p) walk(p.children)
    }
  }
  walk(version.parts)
  return out.filter((t): t is string => typeof t === 'string' && t !== '')
}

/**
 * JS twin of `NOT_FLAGGED_SQL` (S1-T07, FR-ADM-G7.3): the LIVE version carries `stimulus_missing` or `figure_only` and nobody dismissed it. The same
 * verdict on every pupil surface; `stem_duplicated` is shown once and never a reason. For `stimulus_missing` the sentence names the reference the text
 * contains ("Rajah 14"); `detail` is the stored reference kind (`numbered`, `unnumbered`).
 */
function flagReasons(live: QuestionRecord, activity: ServabilityActivity): ServabilityReason[] {
  const v = live.version
  if (v.flagDismissedAt != null) return []
  if (v.stimulusFlag === 'figure_only') return [reason('figure_only', activity, v.stimulusFlagRef ?? undefined)]
  if (v.stimulusFlag !== 'stimulus_missing') return []
  const found = textsOf(v).map((t) => stimulusReferenceOf(t)).find((r) => r !== null)
  return [reason('stimulus_missing', activity, v.stimulusFlagRef ?? undefined, found?.text)]
}

/**
 * JS twin of `ALL_LEAVES_KEYED_SQL` (S1-T07, lead decision on #424): a leaf with no `answer_keys` row cannot be marked, so it is not served. An MCQ
 * leaf reads `no_key` (45 row 16), any other leaf `no_scheme` (the structured "tiada skema — tidak disajikan"). The servability read loads such a
 * leaf leniently (`key` undefined); every rule that reads a key runs after this check, so none sees it.
 */
function keyReasons(live: QuestionRecord, activity: ServabilityActivity): ServabilityReason[] {
  const modes = new Set<'no_key' | 'no_scheme'>()
  const walk = (parts: readonly QuestionPart[]): void => {
    for (const p of parts) {
      if ('mode' in p) {
        if (p.key == null) modes.add(p.mode === 'mcq' ? 'no_key' : 'no_scheme')
      } else walk(p.children)
    }
  }
  walk(live.version.parts)
  return [...modes].map((code) => reason(code, activity))
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

/**
 * The shape verdict of a surface in `GROUP_SURFACES` (D105): one MCQ leaf whose key names an option; a stimulus, a figure and an
 * option image are allowed. The whole group is excluded (`group_incomplete`) when a member cannot be served or the group lost its
 * stimulus; a stimulus the screen cannot show (missing file, empty body) is the bridge's own refusal, with its own reason.
 */
function groupSurfaceShapeReasons(f: ServabilityFacts, record: QuestionRecord, activity: ServabilityActivity): ServabilityReason[] {
  const v = record.version
  const only = v.parts.length === 1 ? v.parts[0] : undefined
  let refusal: string | null = null
  if (v.type !== 'mcq') refusal = `type ${v.type} is not served by practice`
  else if (v.parts.length !== 1) refusal = 'an MCQ must have exactly one part'
  else if (only === undefined || !('mode' in only) || only.mode !== 'mcq') refusal = 'the only part is not an MCQ leaf'
  else if (!only.options.some((o) => o.label === only.key.correct)) refusal = 'the key names no option'
  if (refusal !== null) return [reason('shape_unsupported', activity, refusal)]
  if (f.groupIncomplete !== undefined) return [reason('group_incomplete', activity, undefined, undefined, f.groupIncomplete)]
  return bridgeReasons(f, activity, record)
}

/** The shape reasons of a drill: the group-aware verdict on a `GROUP_SURFACES` surface, else the text-only practice verdict. */
function drillShapeReasons(f: ServabilityFacts, record: QuestionRecord, activity: ServabilityActivity, surfaces: readonly ServabilityActivity[]): ServabilityReason[] {
  return surfaces.includes(activity) ? groupSurfaceShapeReasons(f, record, activity) : practiceShapeReasons(record, activity)
}

/** What `refusalsOf` of the Bijak bridge would report for the live version: the mapper's refusal, or null when it is served. */
export function bridgeRefusal(f: ServabilityFacts, record: QuestionRecord | null = f.live): UnsupportedQuestionError | null {
  const live = record
  if (live === null) return null
  const media: BridgeMedia = { tokens: f.fileTokens, outside: f.outside }
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
  // D90: a stimulus linked to several questions must be a group; the admin gets the cause and the fix, not the generic wrapper.
  if (refusal.code === 'stimulus_shared_ungrouped') return [reason('stimulus_shared_ungrouped', activity, refusal.reasonCode)]
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
 * Simulasi (kertas). The PAPER is the authority, not the live flag of the question: the Bijak bridge serves the LIVE version of a
 * placed question whatever its `is_active`, so none of the draw rules (active, level) apply, and a served question must sit on a
 * published paper. But a NEW sitting needs a live approved version: `BijakPapersAttemptSource.resolveForAttempt` reads
 * `getMany(published = true)` and keeps only that. A question without a live version (archived, or back to draft) therefore stops
 * the paper from being started, and is reported as `archived` or `not_approved` (H-A13). A sitting that is already running keeps
 * reading the archived version through the bridge; that is readability, not servability, and is not reported here.
 */
function simulasiPaperReasons(f: ServabilityFacts): ServabilityReason[] {
  const activity = 'simulasi_paper' as const
  if (f.live === null) return [reason(f.latest.version.status === 'archived' ? 'archived' : 'not_approved', activity)]
  if (!SERVABLE_STATUSES.includes(f.live.version.status)) return [reason('not_approved', activity)]
  const keys = keyReasons(f.live, activity)
  if (keys.length > 0) return keys
  return [...bridgeReasons(f, activity, f.live), ...(f.onPublishedPaper ? [] : [reason('not_on_published_paper', activity)])]
}

function activityReasons(f: ServabilityFacts, activity: ServabilityActivity, surfaces: readonly ServabilityActivity[]): ServabilityReason[] {
  const live = f.live as QuestionRecord
  switch (activity) {
    case 'latih_tubi_spm':
    case 'databank': {
      const out = spmReasons(f, activity)
      const listed = activity === 'databank' ? f.subject?.databankListed : f.subject?.spmListed
      if (f.subject !== null && !listed) out.push(reason('subject_not_listed', activity))
      return [...out, ...drillShapeReasons(f, live, activity, surfaces)]
    }
    case 'bab':
      return [...(live.version.chapterId === null ? [reason('no_chapter', activity)] : []), ...drillShapeReasons(f, live, activity, surfaces)]
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
export function evaluate(f: ServabilityFacts, activity: ServabilityActivity, surfaces: readonly ServabilityActivity[] = GROUP_SURFACES): ServabilityActivityResult {
  // Checked first, whatever the other rules say: a question with no live version (archived) or a common reason would otherwise return its
  // verdict from facts that never had the Jana pool facts, and the same facts would throw for a servable question.
  if (activity === 'jana_kertas' && f.janaSkipped) {
    throw new Error('servability: the Jana Kertas verdict was evaluated on facts loaded with { jana: false } (janaFacts not loaded)')
  }
  if (activity === 'simulasi_paper') {
    const reasons = simulasiPaperReasons(f)
    return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: reasons.length === 0, reasons }
  }
  const common = commonReasons(f, activity)
  const reasons = common.length > 0 || f.live === null ? common : activityReasons(f, activity, surfaces)
  return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: reasons.length === 0, reasons }
}

/** All six activities, in the contract order. */
export function evaluateAll(f: ServabilityFacts, surfaces: readonly ServabilityActivity[] = GROUP_SURFACES): ServabilityReport {
  const results = SERVABILITY_ACTIVITIES.map((a) => evaluate(f, a, surfaces))
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

/**
 * S1-T06 (D105, FR-MUR-QP-6, DM-27): the ONE unit draw. A unit is a single question or a WHOLE stimulus group. A draw takes whole
 * units or nothing: a group is never split, its members stay contiguous in `groupPosition` order, a group that would push the draw
 * past the target is skipped (so the result may hold fewer than `n`). PURE. Callers pass the SERVABLE candidates and, when they know
 * it, each group's `groupSize` so a group with a member that is not servable is skipped, never half served.
 */
interface DrawCandidateBase {
  id: string
}
/** A standalone question, or a member of a group: a member MUST carry `groupSize` (members the group holds in all). */
export type DrawCandidate =
  | (DrawCandidateBase & { groupId: null; groupPosition: null; groupSize?: undefined })
  | (DrawCandidateBase & {
      /** `questions.group_id`. */
      groupId: string
      /** `questions.group_position` (order inside the group). */
      groupPosition: number | null
      /** Members the group holds in all; a group whose distinct candidate members differ from it is skipped, never half drawn. */
      groupSize: number
    })

/** Ids of the drawn units, flattened: units in draw order, the members of a group contiguous in group order. At most `n` ids. */
export function drawUnits(candidates: readonly DrawCandidate[], n: number, rng: { next(): number }): string[] {
  if (!(n > 0)) return []
  const singles: DrawCandidate[][] = []
  const groups = new Map<string, Map<string, DrawCandidate>>()
  const seenSingles = new Set<string>()
  for (const c of candidates) {
    if (c.groupId === null) {
      if (!seenSingles.has(c.id)) singles.push([c])
      seenSingles.add(c.id)
    } else {
      const list = groups.get(c.groupId) ?? new Map<string, DrawCandidate>()
      list.set(c.id, c) // a duplicate id is one member
      groups.set(c.groupId, list)
    }
  }
  const units: DrawCandidate[][] = [...singles]
  for (const map of groups.values()) {
    const members = [...map.values()]
    const size = members[0]?.groupSize
    // A missing size (untyped caller) or a member count that is not the group's size: the whole group is out, never half drawn.
    if (typeof size !== 'number' || members.some((m) => m.groupSize !== size) || members.length !== size) continue
    units.push([...members].sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0) || a.id.localeCompare(b.id, undefined, { numeric: true })))
  }
  for (let i = units.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1))
    const tmp = units[i] as DrawCandidate[]
    units[i] = units[j] as DrawCandidate[]
    units[j] = tmp
  }
  const out: string[] = []
  for (const unit of units) {
    if (out.length + unit.length > n) continue
    for (const m of unit) out.push(m.id)
    if (out.length === n) break
  }
  return out
}
