/**
 * SRS M09 v1.5 §7 #33 `GET /api/perutusan` (S22), #34 `GET /api/perutusan/mine` (S25), #35
 * `GET /api/perutusan/:id` (S23), #36 `GET /api/perutusan/compose-context` (S24), #37
 * `POST /api/perutusan` (S24, multipart), #38 `POST /api/perutusan/:id/reactions`, #39
 * `POST /api/perutusan/:id/comments` and #40 `GET /api/public/perutusan/:id` (S28, public).
 *
 * Visibility, order, read counting, reactions, comments and the pin limit are the BR-M09-22…28 rules
 * of the perutusan repository. An unknown or hidden post answers 404 (never 403), so ids cannot be
 * probed (FR-M09-38).
 */

import {
  created,
  forbidden,
  int,
  max,
  notFound,
  ok,
  oneOf,
  required,
  requireAuth,
  route,
  rule,
  unpaged,
  validate,
  validationError,
  validationErrors,
  type MockContext,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { toEpochMs, toIsoMyt } from '@/lib/time'
import { schools } from '@/modules/m02-users-schools/mock'

import { parseVideoUrl } from '../data/video-url'
import { M09Error, perutusanRepo, perutusanVisibleTo, type PerutusanDetail } from '../repository'
import { NATIONAL_SCOPE_LABEL, SCHOOL_SCOPE_LABEL } from '../repository/perutusan'
import type { PerutusanRow, PerutusanStatus, ReactionType } from '../types'
import { FIELD_INVALID, FIELD_REQUIRED, FLASH, isString, refusal, requireViewer } from './common'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const IMAGE_EXT = /\.(jpe?g|png|gif)$/i
const PDF_EXT = /\.pdf$/i
const STATUS_LABELS: Readonly<Record<PerutusanStatus, string>> = {
  published: 'Diterbitkan',
  scheduled: 'Dijadualkan',
  draft: 'Draf',
}
const STATUS_FLASH: Readonly<Record<PerutusanStatus, string>> = {
  published: FLASH.perutusanSent,
  scheduled: FLASH.perutusanScheduled,
  draft: FLASH.perutusanDraft,
}

// --- shaping ----------------------------------------------------------------------------------------

function detailBody(d: PerutusanDetail) {
  const { youtubeUrl, ...rest } = d
  const published = perutusanRepo.get(d.id)?.status === 'published'
  return {
    ...rest,
    youtubeEmbedUrl: youtubeUrl ? parseVideoUrl(youtubeUrl).embedUrl : null,
    // The client adds the origin (FR-M09-101); only a public published post has a public link.
    publicUrl: d.isPublic && published ? `/perutusan/awam/${String(d.id)}` : null,
  }
}

// --- multipart input ----------------------------------------------------------------------------------

interface FileLike {
  name: string
  size: number
  type: string
}

const asArray = (value: unknown): unknown[] =>
  value === undefined || value === null || value === ''
    ? []
    : Array.isArray(value)
      ? (value as unknown[])
      : [value]

const asBool = (value: unknown): boolean =>
  value === true || value === 1 || ['1', 'true', 'on', 'yes'].includes(String(value).toLowerCase())

function fileLike(value: unknown): FileLike | null {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return {
      name: (value as Blob & { name?: string }).name ?? 'fail',
      size: value.size,
      type: value.type,
    }
  }
  if (typeof value === 'object' && value !== null) {
    const v = value as { name?: unknown; fileName?: unknown; size?: unknown; type?: unknown }
    const name =
      typeof v.name === 'string' ? v.name : typeof v.fileName === 'string' ? v.fileName : null
    if (name !== null && typeof v.size === 'number') {
      return { name, size: v.size, type: typeof v.type === 'string' ? v.type : '' }
    }
  }
  return null
}

