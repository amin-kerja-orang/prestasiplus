/**
 * M09 seed (SRS M09 v1.2 §6.9), written through the M09 repositories (overview §3 rule 3a):
 *
 * - `seedContent(ctx)` (seed phase): the 72 articles, 10 notes, 5 banners, 3 perutusan with their
 *   reactions, the support config and the one video-form school row. Audio KBAT sets, screenshots
 *   and comments are empty as on live. The 2,260 videos are the dataset itself (30 literal anchors
 *   plus the generated rows).
 * - `finaliseContent()` (after every dataset has compiled): the build check — every documented
 *   M09 §6.11 figure (`expected` of the named queries) must equal the computed count.
 */

import type { SeedContext } from '@/mock/define'
import { checkNamedQueries } from '@/mock/dataset'

import { SEED_ARTICLES } from '../data/articles'
import {
  SEED_BANNERS,
  SEED_NOTES,
  SEED_PERUTUSAN,
  SEED_REACTIONS,
  SEED_SUPPORT,
  SEED_VIDEO_SCHOOLS,
} from '../data/content'
import {
  articleQueries,
  articlesRepo,
  audioQueries,
  bannerQueries,
  bannersRepo,
  noteQueries,
  notesRepo,
  perutusanQueries,
  perutusanRepo,
  supportRepo,
  videoQueries,
  videosRepo,
} from '../repository'
import { bindM09Clock } from '../repository/common'

export function seedContent(ctx: SeedContext): void {
  bindM09Clock(ctx.clock)
  articlesRepo.seed(SEED_ARTICLES)
  notesRepo.seed(SEED_NOTES)
  bannersRepo.seed(SEED_BANNERS)
  perutusanRepo.seed(SEED_PERUTUSAN, SEED_REACTIONS)
  supportRepo.seed(SEED_SUPPORT)
  videosRepo.seedVideoSchools(SEED_VIDEO_SCHOOLS)
}

/** Throws when a documented M09 figure differs from the computed count (stops the boot). */
export function finaliseContent(): void {
  const issues = [
    ...checkNamedQueries(articleQueries),
    ...checkNamedQueries(noteQueries),
    ...checkNamedQueries(bannerQueries),
    ...checkNamedQueries(audioQueries),
    ...checkNamedQueries(perutusanQueries),
    ...checkNamedQueries(videoQueries),
  ]
  if (issues.length > 0) {
    throw new Error(
      `M09 content build check failed:\n${issues.map((i) => `- ${i.message}`).join('\n')}`,
    )
  }
}
