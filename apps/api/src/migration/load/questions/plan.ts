/**
 * The rajah planner (T-B9-3, design v2-question-bank-migration.md section 7). PURE and deterministic: the same rows give the same plan
 * (stable order by subject, level, id), so a dry-run, an apply and a re-run agree. No I/O here; `plan-source.ts` reads the rows, `groups.ts`
 * writes the plan.
 *
 * PO core rule: V2's defect is repaired, never copied. When two or more questions refer to the same rajah, V2 showed the image on the first
 * only, and sometimes the rajah was stored as its own "question". In V3 a rajah is only the stimulus of a group: carrier rows are absorbed
 * (never loaded as a question), every member shows the rajah, members keep V2 order. What cannot be decided from the data is loaded as it
 * is, so the V3 detectors flag it (`stimulus_missing`) and it lands in the Regroup / Audit Rajah work-lists and is never served.
 *
 * Every reference test uses `figureKeys` and `stimulusReferenceOf` of `modules/intake/workflow/figure-links.ts`: there is no second keyword set.
 *
 * Confidence (section 7.4): High -> auto-group. Medium -> approved class: NOT grouped (held for the admin, one click in Regroup), pending
 * and archived classes: grouped (no pupil impact). Low -> never grouped. A group is formed within one lifecycle class (OC-2): classes that
 * share a rajah get separate groups on the SAME stimulus row.
 */
import { createHash } from 'node:crypto'

import { detectStimulusFlag, type FlagInput, type StimulusFlagResult } from '../../../modules/questions/effective-leaf'
import { figureKeys, stimulusReferenceOf } from '../../../modules/intake/workflow/figure-links'
import type { LifecycleClass } from '../../transform/question-bank'

export const PLAN_RULES_VERSION = 'rajah-1'
/** At most this many questions in one group (`STIMULUS_LIMITS.groupQuestions`); a longer run is cut and the rest left for the unresolved list. */
export const MAX_GROUP_MEMBERS = 40
/** A carrier caption is at most this long (section 7.2, S2). */
export const CARRIER_MAX_CHARS = 160
/** A text-only carrier (a passage) is at least this long, so a stray short row is never taken for a passage. */
export const PASSAGE_MIN_CHARS = 60
/** Shared-image rows are one run only when no more than this many rows lie between them (S5). */
export const IMAGE_RUN_WINDOW = 10
/** Unrelated rows tolerated between the members of a Medium group (step 3). */
export const MAX_GAP = 3

export type StimulusKind = 'passage' | 'image' | 'diagram' | 'table' | 'graph' | 'map' | 'infographic'
export type Confidence = 'high' | 'medium'

export interface RajahRow {
  /** V2 `questions.id` (digits). */
  id: string
  /** The id as a number, for ordering. */
  n: number
  subject: string
  level: string
  cls: LifecycleClass
  /** `image_path`, trimmed, or null. */
  image: string | null
  /** The stem as plain text. */
  stem: string
  /** The option texts, trimmed, empty ones removed. */
  optionTexts: readonly string[]
  /** The transform loads this row as a question (a carrier is by definition not loadable). */
  loadable: boolean
  createdMs: number | null
  externalRef: string | null
}

export interface StimulusSpec {
  /** `c:<carrier id>`, `o:<owner id>`, `x:<lowest id>` (shared image) or `s:<V2 stimuli id>` (canonical). The id-map key of `question_stimuli`. */
  key: string
  kind: StimulusKind
  /** "Rajah 1". */
  label: string | null
  caption: string | null
  bodyText: string | null
  altText: string | null
  imagePath: string | null
}

/** S1: a legacy question linked to a canonical stimulus. */
export interface CanonicalLink {
  stimulusKey: string
  legacyId: string
  position: number
  /** How many exam questions link the stimulus in V2 (two or more make it a group). */
  examQuestionCount: number
}

export interface PlanInput {
  rows: readonly RajahRow[]
  canonicalStimuli?: ReadonlyMap<string, StimulusSpec>
  canonicalLinks?: readonly CanonicalLink[]
}

