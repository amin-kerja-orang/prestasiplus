/**
 * BE-09 question bank -> Bijak attempts (BE-16) mapping. PURE: no database, no clock.
 *
 * BE-09 stores the v2 part tree (`QuestionPart` of `@pp/contract`, exam schema D1 to D4): leaves carry
 * `mode` + `key`, labels address them. BE-16 grades with the exam-core shapes (`QuestionDef`,
 * `SchemeDef`): a question-level MCQ, or nested `PartDef`s with one scheme per LEAF id. This file
 * converts one published question version (plus its stimulus group and curriculum labels) into a
 * `BijakQuestionBundle`, or REFUSES it with an `UnsupportedQuestionError` naming the question, the
 * part path and the reason. A refused question is never served half-mapped: grading it wrongly is
 * worse than not serving it (the attempt fails closed, the paper builder sees it as unavailable).
 *
 * Ids (decimal question ids stay as they are; everything else is namespaced so it never collides
 * with a PoC export key):
 * - question id: the BE-09 decimal id; an MCQ question's leaf id is the question id (exam-core rule).
 * - leaf / part id: `<questionId>.<label path>`, labels stripped to `[A-Za-z0-9]` (`(a)`, `(ii)` ->
 *   `a.ii`). Stable across versions while the labels stay, so a republish keeps saved answers.
 * - group id `qb-g<groupId>`, stimulus id `qb-s<stimulusId>`, MCQ option id = its letter (A..H).
 *
 * Supported modes and what they become (the refusals are the PR's gap list):
 * | BE-09 mode     | exam-core                                   | refused when                                     |
 * | mcq            | question-level `mcq`, scheme `option`        | not the question's only part; option image       |
 * | short_text     | leaf `short_text`, scheme `accepted`         | `anyOrder`, more than one blank                  |
 * | numeric        | leaf `numeric`, scheme `accepted`            | `sigFigs` / `decimals` set                       |
 * | match_letter   | leaf `match_letter`, scheme `mapping`        | the key maps more than one item                  |
 * | working        | leaf `working`, scheme `points`              | see `pointsScheme`                               |
 * | essay          | leaf `essay`, scheme `points` or `rubric`    | see `pointsScheme`                               |
 * | drawing        | leaf `drawing`, scheme `points`              | see `pointsScheme`                               |
 * | essay_choice   | leaf `essay_choice` (topics), marked as essay | no topics (see `leafScheme`)                     |
 * | table_fill     | -                                            | always (KIV: exam-core has no table widget)      |
 * Stimuli (R1-B08, ADR-0030, D90): a group carries 1 to 3 stimuli, each `passage | image | diagram | table | map |
 * infographic | graph`; one that has a stored file becomes `image: { url: '/api/files/<token>' }` (the pupil read
 * rule of `files/question-image-access.ts` decides who may load it). A stimulus is shown ONCE per group above all
 * member questions: the bundle of EVERY member carries the same group (same stimulus ids), so a member served alone
 * (a quiz) still carries it. A stimulus is never a question and has no marks. A picture stimulus (image, diagram, map,
 * infographic, graph) linked to the version but not to the group is the question's own `stemImage` (R1E2E-05). MCQ option images become `option.image`.
 * Also refused: `reveal: 'never'` (BE-16 always reveals the scheme after submit), a stimulus the bridge cannot
 * show (outside the group and not a stem picture, unknown kind, empty, file not found), a group with more than
 * three stimuli, two sibling labels that strip to the same id. Every refusal carries a code and a BM reason
 * (`./refusals.ts`).
 */
import type { QuestionPart } from '@pp/contract'

import type {
  McqOption,
  PartDef,
  QuestionDef,
  SchemeDef,
  StimulusDef,
} from '../attempts/exam-core.adapter'
import type { BijakQuestionBundle } from '../attempts/ports'
import type { BijakQuestionInfo } from '../papers/ports'
import type { QuestionRecord, StimulusGroupRecord, StimulusRecord } from '../../questions/types'
import { STIMULUS_KINDS, type StimulusKind } from '@pp/exam-core/types'
import { BRIDGE_REFUSAL_REASONS_MS, type BridgeRefusalCode } from './refusals'

