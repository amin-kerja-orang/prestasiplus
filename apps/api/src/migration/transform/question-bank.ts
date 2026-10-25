/**
 * Pure side of `migrate:questions` (QLOAD, LEAD decision A): turns one archived .cloud question (status `diluluskan`, type
 * `mcq`) and its options into the plan of one published, live, single-part MCQ of the v2 bank. No I/O.
 *
 * Rules (docs/architecture/v2-data-migration.md 3.3, design in the QLOAD card):
 *  - a question that is not `diluluskan` or not an MCQ is EXCLUDED (counted, not a reject);
 *  - the leaf must satisfy the contract `QuestionLeafPartSchema` (3 to 8 options, labels A to H, non-empty texts, the key
 *    names an option): the v2 reader fails closed on a stored leaf that does not, so nothing is inserted that it would refuse;
 *  - curriculum ids come from the `migrate:core` id maps; subject and level are required, chapter and topic are optional;
 *  - `difficulty_tp` is the raw 1 to 5 (as `practice_answers.difficulty`); `cognitive_level` stays empty;
 *  - a question or option image is NOT copied: the path is kept in `import_issues` and the question is held inactive (so is one whose
 *    text still holds an image, maths or script markup after the HTML conversion, or looks like it holds personal data);
 *  - the SPM pool tag is written for Tingkatan 4 and 5 only; no DSKP unit or SP exists in .cloud.
 * Reject reasons are the kit's five; the cause is the `column`. Text never goes into a reject or a counter.
 */
import { QuestionLeafPartSchema } from '@pp/contract'

import { REDACTED_TOKEN } from '../anonymise/redacted-token'
import { mapQuestionType, parseDifficulty } from '../snapshot-dims/dims'
import { enumKey, flag, ok, reject, stamps, text, type Outcome, type Staged } from './common'

/** The only status that is loaded (BM code of .cloud `questions.status`). */
export const APPROVED_STATUS = 'diluluskan'
export const MIN_OPTIONS = 3
export const MAX_OPTIONS = 8
const LABELS = 'ABCDEFGH'

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

/** null when the row is in scope; else why not (status is checked first). */
export function exclusionOf(row: Staged): Exclusion | null {
  if (enumKey(row.status) !== APPROVED_STATUS) return { by: 'status', code: codeOf(row.status) }
  if (mapQuestionType(row.type) !== 'mcq') return { by: 'type', code: codeOf(row.type) }
  return null
}

export interface QuestionPlan {
  legacyId: string
  created_at: string
  updated_at: string
  published_at: string
  is_active: boolean
  subject_id: string
  education_level_id: string
  chapter_id: string | null
  topic_id: string | null
  form_origin: 't1_t3' | 't4' | 't5'
  difficulty_tp: number | null
  stem: string
  explanation: string | null
  /** `import_issues` of the version (structured list) or null. */
  import_issues: { code: string; target: 'question' | 'stem' | 'option' | 'explanation'; label?: string; path?: string; kind?: string }[] | null
  options: { label: string; body: string; position: number }[]
  correct: string
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
 */
export function piiKindsOf(value: string): PiiKind[] {
  const kinds: PiiKind[] = []
  if (/(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}(?!\d)/.test(value)) kinds.push('ic')
  if (/(?<!\d)(?:\+?60|0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/.test(value)) kinds.push('phone')
  if (value.includes('@')) {
    if (/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4}/.test(value)) kinds.push('email')
    if (/(?<![\w.@])@[A-Za-z0-9_.]{3,30}/.test(value)) kinds.push('handle')
  }
  if (/https?:\/\//i.test(value) || /(?<![\w.])www\./i.test(value)) kinds.push('url')
  if (value.includes(REDACTED_TOKEN)) kinds.push('redacted')
  return kinds
}

/** Plan of one in-scope question, or the reject. `row` must not be excluded (`exclusionOf` is null). */
export function transformQuestion(row: LegacyQuestion, cur: Curriculum): Outcome<QuestionPlan> {
  const notes: string[] = []
  const subject = text(row.subject_id) === null ? undefined : cur.subjects.get((row.subject_id as string).trim())
  if (subject === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  const level = text(row.education_level_id) === null ? undefined : cur.levels.get((row.education_level_id as string).trim())
  if (level === undefined) return reject('ORPHAN_PARENT', 'education_level_id')

  const rawStem = text(row.body)
  if (rawStem === null) return reject('INVALID_VALUE', 'body')
  if (rawStem.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'body')
  const stemPlain = plainFromHtml(rawStem)
  const stem = stemPlain.text
  if (stem === '') return reject('INVALID_VALUE', 'body')
  let htmlStripped = stemPlain.tags
  let entityDecoded = stemPlain.entities

  const opts = row.options
  if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) return reject('INVALID_VALUE', 'options')
  const rawBodies = opts.map((o) => text(o.body))
  if (rawBodies.some((b) => b === null)) return reject('INVALID_VALUE', 'options.body')
  if (rawBodies.some((b) => (b as string).length > MAX_BODY_CHARS)) return reject('INVALID_VALUE', 'options.body')
  const bodies = rawBodies.map((raw) => {
    const plain = plainFromHtml(raw as string)
    if (plain.tags) htmlStripped = true
    if (plain.entities) entityDecoded = true
    return plain.text
  })
  if (bodies.some((b) => b === '')) return reject('INVALID_VALUE', 'options.body')

  const labels = normaliseLabels(opts.map((o) => o.label))
  if (labels === null || labels.some((l) => l === null)) return reject('INVALID_VALUE', 'label')
  if (new Set(labels).size !== labels.length) return reject('DUPLICATE_KEY', 'label')
  if (opts.every((o) => /^[1-8]$/.test((text(o.label) ?? '').replace(/[.)]$/, '')))) notes.push('label_renumbered')

  let correct: string | null = null
  for (const [i, o] of opts.entries()) {
    const f = flag(o.is_correct, false)
    if (f === 'invalid') return reject('INVALID_VALUE', 'is_correct')
    if (f) {
      if (correct !== null) return reject('INVALID_VALUE', 'is_correct')
      correct = labels[i] as string
    }
  }
  if (correct === null) return reject('INVALID_VALUE', 'is_correct')

  const ordered = opts
    .map((_, i) => ({ label: labels[i] as string, body: bodies[i] as string, image: text(opts[i]?.image_path) }))
    .sort((a, b) => (a.label < b.label ? -1 : 1))
    .map((o, i) => ({ ...o, position: i + 1 }))

  const parsed = QuestionLeafPartSchema.safeParse({
    label: '1',
    prompt: { ms: stem },
    marks: 1,
    mode: 'mcq',
    options: ordered.map((o) => ({ label: o.label, body: { ms: o.body } })),
    key: { kind: 'option', correct },
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
  const issues: NonNullable<QuestionPlan['import_issues']> = []
  const qImage = text(row.image_path)
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
  if (issues.length > 0) notes.push('held_image')
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

  const code = cur.levelCodes.get(level)
  const t = stamps(row)
  return ok({
    legacyId: (row.id ?? '').trim(),
    created_at: t.created_at,
    updated_at: t.updated_at,
    published_at: t.updated_at,
    is_active: issues.length === 0,
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
