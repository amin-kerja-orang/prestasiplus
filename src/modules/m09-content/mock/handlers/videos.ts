/**
 * SRS M09 v1.5 §7 #27 `GET /api/videos` (S17), #28 `GET /api/videos/:id` (S18), #29
 * `POST /api/videos` (S20), #30 `PUT /api/videos/:id` (S19), #31 `DELETE /api/videos/:id` and #32
 * `GET /api/videos/form-context`. #28 also accepts `?for=edit` (S19): the same body without
 * counting a view. Reads are public (guests see `global` videos, BR-M09-19); the
 * writes need a session, and #30/#31 the uploader or the admin (BR-M09-21). Every count comes from
 * the videos repository's named queries and facets (BR-M09-18).
 */

import {
  created,
  forbidden,
  int,
  notFound,
  ok,
  oneOf,
  paged,
  pageParams,
  queryInt,
  queryString,
  requireAuth,
  required,
  route,
  rule,
  validate,
  max,
  exists,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS } from '../data/labels'
import { videosRepo, videoVisibleTo, type VideoDetailResult } from '../repository'
import { uploaderRef } from '../repository/common'
import { VIDEO_PAGE_SIZE } from '../repository/videos'
import type { VideoCard, VideoCategory, VideoRow, Viewer } from '../types'
import {
  FIELD_INVALID,
  FIELD_REQUIRED,
  FLASH,
  isString,
  refusal,
  requireViewer,
  subjectRef,
  viewerOf,
} from './common'

/**
 * The viewer for the school-visibility rule (BR-M09-19/21, INFERRED): schoolId is the viewer's
 * video-form school (videoSchools), the same source that fills schoolId on the uploader's
 * videos, not the profile school.
 */
function videoViewerOf(req: MockRequest): Viewer | null {
  const viewer = viewerOf(req)
  return viewer && { ...viewer, schoolId: videosRepo.videoSchool(viewer.id) }
}

function requireVideoViewer(req: MockRequest): Viewer {
  const viewer = requireViewer(req)
  return { ...viewer, schoolId: videosRepo.videoSchool(viewer.id) }
}

const cardOf = (v: VideoRow): VideoCard => videosRepo.cards([v])[0] as VideoCard

function detailBody(d: VideoDetailResult) {
  const v = d.video
  return {
    ...cardOf(v),
    videoUrl: v.videoUrl,
    embedUrl: d.embedUrl,
    platform: v.platform,
    description: v.description,
    category: v.category,
    categoryLabel: VIDEO_CATEGORY_LABELS[v.category],
    subject: subjectRef(v.subjectId),
    visibility: v.visibility,
    canManage: d.canManage,
    related: videosRepo.cards(d.related),
  }
}

const isHttpUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** SRS M09 §5 "S19/S20 video" server rules; the messages are the generic placeholders (§8.2). */
const VIDEO_RULES = {
  videoUrl: [
    required(),
    isString(),
    rule('url', (v) => (isHttpUrl(v) ? null : FIELD_INVALID)),
    max(2048),
  ],
  title: [required(), isString(), max(255)],
  description: [isString(), max(1000)],
  category: [required(), oneOf(VIDEO_CATEGORIES)],
  subjectId: [exists((v) => curriculum.subject(Number(v)) !== undefined)],
  visibility: [required(), oneOf(['global', 'school'])],
}

const VIDEO_MESSAGES = {
  required: FIELD_REQUIRED,
  max: FIELD_INVALID,
  in: FIELD_INVALID,
  exists: FIELD_INVALID,
}

interface VideoBody {
  videoUrl: string
  title: string
  description?: string | null
  category: VideoCategory
  subjectId?: number | string | null
  visibility: 'global' | 'school'
}

function toInput(body: VideoBody) {
  const subjectId =
    body.subjectId === undefined || body.subjectId === null || body.subjectId === ''
      ? null
      : Number(body.subjectId)
  return {
    videoUrl: body.videoUrl,
    title: body.title.trim(),
    description: body.description?.toString().trim() ? body.description.toString() : null,
    category: body.category,
    subjectId,
    visibility: body.visibility,
  }
}