type Leaf = Extract<QuestionPart, { mode: string }>
type LeafOf<M extends Leaf['mode']> = Extract<Leaf, { mode: M }>
type PointsKey = Extract<LeafOf<'working'>['key'], { kind: 'points' }>
type BePoint = PointsKey['points'][number]
type PointsScheme = Extract<SchemeDef, { kind: 'points' }>
type ExamPoint = PointsScheme['points'][number]
type RubricScheme = Extract<SchemeDef, { kind: 'rubric' }>
type LeafKind = NonNullable<PartDef['answer']>['kind']

/** A BE-09 question the mapper cannot turn into an exam-core question without changing its marking. */
export class UnsupportedQuestionError extends Error {
  constructor(
    readonly questionId: string,
    /** Label path of the part (`(a).(ii)`), or `''` for the question itself. */
    readonly path: string,
    /** English detail for the log. */
    readonly reason: string,
    /** Stable code; its BM reason is in `BRIDGE_REFUSAL_REASONS_MS`. */
    readonly code: BridgeRefusalCode = 'points_unsupported',
  ) {
    super(`Question ${questionId}${path ? ` part ${path}` : ''}: ${reason}`)
    this.name = 'UnsupportedQuestionError'
  }

  /** `shape_unsupported:<code>` (ADR-0030 section 4). */
  get reasonCode(): string {
    return `shape_unsupported:${this.code}`
  }

  /** BM phrase continuing "Tidak dihidangkan kerana ...". */
  get reasonMs(): string {
    return BRIDGE_REFUSAL_REASONS_MS[this.code]
  }
}

/**
 * Files the mapper needs and cannot read itself (it is pure): file id (decimal) -> public token, and the
 * stimuli linked to the version that are NOT in its group (id -> kind and file), read by the caller from the
 * BE-09 repository.
 */
export interface BridgeMedia {
  tokens: ReadonlyMap<string, string>
  outside: ReadonlyMap<string, { kind: string; assetFileId: string | null }>
}

export const NO_MEDIA: BridgeMedia = { tokens: new Map(), outside: new Map() }

/** `/api/files/<token>`: the URL the pupil's browser loads (read rule R1-B20). */
export const fileUrlOf = (token: string): string => `/api/files/${token}`

/** A BE-09 stimulus with the columns `groupOf` may carry beyond `StimulusRecord` (read defensively). */
type WideStimulus = Omit<StimulusRecord, 'kind'> & {
  kind: string
  caption?: string | null
  tableData?: unknown
  sourceCitation?: string | null
}

/** Curriculum labels resolved by the caller (BE-08 repository) for one question version. */
export interface CurriculumLabels {
  /** Bijak subject code (MAT, SN, SEJ ...; curriculum code mapped by `bijakCodeOf`), `''` when unknown. */
  subjectCode: string
  /** Title of the unit node, else the subject name, else `''`. */
  unitLabel: string
  /** Printed code of the unit node, or null. */
  unitCode: string | null
}

/** The bundle plus the pinned version it was built from (M7 working assumption: the LIVE version). */
export interface Be09QuestionBundle extends BijakQuestionBundle {
  versionNo: number
}

const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p

/** Contract `IdSchema` max length: every id the bridge puts on the wire must fit. */
const MAX_WIRE_ID = 64

const FORM_ORIGIN = { t1_t3: 'T1-T3', t4: 'T4', t5: 'T5' } as const
const LEVEL = { t1_t3: 'T4+T5', t4: 'T4', t5: 'T5' } as const

export const groupWireId = (groupId: string): string => `qb-g${groupId}`
export const stimulusWireId = (stimulusId: string): string => `qb-s${stimulusId}`

/** `(a)` -> `a`; an empty result falls back to the 1-based position. */
const segmentOf = (label: string, index: number): string =>
  label.replace(/[^A-Za-z0-9]/g, '') || `p${String(index + 1)}`

interface Ctx {
  questionId: string
  /** Label path -> leaf part id, for ECF references. */
  leafIdByPath: Map<string, string>
  /** Last label -> leaf part ids (an ECF reference may name only the part's own label). */
  leafIdsByLabel: Map<string, string[]>
  stimulusIds: ReadonlySet<string>
  media: BridgeMedia
  explanation: string
}

/**
 * Maps one question (the version in `record.version`) to a bundle. `group` is the question's stimulus
 * group (`QuestionsRepository.groupOf`), or null. Throws `UnsupportedQuestionError`.
 */
