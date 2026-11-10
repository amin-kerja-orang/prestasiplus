/**
 * Pure side of the canonical-only loader (T-B9-7, design 9.4). No I/O.
 *
 * A canonical `exam_question` that is the projection of a legacy question or structured question (a `legacy_canonical_map` row)
 * is NOT loaded again: the legacy row stays the question. Only canonical questions with no map row (imported straight from past
 * papers) become V3 questions here, keyed by `etl_id_map('exam_questions')`.
 *
 *  - stem json -> text (`{ms,en}`, `{text}`, a block list or a rich doc); a shape this extractor does not know is a reject;
 *  - parts tree (`parent_part_id`, depth at most 3): a part with children is a branch, otherwise a leaf; V2 answer mode slug -> V3 mode;
 *  - MCQ options carry `is_correct` (V3 keeps the correct label in the key); exactly one correct option, 2 to 8 options;
 *  - key translation by mode; whatever the contract leaf schema refuses is a reject (never a placeholder key);
 *  - status by slug (`approved|published` approved, `draft` draft, `reviewed|in_review` review, `archived` archived, other: reject);
 *  - subject from the paper (`exam_papers.subject_id`, else `source_papers.subject_id`); V2 canonical questions carry no level, so the
 *    version has no education level (it cannot be served until the Studio tags it).
 */
import { ok, reject, stamps, text, type Outcome, type Staged } from '../../transform/common'
import { htmlHoldOf, MAX_BODY_CHARS, normaliseLabels, piiKindsOf, plainFromHtml, type Curriculum } from '../../transform/question-bank'
import { parseDifficulty } from '../../snapshot-dims/dims'
import type { IssuePlan, NodePlan, QuestionTreePlan, VersionStatus } from './bank-writer'
import { treeParses } from './structured-plan'

export const CANONICAL_RULES_VERSION = 'canonical-2'
const MAX_DEPTH = 3

export type CanonicalPart = Staged & {
  id: string | null
  parent_part_id: string | null
  position: string | null
  label: string | null
  prompt: string | null
  marks: string | null
  word_limit: string | null
  config: string | null
  mode_slug: string | null
  options: readonly Staged[]
  key_kind: string | null
  key_content: string | null
}
export type CanonicalQuestion = Staged & {
  status_slug: string | null
  subject_ref: string | null
  parts: readonly CanonicalPart[]
  stimulus_ids: readonly string[]
}

export function canonicalStatus(slug: string | null | undefined): VersionStatus | null {
  switch ((text(slug) ?? '').toLowerCase().replace(/[\s-]+/g, '_')) {
    case 'approved':
    case 'published':
      return 'approved'
    case 'draft':
      return 'draft'
    case 'reviewed':
    case 'in_review':
    case 'review':
      return 'review'
    case 'archived':
      return 'archived'
    default:
      return null
  }
}

/** V2 answer mode slug -> V3 leaf mode (design 9.4); null = not representable (quarantine). */
export function leafModeOf(slug: string | null | undefined): string | null {
  switch ((text(slug) ?? '').toLowerCase()) {
    case 'mcq':
      return 'mcq'
    case 'short_text':
    case 'short':
      return 'short_text'
    case 'numeric':
    case 'number':
      return 'numeric'
    case 'essay':
    case 'long':
    case 'extended_essay':
    case 'essay_choice':
    case 'numbered_list':
    case 'code':
      return 'essay'
    case 'working':
    case 'working_shown':
    case 'table_fill':
    case 'sequence_order':
    case 'gapped_text_match':
    case 'cloze':
      return 'working'
    case 'draw_on_diagram':
    case 'graph_plot':
    case 'drawing':
      return 'drawing'
    default:
      return null
  }
}