/** SRS M09 §5 "S24 perutusan": images JPG/PNG/GIF ≤ 2 MB, documents PDF ≤ 5 MB. */
function fileError(
  value: unknown,
  kind: 'image' | 'document',
): { files: FileLike[]; error: string | null } {
  const files: FileLike[] = []
  for (const item of asArray(value)) {
    const file = fileLike(item)
    const okType =
      file !== null &&
      (kind === 'image'
        ? IMAGE_TYPES.includes(file.type) || (file.type === '' && IMAGE_EXT.test(file.name))
        : file.type === 'application/pdf' || (file.type === '' && PDF_EXT.test(file.name)))
    const okSize =
      file !== null && file.size <= (kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES)
    if (file === null || !okType || !okSize) {
      return { files, error: `${file?.name ?? 'Fail'}: format atau saiz tidak dibenarkan.` }
    }
    files.push(file)
  }
  return { files, error: null }
}

const createRules = {
  title: [required(), isString(), max(255)],
  body: [isString()],
  status: [required(), oneOf(['published', 'scheduled', 'draft'])],
  youtubeUrl: [
    rule('youtube', (v) =>
      typeof v === 'string' && parseVideoUrl(v).platform === 'Youtube' ? null : FIELD_INVALID,
    ),
  ],
}

const RULE_MESSAGES = { required: FIELD_REQUIRED, max: FIELD_INVALID, in: FIELD_INVALID }

const isWriter = (role: string): boolean => role === 'admin' || role === 'school_admin'

function composeContext(req: MockRequest) {
  const viewer = requireViewer(req)
  if (viewer.role === 'admin') {
    return { scope: 'national' as const, scopeLabel: NATIONAL_SCOPE_LABEL, canWrite: true }
  }
  if (viewer.role === 'school_admin') {
    const school = viewer.schoolId === null ? undefined : schools.get(viewer.schoolId)
    // INFERRED label: the school's name (what readers see on the post), else "Sekolah" (BR-M09-22).
    return {
      scope: 'school' as const,
      scopeLabel: school?.name ?? SCHOOL_SCOPE_LABEL,
      canWrite: true,
    }
  }
  return { scope: null, scopeLabel: '', canWrite: false }
}

function create(req: MockRequest, ctx: MockContext) {
  const viewer = requireViewer(req)
  // BR-M09-22 (INFERRED, OQ-M09-05): the other roles are refused.
  if (!isWriter(viewer.role)) return forbidden()
  const body = (req.body ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}
  Object.assign(
    fields,
    validationErrors(body, createRules, { messages: { ...RULE_MESSAGES, youtube: FIELD_INVALID } }),
  )
  const images = fileError(body.images, 'image')
  if (images.error) fields.images = images.error
  const documents = fileError(body.documents, 'document')
  if (documents.error) fields.documents = documents.error

  const status = body.status as PerutusanStatus
  const scheduledAt =
    status === 'scheduled' && typeof body.scheduledAt === 'string' && body.scheduledAt !== ''
      ? body.scheduledAt
      : null
  let scheduledIso: string | null = null
  if (scheduledAt !== null) {
    // A `datetime-local` value without an offset is Malaysia time (MYT).
    // INFERRED (SRS §5): a future date and time when the status is `scheduled`.
    try {
      const ms = toEpochMs(scheduledAt)
      if (ms <= ctx.clock.now()) fields.scheduledAt = FIELD_INVALID
      else scheduledIso = toIsoMyt(ms)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      fields.scheduledAt = FIELD_INVALID
    }
  }
  if (Object.keys(fields).length > 0) return validationError(fields)

  try {
    const row: PerutusanRow = perutusanRepo.create(viewer, {
      title: String(body.title).trim(),
      body: typeof body.body === 'string' ? body.body : '',
      images: images.files.map((f) => ({ fileName: f.name, size: f.size })),
      documents: documents.files.map((f) => ({ fileName: f.name, size: f.size })),
      youtubeUrl:
        typeof body.youtubeUrl === 'string' && body.youtubeUrl !== '' ? body.youtubeUrl : null,
      isPinned: asBool(body.isPinned),
      isPublic: asBool(body.isPublic),
      status,
      scheduledAt: scheduledIso,
    })
    const detail = perutusanRepo.detail(row.id, viewer)
    if (!detail) return notFound()
    return created(detailBody(detail), { status: STATUS_FLASH[status] })
  } catch (error) {
    if (error instanceof M09Error && error.code === 'VALIDATION_ERROR') {
      return refusal(error, 'form')
    }
    return refusal(error)
  }
}