export function mapBe09Question(
  record: QuestionRecord,
  group: StimulusGroupRecord | null,
  labels: CurriculumLabels,
  media: BridgeMedia = NO_MEDIA,
): Be09QuestionBundle {
  const v = record.version
  const qid = record.id
  if (v.parts.length === 0)
    throw new UnsupportedQuestionError(qid, '', 'the question has no parts', 'no_parts')

  const stimuli = group ? stimuliOf(qid, group, media) : []
  const stimulus = stimuli[0]
  const stimulusIds = new Set(group?.stimuli.map((s) => s.id) ?? [])
  const stemImage = stemImageOf(qid, v.stimulusIds, stimulusIds, media)
  if (stemImage) stimulusIds.add(stemImage.rawId)

  const ctx: Ctx = {
    questionId: qid,
    leafIdByPath: new Map(),
    leafIdsByLabel: new Map(),
    stimulusIds,
    media,
    explanation: v.explanationMs ?? '',
  }
  const curriculum: QuestionDef['curriculum'] = {
    subject: labels.subjectCode,
    level: LEVEL[v.formOrigin],
    unit: labels.unitCode,
    unitLabel: labels.unitLabel,
    // Curriculum node ids of the SP tag (BE-08); BE-16 never shows them.
    sp: [...v.spIds],
    tp: v.difficultyTp ?? 0,
    formOrigin: FORM_ORIGIN[v.formOrigin],
  }
  const stemText = v.stemMs ?? ''
  const groupFields = record.groupId ? { groupId: groupWireId(record.groupId) } : {}
  const stemFields = stemImage ? { stemImage: stemImage.def } : {}
  const groupBundle =
    group && stimulus
      ? {
          group: {
            id: groupWireId(group.id),
            stimulus,
            stimuli,
            ...(group.optionBank.length > 0
              ? {
                  optionBank: group.optionBank.map((o): McqOption => ({
                    id: o.label,
                    text: o.bodyMs ?? o.label,
                  })),
                }
              : {}),
          },
        }
      : {}

  // A question whose only part is an MCQ leaf is an exam-core MCQ question (its id is the leaf id).
  const only = v.parts.length === 1 ? v.parts[0] : undefined
  if (only && isLeaf(only) && only.mode === 'mcq') {
    const path = only.label
    checkLeafCommon(ctx, only, path)
    const options = only.options.map((o): McqOption => {
      if (o.imageId == null) return { id: o.label, text: o.body.ms }
      const token = media.tokens.get(o.imageId)
      if (token === undefined)
        throw new UnsupportedQuestionError(
          qid,
          path,
          `the image file ${o.imageId} of option ${o.label} was not found`,
          'file_missing',
        )
      return {
        id: o.label,
        text: o.body.ms,
        image: { url: fileUrlOf(token), alt: o.body.ms || `Pilihan ${o.label}` },
      }
    })
    const prompt = only.prompt.ms
    const stem =
      stemText && prompt && stemText !== prompt ? `${stemText}\n\n${prompt}` : stemText || prompt
    const question: QuestionDef = {
      id: qid,
      curriculum,
      ...groupFields,
      stem,
      ...stemFields,
      mcq: { options },
    }
    return {
      question,
      ...groupBundle,
      schemes: Object.freeze({
        [qid]: {
          kind: 'option',
          marks: only.marks,
          correct: only.key.correct,
          reason: ctx.explanation,
        } satisfies SchemeDef,
      }),
      versionNo: v.versionNo,
    }
  }

  indexLeaves(ctx, v.parts, [], [])
  const schemes: Record<string, SchemeDef> = {}
  const parts = v.parts.map((p, i) => mapPart(ctx, p, i, [], [], schemes))
  const question: QuestionDef = {
    id: qid,
    curriculum,
    ...groupFields,
    stem: stemText,
    ...stemFields,
    parts,
  }
  return { question, ...groupBundle, schemes: Object.freeze(schemes), versionNo: v.versionNo }
}

/** Structure only, for BE-15 (`BijakQuestionInfo`): marks are the sum of the mapped leaf marks. */
export function infoOf(bundle: Be09QuestionBundle, groupId: string | null): BijakQuestionInfo {
  const q = bundle.question
  const marks = q.mcq
    ? (bundle.schemes[q.id]?.marks ?? 0)
    : Object.values(bundle.schemes).reduce((n, s) => n + s.marks, 0)
  return { id: q.id, marks, groupId, versionNo: bundle.versionNo }
}

/** At most three stimuli per group (ADR-0030 section 4); a group with none to show is refused. */
const MAX_GROUP_STIMULI = 3

