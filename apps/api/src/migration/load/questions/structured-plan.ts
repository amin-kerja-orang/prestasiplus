/**
 * Pure side of the structured and subjective loaders (T-B9-6, design v2-question-bank-migration.md sections 4.1, 9.1 to 9.3). No I/O.
 *
 *  - A V2 `structured_questions` row becomes one question (type `structured`): its `stimulus` text is the stem, each sub-question is a
 *    LEAF part (the number parsed into a label path, `(a)(i)` nests under a branch `(a)` only when no plain `(a)` sub-question exists),
 *    its Skema is the `modelText` of a `points` key and its rubric points are the key points (shape read by `structured-rubric.ts`).
 *  - A V2 `questions` row of type `subjektif` becomes an `essay` question with one essay leaf (1 mark: V2 holds none) whose key is a
 *    single point carrying the explanation as the model answer.
 *  - Mode: V2 has none. The contract allows a `points` key only on `working`, `drawing` and `essay` (a `short_text` leaf needs an
 *    `accepted` key, which cannot carry the Skema), so 1 to 2 marks are `working` (a short answer the pupil marks against the
 *    Skema) and 3 or more are `essay`. This replaces the design's `short_text` for 1 to 2 marks (report: design deviation).
 *  - Status follows the design table 4.1; an approved question without a scheme is loaded as `review` (cannot be marked).
 * Every leaf is validated with the contract read schema; a tree that does not parse is a reject, never a half-formed row.
 */
import { QuestionPartReadV3Schema } from '@pp/contract'

import { enumKey, ok, reject, stamps, text, type Outcome, type Staged } from '../../transform/common'
import { formOriginOf, htmlHoldOf, MAX_BODY_CHARS, piiKindsOf, plainFromHtml, type Curriculum } from '../../transform/question-bank'
import { parseDifficulty } from '../../snapshot-dims/dims'
import type { IssuePlan, NodePlan, QuestionTreePlan, VersionStatus } from './bank-writer'
import { leafMarksOf } from './bank-writer'

export const STRUCTURED_RULES_VERSION = 'structured-1'

/** V2 status code -> version status; `rejection` is set for the one `ditolak` row. */
export function statusOf(raw: string | null | undefined): { status: VersionStatus; rejection: string | null } | null {
  switch (enumKey(raw)) {
    case 'diluluskan':
      return { status: 'approved', rejection: null }
    case 'diarkib':
      return { status: 'archived', rejection: null }
    case 'draf':
      return { status: 'draft', rejection: null }
    case 'ditolak':
      return { status: 'draft', rejection: 'Ditolak di V2.' }
    case 'menunggu':
      return { status: 'review', rejection: null }
    default:
      return null
  }
}

export type LegacyRubricPoint = Staged & {
  id: string | null
  code: string | null
  text: string | null
  marks: string | null
  position: string | null
}
export type LegacySubQuestion = Staged & {
  id: string | null
  number: string | null
  body: string | null
  marks: string | null
  scheme: string | null
  rubric: readonly LegacyRubricPoint[]
}
export type LegacyStructured = Staged & { subs: readonly LegacySubQuestion[] }

const KBAT = new Set(['mengaplikasi', 'menganalisis', 'menilai', 'mencipta'])

/** `kbat_level` of V2 to the V3 KBAT value; anything else (`lots`, `bukan kbat`, blank) is not KBAT. */
export function kbatOf(raw: string | null | undefined): string | null {
  const k = enumKey(raw)
  return k !== null && KBAT.has(k) ? k : null
}

/** 1 to 2 marks `working`, 3 or more `essay` (see the header). */
export const modeOfMarks = (marks: number): 'working' | 'essay' => (marks <= 2 ? 'working' : 'essay')