/** Plain text of a V2 JSON text value (a string, `{ms, en}`, `{text}`, a block list or a rich doc); null when empty or unknown. */
export function textOfJson(raw: string | null | undefined): string | null {
  const t = text(raw)
  if (t === null) return null
  let value: unknown = t
  if (/^[[{"]/.test(t)) {
    try {
      value = JSON.parse(t)
      // A json column that holds a json-encoded string (double encoding): read it once more.
      if (typeof value === 'string' && /^[[{]/.test(value.trim())) value = JSON.parse(value)
    } catch {
      return plainFromHtml(t).text || null
    }
  }
  const out = extractText(value, 0)
  const clean = out === null ? null : plainFromHtml(out).text.trim()
  return clean === '' ? null : clean
}

function extractText(v: unknown, depth: number): string | null {
  if (depth > 8) return null
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    const parts = v.map((x) => extractText(x, depth + 1)).filter((x): x is string => x !== null && x.trim() !== '')
    return parts.length === 0 ? null : parts.join('\n')
  }
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['ms', 'html', 'text', 'en', 'value', 'body']) {
      if (typeof o[k] === 'string' && (o[k] as string).trim() !== '') return o[k] as string
    }
    for (const k of ['content', 'children', 'blocks']) if (Array.isArray(o[k])) return extractText(o[k], depth + 1)
  }
  return null
}

function jsonOf(raw: string | null | undefined): unknown {
  const t = text(raw)
  if (t === null) return null
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

const asInt = (v: string | null | undefined): number | null => {
  const t = text(v)
  return t !== null && /^\d{1,6}$/.test(t) ? Number(t) : null
}

/** Strings of an accepted-values content (`["a"]`, `{values:[...]}`, `{accepted:[...]}`). */
function acceptedOf(content: unknown): string[] | null {
  const list = Array.isArray(content) ? content : content !== null && typeof content === 'object' ? ((content as Record<string, unknown>).values ?? (content as Record<string, unknown>).accepted) : null
  if (!Array.isArray(list)) return null
  const out = list.map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x).trim() : typeof x === 'object' && x !== null ? String((x as Record<string, unknown>).v ?? (x as Record<string, unknown>).value ?? '').trim() : '')).filter((x) => x !== '')
  return out.length === 0 ? null : out
}

const POINT_LABEL_MAX = 120
const truncate = (v: string): string => ([...v].length <= POINT_LABEL_MAX ? v : [...v].slice(0, POINT_LABEL_MAX).join('').trimEnd())

/** Every non-empty string of a json value, in document order (the fallback text of a key whose shape this loader does not know). */
function allStrings(v: unknown, depth = 0): string[] {
  if (depth > 6 || v === null || v === undefined) return []
  if (typeof v === 'string') return v.trim() === '' ? [] : [plainFromHtml(v).text.trim()].filter((x) => x !== '')
  if (typeof v === 'number') return []
  if (Array.isArray(v)) return v.flatMap((x) => allStrings(x, depth + 1))
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).flatMap((x) => allStrings(x, depth + 1))
  return []
}

/** The `points` key of a leaf from a mark-scheme or model-answer content, or null when nothing usable is in it. */
function pointsKeyOf(content: unknown, marks: number): Record<string, unknown> | null {
  let model: string | null = null
  let rows: { text: string; marks: number }[] = []
  const list = Array.isArray(content) ? content : content !== null && typeof content === 'object' ? ((content as Record<string, unknown>).points ?? null) : null
  if (content !== null && typeof content === 'object' && !Array.isArray(content)) {
    const o = content as Record<string, unknown>
    const m = o.model ?? o.answer ?? o.text ?? o.modelText ?? o.html
    model = m === undefined || m === null ? null : textOfJson(JSON.stringify(m))
  } else if (typeof content === 'string') model = text(content)
  if (Array.isArray(list)) {
    rows = list
      .map((p) => {
        if (typeof p === 'string') return { text: plainFromHtml(p).text.trim(), marks: 1 }
        const o = (p ?? {}) as Record<string, unknown>
        const raw = [o.text, o.point, o.label, o.description, o.html].find((x) => typeof x === 'string') as string | undefined
        const m = typeof o.marks === 'number' ? o.marks : typeof o.mark === 'number' ? o.mark : 1
        return { text: plainFromHtml(raw ?? '').text.trim(), marks: Math.max(0, Math.trunc(m)) }
      })
      .filter((r) => r.text !== '')
  }
  if (rows.length > 0 && rows.reduce((s, r) => s + r.marks, 0) === marks) {
    return {
      kind: 'points',
      marks,
      points: rows.map((r, i) => ({ id: `p${i + 1}`, code: 'P', label: truncate(r.text), marks: r.marks, text: { ms: r.text } })),
      ...(model === null ? {} : { modelText: model }),
    }
  }
  // A rubric of an unknown shape (a band rubric, a table): its text, in order, is the model answer.
  const body = model ?? (rows.length > 0 ? rows.map((r) => r.text).join('\n') : null) ?? (allStrings(content).join('\n') || null)
  if (body === null) return null
  return { kind: 'points', marks, points: [{ id: 'p1', code: 'P', label: rows.length > 0 ? 'Mengikut skema' : 'Jawapan model', marks, text: { ms: body } }], modelText: body }
}

