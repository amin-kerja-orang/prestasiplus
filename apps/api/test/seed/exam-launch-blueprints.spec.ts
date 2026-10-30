import { canonicalStructure, validateBlueprint, type StandardBlueprint } from '@pp/exam-core'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { createExamLaunchBlueprintsSeed } from '../../prisma/seed/exam-launch-blueprints'
import { LAYER1 } from '../../prisma/seed/bijak-standards/layer1'
import { createTestDatabase, type TestDatabase } from '../support/db'

const CODES = ['1449/1', '1449/2', '3472/1', '3472/2', '4531/2', '1249/2']

interface SectionRow {
  position: number
  label: string
  rule_type: string
  rule_n: number | null
  question_count: number
  mark_budget: number
  allowed_modes: string[]
  profile: { kind: string; groups: { from: number; to: number; tpMin: number; tpMax: number; marksMin?: number; marksMax?: number }[] } | null
  quota: unknown
  kbat_marks: number | null
  kbat_reviewed: boolean
}

// Layer 1 only: no analyst file is read here (layer 2 is covered by exam-launch-blueprints-layer2.spec.ts).
const examLaunchBlueprintsSeed = createExamLaunchBlueprintsSeed({ layer2: () => null })

describe('exam-launch-blueprints seed, layer 1 and evidence (BJS-12)', () => {
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

  it('creates the six blueprints as active Spec rows that serve no student and carry no verification', async () => {
    const rows = await db.query<{ code: string; source: string; status: string; serves_students: boolean; verification_id: string | null; provenance: string; confidence: string; total_marks: number; duration_min: number }>(
      `select code, source, status, serves_students, verification_id::text, provenance, confidence, total_marks, duration_min from blueprints where provenance = 'paper' order by code`,
    )
    expect(rows.map((r) => r.code)).toEqual([...CODES].sort())
    for (const r of rows) {
      expect(r.source).toBe('spec')
      expect(r.status).toBe('active')
      expect(r.serves_students).toBe(false)
      expect(r.verification_id).toBeNull()
      expect(['high', 'medium']).toContain(r.confidence)
    }
    expect(Object.fromEntries(rows.map((r) => [r.code, [r.total_marks, r.duration_min]]))).toEqual({
      '1449/1': [40, 90],
      '1449/2': [100, 150],
      '3472/1': [80, 120],
      '3472/2': [100, 150],
      '4531/2': [100, 150],
      '1249/2': [100, 90],
    })
    expect(await db.query(`select 1 from blueprint_verifications`)).toHaveLength(0)
  })

  it('seeds sections, rules, counts and marks as observed', async () => {
    const shape = async (code: string) => (await sectionsOf(code)).map((s) => [s.label, s.rule_type, s.rule_n, s.question_count, s.mark_budget])
    expect(await shape('1449/1')).toEqual([['Bahagian A', 'all', null, 40, 40]])
    expect(await shape('1449/2')).toEqual([['Bahagian A', 'all', null, 10, 40], ['Bahagian B', 'all', null, 5, 45], ['Bahagian C', 'choose', 1, 2, 15]])
    expect(await shape('3472/1')).toEqual([['Bahagian A', 'all', null, 12, 64], ['Bahagian B', 'choose', 2, 3, 16]])
    expect(await shape('3472/2')).toEqual([['Bahagian A', 'all', null, 7, 50], ['Bahagian B', 'choose', 3, 4, 30], ['Bahagian C', 'choose', 2, 4, 20]])
    expect(await shape('4531/2')).toEqual([['Bahagian A', 'all', null, 8, 60], ['Bahagian B', 'choose', 1, 2, 20], ['Bahagian C', 'all', null, 1, 20]])
    expect(await shape('1249/2')).toEqual([['Bahagian A', 'all', null, 4, 40], ['Bahagian B', 'choose', 3, 5, 60]])
    expect((await sectionsOf('1449/1'))[0]?.allowed_modes).toEqual(['mcq'])
  })

  it('seeds the difficulty profiles (kind and slot groups) of SPP 5.1', async () => {
    const mat1 = (await sectionsOf('1449/1'))[0]?.profile
    expect(mat1?.kind).toBe('ladder')
    expect(mat1?.groups.map((g) => [g.from, g.to, g.tpMin, g.tpMax])).toEqual([[1, 10, 2, 4], [11, 20, 2, 4], [21, 30, 3, 5], [31, 40, 3, 5]])
    const fizik = await sectionsOf('4531/2')
    expect(fizik.map((s) => s.profile?.kind)).toEqual(['ladder', 'bahagian', 'bahagian'])
    expect(fizik[0]?.profile?.groups.map((g) => [g.from, g.to, g.tpMin, g.tpMax, g.marksMin])).toEqual([[1, 1, 2, 3, 4], [2, 2, 2, 3, 5], [3, 3, 2, 3, 6], [4, 4, 2, 3, 9], [5, 6, 3, 4, 9], [7, 8, 4, 4, 9]])
    const add2 = await sectionsOf('3472/2')
    expect(add2.map((s) => [s.profile?.groups[0]?.tpMin, s.profile?.groups[0]?.tpMax])).toEqual([[3, 5], [4, 5], [4, 6]])
    expect((await db.query<{ sub_part_ramp: boolean }>(`select sub_part_ramp from blueprints where code = '1249/2' and status = 'active'`))[0]?.sub_part_ramp).toBe(true)
  })

  it('layer-1-only sections have no quota and no KBAT value (valid Spec, not verifiable)', async () => {
    // Layer 2 is merged by BJS-13; this suite runs the module without it.
    for (const code of CODES)
      for (const s of await sectionsOf(code)) {
        expect(s.quota).toBeNull()
        expect(s.kbat_marks).toBeNull()
      }
  })

  it('stores a structure_hash that is the sha-256 of the exam-core canonical structure', async () => {
    for (const code of CODES) {
      const [bp] = await db.query<{ id: string; structure_hash: string; subject: string; kertas: number; duration_min: number; sub_part_ramp: boolean }>(
        `select b.id::text, b.structure_hash, s.code subject, b.kertas, b.duration_min, b.sub_part_ramp from blueprints b join subjects s on s.id = b.subject_id where b.code = $1 and b.status = 'active'`,
        [code],
      )
      expect(bp?.structure_hash).toMatch(/^[0-9a-f]{64}$/)
      const sections = await sectionsOf(code)
      const standard: StandardBlueprint = {
        subject: bp!.subject,
        kertas: bp!.kertas,
        code,
        version: 1,
        durationMin: bp!.duration_min,
        subPartRamp: bp!.sub_part_ramp,
        sections: sections.map((s) => ({
          position: s.position,
          label: s.label,
          rule: s.rule_type === 'choose' ? { type: 'choose', n: s.rule_n as number } : { type: 'all' },
          questionCount: s.question_count,
          markBudget: s.mark_budget,
          compulsory: false,
          pool: null,
          allowedModes: s.allowed_modes,
          profile: s.profile as never,
          quota: null,
          kbatMarks: null,
        })),
      }
      expect(bp?.structure_hash).toBe(createHash('sha256').update(canonicalStructure(standard), 'utf8').digest('hex'))
    }
    const hashes = await db.query<{ structure_hash: string }>(`select structure_hash from blueprints`)
    expect(hashes.every((h) => /^[0-9a-f]{64}$/.test(h.structure_hash))).toBe(true)
  })

  it('adds a new version over the PoC and demo blueprints and retires the old active row', async () => {
    for (const code of ['1449/1', '1449/2', '1249/2']) {
      const rows = await db.query<{ version: number; status: string; provenance: string | null }>(
        `select version, status, provenance from blueprints where code = $1 order by version`,
        [code],
      )
      expect(rows).toEqual([
        { version: 1, status: 'retired', provenance: null },
        { version: 2, status: 'active', provenance: 'paper' },
      ])
    }
    for (const code of ['3472/1', '3472/2', '4531/2']) {
      expect(await db.query(`select 1 from blueprints where code = $1 and version = 1 and status = 'active'`, [code])).toHaveLength(1)
    }
    // At most one active row per subject and kertas (partial unique index) and the PoC papers keep their blueprint.
    const papers = await db.query<{ version: number }>(
      `select b.version from papers p join blueprints b on b.id = p.blueprint_id where b.code in ('1449/1', '1449/2')`,
    )
    expect(papers.every((p) => p.version === 1)).toBe(true)
  })

  it('seeds study evidence rows: origin study, snake_case bodies, no file and no verification', async () => {
    const rows = await db.query<{ code: string; kind: string; body: string; year: number; paper_code: string; source_ref: string; origin: string; created_by_id: string | null }>(
      `select b.code, e.kind, e.body, e.year, e.paper_code, e.source_ref, e.origin, e.created_by_id::text
         from blueprint_evidence e join blueprints b on b.id = e.blueprint_id order by b.code, e.kind, e.body`,
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.origin).toBe('study')
      expect(r.body).toMatch(/^[a-z0-9_]{1,64}$/)
      expect(['sbp', 'selangor_mpsm']).toContain(r.body)
      expect(r.year).toBe(2025)
      expect(r.paper_code).toBe(r.code)
      expect(r.source_ref).toBe('Kajian kertas percubaan 2025')
      expect(r.created_by_id).toBeNull()
    }
    const bodies = (code: string, kind: string) => rows.filter((r) => r.code === code && r.kind === kind).map((r) => r.body)
    expect(bodies('1449/2', 'trial_paper')).toEqual(['sbp', 'selangor_mpsm'])
    expect(bodies('3472/2', 'skema')).toEqual(['sbp', 'selangor_mpsm'])
    expect(bodies('3472/1', 'trial_paper')).toEqual(['sbp'])
    expect(bodies('4531/2', 'trial_paper')).toEqual(['sbp'])
    expect(bodies('1249/2', 'trial_paper')).toEqual(['selangor_mpsm'])
    expect(bodies('1249/2', 'skema')).toEqual([])
  })

  it('evidence agrees with the blueprint where the study read it (and Fizik C states no rule)', async () => {
    const values = await db.query<{ values: { durationMin?: number; totalMarks?: number; sections?: { position: number; rule?: unknown; markBudget?: number }[] } }>(
      `select e.values from blueprint_evidence e join blueprints b on b.id = e.blueprint_id where b.code = '4531/2' and e.kind = 'trial_paper'`,
    )
    expect(values[0]?.values.durationMin).toBe(150)
    expect(values[0]?.values.sections?.find((s) => s.position === 3)?.rule).toBeUndefined()
  })

  it('each blueprint passes exam-core validateBlueprint (layer 1 only)', async () => {
    for (const l1 of LAYER1) {
      const sections = await sectionsOf(l1.code)
      const result = validateBlueprint({
        subject: l1.subject,
        kertas: l1.kertas,
        code: l1.code,
        version: 1,
        sections: sections.map((s) => ({
          position: s.position,
          label: s.label,
          rule: s.rule_type === 'choose' ? { type: 'choose', n: s.rule_n as number } : { type: 'all' },
          questionCount: s.question_count,
          markBudget: s.mark_budget,
          allowedModes: s.allowed_modes,
          profile: s.profile as never,
          quota: null,
          kbatMarks: null,
        })),
      })
      expect(result.problems, l1.code).toEqual([])
    }
  })

  it('is idempotent: a second run adds nothing', async () => {
    const before = await db.query<{ n: string }>(`select (select count(*) from blueprints) + (select count(*) from blueprint_sections) + (select count(*) from blueprint_evidence) n`)
    await runSeeds([examLaunchBlueprintsSeed], { prisma: db.prisma })
    const after = await db.query<{ n: string }>(`select (select count(*) from blueprints) + (select count(*) from blueprint_sections) + (select count(*) from blueprint_evidence) n`)
    expect(after[0]?.n).toBe(before[0]?.n)
  })
})
