/**
 * M09 mock plugin (F-29: the shared content store; SRS M09 v1.5 §6, §6.11; overview §6.7, D11/D12).
 * Owner of the `videos` virtual dataset (live total 2,260) and the M09 tables (articles and
 * attachments, notes, banners, audio KBAT sets, perutusan with reactions / comments / reads,
 * screenshots, video schools, support config).
 *
 * PUBLIC exports (the only M09 mock code other modules may import, `@/modules/m09-content/mock`):
 * the repositories `articles` (`latest(5)` for the M05 dashboard, the reader queries, and the M10
 * teacher-form methods `listByAuthor` / `statsByAuthor` / `getOwn` / `createFromTeacher` /
 * `updateFromTeacher` / `deleteAttachment`), `banners` (`activeFor(user)` for M05), `notes`,
 * `videos`, `audioKbat`, `perutusan`, `support`, and the error class `M09Error`.
 *
 * Routes (`handlers/`): the reader endpoints §7 #6–#9, #20, #24–#40, #43 (M09-T1) and the admin
 * endpoints #1–#5, #10–#19, #21–#23, #41–#42 (admin content handlers). Client functions and types: `../api`.
 * Test hooks (§6.10) and screens belong to M09-T1…T5.
 *
 * Bump `version` whenever the seed, a spec, `derive` or a cheap field changes (overview §6.9,
 * §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { videosDataset } from './datasets/videos'
import { adminRoutes, readerRoutes } from './handlers'
import {
  articlesRepo,
  audioKbatRepo,
  bannersRepo,
  notesRepo,
  perutusanRepo,
  supportRepo,
  videosRepo,
} from './repository'
import { finaliseContent, seedContent } from './seeds/seed'
import { M09_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M09',
  dependsOn: ['core', 'M01', 'M02'],
  version: 4,
  tables: M09_TABLES,
  datasets: { videos: videosDataset },
  repositories: {
    articles: articlesRepo,
    banners: bannersRepo,
    notes: notesRepo,
    videos: videosRepo,
    audioKbat: audioKbatRepo,
    perutusan: perutusanRepo,
    support: supportRepo,
  },
  seed: seedContent,
  finalise: finaliseContent,
  routes: [...readerRoutes, ...adminRoutes],
})

export default plugin

export const { articles, banners, notes, videos, audioKbat, perutusan, support } =
  plugin.repositories

export { M09Error, type M09ErrorCode } from './repository'
export type * from './types'
export type {
  AdminArticleFilter,
  AdminArticleInput,
  ArticleFilter,
  AudioFilter,
  AudioSetInput,
  BannerInput,
  FileInput,
  NoteFilter,
  NoteInput,
  PerutusanCard,
  PerutusanDetail,
  PerutusanInput,
  TeacherArticleInput,
  VideoDetailResult,
  VideoFacets,
  VideoFilter,
  VideoInput,
} from './repository'