/** A key that says no scheme was authored: kept as a visible placeholder (the admin completes it), and the question is never approved. */
function placeholderKey(marks: number): Record<string, unknown> {
  return { kind: 'points', marks, points: [{ id: 'p1', code: 'P', label: 'Skema belum disediakan', marks }] }
}

interface Ctx {
  notes: string[]
  issues: IssuePlan[]
  texts: { target: string; label?: string; value: string }[]
  placeholder: boolean
}

function buildLeaf(p: CanonicalPart, label: string, ctx: Ctx): Outcome<NodePlan> {
  const mode = leafModeOf(p.mode_slug)
  if (mode === null) return reject('INVALID_VALUE', 'answer_mode')
  if (!['mcq', 'short_text', 'numeric', 'essay', 'working', 'drawing'].includes((text(p.mode_slug) ?? '').toLowerCase())) ctx.notes.push('mode_approximated')
  let marks = asInt(p.marks) ?? 0
  if (marks < 1) {
    marks = 1
    ctx.notes.push('marks_floored')
  }
  const rawPrompt = textOfJson(p.prompt)
  const prompt = rawPrompt ?? label
  if (rawPrompt === null) ctx.notes.push('part_prompt_empty')
  if (prompt.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'prompt')
  ctx.texts.push({ target: 'part', label, value: prompt })
  const content = jsonOf(p.key_content)
  const wordMax = asInt(p.word_limit)
  const withPoints = (m: string): Outcome<NodePlan> => {
    const key = pointsKeyOf(content, marks)
    if (key === null) {
      ctx.placeholder = true
      ctx.issues.push({ code: 'scheme_placeholder', target: 'part', label })
      ctx.notes.push('scheme_placeholder')
    }
    return ok({ kind: 'leaf', label, prompt, marks, mode: m, key: key ?? placeholderKey(marks), ...(m === 'essay' && wordMax !== null ? { wordMax } : {}) })
  }
  if (mode === 'mcq') {
    const opts = [...p.options].sort((a, b) => (asInt(a.position) ?? 0) - (asInt(b.position) ?? 0) || Number(a.id) - Number(b.id))
    if (opts.length < 2 || opts.length > 8) return reject('INVALID_VALUE', 'options')
    const labels = normaliseLabels(opts.map((o) => o.label as string | null)) ?? []
    const positional = labels.length !== opts.length || labels.some((l) => l === null) || new Set(labels).size !== labels.length
    const finalLabels = positional ? opts.map((_, i) => 'ABCDEFGH'.charAt(i)) : (labels as string[])
    if (positional) ctx.notes.push('label_relabelled')
    // An option with no text (V2 kept a picture option as an empty body) keeps its label as its text.
    const bodies = opts.map((o, i) => {
      const b = textOfJson(o.body as string | null)
      if (b === null) ctx.notes.push('option_body_empty')
      return b ?? (finalLabels[i] as string)
    })
    const correct: string[] = []
    for (const [i, o] of opts.entries()) {
      const v = (text(o.is_correct as string | null) ?? '0').toLowerCase()
      if (['1', 'true', 't', 'ya', 'yes'].includes(v)) correct.push(finalLabels[i] as string)
      else if (!['0', 'false', 'f', 'tidak', 'no', 'n'].includes(v)) return reject('INVALID_VALUE', 'is_correct')
    }
    if (correct.length === 0) {
      // V2 also keeps the answer in the single_key row (`{option_id}`); a flag-less option list falls back to it.
      const optionId = content !== null && typeof content === 'object' && !Array.isArray(content) ? String((content as Record<string, unknown>).option_id ?? '') : ''
      const at = optionId === '' ? -1 : opts.findIndex((o) => (o.id ?? '').trim() === optionId)
      if (at >= 0) {
        correct.push(finalLabels[at] as string)
        ctx.notes.push('key_from_single_key')
      }
    }
    if (correct.length !== 1) return reject('INVALID_VALUE', 'is_correct')
    for (const [i, b] of bodies.entries()) ctx.texts.push({ target: 'option', label: finalLabels[i], value: b })
    return ok({
      kind: 'leaf', label, prompt, marks, mode,
      options: opts.map((_, i) => ({ label: finalLabels[i] as string, body: bodies[i] as string })),
      key: { kind: 'option', correct: correct[0] },
    })
  }
  if (mode === 'short_text') {
    const values = acceptedOf(content)
    if (values === null) {
      // No accepted answers (a model answer or nothing): a working leaf the pupil marks against the scheme.
      ctx.notes.push('accepted_missing_to_working')
      return withPoints('working')
    }
    return ok({ kind: 'leaf', label, prompt, marks, mode, key: { kind: 'accepted', values } })
  }
  if (mode === 'numeric') {
    const values = acceptedOf(content)
    const nums = values === null ? null : values.map((v) => Number(v.replace(',', '.')))
    if (nums === null || nums.some((n) => !Number.isFinite(n))) {
      ctx.notes.push('accepted_missing_to_working')
      return withPoints('working')
    }
    return ok({ kind: 'leaf', label, prompt, marks, mode, key: { kind: 'accepted', values: nums.map((v) => ({ v })) } })
  }
  return withPoints(mode)
}

