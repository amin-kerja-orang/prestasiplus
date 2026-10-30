import type { BijakBlueprintView, BijakEvidenceInput } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { formFromView, toInput } from '../admin/kontrak/domain/form'
import { KontrakError } from '../admin/kontrak/server/api'
import { MockKontrakServer } from '../admin/kontrak/server/mock'

const server = (): MockKontrakServer => new MockKontrakServer({ createPaper: async () => 'paper-1' })

/** Sains Kertas 2 (no standard in the seed) completed so that it can be verified. */
async function completeSn(s: MockKontrakServer): Promise<BijakBlueprintView> {
  const v = await s.get('SN', 2)
  const f = formFromView(v)
  const unit = { kind: 'unit' as const, ...(await s.listUnits('SN'))[0]! }
  for (const sec of f.sections) {
    sec.profileKind = 'bahagian'
    sec.groups = [{ from: 1, to: sec.questionCount, tpMin: 1, tpMax: 3, tpCounts: {}, marks: null }]
    sec.quotaLines = [{ unit, value: sec.questionCount, reviewed: true }]
    sec.kbatMarks = 0
  }
  return s.saveVersion('SN', 2, toInput(f))
}

const evidence = (body: string, over: Partial<BijakEvidenceInput['values']> = {}): BijakEvidenceInput => ({
  kind: 'trial_paper',
  body,
  year: 2025,
  paperCode: '4541/2',
  values: {
    durationMin: 60,
    totalMarks: 13,
    sections: [
      { position: 1, markBudget: 9, rule: { type: 'all' }, questionCount: 3 },
      { position: 2, markBudget: 4, rule: { type: 'choose', n: 1 }, questionCount: 2 },
    ],
    ...over,
  },
})