/** All stimuli of the group in order (D90: one group, shown once, with every member question under it). */
function stimuliOf(qid: string, group: StimulusGroupRecord, media: BridgeMedia): StimulusDef[] {
  if (group.stimuli.length === 0)
    throw new UnsupportedQuestionError(
      qid,
      '',
      'the stimulus group has no stimulus to show',
      'group_no_stimulus',
    )
  if (group.stimuli.length > MAX_GROUP_STIMULI)
    throw new UnsupportedQuestionError(
      qid,
      '',
      `the stimulus group holds ${String(group.stimuli.length)} stimuli (at most ${String(MAX_GROUP_STIMULI)})`,
      'group_too_many_stimuli',
    )
  return group.stimuli.map((s) => stimulusDefOf(qid, s as WideStimulus, media))
}

const isStimulusKind = (k: string): k is StimulusKind =>
  (STIMULUS_KINDS as readonly string[]).includes(k)

/** One stimulus -> exam-core. Refuses a kind outside the seven, a missing file, and one with nothing to show. */
function stimulusDefOf(qid: string, s: WideStimulus, media: BridgeMedia): StimulusDef {
  if (!isStimulusKind(s.kind))
    throw new UnsupportedQuestionError(
      qid,
      '',
      `stimulus kind "${s.kind}" is not one of the supported kinds`,
      'stimulus_kind_unsupported',
    )
  let image: StimulusDef['image']
  if (s.assetFileId !== null) {
    const token = media.tokens.get(s.assetFileId)
    if (token === undefined)
      throw new UnsupportedQuestionError(
        qid,
        '',
        `the file ${s.assetFileId} of stimulus ${s.id} was not found`,
        'file_missing',
      )
    image = { url: fileUrlOf(token) }
  }
  const table = s.kind === 'table' ? tableOf(s.tableData, s.bodyMs) : undefined
  // A table parsed from the body replaces the body text; any other body stays the text.
  const text = table && !s.tableData ? undefined : s.bodyMs
  if (!text && !table && !image)
    throw new UnsupportedQuestionError(
      qid,
      '',
      `stimulus ${s.id} has no text, table or picture`,
      'stimulus_empty',
    )
  return {
    id: stimulusWireId(s.id),
    kind: s.kind,
    label: s.label,
    alt: s.alt ?? s.label,
    ...(s.caption ? { caption: s.caption } : {}),
    ...(s.sourceCitation ? { source: s.sourceCitation } : {}),
    ...(text ? { text } : {}),
    ...(table ? { table } : {}),
    ...(image ? { image } : {}),
  }
}

/**
 * A table stimulus grid: the stored `tableData` (`{ head, rows }`, `{ headers, rows }`, `{ columns, rows }` or an
 * array of rows whose first row is the head), else a pipe table written in the body (`a | b` per line, an optional
 * `---` rule). Anything else is not a table (the body stays plain text, or the stimulus is a picture).
 */
function tableOf(data: unknown, body: string | null): StimulusDef['table'] {
  const cell = (c: unknown): string =>
    typeof c === 'string' ? c : typeof c === 'number' ? String(c) : ''
  const rowsOf = (x: unknown): string[][] | undefined =>
    Array.isArray(x) && x.every((r) => Array.isArray(r))
      ? (x as unknown[][]).map((r) => r.map(cell))
      : undefined
  if (Array.isArray(data)) {
    const [head, ...rows] = rowsOf(data) ?? []
    if (head && head.length > 0) return { head, rows }
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const head = rowsOf([d.head ?? d.headers ?? d.columns])?.[0]
    const rows = rowsOf(d.rows)
    if (head && head.length > 0 && rows) return { head, rows }
  }
  if (body && body.includes('|')) {
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !/^\|?[\s:|-]+\|?$/.test(l))
    const cells = lines.map((l) =>
      l
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()),
    )
    const [head, ...rows] = cells
    if (head && head.length >= 2 && rows.length >= 1 && rows.every((r) => r.length === head.length))
      return { head, rows }
  }
  return undefined
}

/** A stimulus kind that is a stored picture: V2 Studio links any of these straight to a question as its own figure. */
const PICTURE_KINDS: ReadonlySet<string> = new Set(['image', 'diagram', 'map', 'infographic', 'graph'])
const isPictureKind = (kind: string): kind is StimulusKind => PICTURE_KINDS.has(kind)