// --- routes -------------------------------------------------------------------------------------------

export const perutusanRoutes: RouteDef[] = [
  route('GET', '/api/perutusan', [requireAuth()], (req) =>
    unpaged(perutusanRepo.list(requireViewer(req))),
  ),

  route('GET', '/api/perutusan/mine', [requireAuth()], (req) =>
    unpaged(
      perutusanRepo.mine(requireViewer(req)).map((card) => {
        const status = perutusanRepo.get(card.id)?.status ?? 'draft'
        return {
          id: card.id,
          title: card.title,
          status,
          statusLabel: STATUS_LABELS[status],
          createdAt: card.createdAt,
        }
      }),
    ),
  ),

  route('GET', '/api/perutusan/compose-context', [requireAuth()], (req) => ok(composeContext(req))),

  route(
    'GET',
    '/api/perutusan/:id',
    [requireAuth()],
    (req) => {
      const viewer = requireViewer(req)
      const id = Number(req.params.id)
      const detail = perutusanRepo.detail(id, viewer)
      if (!detail) return notFound()
      // BR-M09-07: the admin, the author and repeat opens count nothing; the shown value includes
      // this open (INFERRED, like the article detail).
      const reads = perutusanRepo.markRead(id, viewer)
      return ok({ ...detailBody(detail), reads })
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/perutusan', [requireAuth()], create),

  route(
    'POST',
    '/api/perutusan/:id/reactions',
    [requireAuth()],
    (req) => {
      const viewer = requireViewer(req)
      const id = Number(req.params.id)
      const post = perutusanRepo.get(id)
      if (!post || !perutusanVisibleTo(post, viewer)) return notFound()
      const invalid = validate(
        req.body,
        { type: [required(), oneOf(['like', 'love', 'thanks'])] },
        { messages: { required: FIELD_REQUIRED, in: FIELD_INVALID } },
      )
      if (invalid) return invalid
      const { type } = req.body as { type: ReactionType }
      return ok(perutusanRepo.toggleReaction(id, viewer, type))
    },
    { params: { id: int() } },
  ),

  route(
    'POST',
    '/api/perutusan/:id/comments',
    [requireAuth()],
    (req) => {
      const viewer = requireViewer(req)
      const id = Number(req.params.id)
      const post = perutusanRepo.get(id)
      if (!post || !perutusanVisibleTo(post, viewer)) return notFound()
      const invalid = validate(
        req.body,
        { body: [required(), max(1000)] },
        { messages: { required: FIELD_REQUIRED, max: FIELD_INVALID } },
      )
      if (invalid) return invalid
      try {
        const comment = perutusanRepo.addComment(id, viewer, (req.body as { body: string }).body)
        return created({ id: comment.id, status: 'pending' }, { status: FLASH.commentSent })
      } catch (error) {
        return refusal(error, 'body')
      }
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/public/perutusan/:id',
    (req) => {
      const detail = perutusanRepo.publicDetail(Number(req.params.id))
      if (!detail) return notFound()
      // Counts no read (BR-M09-07). The extras beyond the SRS field list feed FR-M09-131.
      return ok({
        id: detail.id,
        title: detail.title,
        author: detail.author,
        body: detail.body,
        createdAt: detail.createdAt,
        youtubeEmbedUrl: detail.youtubeUrl ? parseVideoUrl(detail.youtubeUrl).embedUrl : null,
        scopeLabel: detail.scopeLabel,
        reactionTotal: detail.reactions.like + detail.reactions.love + detail.reactions.thanks,
        reads: detail.reads,
        commentCount: detail.commentCount,
      })
    },
    { params: { id: int() } },
  ),
]