export interface PlannedGroup {
  /** `g:<lowest member id>:<class>`: the id-map key of `stimulus_groups`. */
  key: string
  cls: LifecycleClass
  confidence: Confidence
  signals: string[]
  stimulusKey: string
  /** Question ids in V2 order (loadable rows only). */
  members: string[]
  subject: string
  level: string
}

export interface HeldCandidate {
  cls: LifecycleClass
  signals: string[]
  /** The stimulus an admin attaches (a carrier), or null when the image owner keeps its own image. */
  stimulusKey: string | null
  members: string[]
}

export interface PlanSummary {
  groupsByConfidenceAndClass: Record<string, number>
  membersHistogram: Record<string, number>
  carriersAbsorbed: number
  unattachedStimuli: number
  heldCandidates: number
  heldCandidateMembers: number
  unresolvedByClass: Record<string, number>
  /** Approved questions the detectors will flag after the load: the V-8 figure. */
  predictedFlaggedApproved: number
  predictedFlaggedByClass: Record<string, number>
}

export interface RajahPlan {
  stimuli: Map<string, StimulusSpec>
  groups: PlannedGroup[]
  held: HeldCandidate[]
  /** Carrier id -> stimulus key (the carrier is never a question). */
  absorbed: Map<string, string>
  /** Stimulus keys with no group (a carrier without usable followers, or one whose approved followers are held). */
  unattached: string[]
  /** Loadable rows that name a figure and have no group and no image of their own, by id. */
  unresolved: { id: string; ref: 'numbered' | 'unnumbered'; cls: LifecycleClass }[]
  /** Question id -> group key. */
  memberGroup: Map<string, string>
  /** Question id -> stimulus key, for a question that keeps its own stem link to a shared stimulus (an image owner alone in its class). */
  ownerStimulus: Map<string, string>
  /** Question ids that supply their image to a group (their own stem image is not written again). */
  imageDropped: Set<string>
  /** Predicted detector verdict per loadable id (only the flagged ones). */
  predictedFlags: Map<string, StimulusFlagResult>
  summary: PlanSummary
  hash: string
}

// --- text helpers ---------------------------------------------------------------------------------------------------------------

const FIGURE_START = /^\s*(?:gambar\s+rajah|gambar|rajah|figure|diagram|jadual|table|graf|graph|carta|chart|peta|map)\s*\d{1,3}(?:\.\d{1,2})?(?![\p{N}])/iu
const CUE = /(?<![\p{L}])(?:nyatakan|hitung|hitungkan|apakah|yang\s+manakah|berdasarkan|calculate|state|which|what)(?![\p{L}])/iu

const allText = (r: RajahRow): string => [r.stem, ...r.optionTexts].join(' ')
const keysOf = (r: RajahRow): string[] => figureKeys(allText(r))

/** Caption-only row (S2): short, starts with a figure word and number, no question or instruction cue, fewer than 2 usable options. */
export function isFigureCarrier(r: RajahRow): boolean {
  const t = r.stem.trim()
  return r.optionTexts.length < 2 && t.length > 0 && t.length <= CARRIER_MAX_CHARS && FIGURE_START.test(t) && !t.includes('?') && !CUE.test(t)
}

/** A long text with fewer than 2 usable options, no question mark and no cue: the passage of a group (followers use unnumbered references). */
export function isPassageCarrier(r: RajahRow): boolean {
  const t = r.stem.trim()
  return r.optionTexts.length < 2 && !isFigureCarrier(r) && t.length >= PASSAGE_MIN_CHARS && !t.includes('?') && !CUE.test(t)
}

const isCarrier = (r: RajahRow): boolean => isFigureCarrier(r) || isPassageCarrier(r)

/** The kind of stimulus a text of a figure word stands for (an image decides the carrier of the picture). */
export function kindOfFigureText(text: string): StimulusKind {
  const m = /(?<![\p{L}])(gambar\s+rajah|rajah|figure|diagram|infographic|infografik|jadual|table|graf|graph|carta|chart|peta|map)(?![\p{L}])/iu.exec(text)
  const w = (m?.[1] ?? '').toLowerCase().replace(/\s+/g, ' ')
  if (w === '') return 'image'
  if (w === 'rajah' || w === 'gambar rajah' || w === 'figure' || w === 'diagram') return 'diagram'
  if (w === 'graf' || w === 'graph' || w === 'carta' || w === 'chart') return 'graph'
  if (w === 'peta' || w === 'map') return 'map'
  if (w === 'jadual' || w === 'table') return 'table'
  return 'infographic'
}