/**
 * The question's own picture: the picture stimulus (image, diagram, map, infographic or graph with a stored file) linked to the
 * version that is not in its group. A passage or table outside the group is not shown (the stem slot is one picture), and a second
 * picture would be dropped: both refuse. R1E2E-05: only `image` was accepted, so a question whose own figure was a diagram, map,
 * infographic or graph was refused (403 on start); every picture kind is accepted now.
 */
function stemImageOf(
  qid: string,
  versionStimulusIds: readonly string[],
  groupStimulusIds: ReadonlySet<string>,
  media: BridgeMedia,
): { def: StimulusDef; rawId: string } | undefined {
  let out: { def: StimulusDef; rawId: string } | undefined
  for (const id of versionStimulusIds) {
    if (groupStimulusIds.has(id)) continue
    const info = media.outside.get(id)
    if (!info || !isPictureKind(info.kind) || info.assetFileId === null)
      throw new UnsupportedQuestionError(
        qid,
        '',
        'a stimulus outside the question group (other than a stem picture) cannot be shown',
        'stimulus_outside_group',
      )
    if (out)
      throw new UnsupportedQuestionError(
        qid,
        '',
        'more than one stem picture is linked to the version',
        'stem_images_many',
      )
    const token = media.tokens.get(info.assetFileId)
    if (token === undefined)
      throw new UnsupportedQuestionError(
        qid,
        '',
        `the file ${info.assetFileId} of stem picture ${id} was not found`,
        'file_missing',
      )
    out = {
      rawId: id,
      def: {
        id: stimulusWireId(id),
        kind: info.kind,
        label: '',
        alt: 'Gambar untuk soalan ini',
        image: { url: fileUrlOf(token) },
      },
    }
  }
  return out
}

function indexLeaves(
  ctx: Ctx,
  parts: readonly QuestionPart[],
  labels: string[],
  segs: string[],
): void {
  const seen = new Set<string>()
  parts.forEach((p, i) => {
    const seg = segmentOf(p.label, i)
    const path = [...labels, p.label].join('.')
    if (seen.has(seg))
      throw new UnsupportedQuestionError(
        ctx.questionId,
        path,
        `two sibling parts share the id "${seg}"`,
        'label_clash',
      )
    seen.add(seg)
    if (isLeaf(p)) {
      const id = [ctx.questionId, ...segs, seg].join('.')
      ctx.leafIdByPath.set(path, id)
      ctx.leafIdsByLabel.set(p.label, [...(ctx.leafIdsByLabel.get(p.label) ?? []), id])
    } else {
      indexLeaves(ctx, p.children as QuestionPart[], [...labels, p.label], [...segs, seg])
    }
  })
}

function checkLeafCommon(ctx: Ctx, leaf: Leaf, path: string): void {
  if (leaf.reveal === 'never')
    throw new UnsupportedQuestionError(
      ctx.questionId,
      path,
      "reveal 'never' is not supported (BE-16 reveals every scheme after submit)",
      'reveal_never',
    )
  if (leaf.stimulusId != null && !ctx.stimulusIds.has(leaf.stimulusId)) {
    throw new UnsupportedQuestionError(
      ctx.questionId,
      path,
      'a part stimulus outside the question group cannot be shown',
      'stimulus_outside_group',
    )
  }
}

function mapPart(
  ctx: Ctx,
  p: QuestionPart,
  index: number,
  labels: string[],
  segs: string[],
  schemes: Record<string, SchemeDef>,
): PartDef {
  const seg = segmentOf(p.label, index)
  const id = [ctx.questionId, ...segs, seg].join('.')
  const path = [...labels, p.label].join('.')
  if (!isLeaf(p)) {
    const children = (p.children as QuestionPart[]).map((c, i) =>
      mapPart(ctx, c, i, [...labels, p.label], [...segs, seg], schemes),
    )
    return { id, label: p.label, prompt: p.prompt.ms, marks: 0, children }
  }
  checkLeafCommon(ctx, p, path)
  const { kind, scheme, unit, wordRange, topics } = leafScheme(ctx, p, path)
  schemes[id] = scheme
  return {
    id,
    label: p.label,
    prompt: p.prompt.ms,
    marks: p.marks,
    answer: {
      kind,
      ...(unit !== undefined ? { unit } : {}),
      ...(wordRange ? { wordRange } : {}),
      ...(topics ? { topics } : {}),
    },
  }
}

interface LeafMapping {
  kind: LeafKind
  scheme: SchemeDef
  unit?: string
  wordRange?: { min: number; max: number }
  topics?: { id: string; label: string }[]
}

