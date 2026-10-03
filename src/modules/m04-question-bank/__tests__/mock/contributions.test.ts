/**
 * F-25 contribution contract (SRS §6.13.2; overview §6.6, §6.7.1): the documented contributors
 * (M05, M06, M07, M08, M10, M11) contribute their anchors and cells through `questions.*` in their
 * seed phase, and every named count stays the documented one ("fixtures are anchors, not
 * additions"). The contributors here are test plugins that mirror the owner SRSs.
 */

import { describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { checkNamedQueries } from '@/mock/dataset'
import { defineMockCore, defineMockModule, type SeedContext } from '@/mock/define'
import { bootMock } from '@/mock/index'
import { RepositoryError } from '@/mock/repository'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'

import m04, { questions, type Question } from '../../mock'
import { PKSK_DOMAINS, SPM_POOL } from '../../mock/data/tables'
import { M05_ANCHOR_GROUPS } from '../../mock/datasets/questions-spec'
import { questionQueries } from '../../mock/repository/queries'

const NOW = '2026-09-25T15:40:00+08:00'

function boot(modules: readonly ReturnType<typeof defineMockModule>[]) {
  return bootMock({
    mode: 'test',
    core: defineMockCore({}),
    plugins: [m01, m02, m03, m04, ...modules],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}

const text = (id: number) => `Soalan anchor ${String(id)}: pilih jawapan yang betul.`

function m05Rows(): Question[] {
  const out: Question[] = []
  for (const g of M05_ANCHOR_GROUPS) {
    for (let id = g.ids[0]; id <= g.ids[1]; id++) {
      out.push(
        questions.anchorRow({
          id,
          subjectId: g.subjectId,
          educationLevelId: g.levelId,
          curriculumChapterId: g.chapterId,
          spmPool: false,
          complianceStatus: 'verified',
          sourceType: 'textbook',
          dskpSpId: null,
          questionText: text(id),
          sourceSet: 'm05_practice_anchor',
          createdAt: '2025-12-01T09:00:00+08:00',
        }),
      )
    }
  }
  return out
}

function m07Rows(): Question[] {
  // The observed anchors first (domain, level, difficulty; M07 §6.8), then the seed-assigned rest.
  const fixed: Record<number, [number, 'T1' | 'T4', number | undefined]> = {
    178460: [7, 'T4', 3],
    178359: [1, 'T1', 2],
    178174: [14, 'T4', 2],
    177919: [4, 'T1', 2],
    178175: [14, 'T4', 3],
  }
  const room = new Map<string, number>()
  for (const [id, [, t1, t4]] of Object.entries(PKSK_DOMAINS)) {
    room.set(`${id}:T1`, t1)
    room.set(`${id}:T4`, t4)
  }
  for (const [d, l] of Object.values(fixed))
    room.set(`${String(d)}:${l}`, (room.get(`${String(d)}:${l}`) ?? 0) - 1)
  const slots = [...room.entries()].flatMap(([k, n]) => Array.from({ length: n }, () => k))
  const out: Question[] = []
  // Rows with fixed facets are completed first, so the seed-assigned rows cannot take their room.
  for (const [id, [domain, level, difficulty]] of Object.entries(fixed)) {
    out.push(
      questions.anchorRow({
        id: Number(id),
        pkskDomainId: domain,
        pkskTargetLevel: level,
        ...(difficulty !== undefined ? { difficultyLevel: difficulty } : {}),
        questionText: `Soalan PKSK ${id}`,
      }),
    )
  }
  let i = 0
  for (let id = 177698; id <= 178460; id++) {
    if (fixed[id]) continue
    const [domain, level] = (slots[i++] as string).split(':') as [string, 'T1' | 'T4']
    out.push(
      questions.anchorRow({
        id,
        pkskDomainId: Number(domain),
        pkskTargetLevel: level,
        questionText: `Soalan PKSK ${String(id)}`,
      }),
    )
  }
  return out
}

function m08Rows(): Question[] {
  const sp = (id: number): number => (id >= 700101 ? 9001 : 9001 + Math.floor((id - 700001) / 2))
  const kimia = [...range(700001, 700008), ...range(700101, 700128)].map((id) =>
    questions.anchorRow({
      id,
      subjectId: 10,
      educationLevelId: 11,
      spmPool: false,
      dskpSpId: sp(id),
      questionText: text(id),
      sourceSet: 'm08_fixture',
    }),
  )
  const sejarah = range(700201, 700215).map((id) =>
    questions.anchorRow({
      id,
      subjectId: 5,
      educationLevelId: 10,
      spmPool: true,
      dskpSpId: null,
      questionText: text(id),
      sourceSet: 'm08_fixture',
    }),
  )
  return [...kimia, ...sejarah]
}

function m10Rows(): Question[] {
  const bank = (
    ids: number[],
    levelId: number,
    difficulty: number,
    extra: Partial<Question> = {},
  ) =>
    ids.map((id) =>
      questions.anchorRow({
        id,
        subjectId: 1,
        educationLevelId: levelId,
        difficultyLevel: difficulty,
        spmPool: false,
        teacherDatabank: true,
        questionText: text(id),
        sourceSet: 'textbook_content_rebuild',
        ...extra,
      }),
    )
  return [
    // 522425–522447 and 700302 are registered by the M04 seed itself (seeds/m10-anchors.ts).
    ...bank(range(525431, 525433), 7, 1),
    ...bank(range(525428, 525430), 9, 3),
  ]
}

const M11_CELLS: [number, number, boolean, number][] = [
  [1, 11, true, 65],
  [1, 10, true, 1],
  [5, 11, true, 83],
  [5, 10, true, 12],
  [2, 11, true, 55],
  [11, 11, true, 75],
  [11, 10, true, 15],
  [6, 11, true, 70],
  [9, 11, true, 15],
  [3, 11, true, 15],
  [4, 11, true, 10],
  [4, 10, true, 9],
  [5, 9, false, 75],
  [4, 9, false, 2],
  [4, 8, false, 3],
  [4, 7, false, 26],
]

function m11Rows(): Question[] {
  const out: Question[] = []
  let id = 700401
  for (const [s, l, pool, n] of M11_CELLS) {
    for (let k = 0; k < n; k++, id++) {
      out.push(
        questions.anchorRow({
          id,
          subjectId: s,
          educationLevelId: l,
          spmPool: pool,
          questionText: text(id),
          chapterLabel: s === 5 ? 'Sejarah Tingkatan 5 KSSM' : 'Umum KSSM',
          curriculumTopicId: null,
        }),
      )
    }
  }
  return out
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

const contributor = (id: `M${number}`, seed: (ctx: SeedContext) => void) =>
  defineMockModule({ id, dependsOn: ['M04'], seed })

describe('documented contributors (SRS §6.13.2)', () => {
  it('M05, M06, M07, M08, M10 and M11 contribute without changing any documented count', async () => {
    const poolCells = Object.entries(SPM_POOL).flatMap(([s, [t4, t5]]) =>
      [
        [10, t4],
        [11, t5],
      ].flatMap(([l, byD]) =>
        (byD as readonly number[]).map((count, i) => ({
          facets: {
            subjectId: Number(s),
            educationLevelId: l as number,
            difficultyLevel: i + 1,
            spmPool: true,
          },
          count,
        })),
      ),
    )
    await boot([
      contributor('M05', (ctx) => questions.contributeAnchors(ctx, m05Rows())),
      contributor('M06', (ctx) => questions.contributeCells(ctx, poolCells)),
      contributor('M07', (ctx) => questions.contributeAnchors(ctx, m07Rows())),
      contributor('M08', (ctx) => questions.contributeAnchors(ctx, m08Rows())),
      contributor('M10', (ctx) => questions.contributeAnchors(ctx, m10Rows())),
      contributor('M11', (ctx) => questions.contributeAnchors(ctx, m11Rows())),
      contributor('M18', (ctx) =>
        questions.contributeAnchors(ctx, [
          questions.anchorRow({
            id: 701001,
            subjectId: 3,
            educationLevelId: 11,
            spmPool: true,
            questionText: text(701001),
          }),
          questions.anchorRow({
            id: 701002,
            subjectId: 5,
            educationLevelId: 9,
            questionText: text(701002),
          }),
        ]),
      ),
    ])
    expect(checkNamedQueries(questionQueries)).toEqual([])
    // Anchors sit at their ids.
    for (const id of [
      600001, 600065, 177698, 178460, 700001, 700128, 700215, 522425, 525433, 700302, 700931,
    ]) {
      expect(questions.get(id)?.id, String(id)).toBe(id)
    }
    expect(questions.get(600001)).toMatchObject({
      curriculumChapterId: 35,
      difficultyLevel: 1,
      dskpTagged: false,
    })
    expect(questions.get(600004)?.difficultyLevel).toBe(4)
    expect(questions.get(178460)).toMatchObject({
      pkskDomainId: 7,
      pkskTargetLevel: 'T4',
      difficultyLevel: 3,
    })
    expect(questions.get(700302)).toMatchObject({
      createdBy: 5,
      educationLevelId: 11,
      spmPool: false,
    })
    expect(questions.get(700931)?.chapterLabel).toBe('Umum KSSM')
    // PKSK rows are exactly the M07 block.
    expect(
      questions.countWhere({ pkskDomainId: { ne: null }, id: { gte: 177698, lte: 178460 } }),
    ).toBe(763)
    // The user-1 block: no row below 522425; S21 page 2 starts at 522445.
    expect(questions.countWhere({ createdBy: 1, id: { lte: 522424 } })).toBe(0)
    const p1 = questions.contributions(1, { page: 1 })
    const p2 = questions.contributions(1, { page: 2 })
    expect(p1.rows.map((r) => r.id)).toEqual(range(522425, 522444))
    expect(p2.rows[0]?.id).toBe(522445) // E2E-M04-67
    expect(p2.rows.slice(0, 3).map((r) => r.id)).toEqual([522445, 522446, 522447])
    expect(p1.total).toBe(16_817)
    // M08 SP availability and M11 label counts.
    expect(questions.spAvailable(9001)).toBe(30)
    expect(
      questions.countWhere({
        chapterLabel: 'Sejarah Tingkatan 5 KSSM',
        status: 'approved',
        isActive: true,
      }),
    ).toBe(170)
  }, 60_000)

  it('valid cells move every dependent count together; invalid cells are rejected', async () => {
    const errors: unknown[] = []
    await boot([
      contributor('M06', (ctx) => {
        questions.contributeCells(ctx, [
          {
            facets: { subjectId: 3, educationLevelId: 11, difficultyLevel: 4, spmPool: true },
            count: 3,
          },
          {
            facets: { subjectId: 7, educationLevelId: 10, difficultyLevel: 3, spmPool: true },
            count: 234,
          },
        ])
        for (const bad of [
          [
            {
              facets: { subjectId: 3, educationLevelId: 5, difficultyLevel: 2, spmPool: true },
              count: 1,
            },
          ],
          [
            {
              facets: { subjectId: 19, educationLevelId: 11, difficultyLevel: 2, spmPool: true },
              count: 1,
            },
          ],
          [
            {
              facets: {
                subjectId: 3,
                educationLevelId: 11,
                difficultyLevel: 2,
                spmPool: true,
                status: 'x',
              },
              count: 1,
            },
          ],
          [
            {
              facets: { subjectId: 4, educationLevelId: 10, difficultyLevel: 4, spmPool: true },
              count: 200,
            },
          ],
          [{ facets: { pkskDomainId: 2, pkskTargetLevel: 'T1', difficultyLevel: 2 }, count: 27 }],
        ]) {
          try {
            questions.contributeCells(ctx, bad as never)
          } catch (err) {
            errors.push(err)
          }
        }
      }),
    ])
    expect(errors).toHaveLength(5)
    for (const e of errors) expect((e as RepositoryError).code).toBe('CONTRACT')
    expect(questions.count('Q-SPM-POOL', 3, 11, 4)).toBe(3)
    expect(questions.count('Q-SPM-POOL', 7, 10, 3)).toBe(234)
    expect(questions.count('Q-SPM-POOL', 3)).toBe(1_681 - 24)
    expect(questions.count('Q-SPM-POOL', 7)).toBe(1_353 + 10)
    expect(questions.count('Q-ELIGIBLE', 7)).toBe(15_014)
    expect(questions.count('Q-SPM-POOL')).toBe(21_033 - 24 + 10)
    expect(questions.count('Q-ELIGIBLE', 3)).toBe(13_872)
    expect(questions.count('Q-ACTIVE')).toBe(129_389)
    expect([1, 2, 3, 4].map((d) => questions.count('Q-DIFFICULTY', d))).toEqual([
      39_694, 47_138, 33_720, 9_600,
    ])
  }, 60_000)

  it('an over-quota anchor fails (anchorRow and contributeAnchors)', async () => {
    const errors: RepositoryError[] = []
    await boot([
      contributor('M08', (ctx) => {
        const rows = m08Rows()
        try {
          questions.anchorRow({
            id: 700216,
            subjectId: 5,
            educationLevelId: 10,
            spmPool: true,
            difficultyLevel: 2,
            dskpSpId: null,
          })
        } catch (err) {
          errors.push(err as RepositoryError)
        }
        // A complete row copied into an already full cell.
        const extra = { ...(rows[rows.length - 1] as Question), id: 700216 }
        try {
          questions.contributeAnchors(ctx, [...rows, extra])
        } catch (err) {
          errors.push(err as RepositoryError)
        }
        questions.contributeAnchors(ctx, rows)
      }),
    ])
    expect(errors.map((e) => e.code)).toEqual(['CONTRACT', 'CONTRACT'])
    expect(errors[1]?.issues.join()).toMatch(/over-subscribed/)
    expect(questions.count('Q-ALL')).toBe(465_278)
  }, 60_000)

  it('anchors outside the contributor id block, or not approved and active, are rejected', async () => {
    const errors: RepositoryError[] = []
    await boot([
      contributor('M05', (ctx) => {
        const row = questions.anchorRow({ id: 600001, subjectId: 1, educationLevelId: 1 })
        for (const bad of [
          { ...row, id: 700001 },
          { ...row, status: 'draft' as const },
        ]) {
          try {
            questions.contributeAnchors(ctx, [bad])
          } catch (err) {
            errors.push(err as RepositoryError)
          }
        }
      }),
    ])
    expect(errors.map((e) => e.code)).toEqual(['CONTRACT', 'CONTRACT'])
  }, 60_000)
})