/** "Rajah 1" and the rest of the caption of a figure carrier; the label is the figure phrase as written, at most 60 characters. */
function captionParts(stem: string): { label: string | null; caption: string | null } {
  const m = FIGURE_START.exec(stem)
  if (m === null) return { label: null, caption: stem.trim() === '' ? null : stem.trim() }
  const label = m[0].trim().replace(/\s+/g, ' ').slice(0, 60)
  const rest = stem.slice(m[0].length).replace(/^[\s.:\-–]+/, '').trim()
  return { label, caption: rest === '' ? null : rest }
}

function carrierStimulus(r: RajahRow): StimulusSpec {
  if (isFigureCarrier(r)) {
    const { label, caption } = captionParts(r.stem)
    return { key: `c:${r.id}`, kind: kindOfFigureText(r.stem), label, caption, bodyText: null, altText: r.stem.trim(), imagePath: r.image }
  }
  return { key: `c:${r.id}`, kind: 'passage', label: null, caption: null, bodyText: r.stem.trim(), altText: null, imagePath: r.image }
}

function imageStimulus(key: string, owner: RajahRow, label: string | null): StimulusSpec {
  return { key, kind: kindOfFigureText(owner.stem), label, caption: null, bodyText: null, altText: null, imagePath: owner.image }
}

// --- detector twin --------------------------------------------------------------------------------------------------------------

/**
 * The V3 detector verdict of a question as the loader writes it (one leaf; a group or any image counts as a stimulus). The load and the
 * prediction both call this, and it calls `detectStimulusFlag`, the ONE place the flag is decided.
 * The loaded leaf prompt is empty: the text is written once, in the stem, so stem_duplicated never fires.
 */
export function flagOfLoaded(input: { stem: string; optionTexts: readonly string[]; hasGroup: boolean; hasStemStimulus: boolean }): StimulusFlagResult | null {
  const flagInput: FlagInput = {
    stemMs: input.stem,
    stemEn: null,
    hasGroup: input.hasGroup,
    hasStemStimulus: input.hasStemStimulus,
    parts: [{ isLeaf: true, promptMs: '', promptEn: null, optionTexts: input.optionTexts, hasStimulus: false, hasOptionImage: false }],
  }
  return detectStimulusFlag(flagInput)
}

// --- the planner ----------------------------------------------------------------------------------------------------------------

interface Cluster {
  stimulus: StimulusSpec
  carrierId: string | null
  ownerId: string | null
  confidence: Confidence
  signals: string[]
  /** Member rows in V2 order (any loadable state; filtered at tiering). */
  members: RajahRow[]
}

const CLASS_ORDER: readonly LifecycleClass[] = ['approved', 'pending', 'archived']