function leafScheme(ctx: Ctx, leaf: Leaf, path: string): LeafMapping {
  const refuse = (reason: string, code: BridgeRefusalCode = 'points_unsupported'): never => {
    throw new UnsupportedQuestionError(ctx.questionId, path, reason, code)
  }
  // essay_choice is not (yet) a mode of the bank part contract; it is read defensively so it is served the day
  // the bank stores it (the V2 production mode, 31 approved parts). Marked exactly like an essay.
  if ((leaf.mode as string) === 'essay_choice') return essayChoiceOf(ctx, leaf, path, refuse)
  switch (leaf.mode) {
    case 'mcq':
      return refuse(
        'an MCQ part inside a structured question is not supported (exam-core MCQ is question-level only)',
        'mcq_in_structured',
      )
    case 'pksk_choice':
      return refuse('a PKSK question is not a Bijak item', 'pksk_not_bijak')
    case 'table_fill':
      return refuse(
        "mode 'table_fill' is not supported (KIV: exam-core has no table widget or cell key)",
        'table_fill',
      )
    case 'short_text': {
      if (leaf.key.anyOrder === true)
        refuse(
          "short_text 'anyOrder' is not supported by the exam-core 'accepted' scheme",
          'short_text_any_order',
        )
      if (leaf.blankCount !== undefined && leaf.blankCount > 1)
        refuse('short_text with more than one blank is not supported', 'short_text_multi_blank')
      return {
        kind: 'short_text',
        scheme: {
          kind: 'accepted',
          marks: leaf.marks,
          values: leaf.key.values.map((v) => ({ v })),
          ...(leaf.key.caseSensitive ? { caseSensitive: true } : {}),
        },
      }
    }
    case 'numeric': {
      const values: Extract<SchemeDef, { kind: 'accepted' }>['values'] = []
      for (const a of leaf.key.values) {
        if (a.sigFigs != null || a.decimals != null)
          refuse(
            'numeric significant figures / decimal places are not supported by the exam-core matcher',
            'numeric_precision',
          )
        const tol =
          a.tol === undefined ? undefined : a.tolKind === 'rel' ? a.tol * Math.abs(a.v) : a.tol
        const v = String(a.v)
        if (/e/i.test(v))
          refuse(
            `numeric value ${v} in exponent form is not supported by the exam-core matcher`,
            'numeric_exponent',
          )
        // Alternative units become alternative accepted values (same number, same tolerance).
        const units = a.unit === undefined ? [undefined] : [a.unit, ...(a.unitAlt ?? [])]
        for (const unit of units)
          values.push({
            v,
            ...(tol !== undefined ? { tol } : {}),
            ...(unit !== undefined ? { unit } : {}),
          })
      }
      const unit = leaf.key.values[0]?.unit
      return {
        kind: 'numeric',
        scheme: { kind: 'accepted', marks: leaf.marks, values },
        ...(unit !== undefined ? { unit } : {}),
      }
    }
    case 'match_letter': {
      const entries = Object.entries(leaf.key.map)
      if (entries.length !== 1)
        refuse(
          `match_letter with ${String(entries.length)} items in one part is not supported (exam-core matches one item per part)`,
          'match_letter_multi',
        )
      const [, letter] = entries[0] as [string, string]
      const partId = ctx.leafIdByPath.get(path) as string
      return {
        kind: 'match_letter',
        scheme: { kind: 'mapping', marks: leaf.marks, map: { [partId]: letter } },
      }
    }
    case 'working':
    case 'drawing':
      return { kind: leaf.mode, scheme: pointsScheme(ctx, leaf.key, leaf.marks, path) }
    case 'essay': {
      const wordRange = leaf.wordRange
      const scheme =
        leaf.key.kind === 'rubric'
          ? rubricScheme(leaf.key, leaf.marks)
          : pointsScheme(ctx, leaf.key, leaf.marks, path)
      return { kind: 'essay', scheme, ...(wordRange ? { wordRange } : {}) }
    }
  }
}

