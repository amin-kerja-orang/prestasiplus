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
 *  - an image (question or option) is NOT copied: the path is kept in `import_issues` and the question is held inactive;
 *  - the SPM pool tag is written for Tingkatan 4 and 5 only; no DSKP unit or SP exists in .cloud.
 * Reject reasons are the kit's five; the cause is the `column`. Text never goes into a reject or a counter.
 */
import { QuestionLeafPartSchema } from '@pp/contract'

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
  import_issues: { code: string; target: 'question' | 'option'; label?: string; path: string }[] | null
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

/**
 * The learner UI shows a stem, an option and an explanation as escaped text (Vue interpolation; Bijak SPM adds `$latex$`
 * spans; the explanation is a small Markdown subset), never as HTML. A legacy body that holds HTML would show its tags.
 * So a SMALL, KNOWN tag set is converted to plain text: line breaks for `br`, closing `p`, `div` and `li`; `sup` and `sub`
 * to Unicode (or `^(..)` / `_(..)`); every other listed tag is dropped; the five basic entities and `&nbsp;` are decoded.
 * Unknown tags stay as they are (a `<` in "x < y" or "a<b" is never touched) and the question is counted `body_has_html`.
 */
const KNOWN_TAG = '(?:p|br|div|span|b|strong|i|em|u|sub|sup|font|ol|ul|li)'
const KNOWN_TAG_RE = new RegExp(`</?${KNOWN_TAG}(?:\\s[^<>]*)?/?>`, 'i')
const SUP: Record<string, string> = { '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079', '+': '\u207a', '-': '\u207b', n: '\u207f' }
const SUB: Record<string, string> = { '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083', '4': '\u2084', '5': '\u2085', '6': '\u2086', '7': '\u2087', '8': '\u2088', '9': '\u2089', '+': '\u208a', '-': '\u208b' }
const script = (inner: string, map: Record<string, string>, mark: string): string => {
  const plain = inner.replace(/<[^>]*>/g, '').trim()
  if (plain === '') return ''
  return [...plain].every((c) => map[c] !== undefined) ? [...plain].map((c) => map[c]).join('') : `${mark}(${plain})`
}

/** Plain text of a legacy body that holds a known tag; `null` when it holds none (the caller keeps the value as it is). */
export function plainFromHtml(value: string): string | null {
  if (!KNOWN_TAG_RE.test(value)) return null
  const out = value
    .replace(/<sup(?:\s[^<>]*)?>([\s\S]*?)<\/sup>/gi, (_, inner: string) => script(inner, SUP, '^'))
    .replace(/<sub(?:\s[^<>]*)?>([\s\S]*?)<\/sub>/gi, (_, inner: string) => script(inner, SUB, '_'))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(new RegExp(`</?${KNOWN_TAG}(?:\\s[^<>]*)?/?>`, 'gi'), '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return out
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
  const stemPlain = plainFromHtml(rawStem)
  const stem = stemPlain ?? rawStem
  if (stem === '') return reject('INVALID_VALUE', 'body')
  let htmlStripped = stemPlain !== null

  const opts = row.options
  if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) return reject('INVALID_VALUE', 'options')
  const bodies = opts.map((o) => {
    const raw = text(o.body)
    const plain = raw === null ? null : plainFromHtml(raw)
    if (plain !== null) htmlStripped = true
    return plain ?? raw
  })
  if (bodies.some((b) => b === null || b === '')) return reject('INVALID_VALUE', 'options.body')

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
  const rawExplanation = text(row.explanation)
  const explanationPlain = rawExplanation === null ? null : plainFromHtml(rawExplanation)
  if (htmlStripped) notes.push('html_stripped')
  if (explanationPlain !== null) notes.push('explanation_html_stripped')
  if (HTML.test(stem) || ordered.some((o) => HTML.test(o.body))) notes.push('body_has_html')

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
    explanation: explanationPlain === null ? rawExplanation : explanationPlain === '' ? null : explanationPlain,
    import_issues: issues.length > 0 ? issues : null,
    options: ordered.map((o) => ({ label: o.label, body: o.body, position: o.position })),
    correct,
    spm_pool: code === 'T4' || code === 'T5',
    notes,
  })
}