const byId = (a: RajahRow, b: RajahRow): number => a.n - b.n || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function planRajah(input: PlanInput): RajahPlan {
  const sorted = [...input.rows].sort((a, b) => (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : a.level < b.level ? -1 : a.level > b.level ? 1 : byId(a, b)))
  const byRowId = new Map(sorted.map((r) => [r.id, r]))
  const used = new Set<string>()
  const clusters: Cluster[] = []

  // Step 1 (S1): canonical stimuli linked by two or more exam questions. The strongest signal; their members leave the later steps.
  const links = input.canonicalLinks ?? []
  const linkedBy = new Map<string, CanonicalLink[]>()
  for (const l of links) {
    if (l.examQuestionCount < 2 || !byRowId.has(l.legacyId)) continue
    const list = linkedBy.get(l.stimulusKey)
    if (list) list.push(l)
    else linkedBy.set(l.stimulusKey, [l])
  }
  for (const key of [...linkedBy.keys()].sort()) {
    const spec = input.canonicalStimuli?.get(key)
    if (spec === undefined) continue
    const list = (linkedBy.get(key) as CanonicalLink[]).filter((l) => !used.has(l.legacyId))
    // One subject per group: a canonical stimulus shared across subjects is split by subject.
    const bySubject = new Map<string, RajahRow[]>()
    for (const l of [...list].sort((a, b) => a.position - b.position || Number(a.legacyId) - Number(b.legacyId))) {
      const r = byRowId.get(l.legacyId) as RajahRow
      const arr = bySubject.get(r.subject)
      if (arr) arr.push(r)
      else bySubject.set(r.subject, [r])
    }
    for (const members of bySubject.values()) {
      for (const m of members) used.add(m.id)
      clusters.push({ stimulus: spec, carrierId: null, ownerId: null, confidence: 'high', signals: ['S1'], members })
    }
  }

  // Partitions (subject, level), each ordered by id (the order of `sorted`).
  const partitions = new Map<string, RajahRow[]>()
  for (const r of sorted) {
    const k = `${r.subject}|${r.level}`
    const arr = partitions.get(k)
    if (arr) arr.push(r)
    else partitions.set(k, [r])
  }

  for (const seq of partitions.values()) {
    const index = new Map(seq.map((r, i) => [r.id, i]))
    // Steps 2 and 3: carrier groups, then an image-bearing first member with same-key followers.
    for (let i = 0; i < seq.length; i += 1) {
      const row = seq[i] as RajahRow
      if (used.has(row.id)) continue
      if (isCarrier(row)) {
        const cluster = carrierCluster(seq, i, used)
        if (cluster !== null) clusters.push(cluster)
        continue
      }
      if (row.image !== null) {
        const cluster = ownerCluster(seq, i, used)
        if (cluster !== null) clusters.push(cluster)
      }
    }
    // Step 4 (S5): the same image on two or more rows within a short run.
    const byImage = new Map<string, RajahRow[]>()
    for (const r of seq) {
      if (r.image === null || used.has(r.id) || isCarrier(r)) continue
      const arr = byImage.get(r.image)
      if (arr) arr.push(r)
      else byImage.set(r.image, [r])
    }
    for (const list of byImage.values()) {
      if (list.length < 2) continue
      let run: RajahRow[] = []
      const flush = (): void => {
        if (run.length >= 2) {
          const first = run[0] as RajahRow
          const idxs = run.map((r) => index.get(r.id) as number)
          const adjacent = idxs.every((x, k) => k === 0 || x === (idxs[k - 1] as number) + 1)
          const shared = run.map(keysOf).reduce<string[]>((acc, ks, k) => (k === 0 ? ks : acc.filter((x) => ks.includes(x))), [])
          const signals = ['S5']
          if (shared.length > 0) signals.push('S3')
          if (adjacent) signals.push('S6')
          const confidence: Confidence = adjacent || shared.length > 0 ? 'high' : 'medium'
          for (const chunk of chunks(run, MAX_GROUP_MEMBERS)) {
            for (const m of chunk) used.add(m.id)
            clusters.push({
              stimulus: imageStimulus(`x:${(chunk[0] as RajahRow).id}`, first, shared[0] === undefined ? null : labelOfKey(shared[0])),
              carrierId: null,
              ownerId: null,
              confidence,
              signals,
              members: chunk,
            })
          }
        }
        run = []
      }
      for (const r of list) {
        const prev = run[run.length - 1]
        if (prev === undefined || (index.get(r.id) as number) - (index.get(prev.id) as number) <= IMAGE_RUN_WINDOW) run.push(r)
        else {
          flush()
          run = [r]
        }
      }
      flush()
    }
  }

  return tier(sorted, clusters, byRowId)
}

const labelOfKey = (key: string): string => {
  const m = /^([a-z]+)(.*)$/.exec(key)
  return m === null ? key : `${(m[1] as string).charAt(0).toUpperCase()}${(m[1] as string).slice(1)} ${m[2] as string}`
}

function* chunks<T>(list: readonly T[], size: number): Generator<T[]> {
  for (let i = 0; i < list.length; i += size) yield list.slice(i, i + size)
}

