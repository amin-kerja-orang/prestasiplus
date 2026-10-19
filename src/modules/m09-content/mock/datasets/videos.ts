/**
 * The `videos` virtual dataset (DATA-M09-05, D11; SRS M09 v1.2 §6.5, §6.9, §6.11). Live total 2,260,
 * idRange 1–2,260, so every id is a row: all 2,260 rows come from the live capture
 * (`../data/video-live-data.ts`, D22: no generated titles, views or media ids) and are literal rows
 * (anchors), so the dataset is a materialised table whose cells are the observed (subject, category)
 * pairs. Counts are computed from the rows: category 3 / 12 / 3 / 2,242 / 0, subject 3→865, 5→97,
 * 8→420, 9→779, 10→96, null→3, Sejarah × category 1 / 12 / 3 / 81 / 0. The list order is the
 * explicit key `listKey` (captured live position); `createdAt` follows each row's live age text.
 *
 * - Cheap fields (filters, sort, search): `title`, `views`, `createdAt`, `platform`, `visibility`,
 *   `schoolId`, `uploaderId`. `listKey` is the BR-M09-19 order (live list order, which is not
 *   sorted by age); `createdAt` only drives the displayed age.
 * - Runtime ids from 2,261.
 *
 * Bump the M09 plugin `version` when this data, the order or a cheap field changes (§6.9).
 */

import { toIsoMyt } from '@/lib/time'
import { defineVirtualDataset, exact, type CellSpec } from '@/mock/dataset'
import { floor } from '@/mock/define'

import {
  cellOf,
  createdMsOf,
  listKeyOf,
  liveTitleOf,
  liveViewsOf,
  liveYoutubeIdOf,
  VIDEO_ORDER,
  VIDEO_TOTAL,
} from '../data/video-cells'
import type { VideoCheapKey, VideoFacetKey, VideoRow } from '../types'

/** Uploader of every seeded video: Admin Demo. */
export const VIDEO_UPLOADER_ID = 1
export const VIDEO_RUNTIME_START = VIDEO_TOTAL + 1

const createdAtOf = (id: number): string => toIsoMyt(createdMsOf(id))

const DESC_2224 =
  'Kredit penuh kepada Cikgu Demo — seorang pendidik Sejarah yang luar biasa dan berdedikasi. Terima kasih Cikgu kerana berkongsi ilmu dengan begitu jelas dan mudah difahami. Semoga usaha Cikgu diberkati!\n\nSumber asal: https://www.youtube.com/@cikgudemo\n\nVideo ini dikongsi untuk tujuan pendidikan sahaja.'

/** The live row of a seeded id 1–2,260 (real title, YouTube id and views from the capture). */
export function liveVideo(id: number): VideoRow {
  const cell = cellOf(id)
  const ext = liveYoutubeIdOf(id)
  const createdAt = createdAtOf(id)
  return {
    id,
    videoUrl: `https://www.youtube.com/watch?v=${ext}`,
    platform: 'Youtube',
    externalId: ext,
    thumbnailUrl: `https://img.youtube.com/vi/${ext}/hqdefault.jpg`,
    title: liveTitleOf(id),
    description: id === 2224 ? DESC_2224 : null,
    category: cell.category,
    subjectId: cell.subjectId,
    visibility: 'global',
    schoolId: null,
    uploaderId: VIDEO_UPLOADER_ID,
    views: liveViewsOf(id),
    createdAt,
    updatedAt: createdAt,
    listKey: listKeyOf(id),
  }
}

/** One literal anchor per live row (2,260): the dataset is a materialised table of observed rows. */
export const VIDEO_ROWS: readonly VideoRow[] = Object.freeze(
  VIDEO_ORDER.slice()
    .sort((x, y) => x - y)
    .map((id) => Object.freeze(liveVideo(id))),
)

/** Cells = the observed (subject, category) pairs, counted from the rows. */
export const videoDistribution: readonly CellSpec<Pick<VideoRow, VideoFacetKey>>[] = exact(
  (() => {
    const counts = new Map<string, { facets: Pick<VideoRow, VideoFacetKey>; count: number }>()
    for (const row of VIDEO_ROWS) {
      const key = `${String(row.subjectId)}|${row.category}`
      const cell = counts.get(key)
      if (cell) cell.count++
      else
        counts.set(key, {
          facets: { subjectId: row.subjectId, category: row.category },
          count: 1,
        })
    }
    return [...counts.values()]
  })(),
)

export const videosDataset = defineVirtualDataset<VideoRow, VideoFacetKey, VideoCheapKey>({
  name: 'videos',
  owner: 'M09',
  total: VIDEO_TOTAL,
  idRange: { min: 1, max: VIDEO_TOTAL },
  runtimeIds: floor({ start: VIDEO_RUNTIME_START }),
  facets: ['subjectId', 'category'],
  distribution: videoDistribution,
  derive: (id) => {
    const ext = liveYoutubeIdOf(id)
    return {
      videoUrl: `https://www.youtube.com/watch?v=${ext}`,
      externalId: ext,
      thumbnailUrl: `https://img.youtube.com/vi/${ext}/hqdefault.jpg`,
      description: id === 2224 ? DESC_2224 : null,
      updatedAt: createdAtOf(id),
    }
  },
  fields: {
    title: (key) => liveTitleOf(key),
    views: (key) => liveViewsOf(key),
    createdAt: (key) => createdAtOf(key),
    listKey: (key) => listKeyOf(key),
    platform: () => 'Youtube',
    visibility: () => 'global',
    schoolId: () => null,
    uploaderId: () => VIDEO_UPLOADER_ID,
  },
  searchFields: ['title'],
  anchors: VIDEO_ROWS,
})