function buildTree(parts: readonly CanonicalPart[], ctx: Ctx): Outcome<NodePlan[]> {
  const byParent = new Map<string, CanonicalPart[]>()
  for (const p of parts) {
    const k = text(p.parent_part_id) ?? ''
    byParent.set(k, [...(byParent.get(k) ?? []), p])
  }
  const order = (l: CanonicalPart[]): CanonicalPart[] => [...l].sort((a, b) => (asInt(a.position) ?? 0) - (asInt(b.position) ?? 0) || Number(a.id) - Number(b.id))
  const state: { failure: Outcome<never> | null } = { failure: null }
  const make = (list: CanonicalPart[], depth: number): NodePlan[] => {
    const nodes: NodePlan[] = []
    order(list).forEach((p, i) => {
      if (state.failure) return
      const children = byParent.get(p.id ?? '') ?? []
      const label = (text(p.label) ?? String(i + 1)).slice(0, 10)
      if (children.length > 0) {
        if (depth >= MAX_DEPTH) {
          state.failure = reject('INVALID_VALUE', 'tree')
          return
        }
        const prompt = textOfJson(p.prompt) ?? label
        nodes.push({ kind: 'branch', label, prompt, children: make(children, depth + 1) })
      } else {
        const leaf = buildLeaf(p, label, ctx)
        if (!leaf.ok) state.failure = leaf
        else nodes.push(leaf.value)
      }
    })
    return nodes
  }
  const roots = make(byParent.get('') ?? [], 1)
  if (state.failure) return state.failure
  if (roots.length === 0) return reject('INVALID_VALUE', 'parts')
  const dedupe = (list: NodePlan[]): void => {
    if (new Set(list.map((n) => n.label)).size !== list.length) {
      list.forEach((n, i) => (n.label = String(i + 1)))
      ctx.notes.push('label_positional')
    }
    for (const n of list) if (n.kind === 'branch') dedupe(n.children)
  }
  dedupe(roots)
  return ok(roots)
}

/** The V3 question type of a canonical tree. */
export function questionTypeOf(tree: readonly NodePlan[]): string {
  const only = tree.length === 1 ? tree[0] : undefined
  if (only === undefined || only.kind === 'branch') return 'structured'
  switch (only.mode) {
    case 'mcq':
      return 'mcq'
    case 'short_text':
    case 'numeric':
      return 'short'
    case 'working':
      return 'working'
    case 'drawing':
      return 'drawing'
    default:
      return 'essay'
  }
}