/** `essay_choice`: the topics the pupil picks one of, then an essay marked by points or a rubric. */
function essayChoiceOf(
  ctx: Ctx,
  leaf: Leaf,
  path: string,
  refuse: (reason: string, code?: BridgeRefusalCode) => never,
): LeafMapping {
  const raw = leaf as unknown as {
    marks: number
    key: Extract<LeafOf<'essay'>['key'], { kind: string }>
    wordRange?: { min: number; max: number }
    topics?: unknown
  }
  const topics = (Array.isArray(raw.topics) ? raw.topics : []).flatMap((t, i) => {
    const o = (typeof t === 'string' ? { label: t } : t) as { id?: unknown; label?: unknown; body?: { ms?: unknown } }
    const body = o.body?.ms
    const label = typeof o.label === 'string' ? o.label : typeof body === 'string' ? body : ''
    return label.trim() === ''
      ? []
      : [{ id: typeof o.id === 'string' && o.id !== '' ? o.id : String.fromCharCode(65 + i), label }]
  })
  if (topics.length === 0) refuse('essay_choice has no topics to choose from', 'essay_choice_no_topics')
  const scheme =
    raw.key.kind === 'rubric'
      ? rubricScheme(raw.key as Extract<typeof raw.key, { kind: 'rubric' }>, raw.marks)
      : pointsScheme(ctx, raw.key as PointsKey, raw.marks, path)
  return {
    kind: 'essay_choice',
    scheme,
    topics,
    ...(raw.wordRange ? { wordRange: raw.wordRange } : {}),
  }
}

function rubricScheme(
  key: Extract<LeafOf<'essay'>['key'], { kind: 'rubric' }>,
  marks: number,
): RubricScheme {
  const bands: RubricScheme['bands'] = key.bands.map((b) => ({
    name: b.name,
    range: [b.range[0], b.range[1]],
    descriptor: Object.entries(b.descriptors ?? {})
      .map(([criterion, text]) => `${criterion}: ${text}`)
      .join('\n'),
  }))
  if (key.floorBand)
    bands.push({
      name: key.floorBand.name,
      range: [key.floorBand.range[0], key.floorBand.range[1]],
      descriptor: '',
    })
  return {
    kind: 'rubric',
    marks,
    criteria: key.criteria.map((c) => ({ id: c.id, name: c.name })),
    bands,
    ...(key.notes ? { notes: [...key.notes] } : {}),
  }
}

/**
 * `points` key -> exam-core `points` scheme. BE-09 points carry no explicit match type, so it is
 * derived (documented, tested):
 * - `accept` on a K, N, P or B point -> `step` (working-line equivalence);
 *   `accept` on an M, F or C point -> `keywords` (science / fact / content points are phrases);
 * - `allOf` -> `all_of`;
 * - an `ecf` point, or an N point without `accept` / `allOf`, when the key has a `final` -> `final`
 *   (exam-core applies ECF only to final-answer points);
 * - a point whose only criterion is a mandatory `unit` -> `unit` (sets the key's final unit);
 * - anything else (including a B point without a criterion) -> `manual` (a teacher marks it; the
 *   attempt result is provisional).
 * A point tolerance becomes the final tolerance (relative: times the numeric final answer).
 * Refused: alternative paths that differ (exam-core adds points, it cannot pick the best path),
 * deductions, point sig-figs / decimals, a mandatory unit on any point but a unit-only one (exam-core
 * would not enforce it), alternative units on a unit point, a tolerance on a non-final point, an
 * `eachMarks` that differs from a grouped point's marks, an ECF reference to an unknown part, a point
 * id longer than the wire id limit (64).
 */