describe('Kontrak mock: version rules (AC-39.4)', () => {
  it('lists the seeded contracts and starts them as Spec version 1', async () => {
    const rows = await server().list()
    const mat2 = rows.find((r) => r.subject === 'MAT' && r.kertas === 2)!
    expect(mat2.source).toBe('Spec')
    expect(mat2.version).toBe(1)
    expect(mat2.servesStudents).toBe(false)
    expect(mat2.sections[0]!.quota!.lines.every((l) => l.reviewed === false)).toBe(true)
  })

  it('refuses a second contract for the same subject and kertas', async () => {
    const s = server()
    const v = await s.get('SN', 2)
    const { sections, code, durationMin } = toInput(formFromView(v))
    await expect(s.create({ subject: 'SN', kertas: 2, code, durationMin, sections })).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('refuses a total that does not match, listing the problem', async () => {
    const s = server()
    const body = { ...toInput(formFromView(await s.get('SN', 2))), totalMarks: 99 }
    const err = await s.saveVersion('SN', 2, body).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(KontrakError)
    expect((err as KontrakError).problems[0]).toMatchObject({ code: 'TOTAL_MISMATCH', expected: 99, actual: 13 })
  })

  it('keeps Disahkan on a cosmetic edit and makes a Spec version on a structural one', async () => {
    const s = server()
    await completeSn(s)
    await s.addEvidence('SN', 2, evidence('sbp'))
    await s.addEvidence('SN', 2, evidence('selangor_mpsm'))
    const verified = await s.verify('SN', 2, 'Disemak')
    expect(verified.source).toBe('Disahkan')
    expect(verified.servesStudents).toBe(true)

    const f = formFromView(verified)
    f.notes = 'nota baharu'
    f.sections[0]!.instruction = 'Arahan lain'
    const cosmetic = await s.saveVersion('SN', 2, toInput(f))
    expect(cosmetic.source).toBe('Disahkan')
    expect(cosmetic.version).toBe(verified.version + 1)

    const g = formFromView(cosmetic)
    g.durationMin = 90
    const structural = await s.saveVersion('SN', 2, toInput(g))
    expect(structural.source).toBe('Spec')
    expect(structural.servesStudents).toBe(false)
    const versions = await s.versions('SN', 2)
    expect(versions.find((v) => v.servesStudents)?.version).toBe(cosmetic.version)
    expect(versions[0]!.version).toBe(structural.version)
  })
})

describe('Kontrak mock: verification (AC-39.1, AC-39.2, AC-39.7)', () => {
  it('refuses to verify and lists every failure at once (422 details.check)', async () => {
    const s = server()
    const err = (await s.verify('MAT', 2, 'x').catch((e: unknown) => e)) as KontrakError
    expect(err.kind).toBe('verification')
    const codes = err.check!.completeness.map((c) => c.code)
    expect(codes).toEqual(expect.arrayContaining(['NO_PROFILE', 'NO_QUOTA', 'NO_KBAT', 'UNREVIEWED', 'NO_EVIDENCE_BODIES']))
    expect(err.check!.passes).toBe(false)
  })

  it('does not count seeded study evidence as a body (D-5)', async () => {
    const s = server()
    const ev = await s.evidence('MAT', 2)
    expect(ev[0]!.origin).toBe('study')
    const state = await s.verification('MAT', 2)
    expect(state.check.completeness.some((c) => c.code === 'NO_EVIDENCE_BODIES')).toBe(true)
  })

  it('marks a differing body as Berbeza and a lone body as Tidak disahkan', async () => {
    const s = server()
    await completeSn(s)
    await s.addEvidence('SN', 2, evidence('sbp'))
    await s.addEvidence('SN', 2, evidence('selangor_mpsm', { durationMin: 75 }))
    const { check } = await s.verification('SN', 2)
    const duration = check.lines.find((l) => l.field === 'durationMin')!
    expect(duration.status).toBe('differs')
    const total = check.lines.find((l) => l.field === 'totalMarks')!
    expect(total.status).toBe('ok')
    expect(total.supportingBodies).toBe(2)
    expect(check.passes).toBe(false)

    const t = server()
    await completeSn(t)
    await t.addEvidence('SN', 2, evidence('sbp'))
    const lone = (await t.verification('SN', 2)).check.lines.find((l) => l.field === 'totalMarks')!
    expect(lone.status).toBe('tidak_disahkan')
  })

  it('locks the evidence after Sahkan (409) and cannot verify twice', async () => {
    const s = server()
    await completeSn(s)
    await s.addEvidence('SN', 2, evidence('sbp'))
    await s.addEvidence('SN', 2, evidence('selangor_mpsm'))
    await s.verify('SN', 2, 'Disemak')
    await expect(s.addEvidence('SN', 2, evidence('mrsm'))).rejects.toMatchObject({ kind: 'conflict' })
    await expect(s.verify('SN', 2, 'lagi')).rejects.toMatchObject({ kind: 'conflict' })
    const state = await s.verification('SN', 2)
    expect(state.record?.note).toBe('Disemak')
    expect(state.record?.bodies.sort()).toEqual(['sbp', 'selangor_mpsm'])
  })
})

describe('Kontrak mock: final contract fields', () => {
  it('serves DSKP units, carries reference and shows the serving version of a Spec head', async () => {
    const s = server()
    const units = await s.listUnits('MAT')
    expect(units[0]).toMatchObject({ level: 'T4', elective: false })
    expect((await s.get('SN', 2)).reference).toEqual([])
    expect((await s.get('SN', 2)).dependentPaperCount).toBe(0)
    await completeSn(s)
    await s.addEvidence('SN', 2, evidence('sbp'))
    await s.addEvidence('SN', 2, evidence('selangor_mpsm'))
    const v = await s.verify('SN', 2, 'ok')
    expect(v.servingVersion).toBe(v.version)
    const f = formFromView(v)
    f.durationMin = 90
    const spec = await s.saveVersion('SN', 2, toInput(f))
    expect(spec.servingVersion).toBe(v.version)
    expect(spec.version).toBe(v.version + 1)
  })
})

describe('Kontrak mock: pool preview and draft', () => {
  it('previews the pool and generates a draft only when the verdict allows it', async () => {
    const s = server()
    await completeSn(s)
    const pool = await s.pool('SN', 2)
    expect(['boleh', 'tidak_boleh']).toContain(pool.verdict)
    expect(pool.sections).toHaveLength(2)
    expect(pool.publishedTotal).toBe(pool.eligibleTotal + pool.excluded.total)
    expect(pool.excluded.byReason.map((r) => r.reason)).toEqual(['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review'])
    expect(pool.excluded.byReason.find((r) => r.reason === 'no_tp')!.bankQuery.missing).toBe('tp')
    if (pool.verdict === 'boleh') {
      await expect(s.generateDraft('SN', 2)).resolves.toEqual({ paperId: 'paper-1' })
    } else {
      await expect(s.generateDraft('SN', 2)).rejects.toMatchObject({ kind: 'shortage' })
    }
  })
})
