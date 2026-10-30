import { validateBlueprint, type StandardBlueprint, type StandardSection } from '@pp/exam-core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { createExamLaunchBlueprintsSeed, createUnitResolver, examLaunchBlueprintsSeed } from '../../prisma/seed/exam-launch-blueprints'
import { LAYER1 } from '../../prisma/seed/bijak-standards/layer1'
import { loadLayer2 } from '../../prisma/seed/bijak-standards/layer2'
import { createTestDatabase, type TestDatabase } from '../support/db'

const CODES = ['1449/1', '1449/2', '3472/1', '3472/2', '4531/2', '1249/2']
/** Sections the analyst marked INCOMPLETE (no kbatMarks): seeded null, so they stay unverifiable. */
const INCOMPLETE: Record<string, number[]> = { '1449/1': [1], '1449/2': [3], '4531/2': [1], '1249/2': [2] }

interface QuotaLineJson {
  unit: { kind: 'unit'; nodeId: string } | { kind: 't1_t3' }
  value: number
  reviewed: boolean
}
interface SectionRow {
  position: number
  label: string
  rule_type: string
  rule_n: number | null
  question_count: number
  mark_budget: number
  allowed_modes: string[]
  profile: StandardSection['profile']
  quota: { basis: 'questions' | 'marks'; lines: QuotaLineJson[]; levelShare?: { t4: number; t5: number } } | null
  kbat_marks: number | null
  kbat_reviewed: boolean
}

