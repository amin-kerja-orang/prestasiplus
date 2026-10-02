/**
 * M04 diagram audit (SRS §7 #23–#25, BR-M04-19, FR-M04-95…101). Admin-only.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 23 | `GET /api/diagram-audit` | `subjectId, schoolId, mcqPage, strPage`; two lists (id desc, 20 per page) |
 * | 24 | `POST /api/diagram-audit/:kind/:id/image` | multipart `image`; 404, 422 |
 * | 25 | `POST /api/diagram-audit/:kind/:id/dismiss` | 404 |
 *
 * `subjectId` filters both lists, `schoolId` the MCQ list only (matched against the school of the
 * question's creator, INFERRED). The stat cards are the filtered list counts (DV-M04-11); the subject
 * pills are the top 10 by MCQ count, unfiltered. An unknown or malformed filter value matches nothing.
 * The image upload is simulated: the MIME type (JPG, PNG, WebP, GIF; SVG refused, SEC-M04-02) and the
 * size (2 MB, INFERRED like the S2 images) are checked and an object URL is kept.
 */

import {
  ok,
  pageMeta,
  pageParams,
  route,
  validationError,
  int,
  notFound,
  str,
  type MockContext,
  type MockQuery,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { DiagramMcqItem, DiagramStructuredItem } from '../../api/diagram-audit'
import { questionsRepo } from '../repository/questions'
import { structuredRepo } from '../repository/structured'
import {
  adminOnly,
  bodyOf,
  DIAGRAM_MIMES,
  excerpt,
  IMAGE_MAX_BYTES,
  nameLookup,
  NO_MATCH,
  queryFilterId,
  storeUpload,
  uploadedFile,
  userRef,
} from './workflow-common'

/** SRS §8 S11 flashes (UNVERIFIED COPY). */
export const DIAGRAM_UPLOADED_TEXT = 'Gambar rajah berjaya dimuat naik.'
export const DIAGRAM_DISMISSED_TEXT = 'Soalan telah dikeluarkan daripada senarai audit.'
/** SRS §5 (S11 `image`) and the S2 image rule. */
export const DIAGRAM_FILE_REQUIRED = 'Sila pilih fail gambar.'
export const DIAGRAM_FILE_TYPE =
  'Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.'
/** FR-M04-98: the structured text is cut at 400 characters. */
export const DIAGRAM_EXCERPT_LENGTH = 400
const PAGE_SIZE = 20
const PILL_COUNT = 10

/**
 * Memo of the two costly reads (the unfiltered subject pills and the creators of a school). It is
 * valid for one db commit: every write (dismiss, upload, question create / update / delete, a user
 * edit) is a commit and moves `db.lastSeq`. The unfiltered flagged total is part of the key too, so
 * a `reset()` (which restarts the sequence) cannot revive a stale entry.
 */
interface Memo {
  key: string
  pills: { name: string; count: number }[] | null
  creators: Map<number, number[]>
}
let memo: Memo | null = null

function memoFor(ctx: MockContext): Memo {
  const key = `${String(ctx.db.lastSeq)}:${String(questionsRepo.count('Q-FLAGGED-MCQ'))}`
  if (memo?.key !== key) memo = { key, pills: null, creators: new Map() }
  return memo
}

/** For tests: drops the memo. */
export function clearDiagramAuditMemo(): void {
  memo = null
}

/** Users whose questions belong to a school (INFERRED, BR-M04-19): its teachers, school admins and admins. */
function creatorsOfSchool(schoolId: number, m: Memo): number[] {
  if (schoolId === NO_MATCH) return []
  const hit = m.creators.get(schoolId)
  if (hit) return hit
  const ids = new Set<number>()
  for (const role of ['teacher', 'school_admin', 'admin'] as const) {
    for (const u of users.adminList({ role, schoolId, page: 1, pageSize: 100_000 }).rows) {
      ids.add(u.id)
    }
  }
  const out = [...ids]
  m.creators.set(schoolId, out)
  return out
}

function listQuery(query: MockQuery) {
  return {
    subjectId: queryFilterId(query, 'subjectId'),
    schoolId: queryFilterId(query, 'schoolId'),
    mcq: pageParams(query, { pageSize: PAGE_SIZE, pageKey: 'mcqPage' }),
    str: pageParams(query, { pageSize: PAGE_SIZE, pageKey: 'strPage' }),
  }
}

function audit(req: MockRequest, ctx: MockContext): MockResponse {
  const q = listQuery(req.query)
  const m = memoFor(ctx)
  const names = nameLookup()

  const mcq = questionsRepo.flagged({
    ...(q.subjectId !== undefined ? { subjectId: q.subjectId } : {}),
    ...(q.schoolId !== undefined ? { creatorIds: creatorsOfSchool(q.schoolId, m) } : {}),
    page: q.mcq.page,
  })
  const str = structuredRepo.flagged({
    ...(q.subjectId !== undefined ? { subjectId: q.subjectId } : {}),
    page: q.str.page,
  })

  const mcqItems: DiagramMcqItem[] = mcq.rows.map((r) => ({
    id: r.id,
    questionText: r.questionText,
    subject: names.subject(r.subjectId),
    createdBy: userRef(r.createdBy),
    sourceFile: r.sourceFile,
    sourcePage: r.sourcePage,
  }))
  const strItems: DiagramStructuredItem[] = str.rows.map((r) => ({
    id: r.id,
    stimulusExcerpt: excerpt(r.stimulus, DIAGRAM_EXCERPT_LENGTH),
    subject: names.subject(r.subjectId),
    createdBy: userRef(r.createdBy),
    sourceFile: r.sourceFile,
    sourcePage: r.sourcePage,
  }))

  // Top 10 subjects by flagged MCQ count, global under every filter (BR-M04-19).
  m.pills ??= curriculum
    .subjects()
    .map((s) => ({ id: s.id, name: s.name, count: questionsRepo.count('Q-FLAGGED-MCQ', s.id) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.id - b.id)
    .slice(0, PILL_COUNT)
    .map(({ name, count }) => ({ name, count }))
  const bySubject = m.pills

  return ok(
    {
      mcq: { items: mcqItems, meta: pageMeta(mcq.total, q.mcq, mcqItems.length) },
      structured: { items: strItems, meta: pageMeta(str.total, q.str, strItems.length) },
    },
    {
      meta: {
        stats: { mcq: mcq.total, structured: str.total, total: mcq.total + str.total },
        bySubject,
        unfilteredMcq: questionsRepo.count('Q-FLAGGED-MCQ'),
      },
    },
  )
}

/** The MIME / size check of #24. Returns the 422 fields, or `null` when the file is acceptable. */
function imageError(value: unknown): { image: string } | null {
  const file = uploadedFile(value)
  if (!file) return { image: DIAGRAM_FILE_REQUIRED }
  if (!file.mime.startsWith('image/')) return { image: DIAGRAM_FILE_REQUIRED }
  if (!DIAGRAM_MIMES.includes(file.mime) || file.size > IMAGE_MAX_BYTES) {
    return { image: DIAGRAM_FILE_TYPE }
  }
  return null
}

type Kind = 'mcq' | 'structured'

function resolve(
  kind: Kind,
  id: number,
  image: string | null,
  now: number,
): { id: number; needsDiagram: false } | null {
  if (kind === 'mcq') {
    const row = questionsRepo.get(id)
    // PKSK rows are not part of the M04 lists (BR-M04-33).
    if (!row || row.pkskDomainId !== null) return null
    questionsRepo.resolveDiagram(id, image, now)
  } else if (!structuredRepo.resolveDiagram(id, image, now)) {
    return null
  }
  return { id, needsDiagram: false }
}

function isKind(value: unknown): value is Kind {
  return value === 'mcq' || value === 'structured'
}

/** #24. */
function upload(req: MockRequest, ctx: MockContext): MockResponse {
  const kind = req.params.kind
  const id = req.params.id as number
  if (!isKind(kind)) return notFound()
  const exists = kind === 'mcq' ? questionsRepo.get(id) : structuredRepo.get(id)
  if (
    !exists ||
    (kind === 'mcq' && (exists as { pkskDomainId: number | null }).pkskDomainId !== null)
  ) {
    return notFound()
  }
  const value = bodyOf(req).image
  const error = imageError(value)
  if (error) return validationError(error)
  const file = uploadedFile(value)
  const url = storeUpload(`${kind}/${String(id)}`, file as NonNullable<typeof file>)
  const data = ctx.transaction(() => resolve(kind, id, url, ctx.clock.now()))
  return data ? ok(data, { status: DIAGRAM_UPLOADED_TEXT }) : notFound()
}

/** #25. */
function dismiss(req: MockRequest, ctx: MockContext): MockResponse {
  const kind = req.params.kind
  if (!isKind(kind)) return notFound()
  const data = ctx.transaction(() => resolve(kind, req.params.id as number, null, ctx.clock.now()))
  return data ? ok(data, { status: DIAGRAM_DISMISSED_TEXT }) : notFound()
}

export const diagramRoutes: RouteDef[] = [
  route('GET', '/api/diagram-audit', [adminOnly], (req, ctx) => audit(req, ctx)),
  route('POST', '/api/diagram-audit/:kind/:id/image', [adminOnly], (req, ctx) => upload(req, ctx), {
    params: { kind: str(), id: int() },
  }),
  route(
    'POST',
    '/api/diagram-audit/:kind/:id/dismiss',
    [adminOnly],
    (req, ctx) => dismiss(req, ctx),
    { params: { kind: str(), id: int() } },
  ),
]