/** Label path of a V2 sub-question number: `1` -> [`1`], `(a)` -> [`(a)`], `1(a)` -> [`(a)`], `(a)(i)` -> [`(a)`, `(i)`]. */
export function labelPathOf(raw: string | null | undefined): string[] {
  const s = (text(raw) ?? '').replace(/\s+/g, '')
  const groups = [...s.matchAll(/\(([^()]{1,8})\)/g)].map((m) => `(${m[1]})`)
  if (groups.length > 0) return groups.slice(0, 3)
  const plain = s.replace(/[.)]+$/, '')
  return [plain === '' ? '' : plain]
}

interface Leaf {
  sub: LegacySubQuestion
  path: string[]
  marks: number
}

const POINT_LABEL_MAX = 120

function truncate(value: string, n: number): string {
  const chars = [...value]
  return chars.length <= n ? value : chars.slice(0, n).join('').trimEnd()
}

const asInt = (v: string | null | undefined): number | null => {
  const t = text(v)
  return t !== null && /^\d{1,6}$/.test(t) ? Number(t) : null
}

interface KeyBuild {
  key: Record<string, unknown>
  placeholder: boolean
  notes: string[]
}

/** The `points` key of a leaf from its Skema text and rubric points (design 9.1 rows "scheme", "rubric", "no scheme"). */
export function buildPointsKey(marks: number, schemeRaw: string | null, rubric: readonly { text: string; marks: number }[]): KeyBuild {
  const scheme = schemeRaw === null ? null : (text(plainFromHtml(schemeRaw).text) ?? null)
  const notes: string[] = []
  const usable = rubric.filter((r) => text(r.text) !== null)
  const base = (points: Record<string, unknown>[]): Record<string, unknown> => ({
    kind: 'points',
    marks,
    points,
    ...(scheme === null ? {} : { modelText: scheme }),
  })
  if (usable.length > 0) {
    const sum = usable.reduce((s, r) => s + r.marks, 0)
    if (sum === marks) {
      const points = usable.map((r, i) => ({
        id: `p${i + 1}`,
        code: 'P',
        label: truncate(r.text.trim(), POINT_LABEL_MAX),
        marks: r.marks,
        text: { ms: r.text.trim() },
      }))
      return { key: base(points), placeholder: false, notes }
    }
    notes.push('rubric_sum_mismatch')
    const joined = usable.map((r) => r.text.trim()).join('\n')
    const key = {
      kind: 'points',
      marks,
      points: [{ id: 'p1', code: 'P', label: 'Mengikut skema', marks }],
      modelText: scheme === null ? joined : `${scheme}\n${joined}`,
    }
    return { key, placeholder: false, notes }
  }
  if (scheme !== null) {
    return {
      key: base([{ id: 'p1', code: 'P', label: truncate(scheme, POINT_LABEL_MAX), marks, text: { ms: scheme } }]),
      placeholder: false,
      notes,
    }
  }
  return { key: base([{ id: 'p1', code: 'P', label: 'Skema belum disediakan', marks }]), placeholder: true, notes }
}

const toContract = (n: NodePlan): unknown =>
  n.kind === 'leaf'
    ? { label: n.label, prompt: { ms: n.prompt }, marks: n.marks, mode: n.mode, key: n.key, ...(n.options ? { options: n.options.map((o) => ({ label: o.label, body: { ms: o.body ?? '' } })) } : {}) }
    : { label: n.label, prompt: { ms: n.prompt }, children: n.children.map(toContract) }

/** Contract check of a whole tree (the stored shape the Studio and the pupil reads parse). */
export function treeParses(tree: readonly NodePlan[]): boolean {
  return tree.every((n) => QuestionPartReadV3Schema.safeParse(toContract(n)).success)
}

interface Held {
  issues: IssuePlan[]
  holdCodes: Set<string>
  pii: boolean
}

