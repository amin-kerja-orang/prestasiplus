/**
 * The `videos` repository (owner M09; SRS M09 v1.2 §6.5, §6.8a, §6.11, BR-M09-17…21). Reads the
 * `videos` virtual dataset: every figure on S17 is a named query or a count over its facets.
 *
 * Visibility (BR-M09-19): `global` for everyone (guests included); `school` only for the uploader,
 * the admin and users with the uploader's school (`viewer.schoolId`). Seeded videos are all
 * `global`, so the common path is a single paged dataset query.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import { PLATFORM_LABELS, VIDEO_CATEGORIES } from '../data/labels'
import { parseVideoUrl } from '../data/video-url'
import { videosDataset } from '../datasets/videos'
import { videoSchoolsTable } from '../tables/tables'
import type {
  VideoCard,
  VideoCategory,
  VideoRow,
  VideoSchoolRow,
  VideoVisibility,
  Viewer,
} from '../types'
import { M09Error, nowIso, norm, uploaderRef } from './common'

export const VIDEO_PAGE_SIZE = 24
export const VIDEO_RELATED_LIMIT = 6

const VIDEO_SORT = [
  { field: 'listKey', dir: 'desc' },
  { field: 'id', dir: 'desc' },
] as const

/** Named count queries (M09 §6.11 Q-VID-*); `expected` = the observed live figures. */
export const videoQueries = defineNamedQueries(videosDataset, {
  'Q-VID-ALL': { where: {}, expected: 2_260, source: 'M09 §6.11' },
  'Q-VID-CAT': {
    where: (category: VideoCategory) => ({ category }),
    expected: [
      { args: ['motivasi'], value: 3 },
      { args: ['tutorial'], value: 12 },
      { args: ['tips-spm'], value: 3 },
      { args: ['ceramah'], value: 2_242 },
      { args: ['lain-lain'], value: 0 },
    ],
    source: 'M09 §6.11',
  },
  'Q-VID-SUBJ': {
    where: (subjectId: number | null) => ({ subjectId }),
    expected: [
      { args: [3], value: 865 },
      { args: [5], value: 97 },
      { args: [8], value: 420 },
      { args: [9], value: 779 },
      { args: [10], value: 96 },
      { args: [null], value: 3 },
    ],
    source: 'M09 §6.11',
  },
  'Q-VID-SUBJ-CAT': {
    where: (subjectId: number | null, category: VideoCategory) => ({ subjectId, category }),
    expected: [
      { args: [5, 'motivasi'], value: 1 },
      { args: [5, 'tutorial'], value: 12 },
      { args: [5, 'tips-spm'], value: 3 },
      { args: [5, 'ceramah'], value: 81 },
      { args: [5, 'lain-lain'], value: 0 },
    ],
    source: 'M09 §6.11 (joint Sejarah × category)',
  },
  'Q-VID-GLOBAL': {
    where: { visibility: 'global' },
    expected: 2_260,
    source: 'M09 §6.11',
  },
})

export interface VideoFilter {
  search?: string
  category?: VideoCategory | 'all' | ''
  subjectId?: number | null
  viewer?: Viewer | null
  page?: number
  pageSize?: number
}

export interface VideoFacets {
  /** "Semua (n)": matching `search` and `subject`. */
  total: number
  /** Every category (0 included): matching `search` and `subject`. */
  categories: { category: VideoCategory; count: number }[]
  /** Only subjects with count > 0, in subject id order: matching `search` and `category`. */
  subjects: { subjectId: number; count: number }[]
  /** Videos with no subject, matching `search` and `category` (shown in the total only). */
  noSubject: number
}

export interface VideoInput {
  videoUrl: string
  title: string
  description?: string | null
  category: VideoCategory
  subjectId?: number | null
  visibility: VideoVisibility
}

export interface VideoDetailResult {
  video: VideoRow
  embedUrl: string | null
  related: VideoRow[]
  canManage: boolean
}

const isAdmin = (viewer: Viewer | null | undefined): boolean => viewer?.role === 'admin'

/** BR-M09-19 visibility of one video. */
export function videoVisibleTo(row: VideoRow, viewer: Viewer | null | undefined): boolean {
  if (row.visibility === 'global') return true
  if (!viewer) return false
  return (
    isAdmin(viewer) ||
    viewer.id === row.uploaderId ||
    (viewer.schoolId !== null && viewer.schoolId === row.schoolId)
  )
}

