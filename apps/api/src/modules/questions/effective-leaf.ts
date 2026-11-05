/**
 * BJS-06 (v2-bijak-spm-standards 3.1, 3.1a): effective per-leaf values. A leaf part's TP, unit and form origin
 * are its own override, else the question version's value (`coalesce(part, version)`). The question TP is the
 * maximum over its leaves and marks per unit are summed per leaf; nothing here is stored (no drift).
 * Cognitive level / KBAT is intentionally absent until the KBAT encoding is decided (decision A9).
 */
import { Prisma } from '../../db/generated/client'
import type { PrismaClient, TxClient } from '../../db/client'
import { idToString } from '../../db/ids'
import { stimulusReferenceOf } from '../intake/workflow/figure-links'

export interface EffectiveLeaf {
  partId: string
  versionId: string
  marks: number
  /** Effective TP 1..6, or null when neither the part nor the version has one. */
  tp: number | null
  /** Effective unit node id (decimal string), or null. */
  unitNodeId: string | null
  formOrigin: 't1_t3' | 't4' | 't5' | null
  /** Effective KBAT: the part override ('bukan' wins over a KBAT question), else the question's; null = Bukan KBAT. */
  kbat: KbatLevel | null
}

export type KbatLevel = 'mengaplikasi' | 'menganalisis' | 'menilai' | 'mencipta'
const KBAT_LEVELS: readonly string[] = ['mengaplikasi', 'menganalisis', 'menilai', 'mencipta']
/** The KBAT value that goes with a cognitive level (R1-B05, D76): the four upper levels are KBAT, mengingat and memahami are not. */
export function kbatOfCognitive(level: string | null | undefined): KbatLevel | 'bukan' | null {
  if (level == null) return null
  return level === 'mengaplikasi' || level === 'menganalisis' || level === 'menilai' || level === 'mencipta' ? level : 'bukan'
}
export const kbatOf = (v: string | null): KbatLevel | null => (v !== null && KBAT_LEVELS.includes(v) ? (v as KbatLevel) : null)

/**
 * The effective-value SQL: one row per leaf part (a leaf is a part with a `mode`) of the given versions.
 * The only place the coalesce rule lives in SQL; pool sources join or reuse this fragment.
 */
export function effectiveLeavesSql(versionIds: readonly bigint[]): Prisma.Sql {
  return Prisma.sql`
    SELECT p.id AS part_id,
           p.question_version_id AS version_id,
           p.marks AS marks,
           coalesce(p.difficulty_tp, v.difficulty_tp) AS tp,
           coalesce(p.unit_node_id, v.unit_node_id) AS unit_node_id,
           coalesce(p.form_origin, v.form_origin) AS form_origin,
           CASE coalesce(p.kbat, v.kbat) WHEN 'bukan' THEN NULL ELSE coalesce(p.kbat, v.kbat) END AS kbat
      FROM question_parts p
      JOIN question_versions v ON v.id = p.question_version_id
     WHERE p.mode IS NOT NULL
       AND p.question_version_id IN (${Prisma.join(versionIds.length > 0 ? [...versionIds] : [BigInt(-1)])})
     ORDER BY p.question_version_id, p.id`
}

/**
 * Bank filter `missing` (15.7): the question has a leaf part lacking the EFFECTIVE value (after inheritance).
 * `unit`: no effective unit and an effective form origin other than t1_t3 (that bucket needs no unit).
 */
export function missingLeafSql(missing: 'unit' | 'tp' | 'marks' | 'key'): Prisma.Sql {
  const lacking =
    missing === 'unit'
      ? Prisma.sql`coalesce(p.unit_node_id, v.unit_node_id) IS NULL AND coalesce(p.form_origin, v.form_origin) IS DISTINCT FROM 't1_t3'`
      : missing === 'tp'
        ? Prisma.sql`coalesce(p.difficulty_tp, v.difficulty_tp) IS NULL`
        : missing === 'marks'
          ? Prisma.sql`(p.marks IS NULL OR p.marks < 1)`
          : Prisma.sql`NOT EXISTS (SELECT 1 FROM answer_keys k WHERE k.part_id = p.id)`
  return Prisma.sql`EXISTS (SELECT 1 FROM question_parts p WHERE p.question_version_id = v.id AND p.mode IS NOT NULL AND ${lacking})`
}

interface EffectiveRow {
  part_id: bigint
  version_id: bigint
  marks: number | null
  tp: number | null
  unit_node_id: bigint | null
  form_origin: string | null
  kbat: string | null
}