describe('exam-launch-blueprints seed, layer 2 (BJS-13)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, examSeed, examDemoBlueprintsSeed, examLaunchBlueprintsSeed], { prisma: db.prisma })
  }, 180_000)
  afterAll(async () => {
    await db.drop()
  })

  const sectionsOf = (code: string) =>
    db.query<SectionRow>(
      `select s.position, s.label, s.rule_type, s.rule_n, s.question_count, s.mark_budget, s.allowed_modes, s.profile, s.quota, s.kbat_marks, s.kbat_reviewed
         from blueprint_sections s join blueprints b on b.id = s.blueprint_id
        where b.code = $1 and b.status = 'active' order by s.position`,
      [code],
    )

  it('every unit code in the six files resolves to a curriculum node (13.1a(a), SEJ "Tajuk" included)', async () => {
    const files = CODES.map((c) => loadLayer2(c))
    const subjects = [...new Set(files.flatMap((f) => f!.sections.flatMap((s) => (s.quota?.lines ?? []).flatMap((l) => (l.subject ? [l.subject] : [])))))]
    expect(subjects.sort()).toEqual(['ADDMATH', 'MATH', 'PHY', 'SEJ'])
    const resolve = await createUnitResolver(db.prisma, subjects)
    let units = 0
    for (const f of files)
      for (const s of f!.sections)
        for (const l of s.quota?.lines ?? [])
          if (l.unitCode) {
            const r = resolve(l.subject!, l.level!, l.unitCode)
            expect(r.level).toBe(l.level)
            units++
          }
    expect(units).toBeGreaterThan(60)
  })

  it('SEJ resolves by exact code first, then by the bare number; a miss fails loudly', async () => {
    const resolve = await createUnitResolver(db.prisma, ['SEJ', 'MATH'])
    expect(resolve('SEJ', 'T4', 'Tajuk 11').nodeId).toBe(resolve('SEJ', 'T4', '11').nodeId)
    expect(() => resolve('SEJ', 'T5', 'Tajuk 99')).toThrow(/does not resolve/)
    expect(() => resolve('MATH', 'T4', 'Tajuk 1')).toThrow(/does not resolve/) // the stripping is SEJ only
    expect(() => resolve('MATH', 'T4', '99.0')).toThrow(/does not resolve/)
  })

  it('fails the seed (and writes nothing) when a unit code does not resolve', async () => {
    const other = await createTestDatabase()
    try {
      await runSeeds([identitySeed, curriculumSeed, examSeed], { prisma: other.prisma })
      const broken = createExamLaunchBlueprintsSeed({
        layer2: (code) => {
          const f = loadLayer2(code)
          if (code !== '3472/2' || !f) return f
          const first = f.sections[0]!.quota!.lines[0]!
          first.unitCode = '99.0'
          return f
        },
      })
      await expect(runSeeds([broken], { prisma: other.prisma })).rejects.toThrow(/does not resolve/)
      expect(await other.query(`select 1 from blueprints where code = '3472/2'`)).toHaveLength(0)
    } finally {
      await other.drop()
    }
  }, 180_000)

  it('quota lines sum exactly to the offered marks (or slots) and every line is "Belum disemak"', async () => {
    for (const code of CODES)
      for (const s of await sectionsOf(code)) {
        expect(s.quota, `${code} ${s.label}`).not.toBeNull()
        const offered = s.rule_type === 'all' ? s.mark_budget : (s.mark_budget / (s.rule_n as number)) * s.question_count
        const target = s.quota!.basis === 'marks' ? offered : s.question_count
        expect(s.quota!.lines.reduce((n, l) => n + l.value, 0), `${code} ${s.label}`).toBe(target)
        expect(s.quota!.lines.every((l) => l.reviewed === false)).toBe(true)
      }
    const bases = await Promise.all(CODES.map(async (c) => [c, (await sectionsOf(c)).map((s) => s.quota!.basis)] as const))
    expect(Object.fromEntries(bases)).toEqual({
      '1449/1': ['questions'],
      '1449/2': ['marks', 'marks', 'marks'],
      '3472/1': ['marks', 'marks'],
      '3472/2': ['marks', 'marks', 'marks'],
      '4531/2': ['marks', 'marks', 'marks'],
      '1249/2': ['marks', 'marks'],
    })
  })

  it('KBAT marks come from the file with kbat_reviewed = false; INCOMPLETE sections stay null', async () => {
    for (const code of CODES) {
      const file = loadLayer2(code)!
      for (const s of await sectionsOf(code)) {
        const expected = file.sections.find((x) => x.position === s.position)?.kbatMarks ?? null
        expect(s.kbat_marks, `${code} ${s.label}`).toBe(expected)
        if (INCOMPLETE[code]?.includes(s.position)) {
          expect(s.kbat_marks).toBeNull()
          expect(s.kbat_reviewed).toBe(true) // nothing to review: the value is simply unknown
        } else {
          expect(s.kbat_marks).not.toBeNull()
          expect(s.kbat_reviewed).toBe(false)
        }
      }
    }
    const totals = await db.query<{ code: string; kbat_marks: number | null }>(`select code, kbat_marks from blueprints where provenance = 'paper' order by code`)
    expect(Object.fromEntries(totals.map((t) => [t.code, t.kbat_marks]))).toEqual({
      '1249/2': null,
      '1449/1': null,
      '1449/2': null,
      '3472/1': 87,
      '3472/2': 130,
      '4531/2': null,
    })
  })

  it('merges the marks bands onto the layer-1 slot groups and keeps the layer-1 bounds where they agree', async () => {
    const sections = await sectionsOf('1449/1')
    expect(sections[0]?.profile?.groups.map((g) => [g.from, g.to, g.marksMin, g.marksMax])).toEqual([[1, 10, 1, 1], [11, 20, 1, 1], [21, 30, 1, 1], [31, 40, 1, 1]])
    expect((await sectionsOf('3472/2')).map((s) => [s.profile?.groups[0]?.marksMin, s.profile?.groups[0]?.marksMax])).toEqual([[5, 9], [10, 10], [10, 10]])
    expect((await sectionsOf('4531/2'))[0]?.profile?.groups.map((g) => [g.marksMin, g.marksMax])).toEqual([[4, 4], [5, 5], [6, 6], [9, 9], [9, 9], [9, 9]])
    // Layer 1 stated marks for these; layer 2 must not contradict them.
    for (const l1 of LAYER1) {
      const rows = await sectionsOf(l1.code)
      l1.sections.forEach((s1, i) =>
        s1.groups.forEach((g1, j) => {
          const g = rows[i]?.profile?.groups[j]
          if (g1.marksMin !== undefined) expect([l1.code, i, j, g?.marksMin, g?.marksMax]).toEqual([l1.code, i, j, g1.marksMin, g1.marksMax])
        }),
      )
    }
  })

  it('3472/2 worked example: A is the seven SBP units, B and C are the four electives at 10 each', async () => {
    const resolveNodes = await db.query<{ id: string; code: string; level: string }>(
      `select n.id::text, n.code, l.code level from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id where s.code = 'ADDMATH' and n.kind = 'unit'`,
    )
    const label = (id: string) => {
      const n = resolveNodes.find((x) => x.id === id)!
      return `${n.level} ${n.code}`
    }
    const [a, b, c] = await sectionsOf('3472/2')
    const lines = (s: SectionRow | undefined) => s!.quota!.lines.map((l) => [l.unit.kind === 'unit' ? label(l.unit.nodeId) : 't1_t3', l.value])
    expect(lines(a)).toEqual([['T4 1.0', 7], ['T4 2.0', 8], ['T4 4.0', 8], ['T4 8.0', 6], ['T5 1.0', 6], ['T5 2.0', 7], ['T5 6.0', 8]])
    expect(lines(b)).toEqual([['T4 6.0', 10], ['T4 7.0', 10], ['T5 3.0', 10], ['T5 5.0', 10]])
    expect(lines(c)).toEqual([['T4 9.0', 10], ['T4 10.0', 10], ['T5 7.0', 10], ['T5 8.0', 10]])
    expect(a?.quota?.levelShare).toEqual({ t4: 29, t5: 21 })
    expect(a?.kbat_marks).toBe(50)
  })

  it('stores the alternatives and choices in the blueprint notes, and the structure_hash covers layer 2', async () => {
    const [bp] = await db.query<{ notes: string; structure_hash: string }>(`select notes, structure_hash from blueprints where code = '3472/2'`)
    expect(bp?.notes).toContain('Selangor')
    expect(bp?.notes).toContain('inferred')
    const layer1Only = createExamLaunchBlueprintsSeed({ layer2: () => null })
    const other = await createTestDatabase()
    try {
      await runSeeds([identitySeed, curriculumSeed, examSeed, layer1Only], { prisma: other.prisma })
      const [plain] = await other.query<{ structure_hash: string }>(`select structure_hash from blueprints where code = '3472/2'`)
      expect(plain?.structure_hash).not.toBe(bp?.structure_hash)
    } finally {
      await other.drop()
    }
  }, 180_000)

  it('each blueprint passes exam-core validateBlueprint with the unit levels (result listed per blueprint)', async () => {
    const nodes = await db.query<{ id: string; level: 'T4' | 'T5' }>(
      `select n.id::text, l.code level from curriculum_nodes n join education_levels l on l.id = n.education_level_id where n.kind = 'unit' and l.code in ('T4','T5')`,
    )
    const unitLevels = new Map(nodes.map((n) => [n.id, n.level]))
    const outcome: Record<string, unknown> = {}
    for (const l1 of LAYER1) {
      const [row] = await db.query<{ kbat_marks: number | null }>(`select kbat_marks from blueprints where code = $1 and status = 'active'`, [l1.code])
      const sections = await sectionsOf(l1.code)
      const bp: StandardBlueprint = {
        subject: l1.subject,
        kertas: l1.kertas,
        code: l1.code,
        version: 1,
        kbatMarks: row?.kbat_marks ?? null,
        sections: sections.map((s) => ({
          position: s.position,
          label: s.label,
          rule: s.rule_type === 'choose' ? { type: 'choose', n: s.rule_n as number } : { type: 'all' },
          questionCount: s.question_count,
          markBudget: s.mark_budget,
          allowedModes: s.allowed_modes,
          profile: s.profile,
          quota: s.quota,
          kbatMarks: s.kbat_marks,
        })),
      }
      const { problems, warnings } = validateBlueprint(bp, { unitLevels })
      outcome[l1.code] = { problems, warnings: warnings.length }
    }
    // Every blueprint is valid (no problem codes); warnings (KBAT_TP_BAND) are informational.
    for (const [code, o] of Object.entries(outcome)) expect((o as { problems: unknown[] }).problems, code).toEqual([])
  })

  it('is idempotent and the module never touches an existing paper row on a second run', async () => {
    const count = async () => (await db.query<{ n: string }>(`select (select count(*) from blueprints) + (select count(*) from blueprint_sections) + (select count(*) from blueprint_evidence) n`))[0]?.n
    const before = await count()
    await runSeeds([examLaunchBlueprintsSeed], { prisma: db.prisma })
    expect(await count()).toBe(before)
  })

  it('docs/reference/blueprints is the one source: the exam-core test fixtures are identical copies', () => {
    for (const code of CODES) {
      const name = `${code.replace('/', '-')}.json`
      const fixture = JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../packages/exam-core/__tests__/fixtures/blueprints/${name}`, import.meta.url)), 'utf8')) as unknown
      expect(fixture, name).toEqual(loadLayer2(code))
    }
  })
})
