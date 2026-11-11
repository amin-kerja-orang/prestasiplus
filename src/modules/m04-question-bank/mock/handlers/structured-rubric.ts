/**
 * M04 structured questions, "Skema & Rubrik" editor (V2 Panel `spm/subjektif-edit`): `GET/PUT /api/structured-questions/:id/rubric`.
 * Admin only. Mirrors `apps/api/src/modules/questions/structured-rubric.ts` and the `StructuredRubric*` schemas of `@pp/contract`.
 *
 * Mapping of the mock structured store (V2 shaped) onto the wire shape of the V3 part tree:
 *  - a leaf part = a sub-question that no other sub-question names as its parent; its `id` is the label path (`(a).(ii)` style, joined by `.`);
 *  - editable = a leaf with a text answer (a numeric answer has no points key, so it is read-only);
 *  - Skema = `modelAnswer`; a rubric point = a stored rubric row, its `text` the `keyword`, its `code` the `konstruk`.
 * INFERRED (not observed on live): which stored field is the point text and which the code.
 *
 * Differences from the API, kept deliberately: the stored row keeps its `published`/`draft` status after a save (the API writes the next
 * draft version while the live one stays served), so `status` of the view stays `approved` for a published row.
 */

import { StructuredRubricUpdateRequestSchema, STRUCTURED_RUBRIC_MESSAGES } from '@pp/contract'

import {
  int,
  notFound,
  ok,
  route,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { StructuredRubric, StructuredRubricSub } from '../../api/structured-rubric'
import { structuredRepo, type StructuredSubInput } from '../repository/structured'
import type { StructuredQuestion, StructuredSubQuestion } from '../repository/types'
import { adminOnly, nameLookup } from './workflow-common'

/** The API's `BODY_MESSAGE` for a body that is not a JSON object. */
export const RUBRIC_BODY_MESSAGE = 'Badan permintaan mesti objek JSON.'
/** Code of a point added in the editor (as the API). */
const NEW_POINT_CODE = 'P'

interface Leaf {
  path: string
  sub: StructuredSubQuestion
}

const byOrder = (q: StructuredQuestion): StructuredSubQuestion[] => [...q.subQuestions].sort((a, b) => a.order - b.order)

/** Label path of a sub-question through its parents. */
function pathOf(sub: StructuredSubQuestion, all: ReadonlyMap<number, StructuredSubQuestion>): string {
  const labels = [sub.partLabel]
  const seen = new Set([sub.id])
  for (let p = sub.parentSubId === null ? undefined : all.get(sub.parentSubId); p && !seen.has(p.id); p = p.parentSubId === null ? undefined : all.get(p.parentSubId)) {
    seen.add(p.id)
    labels.unshift(p.partLabel)
  }
  return labels.join('.')
}

function leavesOf(q: StructuredQuestion): Leaf[] {
  const subs = byOrder(q)
  const all = new Map(subs.map((s) => [s.id, s]))
  const parents = new Set(subs.flatMap((s) => (s.parentSubId === null ? [] : [s.parentSubId])))
  return subs.filter((s) => !parents.has(s.id)).map((sub) => ({ path: pathOf(sub, all), sub }))
}

const editableLeaf = (l: Leaf): boolean => l.sub.answerType === 'text'

function subView(l: Leaf): StructuredRubricSub {
  const editable = editableLeaf(l)
  const scheme = l.sub.modelAnswer.trim()
  return {
    id: l.path,
    number: l.sub.partLabel,
    body: l.sub.questionText,
    marks: l.sub.marks,
    editable,
    scheme: editable && scheme !== '' ? l.sub.modelAnswer : null,
    points: editable ? l.sub.rubrics.map((r, i) => ({ id: `p${String(i + 1)}`, code: r.konstruk, text: r.keyword, marks: r.marks })) : [],
  }
}

export function toRubricView(q: StructuredQuestion): StructuredRubric {
  const subs = leavesOf(q).map(subView)
  const names = nameLookup()
  return {
    question: {
      id: String(q.id),
      stimulus: q.stimulus,
      subject: names.subject(q.subjectId)?.name ?? null,
      level: names.level(q.educationLevelId)?.name ?? null,
      status: q.status === 'published' ? 'approved' : 'draft',
      totalMarks: subs.reduce((n, s) => n + s.marks, 0),
    },
    subs,
  }
}

/** First issue per path, `_` for the root (the API's `fieldsOf`). */
function fieldsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_'
    fields[key] ??= issue.message
  }
  return fields
}