export const effectiveLeafOf = (r: EffectiveRow): EffectiveLeaf => ({
  partId: idToString(r.part_id),
  versionId: idToString(r.version_id),
  marks: r.marks ?? 0,
  tp: r.tp,
  unitNodeId: r.unit_node_id === null ? null : idToString(r.unit_node_id),
  formOrigin: r.form_origin === 't1_t3' || r.form_origin === 't4' || r.form_origin === 't5' ? r.form_origin : null,
  kbat: kbatOf(r.kbat),
})

/** Runs the helper against any Prisma client / transaction. */
export async function loadEffectiveLeaves(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  versionIds: readonly bigint[],
): Promise<EffectiveLeaf[]> {
  if (versionIds.length === 0) return []
  const rows = await db.$queryRaw<EffectiveRow[]>(effectiveLeavesSql(versionIds))
  return rows.map(effectiveLeafOf)
}

/** Question TP = maximum effective TP over its leaves; null when no leaf has one. */
export function questionTp(leaves: readonly EffectiveLeaf[]): number | null {
  let best: number | null = null
  for (const l of leaves) if (l.tp !== null && (best === null || l.tp > best)) best = l.tp
  return best
}

/** KBAT marks of a question: the marks of the leaves whose effective kbat is one of the four levels. */
export function kbatMarks(leaves: readonly EffectiveLeaf[]): number {
  return leaves.reduce((s, l) => (l.kbat === null ? s : s + l.marks), 0)
}

/** Marks per effective unit (marks-basis quota); leaves without a unit land under the key `null`. */
export function unitMarks(leaves: readonly EffectiveLeaf[]): Map<string | null, number> {
  const out = new Map<string | null, number>()
  for (const l of leaves) out.set(l.unitNodeId, (out.get(l.unitNodeId) ?? 0) + l.marks)
  return out
}

// --- S1-T07 (DM-05, DM-53): the stimulus flag detectors ---------------------------------------------------------------------------

export type StimulusFlag = 'stimulus_missing' | 'figure_only' | 'stem_duplicated'
export type StimulusFlagRef = 'numbered' | 'unnumbered'

/** A part of the tree, flattened, as the detectors read it. */
export interface FlagPart {
  /** A leaf part (it has a `mode`). */
  isLeaf: boolean
  promptMs: string | null
  promptEn: string | null
  /** Option texts (Malay and English) of the part; empty strings are allowed. */
  optionTexts: readonly (string | null)[]
  /** The part links a stimulus, or one of its options has a picture. */
  hasStimulus: boolean
  hasOptionImage: boolean
}

export interface FlagInput {
  stemMs: string | null
  stemEn: string | null
  /** The question belongs to a stimulus group. */
  hasGroup: boolean
  /** The version links at least one stimulus: a stem image (the flat stem image is an image stimulus). */
  hasStemStimulus: boolean
  parts: readonly FlagPart[]
}

export interface StimulusFlagResult {
  flag: StimulusFlag
  /** Set with `stimulus_missing` only. */
  ref: StimulusFlagRef | null
}

const blank = (s: string | null | undefined): boolean => s == null || s.trim() === ''
const squash = (s: string): string => s.trim().replace(/\s+/g, ' ')

/**
 * The three detectors of 50 DM-05 (pure; the ONE place the flag is decided). One flag per version; when two apply the excluding one wins
 * (`figure_only`, then `stimulus_missing`, then `stem_duplicated`):
 *  - `figure_only`: an image on the stem, no group, the stem empty after trimming, no text in any part prompt and no option text (a bare figure
 *    imported as a question; 45 6.6.1 "no question sentence, no options");
 *  - `stimulus_missing`: no group, no stimulus and no image anywhere, and the stem, a part prompt or an option names a figure
 *    (`stimulusReferenceOf`, the keyword code of `figure-links.ts`: "Rajah 14", "Jadual 2", "Graf", whole word, case-insensitive);
 *  - `stem_duplicated`: the question has exactly one leaf and its prompt equals the stem after trimming and collapsing spaces.
 */