/** Step 2: the followers of a carrier row; null when the carrier is the last of the partition and nothing follows (it is still absorbed: see `carrierOnly`). */
function carrierCluster(seq: readonly RajahRow[], at: number, used: Set<string>): Cluster | null {
  const carrier = seq[at] as RajahRow
  const stimulus = carrierStimulus(carrier)
  const figureCarrier = isFigureCarrier(carrier)
  const carrierKeys = figureCarrier ? figureKeys(carrier.stem) : []
  const run: RajahRow[] = []
  used.add(carrier.id)
  for (let j = at + 1; j < seq.length && run.length < MAX_GROUP_MEMBERS; j += 1) {
    const r = seq[j] as RajahRow
    if (used.has(r.id) || isCarrier(r)) break
    const keys = keysOf(r)
    const sameKey = carrierKeys.length > 0 && keys.some((k) => carrierKeys.includes(k))
    const otherKey = keys.length > 0 && !sameKey
    const ownImage = r.image !== null
    if (sameKey) {
      // The follower names our figure. A different picture of its own is a different figure: stop.
      if (ownImage && r.image !== carrier.image) break
      run.push(r)
      continue
    }
    if (otherKey) break
    const unnumbered = !ownImage && stimulusReferenceOf(allText(r))?.kind === 'unnumbered'
    // A figure carrier takes unnumbered followers only after a numbered one; a passage carrier has no number, so its first follower is unnumbered.
    if (unnumbered && (run.length > 0 || !figureCarrier)) {
      run.push(r)
      continue
    }
    break
  }
  for (const r of run) used.add(r.id)
  const loadable = run.filter((r) => r.loadable)
  const signals = ['S2', figureCarrier ? 'S3' : 'S4']
  let confidence: Confidence = 'medium'
  if (figureCarrier) {
    // An image on the carrier and one follower; a caption with no picture is only a Medium hint (the picture was never stored in V2).
    if (carrier.image !== null && loadable.length >= 1) confidence = 'high'
  } else if (loadable.length >= 2) confidence = 'high'
  if (carrier.image !== null) signals.push('S5')
  return { stimulus, carrierId: carrier.id, ownerId: null, confidence, signals, members: run }
}

/** Step 3: a row with an image and a numbered reference, followed by rows of the same key with no image of their own. Null when nobody follows. */
function ownerCluster(seq: readonly RajahRow[], at: number, used: Set<string>): Cluster | null {
  const owner = seq[at] as RajahRow
  const ownerKey = figureKeys(owner.stem)[0] ?? keysOf(owner)[0]
  if (ownerKey === undefined) return null
  const matches = (r: RajahRow): boolean => !used.has(r.id) && !isCarrier(r) && (r.image === null || r.image === owner.image) && keysOf(r).includes(ownerKey)
  const members: RajahRow[] = [owner]
  let usedGap = false
  let j = at + 1
  while (j < seq.length && members.length < MAX_GROUP_MEMBERS) {
    const r = seq[j] as RajahRow
    if (matches(r)) {
      members.push(r)
      j += 1
      continue
    }
    if (used.has(r.id) || isCarrier(r)) break
    // An unrelated plain row (no picture, no figure of its own) may sit between members, at most MAX_GAP of them, and only when a member follows.
    let k = j
    let skipped = 0
    while (k < seq.length && skipped <= MAX_GAP) {
      const g = seq[k] as RajahRow
      if (matches(g)) break
      if (used.has(g.id) || isCarrier(g) || g.image !== null || keysOf(g).length > 0) {
        k = seq.length
        break
      }
      skipped += 1
      k += 1
    }
    if (k >= seq.length || skipped > MAX_GAP || !matches(seq[k] as RajahRow)) break
    usedGap = true
    j = k
  }
  if (members.length < 2) return null
  for (const m of members) used.add(m.id)
  const signals = ['S3', 'S5']
  return {
    stimulus: imageStimulus(`o:${owner.id}`, owner, labelOfKey(ownerKey)),
    carrierId: null,
    ownerId: owner.id,
    confidence: usedGap ? 'medium' : 'high',
    signals,
    members,
  }
}