export function transformCanonical(
  row: CanonicalQuestion,
  cur: Curriculum,
  stimulusOf: ReadonlyMap<string, string>,
): Outcome<QuestionTreePlan> {
  const status = canonicalStatus(row.status_slug)
  if (status === null) return reject('UNKNOWN_ENUM', 'status_id')
  const subjectRef = text(row.subject_ref)
  const subject = subjectRef === null ? undefined : cur.subjects.get(subjectRef)
  if (subject === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  let rawStem = textOfJson(row.stem)
  const stemNotes: string[] = []
  if (rawStem === null) {
    // V2 keeps an empty stem on a question whose text sits in its first part (a structured paper question): that prompt is the stem.
    const first = [...row.parts].sort((a, b) => (asInt(a.position) ?? 0) - (asInt(b.position) ?? 0) || Number(a.id) - Number(b.id)).map((x) => textOfJson(x.prompt)).find((x) => x !== null) ?? null
    if (first === null) return reject('INVALID_VALUE', 'stem')
    rawStem = first
    stemNotes.push('stem_from_part')
  }
  if (rawStem.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'stem')

  const ctx: Ctx = { notes: [...stemNotes], issues: [], texts: [{ target: 'stem', value: rawStem }], placeholder: false }
  const tree = buildTree(row.parts, ctx)
  if (!tree.ok) return tree
  // A single leaf that has no prompt of its own shows only the stem (the label would be appended to it), like a question made in the Studio.
  const only = tree.value.length === 1 ? tree.value[0] : undefined
  if (only?.kind === 'leaf' && row.parts.length === 1 && textOfJson(row.parts[0]?.prompt) === null) only.prompt = ''
  if (!treeParses(tree.value)) return reject('INVALID_VALUE', 'tree')

  const seen = new Set<string>()
  const holds = new Set<string>()
  for (const t of ctx.texts) {
    const hold = htmlHoldOf(t.value)
    if (hold !== null) {
      ctx.issues.push({ code: hold, target: t.target, ...(t.label === undefined ? {} : { label: t.label }) })
      holds.add(hold)
    }
    for (const kind of piiKindsOf(t.value)) {
      const key = `${t.target}:${t.label ?? ''}:${kind}`
      if (seen.has(key)) continue
      seen.add(key)
      ctx.issues.push({ code: 'pii_suspect', target: t.target, ...(t.label === undefined ? {} : { label: t.label }), kind })
    }
  }
  for (const c of holds) ctx.notes.push(`held_${c}`)
  if (seen.size > 0) ctx.notes.push('held_pii_suspect')

  const stimulusIds: string[] = []
  for (const id of row.stimulus_ids) {
    const hit = stimulusOf.get(id)
    if (hit === undefined) ctx.notes.push('stimulus_not_loaded')
    else if (!stimulusIds.includes(hit)) stimulusIds.push(hit)
  }
  if (stimulusIds.length > 3) {
    ctx.notes.push('stimulus_cut_to_3')
    stimulusIds.length = 3
  }
  const chapterRaw = text(row.chapter_id)
  const chapter = chapterRaw === null ? null : (cur.chapters.get(chapterRaw) ?? null)
  if (chapterRaw !== null && chapter === null) ctx.notes.push('chapter_unmapped')
  const difficulty = parseDifficulty(row.difficulty)
  // V2 canonical questions carry no level; every one comes from an SPM (percubaan) paper, so it is a Tingkatan 5 question (form_origin t5,
  // the exam year). Without a T5 level in the curriculum the question stays level-less (it cannot be served until the Studio tags it).
  const t5 = [...cur.levelCodes].find(([, code]) => code === 'T5')?.[0] ?? null
  ctx.notes.push('source_paper_not_linked', t5 === null ? 'level_missing' : 'level_from_spm_paper')
  let finalStatus = status
  if (status === 'approved' && ctx.placeholder) {
    finalStatus = 'review'
    ctx.notes.push('approved_to_review_no_scheme')
  }
  const t = stamps(row)
  return ok({
    idEntity: 'exam_questions',
    idKey: (row.id ?? '').trim(),
    legacyId: null,
    type: questionTypeOf(tree.value),
    status: finalStatus,
    is_active: ctx.issues.filter((i) => i.code !== 'scheme_placeholder').length === 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
    subject_id: subject,
    education_level_id: t5,
    chapter_id: chapter,
    topic_id: null,
    form_origin: t5 === null ? 't4' : 't5',
    difficulty_tp: difficulty,
    kbat: null,
    number_label: text(row.number_label),
    stem: rawStem,
    explanation: null,
    declared_marks: null,
    rejection_reason: null,
    import_issues: ctx.issues.length > 0 ? ctx.issues : null,
    created_by_id: null,
    spm_pool: false,
    tree: tree.value,
    ...(stimulusIds.length > 0 ? { stimulusIds } : {}),
    notes: ctx.notes,
  })
}