function screen(parts: readonly { target: string; label?: string; value: string }[]): Held {
  const issues: IssuePlan[] = []
  const holdCodes = new Set<string>()
  const seen = new Set<string>()
  for (const t of parts) {
    const hold = htmlHoldOf(t.value)
    if (hold !== null) {
      issues.push({ code: hold, target: t.target, ...(t.label === undefined ? {} : { label: t.label }) })
      holdCodes.add(hold)
    }
    for (const kind of piiKindsOf(t.value)) {
      const key = `${t.target}:${t.label ?? ''}:${kind}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({ code: 'pii_suspect', target: t.target, ...(t.label === undefined ? {} : { label: t.label }), kind })
    }
  }
  return { issues, holdCodes, pii: seen.size > 0 }
}

/** Plan of one V2 structured question, or the reject. */
export function transformStructured(row: LegacyStructured, cur: Curriculum, userOf: ReadonlyMap<string, string> = new Map()): Outcome<QuestionTreePlan> {
  const notes: string[] = []
  const st = statusOf(row.status)
  if (st === null) return reject('UNKNOWN_ENUM', 'status', { enumValue: enumKey(row.status) ?? undefined })
  const subject = text(row.subject_id) === null ? undefined : cur.subjects.get((row.subject_id as string).trim())
  if (subject === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  const level = text(row.education_level_id) === null ? undefined : cur.levels.get((row.education_level_id as string).trim())
  if (level === undefined) return reject('ORPHAN_PARENT', 'education_level_id')

  const rawStem = text(row.stimulus)
  if (rawStem === null || rawStem.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'stimulus')
  const stem = plainFromHtml(rawStem).text
  if (stem === '') return reject('INVALID_VALUE', 'stimulus')

  if (row.subs.length === 0) return reject('INVALID_VALUE', 'sub_questions')
  const leaves: Leaf[] = []
  for (const sub of row.subs) {
    let marks = asInt(sub.marks) ?? 1
    if (marks < 1) {
      marks = 1
      notes.push('marks_floored')
    }
    leaves.push({ sub, path: labelPathOf(sub.number), marks })
  }
  // Stripping a leading question number can make two sub-questions collide (`1(a)` and `2(a)`): then every number is kept whole.
  if (new Set(leaves.map((l) => l.path.join('|'))).size !== leaves.length) {
    for (const l of leaves) l.path = [(text(l.sub.number) ?? '').replace(/\s+/g, '')]
    notes.push('label_kept_number')
  }
  // A plain `(a)` sub-question (one token) blocks nesting under `(a)`: the whole list then stays flat.
  const plain = new Set(leaves.filter((l) => l.path.length === 1).map((l) => l.path[0] as string))
  const blocked = leaves.some((l) => l.path.length > 1 && l.path.slice(0, -1).some((_, i) => plain.has(l.path.slice(0, i + 1).join('\u0000'))))
  if (blocked) notes.push('label_flat')

  const tree: NodePlan[] = []
  let placeholder = false
  let rubricMismatch = false
  const held: { target: string; label?: string; value: string }[] = [{ target: 'stem', value: stem }]
  const issues: IssuePlan[] = []
  const branchOf = new Map<string, NodePlan & { kind: 'branch' }>()
  for (const l of leaves) {
    const rawBody = text(l.sub.body)
    if (rawBody !== null && rawBody.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'sub_questions.body')
    const rawScheme = text(l.sub.scheme)
    if (rawScheme !== null && rawScheme.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'sub_questions.scheme')
    const sorted = [...l.sub.rubric].sort((a, b) => (asInt(a.position) ?? 0) - (asInt(b.position) ?? 0) || Number(a.id) - Number(b.id))
    const rubric = sorted.map((r) => {
      const t = text(r.text)
      return { text: t === null ? '' : plainFromHtml(t).text, marks: asInt(r.marks) ?? 0 }
    })
    const built = buildPointsKey(l.marks, rawScheme, rubric)
    if (built.placeholder) placeholder = true
    if (built.notes.includes('rubric_sum_mismatch')) rubricMismatch = true

    const path = blocked ? [l.path.join('')] : l.path
    const baseLabel = path[path.length - 1] as string
    let prompt = rawBody === null ? '' : plainFromHtml(rawBody).text
    if (prompt === '') {
      prompt = baseLabel === '' ? '1' : baseLabel
      notes.push('sub_body_empty')
    }
    const leaf: NodePlan = { kind: 'leaf', label: baseLabel, prompt, marks: l.marks, mode: modeOfMarks(l.marks), key: built.key }
    held.push({ target: 'part', label: baseLabel, value: prompt })
    if (rawScheme !== null) held.push({ target: 'scheme', label: baseLabel, value: rawScheme })
    if (built.placeholder) issues.push({ code: 'scheme_placeholder', target: 'part', label: baseLabel })

    let siblings = tree
    for (const [i, token] of path.slice(0, -1).entries()) {
      const bkey = path.slice(0, i + 1).join('\u0000')
      let b = branchOf.get(bkey)
      if (b === undefined) {
        b = { kind: 'branch', label: token, prompt: token, children: [] }
        branchOf.set(bkey, b)
        siblings.push(b)
      }
      siblings = b.children
    }
    siblings.push(leaf)
  }
  if (rubricMismatch) notes.push('rubric_sum_mismatch')
  if (placeholder) notes.push('scheme_placeholder')

  // Sibling labels must be unique and at most 10 characters: otherwise relabel that sibling list by position.
  const relabel = (list: NodePlan[]): void => {
    const labels = list.map((n) => n.label)
    if (new Set(labels).size !== labels.length || labels.some((x) => x === '' || [...x].length > 10)) {
      list.forEach((n, i) => (n.label = String(i + 1)))
      notes.push('label_positional')
    }
    for (const n of list) if (n.kind === 'branch') relabel(n.children)
  }
  relabel(tree)

  const leafTotal = leafMarksOf(tree)
  const declaredRaw = asInt(row.total_marks)
  const declared = declaredRaw !== null && declaredRaw === leafTotal ? declaredRaw : null
  if (declaredRaw !== null && declared === null) notes.push('marks_mismatch')

  if (!treeParses(tree)) return reject('INVALID_VALUE', 'tree')

  const screened = screen(held)
  issues.push(...screened.issues)
  for (const c of screened.holdCodes) notes.push(`held_${c}`)
  if (screened.pii) notes.push('held_pii_suspect')

  let status = st.status
  if (status === 'approved' && placeholder) {
    status = 'review'
    notes.push('approved_to_review_no_scheme')
  }
  const kbat = kbatOf(row.kbat_level)
  if (text(row.kbat_level) !== null && kbat === null) notes.push('kbat_not_kbat')
  const t = stamps(row)
  const creator = text(row.created_by)
  const levelCode = cur.levelCodes.get(level)
  return ok({
    idEntity: 'structured_questions',
    idKey: (row.id ?? '').trim(),
    legacyId: null,
    type: 'structured',
    status,
    is_active: screened.issues.filter((i) => i.code !== 'scheme_placeholder').length === 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
    subject_id: subject,
    education_level_id: level,
    chapter_id: null,
    topic_id: null,
    form_origin: formOriginOf(levelCode),
    difficulty_tp: null,
    kbat,
    number_label: null,
    stem,
    explanation: null,
    declared_marks: declared,
    rejection_reason: st.rejection,
    import_issues: issues.length > 0 ? issues : null,
    created_by_id: creator === null ? null : (userOf.get(creator) ?? null),
    spm_pool: levelCode === 'T4' || levelCode === 'T5',
    tree,
    notes,
  })
}

/** Plan of one V2 subjective question (`questions.type = subjektif`), or the reject. */
export function transformSubjective(row: Staged, cur: Curriculum, userOf: ReadonlyMap<string, string> = new Map()): Outcome<QuestionTreePlan> {
  const notes: string[] = ['marks_unknown']
  const st = statusOf(row.status)
  if (st === null) return reject('UNKNOWN_ENUM', 'status', { enumValue: enumKey(row.status) ?? undefined })
  const subject = text(row.subject_id) === null ? undefined : cur.subjects.get((row.subject_id as string).trim())
  if (subject === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  const level = text(row.education_level_id) === null ? undefined : cur.levels.get((row.education_level_id as string).trim())
  if (level === undefined) return reject('ORPHAN_PARENT', 'education_level_id')
  const rawStem = text(row.body)
  if (rawStem === null || rawStem.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'body')
  const stemPlain = plainFromHtml(rawStem)
  if (stemPlain.text === '') return reject('INVALID_VALUE', 'body')
  const rawExplanation = text(row.explanation)
  if (rawExplanation !== null && rawExplanation.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'explanation')
  const explanation = rawExplanation === null ? null : (text(plainFromHtml(rawExplanation).text) ?? null)

  const built = explanation === null
    ? buildPointsKey(1, null, [])
    : { key: { kind: 'points', marks: 1, points: [{ id: 'p1', code: 'P', label: 'Jawapan model', marks: 1, text: { ms: explanation } }], modelText: explanation }, placeholder: false }
  const leaf: NodePlan = { kind: 'leaf', label: '1', prompt: stemPlain.text, marks: 1, mode: 'essay', key: built.key }
  const tree = [leaf]
  if (!treeParses(tree)) return reject('INVALID_VALUE', 'tree')

  const issues: IssuePlan[] = []
  const qImage = text(row.image_path)
  if (qImage !== null) {
    issues.push({ code: 'legacy_image_unresolved', target: 'question', path: qImage })
    notes.push('question_image')
  }
  const screened = screen([
    { target: 'stem', value: stemPlain.text },
    ...(explanation === null ? [] : [{ target: 'explanation', value: explanation }]),
  ])
  issues.push(...screened.issues)
  for (const c of screened.holdCodes) notes.push(`held_${c}`)
  if (screened.pii) notes.push('held_pii_suspect')
  if (built.placeholder) {
    issues.push({ code: 'scheme_placeholder', target: 'part', label: '1' })
    notes.push('scheme_placeholder')
  }
  let status = st.status
  if (status === 'approved' && built.placeholder) {
    status = 'review'
    notes.push('approved_to_review_no_scheme')
  }
  const difficulty = parseDifficulty(row.difficulty_level)
  if (difficulty === null) notes.push('difficulty_missing')
  const topicRaw = text(row.topic_id)
  const chapterRaw = text(row.chapter_id)
  let topic = topicRaw === null ? null : (cur.topics.get(topicRaw) ?? null)
  let chapter = chapterRaw === null ? null : (cur.chapters.get(chapterRaw) ?? null)
  if (topic !== null) {
    const parent = cur.topicChapter.get(topic) ?? null
    if (chapter === null && parent !== null) chapter = parent
    else if (chapter !== null && parent !== chapter) topic = null
  }
  const t = stamps(row)
  const creator = text(row.created_by)
  const levelCode = cur.levelCodes.get(level)
  return ok({
    idEntity: 'questions',
    idKey: (row.id ?? '').trim(),
    legacyId: (row.id ?? '').trim(),
    type: 'essay',
    status,
    is_active: issues.filter((i) => i.code !== 'scheme_placeholder').length === 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
    subject_id: subject,
    education_level_id: level,
    chapter_id: chapter,
    topic_id: topic,
    form_origin: formOriginOf(levelCode),
    difficulty_tp: difficulty,
    kbat: null,
    number_label: null,
    stem: stemPlain.text,
    explanation: null,
    declared_marks: null,
    rejection_reason: st.rejection,
    import_issues: issues.length > 0 ? issues : null,
    created_by_id: creator === null ? null : (userOf.get(creator) ?? null),
    spm_pool: levelCode === 'T4' || levelCode === 'T5',
    tree,
    notes,
  })
}
