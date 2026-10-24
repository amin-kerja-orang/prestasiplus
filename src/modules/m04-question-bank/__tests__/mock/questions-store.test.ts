/**
 * F-25: the M04 question, structured-question and report stores (SRS v1.10 §4.1, §6.11, §6.13,
 * §7.1). Booted through `bootMock` with the real registry (M03 + M04; the other slice modules are
 * still stubs), so the plugin, repositories, seed and conventions are checked as the app runs them.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { assertFeasible, checkNamedQueries } from '@/mock/dataset'
import { defineMockCore } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'
import { RepositoryError } from '@/mock/repository'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { mulberry32 } from '@/mock/determinism'

import plugin, { importRuns, questions, reports, structured } from '../../mock'
import { M04_ANCHORS } from '../../mock/data/anchors'
import {
  ACTIVE_BY_LEVEL,
  APPROVED_BY_SUBJECT,
  ELIGIBLE_BY_SUBJECT,
  LEVELS,
  NAMED_SPS,
  DARJAH_DIFFICULTY_PINS,
  S6_LEVEL_MEAN,
  S6_SUBJECT_MEAN,
  SPM_POOL,
  TABLE_A,
  TABLE_B,
  T45_CHAPTERS,
  TABLE_C,
} from '../../mock/data/tables'
import { qualityMeans } from '../../mock/datasets/quality'
import {
  M04_ANCHOR_ROWS,
  PINNED_SCORES,
  qualityScoreOf,
  questionsDataset,
} from '../../mock/datasets/questions'
import { M05_ANCHOR_GROUPS, questionSpec } from '../../mock/datasets/questions-spec'
import { structuredDataset, structuredSpec } from '../../mock/datasets/structured'
import { questionQueries, structuredQueries } from '../../mock/repository/queries'
import { SEED_REPORTS } from '../../mock/seeds/reports'

const NOW = '2026-09-25T15:40:00+08:00'
const NOW_MS = Date.parse(NOW)

let runtime: MockRuntime

function boot(init: { overrides?: Record<string, unknown> } = {}) {
  return bootMock({
    mode: 'test',
    core: defineMockCore({}),
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
    init,
  })
}

function repoError(fn: () => unknown): RepositoryError {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(RepositoryError)
    return err as RepositoryError
  }
  throw new Error('expected a RepositoryError')
}

const cell = (t: Readonly<Record<number, readonly (number | null)[]>>, s: number, l: number) =>
  t[s]?.[l - 1] ?? 0

beforeAll(async () => {
  runtime = await boot()
}, 60_000)

afterAll(async () => {
  await runtime.reset()
})

describe('plugin and boot', () => {
  it('boots with M03 and exports the three M04 repositories', () => {
    expect(plugin.id).toBe('M04')
    expect(plugin.dependsOn).toEqual(['core', 'M01', 'M02', 'M03'])
    expect(Object.keys(plugin.repositories).sort()).toEqual([
      'importRuns',
      'masterNotes',
      'qualityAudit',
      'questions',
      'reports',
      'structured',
      'submissions',
    ])
    expect(questionsDataset.compiled).toBe(true)
    expect(structuredDataset.compiled).toBe(true)
    // M03 is seeded in the same boot.
    expect(curriculum.subjectLevelPairs()).toHaveLength(194)
  })

  it('Table A–C pairs outside the M03 links are only the S10-observed Pendidikan Muzik T1–T3 and Pendidikan Syariah Islamiah T1; every chapter id is an M03 chapter of its pair', () => {
    const links = new Set(
      curriculum.subjectLevelPairs().map(([s, l]) => `${String(s)}:${String(l)}`),
    )
    const outside = new Set<string>()
    for (const table of [TABLE_A, TABLE_B, TABLE_C]) {
      for (const [s, row] of Object.entries(table)) {
        row.forEach((n, i) => {
          if (n !== null && !links.has(`${s}:${String(i + 1)}`))
            outside.add(`${s}:${String(i + 1)}`)
        })
      }
    }
    // SRS v1.11: "the M03 links are not used as a constraint for Table A" (S10 observes them).
    expect([...outside].sort()).toEqual(['14:7', '14:8', '14:9', '27:7'])
    // D54: the T4/T5 chapter table is exactly the M03 chapters of each pair (all active).
    for (const [s, [t4, t5]] of Object.entries(T45_CHAPTERS)) {
      for (const [l, list] of [
        [10, t4],
        [11, t5],
      ] as const) {
        for (const chapterId of list) {
          const ch = curriculum.chapter(chapterId)
          expect(ch?.subjectId, `chapter ${String(chapterId)}`).toBe(Number(s))
          expect(ch?.educationLevelId, `chapter ${String(chapterId)}`).toBe(l)
        }
        const m03 = curriculum
          .chapters(Number(s), l)
          .map((c) => c.id)
          .sort((a, b) => a - b)
        expect(
          [...list].sort((a, b) => a - b),
          `chapters of ${s}:${String(l)}`,
        ).toEqual(m03)
      }
    }
    // The M05 anchors' chapters (admin: BM Darjah 1/2, kept as observed; pelajarmaju: MATH T4).
    for (const g of M05_ANCHOR_GROUPS) {
      const ch = curriculum.chapter(g.chapterId)
      expect(ch?.subjectId, `chapter ${String(g.chapterId)}`).toBe(g.subjectId)
      expect(ch?.educationLevelId, `chapter ${String(g.chapterId)}`).toBe(g.levelId)
    }
  })

  it('specHash is stable and computable without compiling', () => {
    expect(questionsDataset.specHash()).toMatch(/^[0-9a-f]{16}$/)
    expect(questionsDataset.specHash()).toBe(questionsDataset.specHash())
    expect(structuredDataset.specHash()).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('named queries (SRS §4.1)', () => {
  it('the dataset is feasible and every documented value holds', () => {
    expect(assertFeasible(questionsDataset, questionQueries).ok).toBe(true)
    expect(assertFeasible(structuredDataset, structuredQueries).ok).toBe(true)
    expect(checkNamedQueries(questionQueries)).toEqual([])
    expect(checkNamedQueries(structuredQueries)).toEqual([])
  }, 60_000)

  it('headline values', () => {
    expect(questionsDataset.count()).toBe(466_041)
    expect(questions.count('Q-ALL')).toBe(465_278)
    expect(questions.count('Q-ACTIVE')).toBe(129_389)
    expect(questions.count('Q-ELIGIBLE')).toBe(128_989)
    expect(questions.count('Q-PKSK')).toBe(763)
    expect(questions.count('Q-ACTIVE') + questions.count('Q-PKSK')).toBe(130_152)
    expect(questions.count('Q-ELIGIBLE') + questions.count('Q-PKSK')).toBe(129_752)
    expect(questions.count('Q-APPROVED')).toBe(146_330)
    expect(questions.count('Q-ARCHIVED')).toBe(318_948)
    expect(questions.count('Q-APPROVED-INACTIVE')).toBe(17_341)
    expect(questions.count('Q-ARCHIVED-ACTIVE')).toBe(400)
    expect(questions.count('Q-SCORED')).toBe(147_026)
    expect(questions.count('Q-SPM-POOL')).toBe(21_033)
    expect(questions.count('Q-SPM-POOL', 3)).toBe(1_681)
    expect(questions.count('Q-SPM-POOL', 18)).toBe(0)
    expect([1, 2, 3, 4, 5].map((d) => questions.count('Q-DIFFICULTY', d))).toEqual([
      39_694, 47_138, 33_720, 9_600, 0,
    ])
    expect(structured.count('Q-STRUCT-ALL')).toBe(4_064)
    expect(structured.count('Q-STRUCT-VISIBLE')).toBe(4_059)
    expect(questions.count('Q-CONTRIB', 1)).toBe(16_817)
    expect(questions.count('Q-CONTRIB', 5)).toBe(1)
    expect(questions.count('Q-TEACHER-DATABANK', 1)).toBe(6_048)
    expect(questions.countWhere({})).toBe(465_278)
    expect(questions.countWhere({ pkskDomainId: { ne: null } })).toBe(763)
  })

  it('Table A, B and C cells (layer 1/2 and the scored rows)', () => {
    for (const s of Object.keys(TABLE_A).map(Number)) {
      for (const l of LEVELS) {
        const active = questions.count('Q-ACTIVE', s, l)
        const all = questions.count('Q-ALL', s, l)
        expect(active, `A ${String(s)}:${String(l)}`).toBe(cell(TABLE_A, s, l))
        expect(all - active, `B ${String(s)}:${String(l)}`).toBe(cell(TABLE_B, s, l))
        expect(questions.count('Q-SCORED', s, l), `C ${String(s)}:${String(l)}`).toBe(
          cell(TABLE_C, s, l),
        )
      }
    }
    expect(
      questions.count('Q-ACTIVE', 3) -
        questions.countWhere({
          subjectId: 3,
          isActive: true,
          educationLevelId: { isNull: false },
        }),
    ).toBe(9)
  })

  it('consistency checks: Q-ALL ≥ Q-APPROVED ≥ Q-ELIGIBLE per subject; Q-ACTIVE = Q-ELIGIBLE except PM (+400)', () => {
    let sumEligible = 0
    let sumActive = 0
    let sumApproved = 0
    for (let s = 1; s <= 31; s++) {
      const all = questions.count('Q-ALL', s)
      const approved = questions.count('Q-APPROVED', s)
      const eligible = questions.count('Q-ELIGIBLE', s)
      const active = questions.count('Q-ACTIVE', s)
      expect(all).toBeGreaterThanOrEqual(approved)
      expect(approved).toBeGreaterThanOrEqual(eligible)
      expect(active - eligible).toBe(s === 7 ? 400 : 0)
      expect(eligible).toBe(ELIGIBLE_BY_SUBJECT[s] ?? 0)
      expect(approved).toBe(APPROVED_BY_SUBJECT[s] ?? 0)
      sumEligible += eligible
      sumActive += active
      sumApproved += approved
    }
    expect([sumEligible, sumActive, sumApproved]).toEqual([128_989, 129_389, 146_330])
    let sumLevels = 0
    for (const [l, n] of Object.entries(ACTIVE_BY_LEVEL)) {
      expect(questions.count('Q-ACTIVE', undefined, Number(l))).toBe(n)
      sumLevels += n
    }
    expect(sumLevels).toBe(129_380)
    expect(questions.count('Q-ALL', undefined, 1)).toBe(14_778)
  })

  it('Q-PRACTICE: Tingkatan 4–5 (D54); every eligible non-anchor row of a pair with M03 chapters has a chapter', () => {
    // The practice levels are T4/T5: the sum over subjects equals Table A at T4/T5 (minus the
    // non-MCQ BM databank rows).
    let tableT45 = 0
    let total = 0
    for (let s = 1; s <= 27; s++) {
      tableT45 += cell(TABLE_A, s, 10) + cell(TABLE_A, s, 11)
      total += questions.count('Q-PRACTICE', s)
    }
    expect(total).toBe(tableT45 - 3)
    expect(questions.count('Q-PRACTICE', 3)).toBe(2601)
    // Chapter links: a pair's chapter questions + its unlinked anchors = its Q-PRACTICE rows.
    for (const [s, [t4, t5]] of Object.entries(T45_CHAPTERS)) {
      for (const [l, list] of [
        [10, t4],
        [11, t5],
      ] as const) {
        const practice = questions.count('Q-PRACTICE', Number(s), l)
        if (practice === 0) continue
        const linked = list.reduce((a, id) => a + questions.count('Q-CHAPTER', id), 0)
        const unlinked = questions.countWhere({
          subjectId: Number(s),
          educationLevelId: l,
          isActive: true,
          status: 'approved',
          questionType: 'mcq',
          pkskDomainId: null,
          curriculumChapterId: null,
        })
        expect(linked + unlinked, `${s}:${String(l)}`).toBe(practice)
        if (list.length > 0) expect(linked, `${s}:${String(l)} linked`).toBeGreaterThan(0)
      }
    }
    // Darjah 1–4: no chapter link but the admin's observed BM anchors; the difficulty pins stay.
    for (const [s, byLevel] of Object.entries(DARJAH_DIFFICULTY_PINS)) {
      for (const [l, data] of Object.entries(byLevel)) {
        expect(
          questions.countWhere({
            subjectId: Number(s),
            educationLevelId: Number(l),
            isActive: true,
            curriculumChapterId: { ne: null },
          }),
          `${s}:${l}`,
        ).toBe(s === '1' && l === '1' ? 33 : s === '1' && l === '2' ? 2 : 0)
        data.difficulty.forEach((n, i) => {
          expect(
            questions.countWhere({
              subjectId: Number(s),
              educationLevelId: Number(l),
              isActive: true,
              difficultyLevel: i + 1,
            }),
          ).toBe(n)
        })
      }
    }
  })

  it('Q-SPM-POOL per subject × level × difficulty (M06 §6.10) and the pool rule', () => {
    for (const [s, [t4, t5]] of Object.entries(SPM_POOL)) {
      t4.forEach((n, i) =>
        expect(
          questions.spmPool({
            subjectId: Number(s),
            educationLevelIds: [10],
            difficultyLevel: i + 1,
          }).total,
        ).toBe(n),
      )
      t5.forEach((n, i) => expect(questions.count('Q-SPM-POOL', Number(s), 11, i + 1)).toBe(n))
    }
    const view = questions.spmPool({ subjectId: 3 })
    expect(view.total).toBe(1_681)
    const page = view.page(1)
    expect(page.rows).toHaveLength(20)
    for (const r of page.rows) {
      expect(r.spmPool && r.questionType === 'mcq' && r.status === 'approved' && r.isActive).toBe(
        true,
      )
    }
  })

  it('Q-SP-AVAILABLE gives the listed values', () => {
    expect(NAMED_SPS.map((s) => [s.sp, questions.spAvailable(s.sp)])).toEqual([
      [9001, 30],
      [9002, 2],
      [9003, 2],
      [9004, 2],
      [221, 16],
      [206, 16],
      [222, 7],
      [214, 12],
      [179, 13],
      [194, 50],
      [418, 13],
    ])
    expect(questions.spAvailable(221, { levelId: 10 })).toBe(16)
    expect(questions.spAvailable(221, { levelId: 11 })).toBe(0)
    // Every other tagged row points to its pair's generic SP (Sains T5 → 6191).
    expect(questions.get(564159)?.dskpSpId).toBe(6191)
  })

  it('facet totals of §6.13.1 layer 3', () => {
    const c = (w: Parameters<typeof questions.countWhere>[0]) => questions.countWhere(w)
    expect(c({ complianceStatus: 'quarantined' })).toBe(124_299)
    expect(c({ complianceStatus: 'quarantined', status: 'archived', isActive: false })).toBe(
      124_299,
    )
    expect(c({ complianceStatus: 'pending_mapping' })).toBe(2_756)
    expect(c({ complianceStatus: 'draft' })).toBe(27_652)
    expect(c({ complianceStatus: 'verified' })).toBe(310_571)
    expect(c({ complianceStatus: 'rejected' })).toBe(0)
    expect(c({ sourceType: 'trial' })).toBe(19_219)
    expect(c({ sourceType: 'dskp' })).toBe(35_401)
    expect(c({ sourceType: 'marking_scheme' })).toBe(199)
    expect(c({ sourceType: 'ai_generated' })).toBe(373)
    expect(c({ legacyGeneric: true })).toBe(373)
    expect(c({ hasSourceFile: false })).toBe(128_372)
    expect(c({ dskpTagged: false })).toBe(14_933)
    expect(c({ qualityBucket: 'baik' })).toBe(749)
    expect(c({ qualityBucket: 'le50' })).toBe(2)
    expect(c({ qualityBucket: 'cemerlang' })).toBe(146_275)
    expect(c({ needsDiagram: true })).toBe(6_144)
    expect(c({ status: ['draft', 'pending_review', 'rejected'] })).toBe(0)
    expect(c({ questionType: { ne: 'mcq' } })).toBe(130)
    expect(c({ questionType: { ne: 'mcq' }, teacherDatabank: false })).toBe(0)
    expect(c({ difficultyLevel: 1 })).toBe(45_686)
    expect(questions.count('Q-TEACHER-DATABANK', 1, 'mcq', 3)).toBe(950)
    // The 9 Bahasa Melayu rows without a level are untagged (M10 §6.9 note).
    expect(
      c({ subjectId: 3, educationLevelId: null, dskpTagged: false, coverageExcluded: true }),
    ).toBe(9)
  })

  it('S6 quality means: every subject and level mean and the overall mean round to the S6 values', () => {
    const m = qualityMeans(questionSpec().cells, (f) => qualityScoreOf(f), PINNED_SCORES)
    for (const [s, mean] of Object.entries(S6_SUBJECT_MEAN)) {
      const e = m.bySubject.get(Number(s))
      expect(e && Math.round((e.sum / e.n) * 10) / 10, `subject ${s}`).toBe(mean)
    }
    for (const [l, mean] of Object.entries(S6_LEVEL_MEAN)) {
      const e = m.byLevel.get(Number(l))
      expect(e && Math.round((e.sum / e.n) * 10) / 10, `level ${l}`).toBe(mean)
    }
    expect((m.total.sum / m.total.n).toFixed(1)).toBe('94.1')
    // The repository aggregate (a scan of the cheap field) agrees with the cell model.
    const stats = questions.qualityStats()
    expect(stats.count).toBe(147_026)
    expect(stats.sum).toBe(m.total.sum)
  })
})

describe('v1.11 analytics inputs (BR-M04-37/38, E2E-M04-68/69)', () => {
  it('Q-M17-COV, the excluded rows and the S10 difficulty tiles', () => {
    expect(questions.count('Q-M17-COV')).toBe(127_643)
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((l) => questions.count('Q-M17-COV', 1, l)),
    ).toEqual([958, 2540, 805, 530, 407, 400, 2104, 1800, 1500, 257, 387])
    expect(questions.count('Q-M17-COV', 3)).toBe(13_354)
    expect(questions.countWhere({ coverageExcluded: true })).toBe(1_746)
    expect(
      questions.countWhere({ coverageExcluded: true, isActive: true, status: 'approved' }),
    ).toBe(1_746)
    expect(
      [1, 2, 3, 4, 5].map((d) =>
        questions.countWhere({ coverageExcluded: true, difficultyLevel: d }),
      ),
    ).toEqual([473, 731, 542, 0, 0])
    expect(
      [1, 2, 3, 4].map((d) =>
        questions.countWhere({ coverageExcluded: true, subjectId: 21, difficultyLevel: d }),
      ),
    ).toEqual([174, 269, 198, 0])
    expect(
      [1, 2, 3, 4, 5].map((d) => questions.count('Q-M17-COV', undefined, undefined, d)),
    ).toEqual([38_968, 46_154, 32_987, 9_534, 0])
    // Excluded rows never sit at T1–T3; Sejarah T4 has no non-pool row (M08's anchors are pool rows).
    expect(questions.countWhere({ coverageExcluded: true, educationLevelId: [7, 8, 9] })).toBe(0)
    expect(
      questions.countWhere({ subjectId: 5, educationLevelId: 10, isActive: true, spmPool: false }),
    ).toBe(0)
    // PKSK difficulty 253 / 253 / 191 / 66 (v1.11).
    expect(
      [1, 2, 3, 4].map((d) =>
        questions.countWhere({ pkskDomainId: { ne: null }, difficultyLevel: d }),
      ),
    ).toEqual([253, 253, 191, 66])
    expect(questions.countWhere({ isActive: false, difficultyLevel: 1 })).toBe(6_245)
  })

  it('Q-TEACHER-CONTRIB = 11,414 while Q-CONTRIB(1) and (5) are unchanged', () => {
    expect(questions.teacherContributions()).toBe(11_414)
    expect(questions.teacherContributions(8087)).toBe(1_368 + 1_064)
    expect(questions.teacherContributions(8107)).toBe(1_184 + 219)
    expect(questions.teacherContributions(8880)).toBe(13)
    expect(questions.teacherContributions(8090)).toBe(1)
    expect(questions.count('Q-CONTRIB', 1)).toBe(16_817)
    expect(questions.count('Q-CONTRIB', 5)).toBe(1)
    // The named query is objective + structured (SRS §4.1, §7.1, E2E-M04-69).
    expect(questions.count('Q-TEACHER-CONTRIB')).toBe(11_414)
    expect(questions.count('Q-TEACHER-CONTRIB', 8087)).toBe(2_432)
    expect(questions.count('Q-TEACHER-CONTRIB', 0)).toBe(7_565)
    // It spans two stores: every method except `count` is a CONTRACT error.
    for (const call of [
      () => questions.groupCount('Q-TEACHER-CONTRIB', 'subjectId'),
      () => questions.where('Q-TEACHER-CONTRIB'),
      () => questions.query('Q-TEACHER-CONTRIB', { page: 1, pageSize: 20 }),
      () => questions.sample('Q-TEACHER-CONTRIB', 5, mulberry32(1)),
    ]) {
      expect(repoError(call).code).toBe('CONTRACT')
    }
    // M02 v1.18 contributor anchors are the createdBy of their school's rows; the 7,565 rows of the
    // other teachers keep the generated creator (no published teacher id).
    expect([4501, 4502, 4503, 4504].map((id) => questions.count('Q-CONTRIB', id))).toEqual([
      1_368, 1_184, 13, 1,
    ])
    expect(
      [4501, 4502].map((id) => structured.list({ viewer: { id }, pageSize: 1 }).total),
    ).toEqual([1_064, 219])
    expect(questions.countWhere({ contribSchoolId: 0, createdBy: 5801 })).toBe(7_565)
  })

  it('holes (absentIds): 108527 does not exist and nothing lies between 564155 and 564157', () => {
    expect(questions.get(108527)).toBeNull()
    expect(questions.get(564156)).toBeNull()
    expect(questions.exists(564155)).toBe(true)
    expect(questions.countWhere({ id: { gte: 564156, lte: 564156 } })).toBe(0)
    expect(
      questions
        .adminList({})
        .rows.slice(0, 6)
        .map((r) => r.id),
    ).toEqual([564159, 564160, 564161, 564157, 564158, 564155])
    expect(questions.count('Q-ALL')).toBe(465_278)
    expect(questionsDataset.count()).toBe(466_041)
  })

  it('no generated question is created on or after 2026-09-21', () => {
    const from = Date.parse('2026-09-21T00:00:00+08:00')
    expect(questions.countWhere({ createdAtMs: { gte: from } })).toBe(0)
    expect(questions.countWhere({ pkskDomainId: { ne: null }, createdAtMs: { gte: from } })).toBe(0)
  })

  it('Jutawan store: Q-JUT-COUNT cells, keyless draws and grading, outside Q-ALL', () => {
    expect(questions.jutawanCount(5, 7)).toBe(2_974)
    expect(questions.jutawanCount(27, 11)).toBe(143)
    expect(questions.jutawanCount(19, 1)).toBe(0)
    let total = 0
    for (let s = 1; s <= 31; s++)
      for (let l = 1; l <= 11; l++) total += questions.jutawanCount(s, l)
    expect(total).toBe(149_911)
    const drawn = questions.jutawanSample(
      { subjectId: 1, level: 1, difficulty: 1 },
      4,
      mulberry32(9),
    )
    expect(new Set(drawn.map((r) => r.id)).size).toBe(4)
    for (const r of drawn) {
      expect(r).toMatchObject({ subjectId: 1, educationLevelId: 1, difficultyLevel: 1 })
      expect('correctAnswer' in r).toBe(false)
    }
    const first = drawn[0] as { id: number }
    const key = questions.jutawanGet(first.id)?.correctAnswer as number
    expect(questions.jutawanGradeAnswer(first.id, key)).toEqual({
      isCorrect: true,
      correctOptionId: key,
    })
    expect(questions.count('Q-ALL')).toBe(465_278)
  })

  it('import runs: 1,123 runs, Σ 31,101, none in Aug–Sep 2026, newest 20/07/2026', () => {
    expect(importRuns.count('Q-IMPORT-RUNS')).toBe(1_123)
    expect(importRuns.importedTotal()).toBe(31_101)
    expect(importRuns.countByMonth('2026-08')).toBe(0)
    expect(importRuns.count('Q-IMPORT-MONTH', '2026-09')).toBe(0)
    const page = importRuns.list()
    expect(page.rows[0]).toMatchObject({
      fileName: 'soalan-bm-d3.csv',
      importedCount: 12,
      failedCount: 1,
    })
    expect(page.rows[0]?.createdAt.slice(0, 10)).toBe('2026-07-20')
    expect(page.total).toBe(1_123)
  })

  it('sampleKeyless returns rows without keys (M16)', () => {
    const rows = questions.sampleKeyless(
      { subjectId: 3, educationLevelIds: [1, 2], questionType: 'mcq', eligible: true },
      10,
      mulberry32(4),
    )
    expect(rows).toHaveLength(10)
    for (const r of rows) {
      expect('correctAnswer' in r || 'explanation' in r).toBe(false)
      expect(questions.gradeAnswer(r.id, 'A')?.correctOptionId).toBeTypeOf('number')
    }
    const pk = questions.sampleKeyless(
      { pkskDomainId: 2, pkskTargetLevel: 'T1', eligible: true },
      5,
      mulberry32(5),
    )
    expect(
      pk.every(
        (r) => r.pkskDomainId === 2 && (r.pkskOptions ?? []).every((o) => !('isCorrect' in o)),
      ),
    ).toBe(true)
  })
})

describe('anchors and layout', () => {
  it('every M04 anchor sits at its id with its literal values', () => {
    for (const row of M04_ANCHOR_ROWS) {
      expect(questionsDataset.isAnchor(row.id), String(row.id)).toBe(true)
      expect(questions.get(row.id)).toEqual(row)
    }
    const a = questions.get(564159)
    expect(a?.questionText).toBe(
      'Topup Sains T5 Bab 9 item 1: Apakah maksud satelit buatan? Pilih jawapan yang paling tepat.',
    )
    expect(a?.qualityScore).toBe(96)
    expect(questions.get(129114)?.qualityScore).toBe(50)
    expect(questions.get(570024)?.qualityScore).toBe(55)
    expect(questions.get(570021)?.usage).toEqual({ attempts: 42, correct: 30 })
    expect(M04_ANCHORS).toHaveLength(M04_ANCHOR_ROWS.length)
  })

  it('S1 order: newest first, ties by id (BR-M04-31); PKSK rows never listed', () => {
    const page = questions.adminList({})
    expect(page.total).toBe(465_278)
    expect(page.rows.slice(0, 5).map((r) => r.id)).toEqual([564159, 564160, 564161, 564157, 564158])
    for (let i = 1; i < page.rows.length; i++) {
      const a = page.rows[i - 1]
      const b = page.rows[i]
      expect(
        a &&
          b &&
          (a.createdAtMs > b.createdAtMs || (a.createdAtMs === b.createdAtMs && a.id < b.id)),
      ).toBe(true)
    }
    expect(questions.adminList({ search: 'Bagi calon T4, apakah tindakan terbaik' }).total).toBe(0)
  })

  it('the user-1 layout block: no user-1 row below 522425; the block starts at 522425', () => {
    expect(questions.countWhere({ createdBy: 1, id: { lte: 522_424 } })).toBe(0)
    const first = questions.contributions(1)
    expect(first.rows[0]?.id).toBe(522_425)
    expect(first.total).toBe(16_817)
    expect(first.counts).toEqual({ total: 16_817, approved: 16_817, pending: 0, used: 0 })
    // Page 1 is ascending user-1 ids from 522425 and page 2 continues it. The exact E2E-M04-67
    // pages (522425–522444, then 522445) need the M10 anchors 522425–522447, which M10 contributes;
    // contributions.test.ts asserts them with those anchors in place.
    const ids = first.rows.map((r) => r.id)
    expect(ids).toHaveLength(20)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    const second = questions.contributions(1, { page: 2 })
    expect((second.rows[0]?.id ?? 0) > (ids[19] ?? 0)).toBe(true)
  })

  it('determinism: rows, pages and seeded draws are identical after a reset and a second boot', async () => {
    const snap = () => ({
      row: questions.get(300_001),
      page: questions.adminList({ page: 1000 }).rows.map((r) => r.id),
      draw: questions
        .sampleKeyless(
          { subjectId: 3, educationLevelIds: [1, 2], questionType: 'mcq', eligible: true },
          20,
          mulberry32(42),
        )
        .map((r) => r.id),
    })
    // Module-level memos (the spec builder, the quality table, the text cache) survive in this one
    // process, so this proves the seed and the compile are deterministic, not the memos. The
    // runtime has no dispose API (`MockRuntime` offers `reset` only); the second `bootMock` resets
    // and re-registers the same singleton stores, which replaces the first runtime.
    const before = snap()
    expect(before.row).not.toBeNull()
    await runtime.reset()
    expect(snap()).toEqual(before)
    runtime = await boot()
    expect(snap()).toEqual(before)
  }, 60_000)

  it('PKSK rows take ids from 177698 and are excluded from every objective count', () => {
    const pksk = questions.pkskList({ pageSize: 1000 })
    expect(pksk.total).toBe(763)
    expect(Math.min(...pksk.rows.map((r) => r.id))).toBe(177_698)
    for (const r of pksk.rows) {
      expect(r.subjectId).toBeNull()
      expect(r.educationLevelId).toBeNull()
      expect(r.options).toBeNull()
    }
    // M07 owns the PKSK texts: exactly the 13 observed live "inovasi" rows contain the word (BR-M07-06).
    expect(pksk.rows.filter((r) => r.questionText.toLowerCase().includes('inovasi'))).toHaveLength(
      13,
    )
    expect(questions.count('Q-PKSK', undefined, 'T1')).toBe(383)
  })

  it('structured dataset: ids 393–4456, anchors, order, published and T4/T5 only', () => {
    expect(structuredDataset.count()).toBe(4_064)
    expect(structuredSpec().reduce((a, c) => a + c.count, 0)).toBe(4_064)
    expect(structured.get(392)).toBeNull()
    expect(structured.get(4456)?.createdAt).toBe('2026-05-20T09:00:00+08:00')
    const s3698 = structured.get(3698)
    expect(s3698?.subQuestions.map((s) => [s.partLabel, s.marks])).toEqual([
      ['a', 2],
      ['b', 4],
      ['c', 4],
    ])
    expect(s3698?.totalMarks).toBe(10)
    for (const id of [3699, 3703, 2509]) expect(structured.getVisible(id)).toBeNull()
    expect(structured.get(4454)?.topic).toBe('Merancang Pengendalian Perniagaan')
    const admin = structured.adminList()
    expect(admin.rows.slice(0, 3).map((r) => r.id)).toEqual([4454, 4455, 4456])
    expect(admin.total).toBe(4_064)
    expect(structured.visible().total).toBe(4_059)
    expect(structured.count('Q-FLAGGED-STR')).toBe(522)
  })
})

describe('reads used by consumers', () => {
  it('get / getEligible / eligibleForPractice (BR-M04-03)', () => {
    expect(questions.get(108_000_000)).toBeNull()
    expect(questions.getEligible(136891)).toBeNull() // approved but inactive
    expect(questions.getEligible(564159)?.id).toBe(564159)
    expect(questions.eligibleForPractice(564159)).toBe(true)
    expect(questions.eligibleForPractice(129114)).toBe(false)
    const pk = questions.pkskList({ pageSize: 1 }).rows[0]
    expect(pk && questions.eligibleForPractice(pk.id)).toBe(false)
  })

  it('practiceQuery is deterministic by seed and returns eligible MCQ rows of the filter', () => {
    const a = questions.practiceQuery({
      subjectId: 3,
      educationLevelIds: [1],
      limit: 10,
      seed: 'session-1',
    })
    const b = questions.practiceQuery({
      subjectId: 3,
      educationLevelIds: [1],
      limit: 10,
      seed: 'session-1',
    })
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id))
    expect(a).toHaveLength(10)
    for (const r of a)
      expect(r.subjectId === 3 && r.educationLevelId === 1 && r.questionType === 'mcq').toBe(true)
    const excluded = questions.practiceQuery({
      subjectId: 3,
      educationLevelIds: [1],
      limit: 10,
      seed: 'session-1',
      excludeIds: [a[0]?.id ?? 0],
    })
    expect(excluded.map((r) => r.id)).not.toContain(a[0]?.id)
  })

  it('gradeAnswer accepts letters and indexes', () => {
    expect(questions.gradeAnswer(564159, 'A')).toMatchObject({
      isCorrect: true,
      correctLetter: 'A',
    })
    expect(questions.gradeAnswer(564159, 2)?.isCorrect).toBe(false)
    expect(questions.gradeAnswer(99_999_999, 'A')).toBeNull()
  })

  it('teacher databank (M10 S28) and flagged lists', () => {
    const bank = questions.teacherDatabank(1)
    expect(bank.total).toBe(6_048)
    expect(bank.rows).toHaveLength(15)
    expect(bank.counts).toEqual({ total: 6_048, objective: 5_918, subjective: 105 })
    expect(questions.teacherDatabank(1, { questionType: 'mcq', difficulty: 3 }).total).toBe(950)
    const flagged = questions.flagged({ subjectId: 11 })
    expect(flagged.total).toBe(1_587)
    expect(flagged.rows[0] && flagged.rows[1] && flagged.rows[0].id > flagged.rows[1].id).toBe(true)
  })

  it('reports seed: 11 reports with the SRS statuses', () => {
    expect(reports.list().map((r) => r.id)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
    expect(reports.count('R-STATUS', 'pending')).toBe(2)
    expect(reports.count('R-STATUS', 'reviewed')).toBe(3)
    expect(reports.count('R-STATUS', 'fixed')).toBe(5)
    expect(reports.count('R-STATUS', 'dismissed')).toBe(1)
    expect(reports.mine(SEED_REPORTS[1]?.reporterId ?? 0).map((r) => r.id)).toEqual([10, 6, 2])
  })
})

describe('writes', () => {
  it('teacher create / update / delete run through the repository (BR-M04-35)', async () => {
    await runtime.reset()
    const before = questions.count('Q-CONTRIB', 5)
    const created = questions.createFromTeacher(
      { id: 5 },
      {
        subjectId: 10,
        educationLevelId: 11,
        difficultyLevel: 3,
        questionText: 'Apakah hasil elektrolisis larutan natrium klorida pekat di anod?',
        options: ['Gas klorin', 'Gas oksigen', 'Gas hidrogen', 'Natrium'],
        correctAnswer: 0,
        scriptType: 'rumi',
      },
      NOW_MS,
    )
    expect(created.id).toBeGreaterThanOrEqual(9_000_001)
    expect(created).toMatchObject({
      status: 'pending_review',
      isActive: true,
      createdBy: 5,
      spmPool: true,
      teacherDatabank: false,
      textDirection: 'ltr',
      createdAt: NOW,
    })
    expect(questions.count('Q-CONTRIB', 5)).toBe(before + 1)
    expect(questions.count('Q-ELIGIBLE')).toBe(128_989) // pending review: outside practice
    expect(questions.count('Q-ALL')).toBe(465_279)

    expect(
      questions.updateOwn({ id: 1 }, created.id, { questionText: 'x'.repeat(12) }, NOW_MS),
    ).toBeNull()
    const updated = questions.updateOwn(
      { id: 5 },
      created.id,
      { scriptType: 'jawi' },
      NOW_MS + 1000,
    )
    expect(updated).toMatchObject({ scriptType: 'jawi', textDirection: 'rtl' })

    expect(questions.deleteOwn({ id: 1 }, created.id)).toBe(false)
    expect(questions.deleteOwn({ id: 5 }, created.id)).toBe(true)
    expect(questions.get(created.id)).toBeNull()
    expect(questions.count('Q-ALL')).toBe(465_278)

    // A second runtime row skips nothing below the floor.
    const next = questions.create(
      {
        subjectId: 3,
        educationLevelId: 11,
        difficultyLevel: 2,
        questionText: 'Selesaikan 2x + 3 = 7.',
      },
      { createdBy: 1, now: NOW_MS },
    )
    expect(next.id).toBeGreaterThanOrEqual(9_000_001)
    expect(next).toMatchObject({
      status: 'approved',
      complianceStatus: 'draft',
      sourceType: null,
      spmPool: true,
    })
    expect(questions.count('Q-SPM-POOL', 3)).toBe(1_682)
  }, 60_000)

  it('non-owner writes throw OWNERSHIP; reads before finalise are guarded', () => {
    const e = repoError(() => questionsDataset.update(564159, { isActive: false }))
    expect(e.code).toBe('OWNERSHIP')
    expect(repoError(() => reportsTableInsert()).code).toBe('OWNERSHIP')
  })

  it('createFixture inserts 700301 at its reserved id (M10 E2E)', async () => {
    await runtime.reset()
    const row = questions.createFixture({
      id: 700301,
      subjectId: 10,
      educationLevelId: 11,
      difficultyLevel: 3,
      status: 'pending_review',
      createdBy: 5,
      questionText: 'Apakah hasil elektrolisis larutan natrium klorida pekat di anod?',
    })
    expect(row.id).toBe(700301)
    expect(questions.count('Q-CONTRIB', 5)).toBe(2)
    expect(questions.count('Q-CONTRIB', 5, 'approved')).toBe(1)
    expect(
      repoError(() => questions.createFixture({ id: 800_001, subjectId: 1, educationLevelId: 1 }))
        .code,
    ).toBe('CONTRACT')
  }, 60_000)

  it('a report deactivates an MCQ at once (BR-M04-12) and a 3rd open report deactivates a structured question', async () => {
    await runtime.reset()
    const res = reports.create({ questionId: 564161, reasons: ['typo'], source: 'spm' }, 2, NOW_MS)
    expect(res).toMatchObject({ success: true, message: 'Laporan berjaya dihantar.' })
    expect(questions.get(564161)?.isActive).toBe(false)
    expect(questions.count('Q-ELIGIBLE')).toBe(128_988)
    expect(questions.count('Q-SPM-POOL', 4)).toBe(2_075)
    expect(questions.eligibleForPractice(564161)).toBe(false)
    expect(reports.count('R-STATUS', 'pending')).toBe(3)

    for (let i = 0; i < 2; i++) {
      reports.create(
        {
          questionId: 3704,
          questionType: 'structured',
          reasons: ['other'],
          source: 'structured_attempt',
        },
        2,
        NOW_MS,
      )
    }
    expect(structured.get(3704)?.isActive).toBe(true)
    reports.create(
      {
        questionId: 3704,
        questionType: 'structured',
        reasons: ['typo'],
        source: 'structured_attempt',
      },
      3,
      NOW_MS,
    )
    expect(structured.get(3704)?.isActive).toBe(false)
    expect(structured.count('Q-STRUCT-VISIBLE')).toBe(4_058)

    const report = reports.list('pending').find((r) => r.questionId === 564161)
    reports.update(report?.id ?? 0, { status: 'dismissed', reactivate: true }, NOW_MS)
    expect(questions.get(564161)?.isActive).toBe(true)
    expect(
      repoError(() => reports.create({ questionId: 1, reasons: [], source: 'spm' }, 2, NOW_MS))
        .code,
    ).toBe('CONTRACT')
  }, 60_000)

  it('structured create / toggle / update / delete (BR-M04-36)', async () => {
    await runtime.reset()
    const row = structured.create(
      { id: 5 },
      {
        subjectId: 5,
        educationLevelId: 11,
        kbatLevel: 3,
        stimulus: 'Baca sumber berikut.',
        subQuestions: [
          { partLabel: 'a', questionText: 'Nyatakan satu ciri.', marks: 2 },
          { partLabel: 'b', questionText: 'Jelaskan.', marks: 4 },
        ],
      },
      NOW_MS,
    )
    expect(row.id).toBeGreaterThanOrEqual(9_000_001)
    expect(row).toMatchObject({
      status: 'draft',
      isActive: true,
      totalMarks: 6,
      visibility: 'public',
    })
    expect(structured.count('Q-STRUCT-ALL')).toBe(4_065)
    expect(structured.count('Q-STRUCT-VISIBLE')).toBe(4_059)
    expect(structured.toggleStatus(row.id, NOW_MS)?.status).toBe('published')
    expect(structured.count('Q-STRUCT-VISIBLE')).toBe(4_060)
    expect(structured.list({ viewer: { id: 5 } }).rows.map((r) => r.id)).toEqual([row.id])
    expect(
      structured.update(
        row.id,
        { subQuestions: [{ partLabel: 'a', questionText: 'x', marks: 8 }] },
        NOW_MS,
      )?.totalMarks,
    ).toBe(8)
    expect(structured.delete(row.id)).toBe(true)
    expect(structured.count('Q-STRUCT-ALL')).toBe(4_064)
  }, 60_000)

  it('admin bulk actions keep every count consistent', async () => {
    await runtime.reset()
    const ids = questions.adminList({ subjectId: 3, status: 'approved' }).rows.map((r) => r.id)
    const eligibleBefore = questions.count('Q-ELIGIBLE', 3)
    const activeIds = ids.filter((id) => questions.get(id)?.isActive)
    expect(questions.bulkAction('archive', ids, NOW_MS)).toBe(ids.length)
    expect(questions.count('Q-ELIGIBLE', 3)).toBe(eligibleBefore - activeIds.length)
    expect(questions.count('Q-APPROVED', 3)).toBe(16_645 - ids.length)
    expect(questions.count('Q-ALL', 3)).toBe(38_504)
    await runtime.reset()
    expect(questions.count('Q-APPROVED', 3)).toBe(16_645)
  }, 60_000)
})

describe('owner overrides and seed-phase contract', () => {
  it('contributeCells and anchorRow are seed-phase only', () => {
    expect(repoError(() => questions.contributeCells('M06', [])).code).toBe('PHASE')
    expect(
      repoError(() => questions.anchorRow({ id: 700_450, subjectId: 5, educationLevelId: 11 }))
        .code,
    ).toBe('PHASE')
  })

  it('questionStore.spmPool override moves pool rows only (M06 §6.11)', async () => {
    await runtime.reset({ questionStore: { spmPool: { MATH: { 11: { 4: 3 } } } } })
    expect(questions.count('Q-SPM-POOL', 3, 11, 4)).toBe(3)
    expect(questions.count('Q-SPM-POOL', 3)).toBe(1_681 - 24)
    expect(questions.count('Q-ELIGIBLE', 3)).toBe(13_872)
    expect(questions.count('Q-DIFFICULTY', 4)).toBe(9_600)
    await runtime.reset()
    expect(questions.count('Q-SPM-POOL', 3, 11, 4)).toBe(27)
  }, 60_000)

  it('importRuns: [] seeds the empty S5h state', async () => {
    await runtime.reset({ importRuns: [] })
    expect(importRuns.count('Q-IMPORT-RUNS')).toBe(0)
    await runtime.reset()
    expect(importRuns.count('Q-IMPORT-RUNS')).toBe(1_123)
  }, 60_000)

  it("questionStore.profile = 'states' adds the state anchors (test-only)", async () => {
    await runtime.reset({ questionStore: { profile: 'states' } })
    expect(questions.get(570001)).toMatchObject({
      status: 'draft',
      subjectId: 1,
      educationLevelId: 3,
    })
    expect(questions.get(570011)).toMatchObject({
      questionType: 'short_answer',
      correctAnswerText: 'photosynthesis',
    })
    expect(questions.count('Q-ALL')).toBe(465_285)
    await runtime.reset()
    expect(questions.get(570001)).toBeNull()
    expect(questions.count('Q-ALL')).toBe(465_278)
  }, 60_000)
})

/** A direct write to the reports table from outside the repository. */
function reportsTableInsert() {
  const table = plugin.tables.reports as unknown as { insert(row: unknown): unknown }
  return table.insert({ questionId: 1 })
}
