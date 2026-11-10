/**
 * Pure side of `migrate:questions` (QLOAD, T-B9-2): turns one archived .cloud MCQ and its options into the plan of one single-part
 * question of the v2 bank, in ANY V2 status (PO KP-5: everything that is not deleted comes over with its status). No I/O.
 *
 * Rules (docs/architecture/v2-question-bank-migration.md sections 4 and 5):
 *  - status: `diluluskan` loads approved and live; `diarkib` archived; `draf` and `ditolak` draft (`ditolak` carries the reason
 *    "Ditolak di V2."); `menunggu` review; any other status is a reject (UNKNOWN_ENUM, never silently dropped). A question of another
 *    TYPE that another loader owns (`subjektif`, T-B9-6) is EXCLUDED (counted); any other type is an UNKNOWN_ENUM reject;
 *  - the leaf must satisfy the contract READ schema the v2 reader uses (`QuestionLeafPartReadV3Schema`: 2 to 8 options, labels A to H,
 *    non-empty option texts, the key names an option): the reader fails closed on a stored leaf that does not, so nothing is inserted
 *    that it would refuse. A question with two or more correct options is `mcq_multi` (key `options`, `modeConfig.multi`);
 *  - rejects of the first load that are repaired, never copied: 2 options load (V3 allows 2 to 8); labels that are not A to H and unique
 *    are re-assigned positionally in option id order (the key follows `is_correct`, never the label); an empty stem with a question
 *    image loads with an empty stem (the image is the stem stimulus). Still quarantined (a reject, kept with its cause): no correct
 *    option (an answer is never guessed), an option with no text, more than 8 options or fewer than 2, a body over the cap, an empty
 *    stem with no image;
 *  - curriculum ids come from the `migrate:core` id maps; subject and level are required, chapter and topic are optional;
 *  - `difficulty_tp` is the raw 1 to 5 (as `practice_answers.difficulty`); `cognitive_level` stays empty;
 *  - a question or option image is NOT copied here: the path is kept in `import_issues` and the question is held inactive (so is one whose
 *    text still holds an image, maths or script markup after the HTML conversion, or looks like it holds personal data);
 *  - the SPM pool tag is written for Tingkatan 4 and 5 only; no DSKP unit or SP exists in .cloud.
 * Reject reasons are the kit's five; the cause is the `column`. Text never goes into a reject or a counter.
 */
import { QuestionLeafPartReadV3Schema } from '@pp/contract'

import { scanViews } from '../anonymise/normalise'
import { LANDLINE } from '../anonymise/patterns'
import { REDACTED_TOKEN } from '../anonymise/redacted-token'
import { mapQuestionType, parseDifficulty } from '../snapshot-dims/dims'
import { enumKey, flag, ok, reject, stamps, text, type Outcome, type Staged } from './common'

/** BM code of .cloud `questions.status` that is live and served (the others are loaded but never served). */
export const APPROVED_STATUS = 'diluluskan'
/** The V3 version statuses a legacy question can take (section 4.1). */
export type LoadedStatus = 'approved' | 'archived' | 'draft' | 'review'
/** BM code of .cloud `questions.status` -> V3 version status. */
export const STATUS_MAP: Readonly<Record<string, LoadedStatus>> = {
  diluluskan: 'approved',
  diarkib: 'archived',
  draf: 'draft',
  ditolak: 'draft',
  menunggu: 'review',
}
/** The reason stored with a V2 `ditolak` question (the 5 to 500 characters rule of `rejection_reason`). */
export const V2_REJECTED_REASON = 'Ditolak di V2.'
/** Types that another loader of the same migration owns: counted as excluded here, never a reject. */
export const OTHER_OWNER_TYPES: ReadonlySet<string> = new Set(['subjektif', 'subjective'])
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 8
const LABELS = 'ABCDEFGH'

/** The lifecycle class of a status, for rajah groups (a group retires and revives as one unit): OC-2. */
export type LifecycleClass = 'approved' | 'pending' | 'archived'
export const lifecycleOf = (status: LoadedStatus): LifecycleClass => (status === 'approved' ? 'approved' : status === 'archived' ? 'archived' : 'pending')