function pointsScheme(ctx: Ctx, key: PointsKey, marks: number, path: string): PointsScheme {
  const refuse = (reason: string): never => {
    throw new UnsupportedQuestionError(ctx.questionId, path, reason)
  }
  if (key.paths && key.paths.length > 1) {
    const sets = key.paths.map((p) => [...new Set(p.pointIds)].sort().join(','))
    if (sets.some((s) => s !== sets[0]))
      refuse(
        "alternative mark paths ('Alternatif A/B') are not supported: exam-core cannot mark the best path",
      )
  }
  if (key.deductions && key.deductions.length > 0)
    refuse('mark deductions are not supported by exam-core')
  const byId = new Map(key.points.map((p) => [p.id, p]))
  for (const g of key.groups ?? []) {
    if (g.eachMarks !== undefined && g.pointIds.some((id) => byId.get(id)?.marks !== g.eachMarks)) {
      refuse(`group ${g.id}: 'eachMarks' differs from the marks of its points`)
    }
  }
  let final: PointsScheme['final'] = key.final
    ? {
        accept: [...key.final.accept],
        display: key.final.display,
        ...(key.final.tolerance !== undefined ? { tolerance: key.final.tolerance } : {}),
        ...(key.final.unit !== undefined ? { unit: key.final.unit } : {}),
        ...(key.final.mustContain !== undefined ? { mustContain: key.final.mustContain } : {}),
      }
    : undefined
  const points = key.points.map((p): ExamPoint => {
    if (p.sigFigs != null || p.decimals != null)
      refuse(`point ${p.id}: significant figures / decimal places are not supported`)
    if (p.id.length > MAX_WIRE_ID)
      refuse(`point id "${p.id.slice(0, 16)}..." is longer than ${String(MAX_WIRE_ID)} characters`)
    const match = matchOf(p, final !== undefined, refuse)
    if (match.type === 'unit' && final && p.unit) {
      if (p.unit.alt && p.unit.alt.length > 0)
        refuse(`point ${p.id}: alternative units are not supported by the exam-core unit check`)
      if (final.unit !== undefined && final.unit !== p.unit.value)
        refuse(`point ${p.id}: the unit differs from the final answer unit`)
      final = { ...final, unit: p.unit.value }
    }
    if (p.tolerance) {
      // exam-core has ONE tolerance per part (the final answer); a point tolerance is only representable there.
      if (match.type !== 'final' || !final)
        refuse(`point ${p.id}: a tolerance on a non-final point is not supported`)
      if (final && final.tolerance === undefined) {
        const base = Number(final.accept[0])
        const tol =
          p.tolerance.kind === 'abs'
            ? p.tolerance.value
            : Number.isFinite(base)
              ? p.tolerance.value * Math.abs(base)
              : refuse(`point ${p.id}: a relative tolerance needs a numeric final answer`)
        final = { ...final, tolerance: tol }
      }
    }
    const ecf =
      p.ecf && match.type === 'final'
        ? {
            fromPart: ecfPart(ctx, p.ecf.fromPart, refuse),
            rule: p.ecf.rule,
            note: p.note ?? 'Dikira dengan nilai sendiri daripada bahagian sebelumnya.',
          }
        : undefined
    return {
      id: p.id,
      code: p.code,
      marks: p.marks,
      label: p.label,
      match,
      ...(p.requires && p.requires.length > 0 ? { requires: [...p.requires] } : {}),
      ...(ecf ? { ecf } : {}),
    }
  })
  return {
    kind: 'points',
    marks,
    points,
    ...(key.groups && key.groups.length > 0
      ? { groups: key.groups.map((g) => ({ id: g.id, anyN: g.anyN, pointIds: [...g.pointIds] })) }
      : {}),
    ...(final ? { final } : {}),
    ...(key.modelText ? { model: key.modelText } : {}),
  }
}

function matchOf(
  p: BePoint,
  hasFinal: boolean,
  refuse: (reason: string) => never,
): ExamPoint['match'] {
  const accept = p.accept?.filter((a) => a.trim() !== '') ?? []
  const mandatoryUnit = p.unit?.mandatory === true
  // A mandatory unit is only enforced by a dedicated exam-core `unit` point; anywhere else it would be ignored (over-award).
  const noUnit = (): void => {
    if (mandatoryUnit)
      refuse(`point ${p.id}: a mandatory unit is only supported on a unit-only point`)
  }
  if (p.ecf && hasFinal) {
    noUnit()
    return { type: 'final' }
  }
  if (accept.length > 0) {
    noUnit()
    return p.code === 'M' || p.code === 'F' || p.code === 'C'
      ? { type: 'keywords', anyOf: accept }
      : { type: 'step', accept }
  }
  if (p.allOf && p.allOf.length > 0) {
    noUnit()
    return { type: 'all_of', items: [...p.allOf] }
  }
  if (mandatoryUnit) {
    if (!hasFinal) refuse(`point ${p.id}: a unit point needs the key's final answer`)
    return { type: 'unit' }
  }
  // Only an accuracy point (N) is the final-answer check; an independent B point without a criterion is manual.
  if (p.code === 'N' && hasFinal) return { type: 'final' }
  return { type: 'manual' }
}

function ecfPart(ctx: Ctx, fromPart: string, refuse: (reason: string) => never): string {
  const exact = ctx.leafIdByPath.get(fromPart)
  if (exact) return exact
  const byLabel = ctx.leafIdsByLabel.get(fromPart) ?? []
  if (byLabel.length === 1) return byLabel[0] as string
  return refuse(`ECF refers to part "${fromPart}", which is not a single leaf of this question`)
}