type RubricInput = { id: string; scheme?: string | null | undefined; points?: { text?: string | null | undefined; marks: number }[] | undefined }

/**
 * The sub-questions with the sent leaves rewritten (the API's `applyRubric`). A sent id that is not an editable leaf of THIS question is
 * skipped; a sent rubric with no non-blank point is refused as `subs.<index>.points`. A point is matched by row position: a kept row keeps
 * its code, a new row gets code `P`.
 */
function applyRubric(q: StructuredQuestion, subs: readonly RubricInput[]): { subs: StructuredSubInput[]; errors: Record<string, string> } {
  const byId = new Map(subs.map((s, i) => [s.id, { s, i }]))
  const editable = new Set(leavesOf(q).filter(editableLeaf).map((l) => l.sub.id))
  const pathById = new Map(leavesOf(q).map((l) => [l.sub.id, l.path]))
  const errors: Record<string, string> = {}
  const out = byOrder(q).map<StructuredSubInput>((sub) => {
    const base: StructuredSubInput = {
      partLabel: sub.partLabel,
      questionText: sub.questionText,
      marks: sub.marks,
      answerType: sub.answerType,
      expectedNumeric: sub.expectedNumeric,
      numericTolerance: sub.numericTolerance,
      rubrics: sub.rubrics,
      modelAnswer: sub.modelAnswer,
      parentSubId: sub.parentSubId,
    }
    const hit = editable.has(sub.id) ? byId.get(pathById.get(sub.id) ?? '') : undefined
    if (!hit) return base
    const model = (hit.s.scheme ?? '').trim()
    let rubrics = sub.rubrics
    if (hit.s.points !== undefined) {
      rubrics = hit.s.points
        .map((row, i) => ({ text: (row.text ?? '').trim(), marks: row.marks, old: sub.rubrics[i] }))
        .filter((r) => r.text !== '')
        .map((r) => ({ konstruk: r.old?.konstruk ?? NEW_POINT_CODE, keyword: r.text, marks: r.marks }))
      if (rubrics.length === 0) {
        errors[`subs.${String(hit.i)}.points`] = STRUCTURED_RUBRIC_MESSAGES.noPoints
        return base
      }
    }
    return { ...base, modelAnswer: model, rubrics }
  })
  return { subs: out, errors }
}

function detail(req: MockRequest): MockResponse {
  const q = structuredRepo.get(req.params.id as number)
  return q ? ok(toRubricView(q)) : notFound()
}

function save(req: MockRequest, ctx: MockContext): MockResponse {
  const q = structuredRepo.get(req.params.id as number)
  // A missing record is 404 before a bad body is 422, like the API.
  if (!q) return notFound()
  const raw = req.body
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return validationError({ _: RUBRIC_BODY_MESSAGE })
  const parsed = StructuredRubricUpdateRequestSchema.safeParse(raw)
  if (!parsed.success) return validationError(fieldsOf(parsed.error.issues))
  const applied = applyRubric(q, parsed.data.subs)
  if (Object.keys(applied.errors).length > 0) return validationError(applied.errors)
  const row = ctx.transaction(() => structuredRepo.update(q.id, { subQuestions: applied.subs }, ctx.clock.now()))
  return ok(toRubricView(row ?? q), { status: STRUCTURED_RUBRIC_MESSAGES.saved })
}

export const structuredRubricRoutes: RouteDef[] = [
  route('GET', '/api/structured-questions/:id/rubric', [adminOnly], detail, { params: { id: int() } }),
  route('PUT', '/api/structured-questions/:id/rubric', [adminOnly], save, { params: { id: int() } }),
]