export interface LegacyOption {
  id: string | null
  label: string | null
  body: string | null
  image_path: string | null
  is_correct: string | null
}

/** A staged archive question with its options attached by the reader. */
export type LegacyQuestion = Staged & { options: readonly LegacyOption[] }

/** Lookups resolved once per run (all small: curriculum, not questions). */
export interface Curriculum {
  subjects: ReadonlyMap<string, string>
  levels: ReadonlyMap<string, string>
  chapters: ReadonlyMap<string, string>
  topics: ReadonlyMap<string, string>
  /** v2 education level id -> code (`D1`, `T4`, ...). */
  levelCodes: ReadonlyMap<string, string>
  /** v2 topic id -> v2 chapter id. */
  topicChapter: ReadonlyMap<string, string>
}

export interface Exclusion {
  by: 'status' | 'type'
  /** An enum-like code (never free text): safe as a counter name. */
  code: string
}

const codeOf = (raw: string | null | undefined): string => {
  const k = enumKey(raw)
  return k !== null && /^[a-z0-9_]{1,32}$/.test(k) ? k : k === null ? 'null' : 'other'
}

/**
 * null when the row is in scope of THIS loader; else the type another loader owns (counted, not a reject). An unknown status or type is
 * not an exclusion: `transformQuestion` rejects it (UNKNOWN_ENUM), so nothing is dropped without a trace.
 */
export function exclusionOf(row: Staged): Exclusion | null {
  const type = enumKey(row.type)
  if (type !== null && OTHER_OWNER_TYPES.has(type)) return { by: 'type', code: codeOf(row.type) }
  return null
}

/** The V3 status of a V2 status code, or null when it is not a known one. */
export function statusOf(raw: string | null | undefined): LoadedStatus | null {
  const k = enumKey(raw)
  return k !== null && Object.prototype.hasOwnProperty.call(STATUS_MAP, k) ? (STATUS_MAP[k] ?? null) : null
}

/** One entry of `question_versions.import_issues`. */
export interface ImportIssue {
  code: string
  target: 'question' | 'stem' | 'option' | 'explanation'
  label?: string
  path?: string
  kind?: string
  /** `rajah_group_auto` only: the confidence tier and the signals that made the group (no text). */
  ref?: string
  signals?: string[]
}

/** The codes that hold a question inactive (the Studio releases them when the cause is fixed). The others only describe the load. */
export const HOLD_CODES: ReadonlySet<string> = new Set(['legacy_image_unresolved', 'html_image', 'html_math', 'html_residual', 'pii_suspect'])

export interface QuestionPlan {
  legacyId: string
  created_at: string
  updated_at: string
  /** `updated_at` for an approved question, else null (only an approved version is published). */
  published_at: string | null
  status: LoadedStatus
  /** The live version pointer is set (approved only). */
  live: boolean
  /** `rejection_reason` of a draft that V2 had rejected, else null. */
  rejection_reason: string | null
  /** `mcq`, or `mcq_multi` when two or more options are correct. */
  qtype: 'mcq' | 'mcq_multi'
  /** V2 `created_by` / `approved_by` ids (users), mapped by the writer when they were migrated. */
  created_by: string | null
  approved_by: string | null
  /** The question image path (the stem stimulus, or the stimulus of its rajah group), else null. */
  image_path: string | null
  is_active: boolean
  subject_id: string
  education_level_id: string
  chapter_id: string | null
  topic_id: string | null
  form_origin: 't1_t3' | 't4' | 't5'
  difficulty_tp: number | null
  stem: string
  explanation: string | null
  /** `import_issues` of the version (structured list) or null. Only the codes of `HOLD_CODES` hold the question inactive. */
  import_issues: ImportIssue[] | null
  options: { label: string; body: string; position: number }[]
  /** The correct label(s): one for `mcq`, two or more for `mcq_multi`. */
  correct: string[]
  /** SPM pool tag (`pool` / `spm`): Tingkatan 4 and 5. */
  spm_pool: boolean
  /** Counter names (no values) to add to the report. */
  notes: string[]
}

/** v2 form origin of a level code: the rule of `QuestionsService.formOriginOf` and the pool seed. */
export const formOriginOf = (levelCode: string | undefined): QuestionPlan['form_origin'] =>
  levelCode === 'T5' ? 't5' : levelCode === 'T4' ? 't4' : 't1_t3'

