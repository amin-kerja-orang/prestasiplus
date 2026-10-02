/**
 * F-29 query budget (overview §6.6 v1.5): every M09 screen and consumer read of the `videos`
 * dataset (2,260) and the article, banner and perutusan tables runs in ≤ 50 ms.
 *
 * Timing uses F-09's paired-calibration harness: each case is paired with a floor pass, the ratio
 * gate (`best ≤ cap × floor`) is always enforced, and the 50 ms budget scales with the floor up to
 * 1.5× (beyond that the budget gate is skipped explicitly; `assertSkipShare` fails the run when too
 * many are skipped).
 */

import { beforeAll, describe, it } from 'vitest'

import { mulberry32 } from '@/mock/determinism'
import { createPerfCalibration, type PerfCap } from '@/mock/dataset/testing/perf-calibration'

import { articles, banners, perutusan, videos } from '../../mock'
import type { Viewer } from '../../mock/types'
import { bootM09 } from './helpers'

const BUDGET_MS = 50

/**
 * Ratio caps (`best / paired floor`), from 5 runs with `suggestCaps` on a loaded machine (floors
 * 47–114 ms against a 30 ms reference); the ratios are load-independent, the noisy caps carry 1 ms slack.
 */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  'S17 page 1': { cap: 0.0084, noisy: true, slackMs: 1 }, // min 0.00106, median 0.00133, max 0.00695, 5 runs — noisy: no 2x guarantee
  'S17 page 95': { cap: 0.0019, noisy: true, slackMs: 1 }, // min 0.00080, median 0.00098, max 0.00153, 5 runs — noisy: no 2x guarantee
  'S17 subject 5 page 2': { cap: 0.0034, noisy: true, slackMs: 1 }, // min 0.00140, median 0.00168, max 0.00279, 5 runs — noisy: no 2x guarantee
  'S17 category motivasi': 0.00041, // min 0.00021, median 0.00032, max 0.00034, 5 runs
  'S17 search fizik': { cap: 0.018, noisy: true, slackMs: 1 }, // min 0.00451, median 0.01067, max 0.01452, 5 runs — noisy: no 2x guarantee
  'S17 search broad (video)': { cap: 0.021, noisy: true, slackMs: 1 }, // min 0.00922, median 0.01246, max 0.01746, 5 runs — noisy: no 2x guarantee
  'S17 facets': { cap: 0.011, noisy: true, slackMs: 1 }, // min 0.00419, median 0.00672, max 0.00876, 5 runs — noisy: no 2x guarantee
  'S17 facets subject 5': 0.0099, // min 0.00538, median 0.00656, max 0.00762, 5 runs
  'S17 facets search': { cap: 0.4, noisy: true, slackMs: 1 }, // re-based for D22 (M09-T1b): real titles contain "tingkatan", so the search matches ~700 rows (generated titles matched none); 0.25-0.26 measured on a loaded machine
  'S17 Q-VID-CAT': 0.00013, // min 0.00007, median 0.00008, max 0.00011, 5 runs
  'S18 detail': { cap: 0.0024, noisy: true, slackMs: 1 }, // min 0.00104, median 0.00154, max 0.00198, 5 runs — noisy: no 2x guarantee
  'S18 related': { cap: 0.0035, noisy: true, slackMs: 1 }, // min 0.00148, median 0.00232, max 0.00273, 5 runs — noisy: no 2x guarantee
  'S15 reader list page 1': { cap: 0.0034, noisy: true, slackMs: 1 }, // min 0.00138, median 0.00225, max 0.00264, 5 runs — noisy: no 2x guarantee
  'S15 reader search sifir': { cap: 0.00091, noisy: true, slackMs: 1 }, // min 0.00034, median 0.00060, max 0.00076, 5 runs — noisy: no 2x guarantee
  'S15 hot': { cap: 0.0029, noisy: true, slackMs: 1 }, // min 0.00123, median 0.00147, max 0.00237, 5 runs — noisy: no 2x guarantee
  'S16 detail': { cap: 0.00078, noisy: true, slackMs: 1 }, // min 0.00021, median 0.00048, max 0.00064, 5 runs — noisy: no 2x guarantee
  'S1 admin list page 4': { cap: 0.0043, noisy: true, slackMs: 1 }, // min 0.00108, median 0.00195, max 0.00355, 5 runs — noisy: no 2x guarantee
  'M05 articles.latest(5)': { cap: 0.0019, noisy: true, slackMs: 1 }, // min 0.00089, median 0.00127, max 0.00155, 5 runs — noisy: no 2x guarantee
  'M05 banners.activeFor': { cap: 0.00014, noisy: true, slackMs: 1 }, // min 0.00004, median 0.00006, max 0.00011, 5 runs — noisy: no 2x guarantee
  'S22 perutusan list': { cap: 0.00073, noisy: true, slackMs: 1 }, // min 0.00033, median 0.00038, max 0.00060, 5 runs — noisy: no 2x guarantee
}

const perf = createPerfCalibration({ prefix: 'M09 perf', caps: RATIO_CAPS })

const STUDENT: Viewer = { id: 2, role: 'student', schoolId: 900001 }

beforeAll(async () => {
  await bootM09()
  perf.setup()
}, 120_000)

const rng = mulberry32(11)

const CASES: readonly (readonly [string, () => unknown, ('js' | 'native')?])[] = [
  ['S17 page 1', () => videos.list({ viewer: null })],
  ['S17 page 95', () => videos.list({ viewer: null, page: 95 })],
  ['S17 subject 5 page 2', () => videos.list({ viewer: STUDENT, subjectId: 5, page: 2 })],
  ['S17 category motivasi', () => videos.list({ viewer: null, category: 'motivasi' })],
  ['S17 search fizik', () => videos.list({ viewer: null, search: 'fizik' }), 'native'],
  ['S17 search broad (video)', () => videos.list({ viewer: STUDENT, search: 'video' }), 'native'],
  ['S17 facets', () => videos.facets({ viewer: STUDENT })],
  ['S17 facets subject 5', () => videos.facets({ viewer: STUDENT, subjectId: 5 })],
  ['S17 facets search', () => videos.facets({ viewer: STUDENT, search: 'tingkatan' }), 'native'],
  ['S17 Q-VID-CAT', () => videos.count('Q-VID-CAT', 'ceramah')],
  ['S18 detail', () => videos.detail(2_224, STUDENT)],
  ['S18 related', () => videos.related(1_500, STUDENT)],
  ['S15 reader list page 1', () => articles.readerList({})],
  ['S15 reader search sifir', () => articles.readerList({ search: 'sifir' })],
  ['S15 hot', () => articles.hot(rng)],
  ['S16 detail', () => articles.detail('selamat-datang-ke-prestasi')],
  ['S1 admin list page 4', () => articles.adminList({ page: 4 })],
  ['M05 articles.latest(5)', () => articles.latest(5)],
  ['M05 banners.activeFor', () => banners.activeFor({ role: 'student' })],
  ['S22 perutusan list', () => perutusan.list(STUDENT)],
]

describe('M09 query budget', () => {
  const results: Record<string, string> = {}
  for (const [label, fn, kind] of CASES) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results, kind)
    })
  }
  it('reports timings', () => perf.report('M09 perf', results))
})

describe('regression proof (F09-5)', () => {
  it('proof: the ratio gate catches a 2× slower S17 category list', (ctx) => {
    perf.proveRegression(ctx, 'S17 category motivasi', () =>
      videos.list({ viewer: null, category: 'motivasi' }),
    )
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too loaded', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