/** Splits every cluster by lifecycle class, applies the confidence tiers, and builds the plan. */
function tier(sorted: readonly RajahRow[], clusters: readonly Cluster[], byRowId: ReadonlyMap<string, RajahRow>): RajahPlan {
  const stimuli = new Map<string, StimulusSpec>()
  const groups: PlannedGroup[] = []
  const held: HeldCandidate[] = []
  const absorbed = new Map<string, string>()
  const unattachedSet = new Set<string>()
  const memberGroup = new Map<string, string>()
  const ownerStimulus = new Map<string, string>()
  const imageDropped = new Set<string>()

  const ordered = [...clusters].sort((a, b) => {
    const ka = (a.members[0] ?? { n: 0 }).n
    const kb = (b.members[0] ?? { n: 0 }).n
    return ka - kb || (a.stimulus.key < b.stimulus.key ? -1 : a.stimulus.key > b.stimulus.key ? 1 : 0)
  })
  for (const c of ordered) {
    const confidence = c.confidence
    if (c.carrierId !== null) absorbed.set(c.carrierId, c.stimulus.key)
    const loadable = c.members.filter((m) => m.loadable)
    let grouped = false
    let usedStimulus = false
    for (const cls of CLASS_ORDER) {
      const inClass = loadable.filter((m) => m.cls === cls)
      if (inClass.length === 0) continue
      const asGroup = confidence === 'high' || cls !== 'approved'
      if (!asGroup) {
        held.push({ cls, signals: c.signals, stimulusKey: c.carrierId !== null ? c.stimulus.key : null, members: inClass.map((m) => m.id) })
        continue
      }
      // The image owner alone in its class keeps a stem link to the shared stimulus: a group of one owner that nobody else shares is no group.
      if (c.ownerId !== null && inClass.length === 1 && (inClass[0] as RajahRow).id === c.ownerId) {
        ownerStimulus.set(c.ownerId, c.stimulus.key)
        usedStimulus = true
        continue
      }
      for (const chunk of chunks(inClass, MAX_GROUP_MEMBERS)) {
        const first = chunk[0] as RajahRow
        const key = `g:${first.id}:${cls}`
        groups.push({
          key,
          cls,
          confidence,
          signals: c.signals,
          stimulusKey: c.stimulus.key,
          members: chunk.map((m) => m.id),
          subject: first.subject,
          level: first.level,
        })
        for (const m of chunk) {
          memberGroup.set(m.id, key)
          // The group supplies the picture: the member's own copy of the same image is not written again.
          if (m.image !== null && (c.ownerId === m.id || m.image === c.stimulus.imagePath)) imageDropped.add(m.id)
        }
        grouped = true
        usedStimulus = true
      }
    }
    // An owner whose image is shared with a group in another class still links it as its own stem stimulus (handled above); a stimulus nobody uses is dropped,
    // except a carrier's: the rajah is kept as an unattached stimulus for the admin (Regroup with `stimulusId`).
    if (c.carrierId !== null) {
      stimuli.set(c.stimulus.key, c.stimulus)
      if (!grouped) unattachedSet.add(c.stimulus.key)
    } else if (usedStimulus) {
      stimuli.set(c.stimulus.key, c.stimulus)
    }
  }
  // An owner that only appears in a held (approved) candidate keeps its own image: no shared stimulus is planned for it.
  for (const g of groups) if (!stimuli.has(g.stimulusKey)) throw new Error(`plan: group ${g.key} has no stimulus`)

  // Unresolved: loadable rows that the detector will flag after the load (they name a figure and show none).
  const unresolved: RajahPlan['unresolved'] = []
  const predictedFlags = new Map<string, StimulusFlagResult>()
  const predictedByClass: Record<string, number> = {}
  for (const r of sorted) {
    if (!r.loadable) continue
    const flag = flagOfLoaded({
      stem: r.stem,
      optionTexts: r.optionTexts,
      hasGroup: memberGroup.has(r.id),
      hasStemStimulus: r.image !== null || ownerStimulus.has(r.id),
    })
    if (flag === null) continue
    predictedFlags.set(r.id, flag)
    if (flag.flag === 'stimulus_missing' || flag.flag === 'figure_only') {
      predictedByClass[r.cls] = (predictedByClass[r.cls] ?? 0) + 1
      unresolved.push({ id: r.id, ref: flag.ref ?? 'numbered', cls: r.cls })
    }
  }
  void byRowId

  const summary = summarise(groups, held, absorbed, unattachedSet, unresolved, predictedByClass)
  const plan: RajahPlan = {
    stimuli,
    groups,
    held,
    absorbed,
    unattached: [...unattachedSet].sort(),
    unresolved,
    memberGroup,
    ownerStimulus,
    imageDropped,
    predictedFlags,
    summary,
    hash: '',
  }
  plan.hash = hashPlan(plan)
  return plan
}