export const videosRepo = defineRepository({
  owner: 'M09',
  name: 'videos',
  store: videosDataset,
  stores: { videoSchools: videoSchoolsTable },
  queries: videoQueries,
  methods: ({ store, stores, transaction }) => {
    const subjectIds = (): number[] => {
      const seen = new Set<number>()
      for (const c of store.cells()) if (c.facets.subjectId !== null) seen.add(c.facets.subjectId)
      return [...seen].sort((a, b) => a - b)
    }

    /** School-visibility videos this viewer may see (few; runtime rows only). */
    const extrasFor = (viewer: Viewer | null | undefined): VideoRow[] =>
      isAdmin(viewer) || !viewer
        ? []
        : store
            .query({ where: { visibility: 'school' } })
            .rows.filter((r) => videoVisibleTo(r, viewer))

    const baseWhere = (f: {
      category?: VideoCategory | 'all' | ''
      subjectId?: number | null
      viewer?: Viewer | null
    }) => ({
      ...(f.category && f.category !== 'all' ? { category: f.category } : {}),
      ...(f.subjectId !== undefined && f.subjectId !== null ? { subjectId: f.subjectId } : {}),
      ...(isAdmin(f.viewer) ? {} : { visibility: 'global' as VideoVisibility }),
    })

    const matchesExtra = (
      r: VideoRow,
      f: {
        term: string
        category?: VideoCategory | 'all' | ''
        subjectId?: number | null
      },
    ): boolean =>
      (f.term === '' || r.title.toLowerCase().includes(f.term)) &&
      (!f.category || f.category === 'all' || r.category === f.category) &&
      (f.subjectId === undefined || f.subjectId === null || r.subjectId === f.subjectId)

    const countOf = (
      where: object,
      term: string,
      extras: VideoRow[],
      f: { category?: VideoCategory | 'all' | ''; subjectId?: number | null },
    ): number =>
      store.count(where, undefined, term === '' ? {} : { search: { term, fields: ['title'] } }) +
      extras.filter((r) => matchesExtra(r, { term, ...f })).length

    const requireVideo = (id: number): VideoRow => {
      const row = store.get(id)
      if (!row) throw new M09Error('NOT_FOUND', `Video ${String(id)} tidak dijumpai.`)
      return row
    }

    const canManage = (row: VideoRow, viewer: Viewer | null | undefined): boolean =>
      !!viewer && (isAdmin(viewer) || viewer.id === row.uploaderId)

    const relatedOf = (
      id: number,
      viewer: Viewer | null | undefined,
      limit: number,
    ): VideoRow[] => {
      const v = store.get(id)
      if (!v || v.subjectId === null) return []
      return store
        .query({
          where: {
            subjectId: v.subjectId,
            id: { ne: id },
            ...(isAdmin(viewer) ? {} : { visibility: 'global' as VideoVisibility }),
          },
          sort: [{ field: 'id', dir: 'desc' }],
          page: 1,
          pageSize: limit,
        })
        .rows.filter((r) => videoVisibleTo(r, viewer))
    }

    const schoolOf = (userId: number): number | null =>
      stores.videoSchools.query({ where: { userId } }).rows[0]?.schoolId ?? null

    return {
      /** Seed phase: the video-form school rows of DATA-M09-13. */
      seedVideoSchools(rows: readonly { userId: number; schoolId: number }[]): void {
        transaction(() => {
          for (const row of rows) stores.videoSchools.insert({ ...row })
        })
      },

      /** M24 / internal: any video by id (no visibility filter). */
      get(id: number): VideoRow | undefined {
        return store.get(id)
      },

      /** S17 grid: `listKey` desc (live list order) then id desc, 24 per page (BR-M09-19). */
      list(filter: VideoFilter = {}): { rows: VideoRow[]; total: number } {
        const term = norm(filter.search ?? '')
        const search = term === '' ? {} : { search: { term, fields: ['title' as const] } }
        const page = filter.page ?? 1
        const pageSize = filter.pageSize ?? VIDEO_PAGE_SIZE
        const extras = extrasFor(filter.viewer).filter((r) =>
          matchesExtra(r, { term, category: filter.category, subjectId: filter.subjectId }),
        )
        const where = baseWhere(filter)
        if (extras.length === 0) {
          return store.query({ where, ...search, sort: VIDEO_SORT, page, pageSize })
        }
        // Unpaged merge path: only when a runtime `school` video is visible to this viewer (seeded
        // videos are all `global`). It derives at most the filtered rows once (a few ms at 2,260 rows),
        // so it is acceptable without its own perf case.
        const all = store.query({ where, ...search, sort: VIDEO_SORT }).rows
        const merged = [...all, ...extras].sort((a, b) =>
          a.listKey !== b.listKey ? b.listKey - a.listKey : b.id - a.id,
        )
        return { rows: merged.slice((page - 1) * pageSize, page * pageSize), total: merged.length }
      },

      /** BR-M09-18: the "Semua (n)" total and the category and subject pills. */
      facets(filter: VideoFilter = {}): VideoFacets {
        const term = norm(filter.search ?? '')
        const extras = extrasFor(filter.viewer)
        const scope = { viewer: filter.viewer }
        const total = countOf(baseWhere({ ...scope, subjectId: filter.subjectId }), term, extras, {
          subjectId: filter.subjectId,
        })
        const categories = VIDEO_CATEGORIES.map((category) => ({
          category,
          count: countOf(
            baseWhere({ ...scope, category, subjectId: filter.subjectId }),
            term,
            extras,
            {
              category,
              subjectId: filter.subjectId,
            },
          ),
        }))
        const subjects = subjectIds()
          .map((subjectId) => ({
            subjectId,
            count: countOf(
              baseWhere({ ...scope, category: filter.category, subjectId }),
              term,
              extras,
              { category: filter.category, subjectId },
            ),
          }))
          .filter((s) => s.count > 0)
        const noSubject =
          store.count(
            { ...baseWhere({ ...scope, category: filter.category }), subjectId: null },
            undefined,
            term === '' ? {} : { search: { term, fields: ['title'] } },
          ) +
          extras.filter(
            (r) =>
              r.subjectId === null &&
              matchesExtra(r, { term, category: filter.category, subjectId: null }),
          ).length
        return { total, categories, subjects, noSubject }
      },

      /** BR-M09-20: up to 6 other visible videos of the same subject, id desc (none without a subject). */
      related(id: number, viewer?: Viewer | null, limit: number = VIDEO_RELATED_LIMIT): VideoRow[] {
        return relatedOf(id, viewer, limit)
      },

      /** S18: the video, its embed URL, related videos and the manage flag; `undefined` if not visible. */
      detail(id: number, viewer?: Viewer | null): VideoDetailResult | undefined {
        const video = store.get(id)
        if (!video || !videoVisibleTo(video, viewer)) return undefined
        return {
          video,
          embedUrl: parseVideoUrl(video.videoUrl).embedUrl,
          related: relatedOf(id, viewer, VIDEO_RELATED_LIMIT),
          canManage: canManage(video, viewer),
        }
      },

      /** BR-M09-07: the view is counted after the response (the shown value excludes the open). */
      countView(id: number): void {
        transaction(() => {
          const v = requireVideo(id)
          store.update(id, { views: v.views + 1 })
        })
      },

      /** `VideoCard` shapes (uploader name, initial and role label from the M01 users). */
      cards(rows: readonly VideoRow[]): VideoCard[] {
        return rows.map((v) => ({
          id: v.id,
          title: v.title,
          platformLabel: PLATFORM_LABELS[v.platform] ?? v.platform,
          thumbnailUrl: v.thumbnailUrl,
          views: v.views,
          createdAt: v.createdAt,
          uploader: uploaderRef(v.uploaderId),
        }))
      },

      /** BR-M09-21: the video-form school ("Sekolah Saya"), or `null` ("Tiada sekolah"). */
      videoSchool(userId: number): number | null {
        return schoolOf(userId)
      },

      /** Fixture `seedVideoSchool(userId, schoolId)` (§6.10): one row per user. */
      setVideoSchool(userId: number, schoolId: number): VideoSchoolRow {
        return transaction(() => {
          const existing = stores.videoSchools.query({ where: { userId } }).rows[0]
          return existing
            ? stores.videoSchools.update(existing.id, { schoolId })
            : stores.videoSchools.insert({ userId, schoolId })
        })
      },

      /** S20 create: any logged-in user; `school` needs a video-form school. */
      create(uploaderId: number, input: VideoInput): VideoRow {
        const school = schoolOf(uploaderId)
        if (input.visibility === 'school' && school === null) {
          throw new M09Error('VALIDATION_ERROR', 'Anda tiada sekolah untuk dikongsi.')
        }
        const parsed = parseVideoUrl(input.videoUrl)
        return transaction(() => {
          const now = nowIso()
          return store.insert({
            videoUrl: input.videoUrl.trim(),
            platform: parsed.platform,
            externalId: parsed.externalId,
            thumbnailUrl: parsed.thumbnailUrl,
            title: input.title,
            description: input.description ?? null,
            category: input.category,
            subjectId: input.subjectId ?? null,
            visibility: input.visibility,
            schoolId: input.visibility === 'school' ? school : null,
            uploaderId,
            views: 0,
            createdAt: now,
            updatedAt: now,
            listKey: Date.parse(now),
          })
        })
      },

      /** S19 update: the uploader or the admin. */
      update(id: number, viewer: Viewer, input: VideoInput): VideoRow {
        return transaction(() => {
          const row = requireVideo(id)
          if (!canManage(row, viewer)) {
            throw new M09Error('FORBIDDEN', 'Anda tidak dibenarkan mengubah video ini.')
          }
          const school = schoolOf(row.uploaderId)
          if (input.visibility === 'school' && school === null) {
            throw new M09Error('VALIDATION_ERROR', 'Anda tiada sekolah untuk dikongsi.')
          }
          const parsed = parseVideoUrl(input.videoUrl)
          return store.update(id, {
            videoUrl: input.videoUrl.trim(),
            platform: parsed.platform,
            externalId: parsed.externalId,
            thumbnailUrl: parsed.thumbnailUrl,
            title: input.title,
            description: input.description ?? null,
            category: input.category,
            subjectId: input.subjectId ?? null,
            visibility: input.visibility,
            schoolId: input.visibility === 'school' ? school : null,
            updatedAt: nowIso(),
          })
        })
      },

      /** S19 delete: the uploader or the admin. */
      remove(id: number, viewer: Viewer): void {
        transaction(() => {
          const row = requireVideo(id)
          if (!canManage(row, viewer)) {
            throw new M09Error('FORBIDDEN', 'Anda tidak dibenarkan memadam video ini.')
          }
          store.remove(id)
        })
      },
    }
  },
})