/** `a)` / ` b. ` -> `B`; a digit 1 to 8 only when every label of the question is a digit. */
export function normaliseLabels(raw: readonly (string | null)[]): (string | null)[] | null {
  const cleaned = raw.map((l) => {
    const t = text(l)
    return t === null ? null : t.replace(/[.)]$/, '').trim().toUpperCase()
  })
  if (cleaned.length > 0 && cleaned.every((l) => l !== null && /^[1-8]$/.test(l))) {
    return cleaned.map((l) => LABELS.charAt(Number(l) - 1))
  }
  return cleaned.map((l) => (l !== null && /^[A-H]$/.test(l) ? l : null))
}

const HTML = /<\/?[a-z][^>]*>/i

/** A body longer than this is rejected before any pattern runs (keeps every regex pass cheap and linear in practice). */
export const MAX_BODY_CHARS = 20_000

/**
 * The learner UI shows a stem, an option and an explanation as escaped text (Vue interpolation; Bijak SPM adds `$latex$`
 * spans; the explanation is a small Markdown subset), never as HTML. A legacy body that holds HTML would show its tags.
 * So a SMALL, KNOWN tag set is converted to plain text: line breaks for `br`, closing `p`, `div` and `li`; `sup` and `sub`
 * to Unicode (or `^(..)` / `_(..)`); every other listed tag is dropped. HTML entities (the basic five, `&nbsp;`, numeric)
 * are decoded in one pass whether or not a tag was present. Unknown tags stay as they are (a `<` in "x < y" or "a<b" is
 * never touched); `holdReasonOf` decides what is then too risky to serve.
 */
const KNOWN_TAG = '(?:p|br|div|span|b|strong|i|em|u|sub|sup|font|ol|ul|li)'
const KNOWN_TAG_RE = new RegExp(`</?${KNOWN_TAG}(?:\\s[^<>]*)?/?>`, 'i')
const KNOWN_TAG_ALL = new RegExp(`</?${KNOWN_TAG}(?:\\s[^<>]*)?/?>`, 'gi')
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋' }
const script = (inner: string, map: Record<string, string>, mark: string): string => {
  const plain = inner.trim()
  if (plain === '') return ''
  return [...plain].every((c) => map[c] !== undefined) ? [...plain].map((c) => map[c]).join('') : `${mark}(${plain})`
}
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const ENTITY = /&(#x[0-9a-f]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos|nbsp);/gi
const decodeEntities = (value: string): string =>
  value.replace(ENTITY, (whole, body: string) => {
    const key = body.toLowerCase()
    if (key.startsWith('#')) {
      const code = key.startsWith('#x') ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)
      const ok = code === 9 || code === 10 || (code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) && code !== 0x7f)
      return ok ? String.fromCodePoint(code) : whole
    }
    return NAMED[key] ?? whole
  })

/** Plain text of a legacy body, and what was done to it. */
export function plainFromHtml(value: string): { text: string; tags: boolean; entities: boolean } {
  const tags = KNOWN_TAG_RE.test(value)
  let out = value
  if (tags) {
    out = out
      .replace(/<sup(?:\s[^<>]*)?>([^<]*)<\/sup>/gi, (_, inner: string) => script(inner, SUP, '^'))
      .replace(/<sub(?:\s[^<>]*)?>([^<]*)<\/sub>/gi, (_, inner: string) => script(inner, SUB, '_'))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li)>/gi, '\n')
      .replace(KNOWN_TAG_ALL, '')
  }
  const decoded = decodeEntities(out)
  const entities = decoded !== out
  out = decoded
  if (tags) out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  return { text: tags || entities ? out.trim() : out, tags, entities }
}

type HoldCode = 'html_image' | 'html_math' | 'html_residual'

/**
 * Markup that must not reach a learner as it is, found AFTER the conversion above; null when the text is clean. Real-tag
 * matchers only (`<name`, then a space or `/`, then `>`), so maths such as `0 < a < 1` or `if (x<a)` is never held.
 */