const idOf = (req: MockRequest): number => Number(req.params.id)

export const videoRoutes: RouteDef[] = [
  route('GET', '/api/videos', (req) => {
    const viewer = videoViewerOf(req)
    const page = pageParams(req.query, { pageSize: VIDEO_PAGE_SIZE })
    const category = (queryString(req.query, 'category')?.trim() ?? '') as
      VideoCategory | 'all' | ''
    const subjectId = queryInt(req.query, 'subject')
    const filter = {
      search: queryString(req.query, 'search') ?? '',
      category,
      ...(subjectId !== undefined ? { subjectId } : {}),
      viewer,
    }
    const res = videosRepo.list({ ...filter, page: page.page, pageSize: page.pageSize })
    const facets = videosRepo.facets(filter)
    return paged({ rows: videosRepo.cards(res.rows), total: res.total }, page, {
      facets: {
        total: facets.total,
        categories: facets.categories.map((c) => ({
          code: c.category,
          label: VIDEO_CATEGORY_LABELS[c.category],
          count: c.count,
        })),
        subjects: facets.subjects.map((s) => ({
          id: s.subjectId,
          name: subjectRef(s.subjectId)?.name ?? '',
          count: s.count,
        })),
      },
    })
  }),

  route('GET', '/api/videos/form-context', [requireAuth()], (req) => {
    const viewer = requireVideoViewer(req)
    const schoolId = videosRepo.videoSchool(viewer.id)
    const school = schoolId === null ? undefined : schools.get(schoolId)
    return ok({
      uploader: uploaderRef(viewer.id),
      school: school ? { id: school.id, name: school.name } : null,
    })
  }),

  route(
    'GET',
    '/api/videos/:id',
    (req) => {
      const id = idOf(req)
      const detail = videosRepo.detail(id, videoViewerOf(req))
      if (!detail) return notFound()
      // BR-M09-07: the response shows the count before this open; the view is counted after.
      const response = ok(detailBody(detail))
      // `?for=edit` (S19 form load): same body, but live does not count edit-page opens.
      if (queryString(req.query, 'for') !== 'edit') videosRepo.countView(id)
      return response
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/videos', [requireAuth()], (req) => {
    const invalid = validate(req.body, VIDEO_RULES, { messages: VIDEO_MESSAGES })
    if (invalid) return invalid
    const viewer = requireVideoViewer(req)
    try {
      const row = videosRepo.create(viewer.id, toInput(req.body as VideoBody))
      const detail = videosRepo.detail(row.id, viewer)
      if (!detail) return notFound()
      return created(detailBody(detail), { status: FLASH.videoCreated })
    } catch (error) {
      return refusal(error, 'visibility')
    }
  }),

  route(
    'PUT',
    '/api/videos/:id',
    [requireAuth()],
    (req) => {
      const viewer = requireVideoViewer(req)
      const id = idOf(req)
      const row = videosRepo.get(id)
      if (!row || !videoVisibleTo(row, viewer)) return notFound()
      if (viewer.role !== 'admin' && viewer.id !== row.uploaderId) return forbidden()
      const invalid = validate(req.body, VIDEO_RULES, { messages: VIDEO_MESSAGES })
      if (invalid) return invalid
      try {
        videosRepo.update(id, viewer, toInput(req.body as VideoBody))
        const detail = videosRepo.detail(id, viewer)
        return detail ? ok(detailBody(detail), { status: FLASH.videoUpdated }) : notFound()
      } catch (error) {
        return refusal(error, 'visibility')
      }
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/videos/:id',
    [requireAuth()],
    (req) => {
      const viewer = requireVideoViewer(req)
      const id = idOf(req)
      const row = videosRepo.get(id)
      if (!row || !videoVisibleTo(row, viewer)) return notFound()
      if (viewer.role !== 'admin' && viewer.id !== row.uploaderId) return forbidden()
      try {
        videosRepo.remove(id, viewer)
        return ok({ deleted: 1 }, { status: FLASH.videoDeleted })
      } catch (error) {
        return refusal(error)
      }
    },
    { params: { id: int() } },
  ),
]