export function detectStimulusFlag(input: FlagInput): StimulusFlagResult | null {
  const prompts = input.parts.flatMap((p) => [p.promptMs, p.promptEn])
  const options = input.parts.flatMap((p) => p.optionTexts)
  const attached = input.hasGroup || input.hasStemStimulus || input.parts.some((p) => p.hasStimulus || p.hasOptionImage)

  if (!input.hasGroup && input.hasStemStimulus && blank(input.stemMs) && blank(input.stemEn) && prompts.every(blank) && options.every(blank)) {
    return { flag: 'figure_only', ref: null }
  }
  if (!attached) {
    const texts = [input.stemMs, input.stemEn, ...prompts, ...options]
    for (const t of texts) {
      if (t == null) continue
      const ref = stimulusReferenceOf(t)
      if (ref !== null) return { flag: 'stimulus_missing', ref: ref.kind }
    }
  }
  const leaves = input.parts.filter((p) => p.isLeaf)
  const only = leaves.length === 1 ? leaves[0] : undefined
  if (only !== undefined) {
    const same = (stem: string | null, prompt: string | null): boolean => !blank(stem) && !blank(prompt) && squash(stem as string) === squash(prompt as string)
    if (same(input.stemMs, only.promptMs) || same(input.stemEn, only.promptEn)) return { flag: 'stem_duplicated', ref: null }
  }
  return null
}

/**
 * DM-05 / DM-53: runs the detectors on one stored version and writes `stimulus_flag`, `stimulus_flag_ref` and `stimulus_flag_at`. Every write path
 * calls it (create, new version, rewrite, approve, group attach / detach, see `QuestionsRepository` and `StimuliRepository`), so the stored flag
 * never drifts; the backfill script `uat-ops/flag-stimulus.ts` calls it too. A flag that stays the same keeps its dismissal ("Bukan masalah");
 * a changed or cleared flag drops it (a new problem needs a new dismissal). Returns the flag now stored.
 */
export async function refreshStimulusFlag(db: TxClient | PrismaClient, questionId: bigint, versionNo: number, now: Date): Promise<StimulusFlag | null> {
  const v = await db.questionVersion.findUnique({ where: { questionId_versionNo: { questionId, versionNo } }, include: FLAG_INCLUDE })
  if (!v) return null
  const found = detectStimulusFlag(flagInputOfRow(v))
  const flag = found?.flag ?? null
  const ref = found?.ref ?? null
  if (flag === v.stimulusFlag && ref === v.stimulusFlagRef) return flag
  await db.questionVersion.update({ where: { id: v.id }, data: flagWrite(flag, ref, now) })
  return flag
}

/** What the detectors read of a stored version (`include` of the Prisma read). */
export const FLAG_INCLUDE = {
  question: { select: { groupId: true } },
  stimuli: { select: { stimulusId: true } },
  parts: { select: { mode: true, promptMs: true, promptEn: true, stimulusId: true, options: { select: { bodyMs: true, bodyEn: true, imageFileId: true } } } },
} as const

/** The detector input of a version read with `FLAG_INCLUDE`. */
export function flagInputOfRow(v: {
  stemMs: string | null
  stemEn: string | null
  question: { groupId: bigint | null }
  stimuli: readonly unknown[]
  parts: readonly { mode: string | null; promptMs: string; promptEn: string | null; stimulusId: bigint | null; options: readonly { bodyMs: string | null; bodyEn: string | null; imageFileId: bigint | null }[] }[]
}): FlagInput {
  return {
    stemMs: v.stemMs,
    stemEn: v.stemEn,
    hasGroup: v.question.groupId !== null,
    hasStemStimulus: v.stimuli.length > 0,
    parts: v.parts.map((p) => ({
      isLeaf: p.mode !== null,
      promptMs: p.promptMs,
      promptEn: p.promptEn,
      optionTexts: p.options.flatMap((o) => [o.bodyMs, o.bodyEn]),
      hasStimulus: p.stimulusId !== null,
      hasOptionImage: p.options.some((o) => o.imageFileId !== null),
    })),
  }
}

/** The columns a changed flag writes: a changed or cleared flag drops its dismissal. */
export function flagWrite(flag: StimulusFlag | null, ref: StimulusFlagRef | null, now: Date) {
  return { stimulusFlag: flag, stimulusFlagRef: ref, stimulusFlagAt: flag === null ? null : now, flagDismissedAt: null, flagDismissedBy: null }
}

/** `refreshStimulusFlag` for the live and the latest version of each question (a group move changes what both read). */
export async function refreshStimulusFlagsOf(db: TxClient | PrismaClient, questionIds: readonly bigint[], now: Date): Promise<void> {
  if (questionIds.length === 0) return
  const rows = await db.question.findMany({ where: { id: { in: [...questionIds] } }, select: { id: true, latestVersionNo: true, liveVersionNo: true } })
  for (const q of rows) {
    for (const no of new Set([q.latestVersionNo, ...(q.liveVersionNo === null ? [] : [q.liveVersionNo])])) await refreshStimulusFlag(db, q.id, no, now)
  }
}