export function htmlHoldOf(value: string): HoldCode | null {
  if (!value.includes('<') && !/javascript\s*:/i.test(value)) return null
  if (/<img(?:[\s/][^<>]*)?>/i.test(value)) return 'html_image'
  if (/<\/?math(?:[\s/][^<>]*)?>/i.test(value)) return 'html_math'
  if (/<\/?(?:script|a|iframe|style|svg|object|embed|link|meta)(?:[\s/][^<>]*)?>/i.test(value)) return 'html_residual'
  if (/<[a-z][^<>]{0,500}\son[a-z]+\s*=[^<>]{0,500}>/i.test(value)) return 'html_residual'
  if (/javascript\s*:/i.test(value)) return 'html_residual'
  return null
}

export type PiiKind = 'ic' | 'phone' | 'email' | 'url' | 'handle' | 'redacted'

/**
 * Count-only screen for personal data in a free-text body (a Malaysian IC number, a phone number, an e-mail address, a URL,
 * an @handle), or the anonymiser's `redact-pii` mark (`redacted`: part of the text was masked in an anonymised dump, so what
 * it said is unknown). Every pattern is bounded or linear. Only the KIND is reported, never the text or the match.
 *
 * The text is checked as it is AND in its normalised views (anonymise/normalise.ts, import-free like patterns.ts: tags and
 * entities that are left, NFKC, Arabic-Indic and other non-ASCII digits, zero-width characters, JSON escapes), so a phone number
 * with a zero-width character or in Arabic-Indic digits is held too (A1-LEAK F1). A hit on either counts; kinds come out in a fixed order.
 */
export function piiKindsOf(value: string): PiiKind[] {
  const found = new Set<PiiKind>(rawPiiKindsOf(value))
  for (const view of scanViews(value)) for (const kind of rawPiiKindsOf(view)) found.add(kind)
  return PII_KIND_ORDER.filter((k) => found.has(k))
}

const PII_KIND_ORDER: readonly PiiKind[] = ['ic', 'phone', 'email', 'handle', 'url', 'redacted']