function summarise(
  groups: readonly PlannedGroup[],
  held: readonly HeldCandidate[],
  absorbed: ReadonlyMap<string, string>,
  unattached: ReadonlySet<string>,
  unresolved: RajahPlan['unresolved'],
  flaggedByClass: Record<string, number>,
): PlanSummary {
  const groupsBy: Record<string, number> = {}
  const histogram: Record<string, number> = {}
  for (const g of groups) {
    groupsBy[`${g.confidence}.${g.cls}`] = (groupsBy[`${g.confidence}.${g.cls}`] ?? 0) + 1
    const bucket = g.members.length >= 10 ? '10+' : String(g.members.length)
    histogram[bucket] = (histogram[bucket] ?? 0) + 1
  }
  const unresolvedBy: Record<string, number> = {}
  for (const u of unresolved) unresolvedBy[u.cls] = (unresolvedBy[u.cls] ?? 0) + 1
  return {
    groupsByConfidenceAndClass: groupsBy,
    membersHistogram: histogram,
    carriersAbsorbed: absorbed.size,
    unattachedStimuli: unattached.size,
    heldCandidates: held.length,
    heldCandidateMembers: held.reduce((s, h) => s + h.members.length, 0),
    unresolvedByClass: unresolvedBy,
    predictedFlaggedApproved: flaggedByClass.approved ?? 0,
    predictedFlaggedByClass: flaggedByClass,
  }
}

/** sha256 of everything the load reads from the plan, in a fixed order (ids, keys and kinds only). */
export function hashPlan(plan: Omit<RajahPlan, 'hash'> | RajahPlan): string {
  const h = createHash('sha256')
  h.update(PLAN_RULES_VERSION)
  for (const g of [...plan.groups].sort((a, b) => (a.key < b.key ? -1 : 1))) h.update(`\ng|${g.key}|${g.cls}|${g.confidence}|${g.stimulusKey}|${g.members.join(',')}`)
  for (const [c, s] of [...plan.absorbed].sort(([a], [b]) => (a < b ? -1 : 1))) h.update(`\na|${c}|${s}`)
  for (const [k, s] of [...plan.stimuli].sort(([a], [b]) => (a < b ? -1 : 1))) h.update(`\ns|${k}|${s.kind}|${s.imagePath ?? ''}`)
  for (const [q, s] of [...plan.ownerStimulus].sort(([a], [b]) => (a < b ? -1 : 1))) h.update(`\no|${q}|${s}`)
  for (const x of plan.held) h.update(`\nh|${x.cls}|${x.stimulusKey ?? ''}|${x.members.join(',')}`)
  for (const u of plan.unattached) h.update(`\nu|${u}`)
  return h.digest('hex')
}

/** The plan file lines (`rajah-plan-<run>.ndjson`): ids, keys, tiers and signals only, never a text. */
export function planFileLines(plan: RajahPlan, meta: { rules: string; inputHash: string }): string[] {
  const lines: unknown[] = [{ t: 'meta', rules: meta.rules, planRules: PLAN_RULES_VERSION, planHash: plan.hash, inputHash: meta.inputHash, summary: plan.summary }]
  for (const g of plan.groups) lines.push({ t: 'group', key: g.key, cls: g.cls, confidence: g.confidence, signals: g.signals, stimulus: g.stimulusKey, members: g.members })
  for (const [carrier, stimulus] of [...plan.absorbed].sort(([a], [b]) => Number(a) - Number(b))) lines.push({ t: 'absorbed', carrier, stimulus })
  for (const u of plan.unattached) lines.push({ t: 'unattached', stimulus: u })
  for (const x of plan.held) lines.push({ t: 'held', cls: x.cls, signals: x.signals, stimulus: x.stimulusKey, members: x.members })
  for (const u of plan.unresolved) lines.push({ t: 'unresolved', id: u.id, ref: u.ref, cls: u.cls })
  return lines.map((l) => JSON.stringify(l))
}