/** `piiKindsOf` on exactly this string. */
function rawPiiKindsOf(value: string): PiiKind[] {
  const kinds: PiiKind[] = []
  if (/(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}(?!\d)/.test(value)) kinds.push('ic')
  // mobile (its own bounded pattern) or landline (the leak scan's LANDLINE, one source in anonymise/patterns.ts)
  if (/(?<!\d)(?:\+?60|0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/.test(value) || LANDLINE.test(value)) kinds.push('phone')
  if (value.includes('@')) {
    if (/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4}/.test(value)) kinds.push('email')
    if (/(?<![\w.@])@[A-Za-z0-9_.]{3,30}/.test(value)) kinds.push('handle')
  }
  if (/https?:\/\//i.test(value) || /(?<![\w.])www\./i.test(value)) kinds.push('url')
  if (value.includes(REDACTED_TOKEN)) kinds.push('redacted')
  return kinds
}

/** Label of the option at index `i` after a positional re-assignment. */
const positional = (i: number): string => LABELS.charAt(i)

/** Plan of one question of this loader's scope (an in-scope type: `exclusionOf` is null), or the reject that quarantines it. */
export function transformQuestion(row: LegacyQuestion, cur: Curriculum): Outcome<QuestionPlan> {
  const notes: string[] = []
  const status = statusOf(row.status)
  if (status === null) {
    const k = codeOf(row.status)
    return reject('UNKNOWN_ENUM', 'status', { enumValue: k, allowedCodes: Object.keys(STATUS_MAP) })
  }
  if (mapQuestionType(row.type) !== 'mcq') return reject('UNKNOWN_ENUM', 'type', { enumValue: codeOf(row.type), allowedCodes: ['mcq', 'objektif', 'pilihan_berganda', ...OTHER_OWNER_TYPES] })
  const subject = text(row.subject_id) === null ? undefined : cur.subjects.get((row.subject_id as string).trim())
  if (subject === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  const level = text(row.education_level_id) === null ? undefined : cur.levels.get((row.education_level_id as string).trim())
  if (level === undefined) return reject('ORPHAN_PARENT', 'education_level_id')

  const qImage = text(row.image_path)
  const rawStem = text(row.body)
  if (rawStem !== null && rawStem.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'body')
  const stemPlain = rawStem === null ? { text: '', tags: false, entities: false } : plainFromHtml(rawStem)
  const stem = stemPlain.text
  // An empty stem is a picture question only when the picture exists; the options are checked below, the same as for any question.
  if (stem === '') {
    if (qImage === null) return reject('INVALID_VALUE', 'body')
    notes.push('empty_stem_image')
  }
  let htmlStripped = stemPlain.tags
  let entityDecoded = stemPlain.entities

  const opts = row.options
  if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) return reject('INVALID_VALUE', 'options')
  if (opts.length === 2) notes.push('two_options')
  const rawBodies = opts.map((o) => text(o.body))
  // An option with no text is quarantined (an image-only option too): the contract needs `body.ms` on every option, so the strict reader would fail on it.
  if (rawBodies.some((b) => b === null)) return reject('INVALID_VALUE', 'options.body')
  if (rawBodies.some((b) => (b as string).length > MAX_BODY_CHARS)) return reject('INVALID_VALUE', 'options.body')
  const bodies = rawBodies.map((raw) => {
    const plain = plainFromHtml(raw as string)
    if (plain.tags) htmlStripped = true
    if (plain.entities) entityDecoded = true
    return plain.text
  })
  if (bodies.some((b) => b === '')) return reject('INVALID_VALUE', 'options.body')

  // Labels: normalised as before; when they are still not A to H and unique, positional A..H in option id order (the key follows is_correct).
  const normalised = normaliseLabels(opts.map((o) => o.label))
  const labelsOk = normalised !== null && normalised.every((l) => l !== null) && new Set(normalised).size === normalised.length
  let labels: string[]
  if (labelsOk) {
    labels = normalised as string[]
    if (opts.every((o) => /^[1-8]$/.test((text(o.label) ?? '').replace(/[.)]$/, '')))) notes.push('label_renumbered')
  } else {
    labels = opts.map((_, i) => positional(i))
    notes.push('label_relabelled')
  }

  const flags = opts.map((o) => flag(o.is_correct, false))
  if (flags.some((f) => f === 'invalid')) return reject('INVALID_VALUE', 'is_correct')
  const correct = labels.filter((_, i) => flags[i] === true)
  // No correct option: quarantine, an answer is never guessed (OC-7). Every option correct is not a question either.
  if (correct.length === 0) return reject('INVALID_VALUE', 'is_correct')
  if (correct.length > 1 && correct.length > opts.length - 1) return reject('INVALID_VALUE', 'is_correct')
  const multi = correct.length > 1
  if (multi) notes.push('mcq_multi')

  const ordered = opts
    .map((_, i) => ({ label: labels[i] as string, body: bodies[i] as string, image: text(opts[i]?.image_path) }))
    .sort((a, b) => (a.label < b.label ? -1 : 1))
    .map((o, i) => ({ ...o, position: i + 1 }))

  // The contract leaf the v2 reader parses on every read (an empty stem is validated with a placeholder, as `leafFromRow` does for a trimmed prompt).
  const parsed = QuestionLeafPartReadV3Schema.safeParse({
    label: '1',
    prompt: { ms: stem === '' ? '-' : stem },
    marks: 1,
    mode: 'mcq',
    options: ordered.map((o) => ({ label: o.label, body: { ms: o.body } })),
    key: multi ? { kind: 'options', correctOptionIds: correct } : { kind: 'option', correct: correct[0] },
    ...(multi ? { modeConfig: { multi: true } } : {}),
  })
  if (!parsed.success) return reject('INVALID_VALUE', 'tree')

  // Curriculum: chapter and topic are optional (the question still serves subject and level draws).
  const topicRaw = text(row.topic_id)
  const chapterRaw = text(row.chapter_id)
  let topic = topicRaw === null ? null : (cur.topics.get(topicRaw) ?? null)
  if (topicRaw !== null && topic === null) notes.push('topic_unmapped')
  let chapter = chapterRaw === null ? null : (cur.chapters.get(chapterRaw) ?? null)
  if (topic !== null) {
    const parent = cur.topicChapter.get(topic) ?? null
    if (chapter === null && parent !== null) {
      chapter = parent
      notes.push('chapter_from_topic')
    } else if (chapter !== null && parent !== chapter) {
      topic = null
      notes.push('topic_chapter_mismatch')
    }
  }
  if (chapter === null) notes.push(chapterRaw === null ? 'chapter_missing' : 'chapter_unmapped')

  const difficulty = parseDifficulty(row.difficulty_level)
  if (difficulty === null) notes.push('difficulty_missing')

  const rawExplanation = text(row.explanation)
  if (rawExplanation !== null && rawExplanation.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'explanation')
  const explanationPlain = rawExplanation === null ? null : plainFromHtml(rawExplanation)
  const explanation = explanationPlain === null ? null : explanationPlain.text === '' ? null : explanationPlain.text
  if (htmlStripped) notes.push('html_stripped')
  if (explanationPlain?.tags) notes.push('explanation_html_stripped')
  if (entityDecoded || explanationPlain?.entities) notes.push('entity_decoded')
  if (HTML.test(stem) || ordered.some((o) => HTML.test(o.body))) notes.push('body_has_html')

  // Held (loaded, but not active): a question image that is not copied, markup that must not be served, suspected personal data.
  const issues: ImportIssue[] = []
  if (qImage !== null) {
    issues.push({ code: 'legacy_image_unresolved', target: 'question', path: qImage })
    notes.push('question_image')
  }
  for (const o of ordered) {
    if (o.image !== null) {
      issues.push({ code: 'legacy_image_unresolved', target: 'option', label: o.label, path: o.image })
      notes.push('option_image')
    }
  }
  if (issues.some((i) => i.code === 'legacy_image_unresolved')) notes.push('held_image')
  const texts: { target: 'stem' | 'option' | 'explanation'; label?: string; value: string }[] = [
    { target: 'stem', value: stem },
    ...ordered.map((o) => ({ target: 'option' as const, label: o.label, value: o.body })),
    ...(explanation === null ? [] : [{ target: 'explanation' as const, value: explanation }]),
  ]
  const holdCodes = new Set<string>()
  const piiKinds = new Set<string>()
  for (const t of texts) {
    const hold = htmlHoldOf(t.value)
    if (hold !== null) {
      issues.push({ code: hold, target: t.target, ...(t.label === undefined ? {} : { label: t.label }) })
      holdCodes.add(hold)
    }
    for (const kind of piiKindsOf(t.value)) {
      const key = `${t.target}:${t.label ?? ''}:${kind}`
      if (piiKinds.has(key)) continue
      piiKinds.add(key)
      issues.push({ code: 'pii_suspect', target: t.target, ...(t.label === undefined ? {} : { label: t.label }), kind })
    }
  }
  for (const c of holdCodes) notes.push(`held_${c}`)
  if (piiKinds.size > 0) notes.push('held_pii_suspect')
  // Informative only (no hold): the V2 `dskp_tagged` flag is the one fact V2 holds about the DSKP; no unit or SP exists in V2.
  if (flag(row.dskp_tagged, false) === true) {
    issues.push({ code: 'v2_dskp_tagged', target: 'question' })
    notes.push('v2_dskp_tagged')
  }

  const code = cur.levelCodes.get(level)
  const t = stamps(row)
  notes.push(`status.${status}`)
  return ok({
    legacyId: (row.id ?? '').trim(),
    created_at: t.created_at,
    updated_at: t.updated_at,
    published_at: status === 'approved' ? t.updated_at : null,
    status,
    live: status === 'approved',
    rejection_reason: enumKey(row.status) === 'ditolak' ? V2_REJECTED_REASON : null,
    qtype: multi ? 'mcq_multi' : 'mcq',
    created_by: text(row.created_by),
    approved_by: text(row.approved_by),
    image_path: qImage,
    is_active: !issues.some((i) => HOLD_CODES.has(i.code)),
    subject_id: subject,
    education_level_id: level,
    chapter_id: chapter,
    topic_id: topic,
    form_origin: formOriginOf(code),
    difficulty_tp: difficulty,
    stem,
    explanation,
    import_issues: issues.length > 0 ? issues : null,
    options: ordered.map((o) => ({ label: o.label, body: o.body, position: o.position })),
    correct,
    spm_pool: code === 'T4' || code === 'T5',
    notes,
  })
}
