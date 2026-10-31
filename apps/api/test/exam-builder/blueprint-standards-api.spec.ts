import {
  BIJAK_STANDARDS_MESSAGES as STD,
  BijakBlueprintInvalidErrorSchema,
  BijakBlueprintVersionItemSchema,
  BijakBlueprintViewSchema,
  BijakDskpUnitSchema,
  BijakEvidenceItemSchema,
  BijakVerificationFailedErrorSchema,
  BijakVerificationStateSchema,
  BijakSubjectSchema,
  envelopeOf,
} from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, auditRows, bootBuilderApp, count, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

let t: BuilderTestApp
let admin: Client
/** DSKP units of Matematik, as the picker route returns them. */
let t4: { nodeId: string }[] = []
let t5: { nodeId: string }[] = []

beforeAll(async () => {
  t = await bootBuilderApp()
  admin = await loginAs(t, ACCOUNTS.admin)
  const res = await admin.get('/api/admin/bijak/dskp/units?subject=MAT')
  const units = z.array(BijakDskpUnitSchema).parse(res.body.data)
  t4 = units.filter((u) => u.level === 'T4')
  t5 = units.filter((u) => u.level === 'T5')
})
afterAll(async () => {
  await t.close()
})

const rows = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
const url = (kertas: number, tail = '') => `/api/admin/blueprints/MAT/${String(kertas)}${tail}`

/** One section of four one-mark questions, with a profile, a questions-basis quota over a T4 and a T5 unit, and KBAT marks. */
const fullSection = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  markBudget: 4,
  questionCount: 4,
  rule: { type: 'all' },
  profile: { kind: 'bahagian', groups: [{ from: 1, to: 4, tpMin: 1, tpMax: 4 }] },
  quota: {
    basis: 'questions',
    lines: [
      { unit: { kind: 'unit', nodeId: t4[0]?.nodeId }, value: 2 },
      { unit: { kind: 'unit', nodeId: t5[0]?.nodeId }, value: 2 },
    ],
  },
  kbatMarks: 1,
  ...over,
})
const body = (over: Record<string, unknown> = {}) => ({
  source: 'Spec',
  code: 'MAT/STD',
  durationMin: 60,
  instructions: ['Jawab semua.'],
  sections: [fullSection()],
  ...over,
})
const create = (kertas: number, over: Record<string, unknown> = {}) => ({ subject: 'MAT', kertas, ...body({ code: `MAT/S${String(kertas)}`, ...over }) })

/** An LPM format document states every compared value, so it alone satisfies AC-39.2 and AC-39.7. */
const lpmEvidence = (over: Record<string, unknown> = {}) => ({
  kind: 'lpm_format',
  body: 'lpm',
  year: 2025,
  paperCode: '1449/1',
  values: { durationMin: 60, totalMarks: 4, sections: [{ position: 1, markBudget: 4, rule: { type: 'all' }, questionCount: 4 }] },
  ...over,
})

const bpRow = async (code: string) =>
  (
    await rows(
      `select id::text, version, status, source, serves_students, structure_hash, verification_id::text, notes, reference_sheets, kbat_marks
         from blueprints where code = $1 order by version`,
      [code],
    )
  )[0]

const bpRowAuto = async (code: string) => (await rows(`select auto_markable from blueprints where code = $1 order by version desc`, [code]))[0]

/** Creates, adds LPM evidence and verifies a blueprint on MAT kertas `k`. Returns the verified view. */
async function verified(k: number, over: Record<string, unknown> = {}) {
  expect((await admin.post('/api/admin/blueprints', create(k, over))).status).toBe(201)
  expect((await admin.post(url(k, '/evidence'), lpmEvidence())).status).toBe(201)
  const res = await admin.post(url(k, '/verify'), { note: 'Disemak.' })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakBlueprintViewSchema.parse(res.body.data)
}

describe('fixtures', () => {
  it('the DSKP of Matematik has T4 and T5 units', () => {
    expect(t4.length).toBeGreaterThan(0)
    expect(t5.length).toBeGreaterThan(0)
  })
})

// R1-21.4 / PIPE AC-06.2 (T44): the Kontrak field "Boleh tanda auto" (blueprints.auto_markable, nullable).
describe('T44 Boleh tanda auto (autoMarkable)', () => {
  it('is stored and returned; absent means null (not stated); a non-boolean is 422', async () => {
    const on = await admin.post('/api/admin/blueprints', create(60, { autoMarkable: true }))
    expect(on.status, JSON.stringify(on.body)).toBe(201)
    expect(BijakBlueprintViewSchema.parse(on.body.data).autoMarkable).toBe(true)
    expect((await bpRowAuto('MAT/S60'))?.auto_markable).toBe(true)
    const off = await admin.post('/api/admin/blueprints', create(61, { autoMarkable: false }))
    expect(BijakBlueprintViewSchema.parse(off.body.data).autoMarkable).toBe(false)
    expect((await bpRowAuto('MAT/S61'))?.auto_markable).toBe(false)
    const none = await admin.post('/api/admin/blueprints', create(62))
    expect(BijakBlueprintViewSchema.parse(none.body.data).autoMarkable).toBeNull()
    expect((await bpRowAuto('MAT/S62'))?.auto_markable).toBeNull()
    expectError(await admin.post('/api/admin/blueprints', create(63, { autoMarkable: 'ya' })), 'VALIDATION_ERROR')
    // GET returns it too
    expect((await admin.get(url(60))).body.data.autoMarkable).toBe(true)
  })

  it('a new version replaces it (omitted = null); null is accepted', async () => {
    expect((await admin.post('/api/admin/blueprints', create(64, { autoMarkable: true }))).status).toBe(201)
    const v2 = await admin.post(url(64, '/versions'), body({ code: 'MAT/S64B', autoMarkable: false }))
    expect(v2.status, JSON.stringify(v2.body)).toBe(201)
    expect(BijakBlueprintViewSchema.parse(v2.body.data)).toMatchObject({ version: 2, autoMarkable: false })
    const v3 = await admin.post(url(64, '/versions'), body({ code: 'MAT/S64C', autoMarkable: null }))
    expect(BijakBlueprintViewSchema.parse(v3.body.data)).toMatchObject({ version: 3, autoMarkable: null })
    const v4 = await admin.post(url(64, '/versions'), body({ code: 'MAT/S64D' }))
    expect(BijakBlueprintViewSchema.parse(v4.body.data)).toMatchObject({ version: 4, autoMarkable: null })
  })

  it('is cosmetic: changing it on a Disahkan blueprint keeps Disahkan and the same structure hash', async () => {
    const v1 = await verified(65)
    expect(v1.autoMarkable).toBeNull()
    const before = await bpRow('MAT/S65')
    const res = await admin.post(url(65, '/versions'), body({ code: 'MAT/S65', autoMarkable: true }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(BijakBlueprintViewSchema.parse(res.body.data)).toMatchObject({ version: 2, source: 'Disahkan', servesStudents: true, autoMarkable: true })
    const all = await rows(`select version, source, structure_hash, auto_markable from blueprints where code = 'MAT/S65' order by version`)
    expect(all[1]).toMatchObject({ version: 2, source: 'verified', auto_markable: true })
    expect(all[1]?.structure_hash).toBe(before?.structure_hash)
  })
})

describe('BJS-08 create and the standard fields', () => {
  it('stores profile, quota, KBAT and notes; the server sets reviewed and the canonical hash', async () => {
    const res = await admin.post('/api/admin/blueprints', create(11, { notes: 'Catatan', subPartRamp: true, kbatMarks: 1, levelShare: { t4: 2, t5: 2 } }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const view = BijakBlueprintViewSchema.parse(res.body.data)
    expect(view).toMatchObject({
      version: 1,
      source: 'Spec',
      servesStudents: false,
      verification: null,
      evidenceCount: 0,
      notes: 'Catatan',
      subPartRamp: true,
      kbatMarks: 1,
      levelShare: { t4: 2, t5: 2 },
      needsReview: false,
      reviewPapers: [],
      reference: [],
      dependentPaperCount: 0,
    })
    expect(view.servingVersion).toBeUndefined()
    const s = view.sections[0]!
    expect(s).toMatchObject({ position: 1, kbatMarks: 1, kbatReviewed: true, allowedModes: [] })
    expect(s.profile?.kind).toBe('bahagian')
    expect(s.quota?.lines.map((l) => l.reviewed)).toEqual([true, true])
    expect(s.quota?.lines[0]?.unit).toMatchObject({ kind: 'unit', level: 'T4' })
    expect(s.quota?.lines[0]?.unit).toHaveProperty('code')

    const row = await bpRow('MAT/S11')
    expect(row).toMatchObject({ version: 1, status: 'active', source: 'spec', serves_students: false, verification_id: null })
    expect(row?.structure_hash).toMatch(/^[0-9a-f]{64}$/)
    const stored = await rows(`select quota, kbat_reviewed from blueprint_sections where blueprint_id = $1`, [row?.id])
    expect(JSON.stringify(stored[0]?.quota)).not.toContain('reviewed')
    expect(stored[0]?.kbat_reviewed).toBe(true)
  })

  /** A blueprint on MAT kertas k whose quota lines and KBAT value are all "Belum disemak" (as the layer-2 seed leaves them). */
  async function seededUnreviewed(k: number) {
    expect((await admin.post('/api/admin/blueprints', create(k))).status).toBe(201)
    const row = await bpRow(`MAT/S${String(k)}`)
    await rows(
      `update blueprint_sections set kbat_reviewed = false,
              quota = jsonb_set(jsonb_set(quota, '{lines,0,reviewed}', 'false'), '{lines,1,reviewed}', 'false') where blueprint_id = $1`,
      [row?.id],
    )
    const before = BijakBlueprintViewSchema.parse((await admin.get(url(k))).body.data)
    expect(before.sections[0]).toMatchObject({ kbatReviewed: false })
    expect(before.sections[0]?.quota?.lines.map((l) => l.reviewed)).toEqual([false, false])
    return row
  }

  it('a cosmetic save keeps the unreviewed flags false (AC-39.9)', async () => {
    await seededUnreviewed(12)
    const res = await admin.post(url(12, '/versions'), body({ code: 'MAT/S12B', notes: 'nota', sections: [fullSection({ label: 'Lain' })] }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const after = BijakBlueprintViewSchema.parse(res.body.data)
    expect(after.sections[0]).toMatchObject({ kbatReviewed: false })
    expect(after.sections[0]?.quota?.lines.map((l) => l.reviewed)).toEqual([false, false])
  })

  it('changing a value sets it reviewed; unchanged values keep their flag', async () => {
    await seededUnreviewed(18)
    // line 0: 2 -> 1 and line 1 unchanged would break the sum, so move one question between the two units; kbat 1 -> 2
    const quota = {
      basis: 'questions',
      lines: [
        { unit: { kind: 'unit', nodeId: t4[0]?.nodeId }, value: 3 },
        { unit: { kind: 'unit', nodeId: t5[0]?.nodeId }, value: 1 },
      ],
    }
    const changed = await admin.post(url(18, '/versions'), body({ code: 'MAT/S18B', sections: [fullSection({ quota, kbatMarks: 2 })] }))
    expect(changed.status, JSON.stringify(changed.body)).toBe(201)
    expect(changed.body.data.sections[0]).toMatchObject({ kbatReviewed: true })
    expect(changed.body.data.sections[0].quota.lines.map((l: { reviewed: boolean }) => l.reviewed)).toEqual([true, true])

    await seededUnreviewed(19)
    // only the KBAT value changes: the quota lines stay unreviewed
    const kbatOnly = await admin.post(url(19, '/versions'), body({ code: 'MAT/S19B', sections: [fullSection({ kbatMarks: 2 })] }))
    expect(kbatOnly.status, JSON.stringify(kbatOnly.body)).toBe(201)
    expect(kbatOnly.body.data.sections[0]).toMatchObject({ kbatReviewed: true })
    expect(kbatOnly.body.data.sections[0].quota.lines.map((l: { reviewed: boolean }) => l.reviewed)).toEqual([false, false])
  })

  it('POST sections/{position}/review stamps the section in place: no new version, no hash change, audited', async () => {
    const row = await seededUnreviewed(20)
    const before = await bpRow('MAT/S20')
    const res = await admin.post(url(20, '/sections/1/review'), {})
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const view = BijakBlueprintViewSchema.parse(res.body.data)
    expect(view.version).toBe(1)
    expect(view.sections[0]).toMatchObject({ kbatReviewed: true })
    expect(view.sections[0]?.quota?.lines.map((l) => l.reviewed)).toEqual([true, true])
    expect(await count(t.db, `select count(*) n from blueprints where code = 'MAT/S20'`)).toBe(1)
    expect((await bpRow('MAT/S20'))?.structure_hash).toBe(before?.structure_hash)
    const audit = (await auditRows(t.db, 'bijak.blueprint.section_reviewed')).find((r) => r.target_id === row?.id)
    expect(audit).toMatchObject({ actor_user_id: admin.userId, target_type: 'bijak_blueprint' })
    expect(audit?.detail).toMatchObject({ sectionPosition: 1, kertas: 20 })
  })

  it('review: 404 for an unknown section or blueprint, 422 for a body with keys, 409 on a Disahkan head', async () => {
    expect((await admin.post('/api/admin/blueprints', create(10))).status).toBe(201)
    expectError(await admin.post(url(10, '/sections/2/review'), {}), 'NOT_FOUND', 404)
    expectError(await admin.post(url(10, '/sections/0/review'), {}), 'NOT_FOUND', 404)
    expectError(await admin.post(url(10, '/sections/x/review'), {}), 'NOT_FOUND', 404)
    expectError(await admin.post(url(999, '/sections/1/review'), {}), 'NOT_FOUND', 404)
    expectError(await admin.post(url(10, '/sections/1/review'), { reviewed: true }), 'VALIDATION_ERROR')
    await verified(30)
    // the Disahkan head is never edited in place: the copy tells the admin to create a new version (AC-39.4)
    expect(STD.evidenceLocked).toBe('Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu.')
    expectError(await admin.post(url(30, '/sections/1/review'), {}), 'CONFLICT', 409, STD.evidenceLocked)
    // the body is validated by the contract schema before the lock is evaluated for a bad body on a live head
    expectError(await admin.post(url(10, '/sections/1/review'), { note: 'x' }), 'VALIDATION_ERROR')
  })

  it('refuses reviewed flags, the section reviewed flag and Disahkan on write (strict schemas, 422)', async () => {
    const lines = [{ unit: { kind: 't1_t3' }, value: 4, reviewed: true }]
    const e1 = expectError(
      await admin.post('/api/admin/blueprints', create(13, { sections: [fullSection({ quota: { basis: 'questions', lines } })] })),
      'VALIDATION_ERROR',
    )
    expect(Object.keys(e1.fields ?? {}).some((k) => k.includes('quota') && k.includes('lines'))).toBe(true)
    expectError(await admin.post('/api/admin/blueprints', create(13, { sections: [fullSection({ kbatReviewed: false })] })), 'VALIDATION_ERROR')
    expect(expectError(await admin.post('/api/admin/blueprints', create(13, { source: 'Disahkan' })), 'VALIDATION_ERROR').fields).toHaveProperty('source')
    expectError(await admin.post(url(11, '/versions'), body({ source: 'Disahkan' })), 'VALIDATION_ERROR')
    expectError(await admin.post(url(11, '/versions'), body({ verificationId: '1' })), 'VALIDATION_ERROR')
    expect(await count(t.db, `select count(*) n from blueprints where code = 'MAT/S13'`)).toBe(0)
  })

  it('422 BLUEPRINT_INVALID lists every problem at once and writes nothing (create and version)', async () => {
    const bad = {
      totalMarks: 99,
      sections: [
        fullSection({
          quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: t4[0]?.nodeId }, value: 1 }, { unit: { kind: 'unit', nodeId: '999999999' }, value: 1 }] },
          kbatMarks: 50,
        }),
      ],
    }
    const auditBefore = await count(t.db, `select count(*) n from audit_events where action like 'bijak.blueprint.%'`)
    const res = await admin.post('/api/admin/blueprints', create(14, bad))
    expect(res.status).toBe(422)
    const parsed = BijakBlueprintInvalidErrorSchema.parse(res.body)
    const codes = parsed.error.details.problems.map((p) => p.code)
    expect(codes).toEqual(expect.arrayContaining(['TOTAL_MISMATCH', 'QUOTA_SUM', 'QUOTA_UNIT', 'KBAT_RANGE']))
    expect(parsed.error.message).toBe(STD.blueprintInvalid)
    expect(await count(t.db, `select count(*) n from blueprints where code = 'MAT/S14'`)).toBe(0)

    const v = await admin.post(url(11, '/versions'), body({ code: 'MAT/S11X', ...bad }))
    expect(v.status).toBe(422)
    expect(BijakBlueprintInvalidErrorSchema.parse(v.body).error.details.problems.length).toBeGreaterThan(2)
    expect(await bpRow('MAT/S11X')).toBeUndefined()
    expect((await bpRow('MAT/S11'))?.status).toBe('active')
    expect(await count(t.db, `select count(*) n from audit_events where action like 'bijak.blueprint.%'`)).toBe(auditBefore)
  })

  it('a KBAT_TP_BAND warning does not refuse the save and is shown on the view', async () => {
    const section = fullSection({ profile: { kind: 'bahagian', groups: [{ from: 1, to: 4, tpMin: 1, tpMax: 2 }] }, kbatMarks: 1 })
    const res = await admin.post('/api/admin/blueprints', create(15, { sections: [section] }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.warnings).toEqual([{ code: 'KBAT_TP_BAND', warning: true, sectionPosition: 1 }])
    expect((await admin.get(url(15))).body.data.warnings).toHaveLength(1)
  })

  it('carries the reference panels over when omitted on a version, and clears them with []', async () => {
    expect((await admin.post('/api/admin/blueprints', create(16, { reference: [{ title: 'Rumus', items: ['a = b'] }] }))).status).toBe(201)
    const kept = await admin.post(url(16, '/versions'), body({ code: 'MAT/S16B' }))
    expect(kept.body.data.reference).toEqual([{ title: 'Rumus', items: ['a = b'] }])
    const cleared = await admin.post(url(16, '/versions'), body({ code: 'MAT/S16C', reference: [] }))
    expect(cleared.body.data.reference).toEqual([])
    const changed = await admin.post(url(16, '/versions'), body({ code: 'MAT/S16D', reference: [{ title: 'Baharu', items: ['x'] }] }))
    expect(changed.body.data.reference).toEqual([{ title: 'Baharu', items: ['x'] }])
  })

  it('lists a Draf head with its source, next to the Spec ones', async () => {
    expect((await admin.post('/api/admin/blueprints', create(17, { source: 'Draf' }))).status).toBe(201)
    const list = await admin.get('/api/admin/blueprints?subject=MAT&kertas=17')
    expect(list.body.data.map((b: { source: string }) => b.source)).toEqual(['Draf'])
  })
})

describe('BJS-08 versions, serving and the cosmetic rule', () => {
  it('a structural edit of a Spec makes a new Spec head; every edit is a new row and the old one is retired', async () => {
    expect((await admin.post('/api/admin/blueprints', create(21))).status).toBe(201)
    const res = await admin.post(url(21, '/versions'), body({ code: 'MAT/S21B', sections: [fullSection({ kbatMarks: 2 })] }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(BijakBlueprintViewSchema.parse(res.body.data)).toMatchObject({ version: 2, source: 'Spec', servesStudents: false })
    expect(await bpRow('MAT/S21')).toMatchObject({ version: 1, status: 'retired', source: 'spec' })
    expect(await bpRow('MAT/S21B')).toMatchObject({ version: 2, status: 'active', source: 'spec' })
  })

  it('a client asking for Draf gets a Draf row even for a cosmetic edit', async () => {
    const view = await verified(22)
    expect(view.source).toBe('Disahkan')
    const res = await admin.post(url(22, '/versions'), body({ code: 'MAT/S22B', source: 'Draf', notes: 'sahaja' }))
    expect(res.body.data).toMatchObject({ source: 'Draf', servesStudents: false, servingVersion: 1 })
  })

  it('a cosmetic-only edit keeps Disahkan: verification, evidence and the serving flag move to the new version', async () => {
    const v1 = await verified(23)
    expect(v1).toMatchObject({ source: 'Disahkan', servesStudents: true, servingVersion: 1, evidenceCount: 1 })
    expect(v1.verification).toMatchObject({ verifierRole: 'admin', bodies: ['lpm'], note: 'Disemak.' })
    const before = await bpRow('MAT/S23')

    const res = await admin.post(
      url(23, '/versions'),
      body({ code: 'MAT/S23', notes: 'Hanya nota', instructions: ['Baharu.'], reference: [{ title: 'Rumus', items: ['a'] }], sections: [fullSection({ label: 'Bahagian Satu', instruction: 'Jawab semua.' })] }),
    )
    // the code is unique per version, so the same code with version 2 is a new row
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const v2 = BijakBlueprintViewSchema.parse(res.body.data)
    expect(v2).toMatchObject({ version: 2, source: 'Disahkan', servesStudents: true, servingVersion: 2, evidenceCount: 1 })
    expect(v2.verification).toMatchObject({ bodies: ['lpm'] })

    const all = await rows(`select version, status, source, serves_students, verification_id::text, structure_hash from blueprints where code = 'MAT/S23' order by version`)
    expect(all[0]).toMatchObject({ version: 1, status: 'retired', source: 'verified', serves_students: false, verification_id: before?.verification_id })
    expect(all[1]).toMatchObject({ version: 2, status: 'active', source: 'verified', serves_students: true, verification_id: before?.verification_id })
    expect(all[1]?.structure_hash).toBe(before?.structure_hash)
    expect(await count(t.db, `select count(*) n from blueprint_evidence where blueprint_id = (select id from blueprints where code = 'MAT/S23' and version = 2)`)).toBe(1)
    expect(await count(t.db, `select count(*) n from blueprints where code = 'MAT/S23' and serves_students`)).toBe(1)
  })

  it('a structural edit of a Disahkan makes a Spec head; the Disahkan version keeps serving', async () => {
    await verified(24)
    const res = await admin.post(url(24, '/versions'), body({ code: 'MAT/S24B', sections: [fullSection({ kbatMarks: 2 })] }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const head = BijakBlueprintViewSchema.parse(res.body.data)
    expect(head).toMatchObject({ version: 2, source: 'Spec', servesStudents: false, servingVersion: 1, verification: null, evidenceCount: 1 })
    expect(await bpRow('MAT/S24')).toMatchObject({ status: 'retired', source: 'verified', serves_students: true })
    expect(await bpRow('MAT/S24B')).toMatchObject({ status: 'active', source: 'spec', serves_students: false, verification_id: null })
    // the admin list and get show the head, with the older serving version
    const list = await admin.get(url(24))
    expect(list.body.data).toMatchObject({ version: 2, servingVersion: 1 })
  })

  it('verifying the new Spec head moves the serving flag from the older version to it', async () => {
    await verified(25)
    expect((await admin.post(url(25, '/versions'), body({ code: 'MAT/S25B', sections: [fullSection({ kbatMarks: 2 })] }))).status).toBe(201)
    // evidence was copied; the structural change did not touch the values the evidence states
    const res = await admin.post(url(25, '/verify'), { note: 'Disemak.' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(BijakBlueprintViewSchema.parse(res.body.data)).toMatchObject({ version: 2, source: 'Disahkan', servesStudents: true, servingVersion: 2 })
    expect(await count(t.db, `select count(*) n from blueprints where code like 'MAT/S25%' and serves_students`)).toBe(1)
    expect(await bpRow('MAT/S25')).toMatchObject({ serves_students: false, source: 'verified' })
    expect(await bpRow('MAT/S25B')).toMatchObject({ serves_students: true, source: 'verified' })
  })

  it('retire stops everything: every version retired, the serving flag cleared', async () => {
    await verified(26)
    expect((await admin.post(url(26, '/versions'), body({ code: 'MAT/S26B', sections: [fullSection({ kbatMarks: 2 })] }))).status).toBe(201)
    expect((await admin.post(url(26, '/retire'))).status).toBe(200)
    const all = await rows(`select status, serves_students from blueprints where code like 'MAT/S26%'`)
    expect(all.every((r) => r.status === 'retired' && r.serves_students === false)).toBe(true)
    expectError(await admin.get(url(26)), 'NOT_FOUND', 404)
  })

  it('re-hashes a legacy row: the history shows the canonical hash and the first write stores it', async () => {
    expect((await admin.post('/api/admin/blueprints', create(27))).status).toBe(201)
    const legacy = 'a'.repeat(64)
    await rows(`update blueprints set structure_hash = $1 where code = 'MAT/S27'`, [legacy])
    const history = z.array(BijakBlueprintVersionItemSchema).parse((await admin.get(url(27, '/versions'))).body.data)
    expect(history).toHaveLength(1)
    expect(history[0]?.structureHash).toMatch(/^[0-9a-f]{64}$/)
    expect(history[0]?.structureHash).not.toBe(legacy)
    // a label-only edit is cosmetic: the new row hashes to the same value
    const res = await admin.post(url(27, '/versions'), body({ code: 'MAT/S27', sections: [fullSection({ label: 'Nama lain' })] }))
    expect(res.status).toBe(201)
    expect((await bpRow('MAT/S27'))?.structure_hash).toBe(history[0]?.structureHash)
    expect((await rows(`select structure_hash from blueprints where code = 'MAT/S27' and version = 2`))[0]?.structure_hash).toBe(history[0]?.structureHash)
  })

  it('version history is newest first with source, serving flag and verification summary', async () => {
    await verified(28)
    expect((await admin.post(url(28, '/versions'), body({ code: 'MAT/S28B', sections: [fullSection({ kbatMarks: 3 })] }))).status).toBe(201)
    const res = await admin.get(url(28, '/versions'))
    const items = envelopeOf(z.array(BijakBlueprintVersionItemSchema)).parse(res.body).data
    expect(items.map((i) => i.version)).toEqual([2, 1])
    expect(items[0]).toMatchObject({ status: 'active', source: 'Spec', servesStudents: false })
    expect(items[0]?.verification).toBeUndefined()
    expect(items[1]).toMatchObject({ status: 'retired', source: 'Disahkan', servesStudents: true })
    expect(items[1]?.verification?.bodies).toEqual(['lpm'])
    expectError(await admin.get(url(999, '/versions')), 'NOT_FOUND', 404)
  })

  it('dependentPaperCount counts published pilihan papers of any version of the pair', async () => {
    expect((await admin.post('/api/admin/blueprints', create(29))).status).toBe(201)
    const row = await bpRow('MAT/S29')
    const subjectId = ((await rows(`select id::text from subjects where code = 'MATH'`))[0] as { id: string }).id
    await rows(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, blueprint_id, is_test)
       values ('pilihan', 'Kertas S29', $1, 29, 60, 'published', $2, false), ('pilihan', 'Draf S29', $1, 29, 60, 'draft', $2, false)`,
      [subjectId, row?.id],
    )
    expect((await admin.post(url(29, '/versions'), body({ code: 'MAT/S29B', sections: [fullSection({ kbatMarks: 2 })] }))).status).toBe(201)
    expect((await admin.get(url(29))).body.data.dependentPaperCount).toBe(1)
  })
})

describe('BJS-09 evidence', () => {
  it('adds, lists and deletes evidence on the head, with audit rows', async () => {
    expect((await admin.post('/api/admin/blueprints', create(31))).status).toBe(201)
    expect(envelopeOf(z.array(BijakEvidenceItemSchema)).parse((await admin.get(url(31, '/evidence'))).body).data).toEqual([])

    const res = await admin.post(url(31, '/evidence'), lpmEvidence({ setLabel: 'Set A', sourceRef: 'folder/a', note: 'nota' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const item = BijakEvidenceItemSchema.parse(res.body.data)
    expect(item).toMatchObject({ kind: 'lpm_format', body: 'lpm', year: 2025, paperCode: '1449/1', setLabel: 'Set A', sourceRef: 'folder/a', origin: 'admin', note: 'nota' })
    const stored = await rows(`select created_by_id::text, origin from blueprint_evidence where id = $1`, [item.id])
    expect(stored[0]).toMatchObject({ created_by_id: admin.userId, origin: 'admin' })

    const list = envelopeOf(z.array(BijakEvidenceItemSchema)).parse((await admin.get(url(31, '/evidence'))).body).data
    expect(list.map((e) => e.id)).toEqual([item.id])
    expect((await admin.get(url(31))).body.data.evidenceCount).toBe(1)

    const del = await admin.del(url(31, `/evidence/${item.id}`))
    expect(del.status).toBe(200)
    expect(del.body).toEqual({ data: { ok: true } })
    expect(await count(t.db, `select count(*) n from blueprint_evidence where id = $1`, [item.id])).toBe(0)
    const added = (await auditRows(t.db, 'bijak.blueprint.evidence_added')).find((r) => r.detail?.evidenceId === item.id)
    expect(added).toMatchObject({ actor_user_id: admin.userId, target_type: 'bijak_blueprint' })
    expect(added?.detail).toMatchObject({ subject: 'MATH', kertas: 31, kind: 'lpm_format', body: 'lpm' })
    expect((await auditRows(t.db, 'bijak.blueprint.evidence_removed')).some((r) => r.detail?.evidenceId === item.id)).toBe(true)
  })

  it('422 for an invalid body (body id format, unknown keys), 404 for unknown blueprint, evidence or id', async () => {
    const post = (over: Record<string, unknown>) => admin.post(url(31, '/evidence'), lpmEvidence(over))
    expect(expectError(await post({ body: 'SBP' }), 'VALIDATION_ERROR').fields).toHaveProperty('body')
    expect(expectError(await post({ body: 'sbp selangor' }), 'VALIDATION_ERROR').fields).toHaveProperty('body')
    expect(expectError(await post({ kind: 'lain' }), 'VALIDATION_ERROR').fields).toHaveProperty('kind')
    expect(expectError(await post({ year: 1800 }), 'VALIDATION_ERROR').fields).toHaveProperty('year')
    expectError(await post({ extra: 1 }), 'VALIDATION_ERROR')
    expectError(await post({ values: { durationMin: 0 } }), 'VALIDATION_ERROR')
    expectError(await admin.post(url(999, '/evidence'), lpmEvidence()), 'NOT_FOUND', 404)
    expectError(await admin.get(url(999, '/evidence')), 'NOT_FOUND', 404)
    expectError(await admin.del(url(31, '/evidence/999999')), 'NOT_FOUND', 404, STD.evidenceNotFound)
    expectError(await admin.del(url(31, '/evidence/abc')), 'NOT_FOUND', 404, STD.evidenceNotFound)
  })

  it('evidence of another blueprint cannot be deleted through this one', async () => {
    expect((await admin.post('/api/admin/blueprints', create(32))).status).toBe(201)
    const other = await admin.post(url(32, '/evidence'), lpmEvidence())
    expect((await admin.del(url(31, `/evidence/${other.body.data.id as string}`))).status).toBe(404)
    expect(await count(t.db, `select count(*) n from blueprint_evidence where id = $1`, [other.body.data.id])).toBe(1)
  })

  it('is locked after Sahkan: 409 on add and delete, nothing changes', async () => {
    await verified(33)
    const [ev] = envelopeOf(z.array(BijakEvidenceItemSchema)).parse((await admin.get(url(33, '/evidence'))).body).data
    expectError(await admin.post(url(33, '/evidence'), lpmEvidence({ body: 'sbp' })), 'CONFLICT', 409, STD.evidenceLocked)
    expectError(await admin.del(url(33, `/evidence/${ev?.id as string}`)), 'CONFLICT', 409, STD.evidenceLocked)
    expect((await admin.get(url(33, '/evidence'))).body.data).toHaveLength(1)
  })
})

describe('BJS-09 verification', () => {
  it('GET verification returns { record: null, check } for a Spec head, listing every gap', async () => {
    expect((await admin.post('/api/admin/blueprints', create(41, { sections: [{ label: 'A', markBudget: 4, questionCount: 4, rule: { type: 'all' } }] }))).status).toBe(201)
    const res = await admin.get(url(41, '/verification'))
    expect(res.status).toBe(200)
    const state = envelopeOf(BijakVerificationStateSchema).parse(res.body).data
    expect(state.record).toBeNull()
    expect(state.check.passes).toBe(false)
    expect(state.check.completeness.map((c) => c.code)).toEqual(expect.arrayContaining(['NO_PROFILE', 'NO_QUOTA', 'NO_KBAT', 'NO_EVIDENCE_BODIES']))
    expect(state.check.lines.length).toBeGreaterThan(0)
    expect(state.check.lines.every((l) => l.status === 'not_covered')).toBe(true)
    expectError(await admin.get(url(999, '/verification')), 'NOT_FOUND', 404)
  })

  it('shows differs / tidak_disahkan lines from the evidence and passes once it agrees', async () => {
    expect((await admin.post('/api/admin/blueprints', create(42))).status).toBe(201)
    await admin.post(url(42, '/evidence'), lpmEvidence({ kind: 'trial_paper', body: 'sbp', values: { durationMin: 75, totalMarks: 4 } }))
    const state = envelopeOf(BijakVerificationStateSchema).parse((await admin.get(url(42, '/verification'))).body).data
    const status = (field: string) => state.check.lines.find((l) => l.field === field)?.status
    expect(status('durationMin')).toBe('differs')
    expect(status('totalMarks')).toBe('tidak_disahkan')
    expect(state.check.passes).toBe(false)

    const ev = envelopeOf(z.array(BijakEvidenceItemSchema)).parse((await admin.get(url(42, '/evidence'))).body).data
    for (const e of ev) await admin.del(url(42, `/evidence/${e.id}`))
    await admin.post(url(42, '/evidence'), lpmEvidence())
    const ok = envelopeOf(BijakVerificationStateSchema).parse((await admin.get(url(42, '/verification'))).body).data
    expect(ok.check).toMatchObject({ passes: true, blueprintProblems: [], completeness: [] })
    expect(ok.check.lines.every((l) => l.status === 'ok')).toBe(true)
  })

  it('422 VERIFICATION_FAILED carries details.check; nothing is written', async () => {
    expect((await admin.post('/api/admin/blueprints', create(43))).status).toBe(201)
    const res = await admin.post(url(43, '/verify'), { note: 'x' })
    expect(res.status).toBe(422)
    const parsed = BijakVerificationFailedErrorSchema.parse(res.body)
    expect(parsed.error.message).toBe(STD.verificationFailed)
    expect(parsed.error.details.check.passes).toBe(false)
    expect(parsed.error.details.check.completeness.map((c) => c.code)).toContain('NO_EVIDENCE_BODIES')
    expect(parsed.error.details).not.toHaveProperty('failures')
    expect(await bpRow('MAT/S43')).toMatchObject({ source: 'spec', verification_id: null, serves_students: false })
    expect(await count(t.db, `select count(*) n from blueprint_verifications where blueprint_id = $1`, [(await bpRow('MAT/S43'))?.id])).toBe(0)
  })

  it('UNREVIEWED values block Sahkan until an admin save reviews them', async () => {
    expect((await admin.post('/api/admin/blueprints', create(44))).status).toBe(201)
    await admin.post(url(44, '/evidence'), lpmEvidence())
    const row = await bpRow('MAT/S44')
    await rows(`update blueprint_sections set kbat_reviewed = false, quota = jsonb_set(quota, '{lines,0,reviewed}', 'false') where blueprint_id = $1`, [row?.id])
    const res = await admin.post(url(44, '/verify'), { note: 'Disemak.' })
    expect(res.status).toBe(422)
    const check = BijakVerificationFailedErrorSchema.parse(res.body).error.details.check
    const unreviewed = check.completeness.filter((c) => c.code === 'UNREVIEWED')
    expect(unreviewed).toHaveLength(2)
    expect(unreviewed.some((c) => c.unit?.kind === 'unit')).toBe(true)
    // the review stamp (in place, not a new version) clears the block
    expect((await admin.post(url(44, '/sections/1/review'), {})).status).toBe(200)
    expect((await admin.post(url(44, '/verify'), { note: 'Disemak.' })).status).toBe(200)
  })

  it('verifies: Disahkan, verification row, serving flag, hash, audit, and GET shows the record', async () => {
    const view = await verified(45)
    expect(view).toMatchObject({ source: 'Disahkan', servesStudents: true, servingVersion: 1, evidenceCount: 1 })
    expect(view.verification?.verifierName).toBeTruthy()
    const row = await bpRow('MAT/S45')
    expect(row).toMatchObject({ source: 'verified', serves_students: true })
    const v = await rows(`select verified_by_id::text, verifier_role, structure_hash, note, jsonb_array_length(evidence_snapshot) n, check_result from blueprint_verifications where id = $1`, [row?.verification_id])
    expect(v[0]).toMatchObject({ verified_by_id: admin.userId, verifier_role: 'admin', structure_hash: row?.structure_hash, note: 'Disemak.', n: 1 })
    expect((v[0]?.check_result as { passes: boolean }).passes).toBe(true)

    const state = envelopeOf(BijakVerificationStateSchema).parse((await admin.get(url(45, '/verification'))).body).data
    expect(state.record).toMatchObject({ verifierRole: 'admin', bodies: ['lpm'], note: 'Disemak.' })
    expect(state.record?.evidence).toHaveLength(1)
    expect(state.record?.lines.length).toBeGreaterThan(0)
    expect(state.check.passes).toBe(true)

    const audit = (await auditRows(t.db, 'bijak.blueprint.verified')).find((r) => r.target_id === row?.id)
    expect(audit).toMatchObject({ actor_user_id: admin.userId, target_type: 'bijak_blueprint' })
    expect(audit?.detail).toMatchObject({ from: 'spec', to: 'verified', evidenceCount: 1, subject: 'MATH', kertas: 45 })
  })

  it('409 when already Disahkan; the verification record is insert-only', async () => {
    await verified(46)
    expectError(await admin.post(url(46, '/verify'), { note: 'Disemak.' }), 'CONFLICT', 409, STD.alreadyVerified)
    expect(await count(t.db, `select count(*) n from blueprint_verifications where blueprint_id = $1`, [(await bpRow('MAT/S46'))?.id])).toBe(1)
    await expect(rows(`update blueprint_verifications set note = 'x' where blueprint_id = $1`, [(await bpRow('MAT/S46'))?.id])).rejects.toThrow()
  })

  // H-A15 (ii): the design makes "Nota pengesahan" required ("wajib"); the server refuses too, so a client cannot skip it (AC-39.2).
  it('Sahkan needs a non-blank note: none, empty or whitespace is 422 on fields.note; nothing is written; a note verifies', async () => {
    expect((await admin.post('/api/admin/blueprints', create(54))).status).toBe(201)
    expect((await admin.post(url(54, '/evidence'), lpmEvidence())).status).toBe(201)
    for (const bad of [{}, { note: '' }, { note: '   ' }, { note: '\n\t ' }, { note: null }]) {
      const res = await admin.post(url(54, '/verify'), bad)
      expectError(res, 'VALIDATION_ERROR', 422)
      expect(res.body.error.fields, JSON.stringify(bad)).toEqual({ note: STD.noteRequired })
    }
    expect(STD.noteRequired).toBe('Isi nota pengesahan dahulu.')
    expect(await bpRow('MAT/S54')).toMatchObject({ source: 'spec', verification_id: null, serves_students: false })
    expect(await count(t.db, `select count(*) n from blueprint_verifications where blueprint_id = $1`, [(await bpRow('MAT/S54'))?.id])).toBe(0)
    const ok = await admin.post(url(54, '/verify'), { note: '  Disemak mengikut skema.  ' })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    const v = await rows(`select note from blueprint_verifications where blueprint_id = $1`, [(await bpRow('MAT/S54'))?.id])
    expect(v[0]?.note).toBe('Disemak mengikut skema.')
  })

  it('422 for an invalid verify body, 404 for an unknown blueprint', async () => {
    expect((await admin.post('/api/admin/blueprints', create(47))).status).toBe(201)
    expectError(await admin.post(url(47, '/verify'), { note: 5 }), 'VALIDATION_ERROR')
    expectError(await admin.post(url(47, '/verify'), { note: 'Disemak.', extra: true }), 'VALIDATION_ERROR')
    expectError(await admin.post(url(999, '/verify'), {}), 'NOT_FOUND', 404)
  })

  // H-A15 (i), AC-39.2 (G2, design D-5): seeded study rows do not count until the verifier replaces them. The body counter of the
  // Kontrak screen already ignored them; now the server check and Sahkan do too.
  describe('study-origin evidence does not count (H-A15 i, AC-39.2)', () => {
    /** A complete, agreeing evidence set for fullSection(): two bodies, each with a paper and a skema, as seeded study rows. */
    const studyRow = (kind: string, bodyId: string, values: Record<string, unknown>) =>
      rows(
        `insert into blueprint_evidence (blueprint_id, kind, body, year, paper_code, values, origin) values ($1, $2, $3, 2025, '1449/1', $4::jsonb, 'study')`,
        [studyBlueprintId, kind, bodyId, JSON.stringify(values)],
      )
    const full = { durationMin: 60, totalMarks: 4, sections: [{ position: 1, markBudget: 4, rule: { type: 'all' }, questionCount: 4 }] }
    const skemaOnly = { totalMarks: 4, sections: [{ position: 1, markBudget: 4 }] }
    let studyBlueprintId = ''
    const stateOf = async (k: number) => envelopeOf(BijakVerificationStateSchema).parse((await admin.get(url(k, '/verification'))).body).data

    it('study rows that would satisfy the check alone make no body count: NO_EVIDENCE_BODIES, lines not_covered, Sahkan refused', async () => {
      expect((await admin.post('/api/admin/blueprints', create(49))).status).toBe(201)
      studyBlueprintId = String((await bpRow('MAT/S49'))?.id)
      for (const [kind, bodyId, values] of [['trial_paper', 'sbp', full], ['skema', 'sbp', skemaOnly], ['trial_paper', 'selangor_mpsm', full], ['skema', 'selangor_mpsm', skemaOnly], ['lpm_format', 'lpm', full]] as const) await studyRow(kind, bodyId, values)
      // the rows are listed (with their origin) ...
      const listed = envelopeOf(z.array(BijakEvidenceItemSchema)).parse((await admin.get(url(49, '/evidence'))).body).data
      expect(listed).toHaveLength(5)
      expect(listed.every((e) => e.origin === 'study')).toBe(true)
      // ... but none of them counts: not two bodies, not even the LPM document
      const state = await stateOf(49)
      expect(state.check.passes).toBe(false)
      expect(state.check.completeness.map((c) => c.code)).toContain('NO_EVIDENCE_BODIES')
      expect(state.check.lines.every((l) => l.status === 'not_covered' && l.statements.length === 0)).toBe(true)
      const res = await admin.post(url(49, '/verify'), { note: 'Disemak.' })
      expect(res.status).toBe(422)
      expect(BijakVerificationFailedErrorSchema.parse(res.body).error.details.check.completeness.map((c) => c.code)).toContain('NO_EVIDENCE_BODIES')
      expect(await bpRow('MAT/S49')).toMatchObject({ source: 'spec', verification_id: null, serves_students: false })
    })

    it('a study row does not contradict either: one that states another duration is ignored, the admin evidence decides', async () => {
      expect((await admin.post('/api/admin/blueprints', create(50))).status).toBe(201)
      studyBlueprintId = String((await bpRow('MAT/S50'))?.id)
      await studyRow('trial_paper', 'sbp', { ...full, durationMin: 120 })
      expect((await admin.post(url(50, '/evidence'), lpmEvidence())).status).toBe(201)
      const state = await stateOf(50)
      expect(state.check.lines.find((l) => l.field === 'durationMin')).toMatchObject({ status: 'ok', supportingBodies: 2 })
      expect(state.check).toMatchObject({ passes: true, completeness: [] })
      const res = await admin.post(url(50, '/verify'), { note: 'Disemak.' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    })

    it('the same rows entered by the admin (origin admin) do count', async () => {
      expect((await admin.post('/api/admin/blueprints', create(51))).status).toBe(201)
      for (const [kind, bodyId, values] of [['trial_paper', 'sbp', full], ['skema', 'sbp', skemaOnly], ['trial_paper', 'selangor_mpsm', full], ['skema', 'selangor_mpsm', skemaOnly]] as const) {
        expect((await admin.post(url(51, '/evidence'), lpmEvidence({ kind, body: bodyId, values }))).status).toBe(201)
      }
      const state = await stateOf(51)
      expect(state.check).toMatchObject({ passes: true, completeness: [] })
      expect(state.check.lines.every((l) => l.status === 'ok')).toBe(true)
    })
  })

  // H-A15 (iii), AC-39.7 / AC-39.8 / SPP 10.3: a skema's Markah on a choose-N section is the offered marks.
  describe('Markah of a skema on a choose-N section (H-A15 iii)', () => {
    const choose = (kertas: number) => create(kertas, {
      sections: [
        fullSection(),
        fullSection({ label: 'Bahagian B', markBudget: 6, questionCount: 4, rule: { type: 'choose', n: 2 }, profile: { kind: 'bahagian', groups: [{ from: 1, to: 4, tpMin: 1, tpMax: 4 }] }, quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: t4[0]?.nodeId }, value: 2 }, { unit: { kind: 'unit', nodeId: t5[0]?.nodeId }, value: 2 }] }, kbatMarks: 1 }),
      ],
    })
    const paper = { durationMin: 60, totalMarks: 10, sections: [{ position: 1, markBudget: 4, rule: { type: 'all' }, questionCount: 4 }, { position: 2, markBudget: 6, rule: { type: 'choose', n: 2 }, questionCount: 4 }] }
    const skemaValues = (b: number) => ({ totalMarks: 10, sections: [{ position: 1, markBudget: 4 }, { position: 2, markBudget: b }] })
    const addSet = async (k: number, skemaB: number) => {
      for (const [kind, bodyId, values] of [['trial_paper', 'sbp', paper], ['skema', 'sbp', skemaValues(skemaB)], ['trial_paper', 'selangor_mpsm', paper], ['skema', 'selangor_mpsm', skemaValues(skemaB)]] as const) {
        expect((await admin.post(url(k, '/evidence'), lpmEvidence({ kind, body: bodyId, values }))).status).toBe(201)
      }
    }
    const line = async (k: number, position: number) => (await (async () => envelopeOf(BijakVerificationStateSchema).parse((await admin.get(url(k, '/verification'))).body).data)()).check.lines.find((l) => l.field === 'markBudget' && l.sectionPosition === position)

    it('the skema offered marks (6 / 2 x 4 = 12) agree with the budget 6: ok, and Sahkan succeeds', async () => {
      expect((await admin.post('/api/admin/blueprints', choose(52))).status).toBe(201)
      await addSet(52, 12)
      expect(await line(52, 2)).toMatchObject({ status: 'ok', expected: 6, supportingBodies: 2 })
      expect(await line(52, 1)).toMatchObject({ status: 'ok', expected: 4 })
      expect((await admin.post(url(52, '/verify'), { note: 'Disemak.' })).status).toBe(200)
    })

    it('another skema figure for the choose section differs; for the non-choose section only the budget agrees', async () => {
      expect((await admin.post('/api/admin/blueprints', choose(53))).status).toBe(201)
      await addSet(53, 10)
      expect(await line(53, 2)).toMatchObject({ status: 'differs', expected: 6 })
      expect(await line(53, 1)).toMatchObject({ status: 'ok' })
      expect((await admin.post(url(53, '/verify'), { note: 'Disemak.' })).status).toBe(422)
    })
  })

  it('two concurrent verifies: one wins (200), the other gets 409', async () => {
    expect((await admin.post('/api/admin/blueprints', create(48))).status).toBe(201)
    await admin.post(url(48, '/evidence'), lpmEvidence())
    const [a, b] = await Promise.all([admin.post(url(48, '/verify'), { note: 'Disemak.' }), admin.post(url(48, '/verify'), { note: 'Disemak.' })])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(await count(t.db, `select count(*) n from blueprint_verifications where blueprint_id = $1`, [(await bpRow('MAT/S48'))?.id])).toBe(1)
  })
})

describe('§15 pickers', () => {
  it('lists the DSKP units of a subject, sorted, with level and elective', async () => {
    const res = await admin.get('/api/admin/bijak/dskp/units?subject=MAT')
    expect(res.status).toBe(200)
    const items = envelopeOf(z.array(BijakDskpUnitSchema)).parse(res.body).data
    expect(items.length).toBe(t4.length + t5.length)
    expect(res.body).not.toHaveProperty('meta')
    const only = envelopeOf(z.array(BijakDskpUnitSchema)).parse((await admin.get('/api/admin/bijak/dskp/units?subject=MAT&level=T5')).body).data
    expect(only.every((u) => u.level === 'T5')).toBe(true)
    expect(only).toHaveLength(t5.length)
    const ids = await rows(
      `select n.id::text from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id
        where s.code = 'MATH' and n.kind = 'unit' and l.code = 'T4' order by n.sort_order, n.id`,
    )
    expect(items.filter((u) => u.level === 'T4').map((u) => u.nodeId)).toEqual(ids.map((r) => r.id))
  })

  it('404 for an unknown subject, 422 for a bad query, empty for a subject without DSKP units', async () => {
    expectError(await admin.get('/api/admin/bijak/dskp/units?subject=ZZZ'), 'NOT_FOUND', 404)
    expectError(await admin.get('/api/admin/bijak/dskp/units'), 'VALIDATION_ERROR')
    expectError(await admin.get('/api/admin/bijak/dskp/units?subject=MAT&level=T3'), 'VALIDATION_ERROR')
    const none = await rows(
      `select s.code from subjects s where not exists (select 1 from curriculum_nodes n where n.subject_id = s.id and n.kind = 'unit') limit 1`,
    )
    if (none[0]) {
      const res = await admin.get(`/api/admin/bijak/dskp/units?subject=${none[0].code as string}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    }
  })

  it('lists the active subjects with Bijak codes (MAT, not MATH)', async () => {
    const res = await admin.get('/api/admin/bijak/subjects')
    expect(res.status).toBe(200)
    const items = envelopeOf(z.array(BijakSubjectSchema)).parse(res.body).data
    const codes = items.map((s) => s.code)
    expect(codes).toContain('MAT')
    expect(codes).toContain('SN')
    expect(codes).not.toContain('MATH')
    expect(codes).not.toContain('SCI')
    expect(items.length).toBe(await count(t.db, `select count(*) n from subjects where is_active`))
  })
})

describe('access: Admin Pusat only (AC-32.1, AC-39.3)', () => {
  const routes: { name: string; method: 'get' | 'post' | 'del'; url: string; body?: unknown }[] = [
    { name: 'versions', method: 'get', url: url(1, '/versions') },
    { name: 'evidence list', method: 'get', url: url(1, '/evidence') },
    { name: 'evidence add', method: 'post', url: url(1, '/evidence'), body: lpmEvidence() },
    { name: 'evidence delete', method: 'del', url: url(1, '/evidence/1') },
    { name: 'verification', method: 'get', url: url(1, '/verification') },
    { name: 'verify', method: 'post', url: url(1, '/verify'), body: { note: 'Disemak.' } },
    { name: 'section review', method: 'post', url: url(1, '/sections/1/review'), body: {} },
    { name: 'dskp units', method: 'get', url: '/api/admin/bijak/dskp/units?subject=MAT' },
    { name: 'subjects', method: 'get', url: '/api/admin/bijak/subjects' },
  ]
  const call = (c: Client, r: (typeof routes)[number]) => (r.method === 'get' ? c.get(r.url) : r.method === 'post' ? c.post(r.url, r.body) : c.del(r.url))

  it('anonymous gets 401', async () => {
    for (const r of routes) {
      const agent = t.agent()
      const res = r.method === 'get' ? await agent.get(r.url) : r.method === 'post' ? await agent.post(r.url).send(r.body as object) : await agent.delete(r.url)
      expectError(res, 'UNAUTHORIZED', 401)
    }
  })

  it.each([['teacher', ACCOUNTS.teacher], ['school admin', ACCOUNTS.schoolAdmin], ['student', ACCOUNTS.student]])('%s gets 403 on every new route', async (_n, account) => {
    const c = await loginAs(t, account)
    for (const r of routes) expectError(await call(c, r), 'FORBIDDEN', 403)
  })

  it('admin inside Mod Pelajar gets 403 on every new route', async () => {
    const c = await loginAs(t, ACCOUNTS.admin)
    await c.enterMod()
    for (const r of routes) expectError(await call(c, r), 'FORBIDDEN', 403)
  })

  it('a refused role changes nothing: no evidence, no verification, no audit row', async () => {
    const c = await loginAs(t, ACCOUNTS.schoolAdmin)
    const before = [
      await count(t.db, 'select count(*) n from blueprint_evidence'),
      await count(t.db, 'select count(*) n from blueprint_verifications'),
      await count(t.db, `select count(*) n from audit_events where action like 'bijak.blueprint.%'`),
    ]
    for (const r of routes.filter((x) => x.method !== 'get')) await call(c, r)
    expect([
      await count(t.db, 'select count(*) n from blueprint_evidence'),
      await count(t.db, 'select count(*) n from blueprint_verifications'),
      await count(t.db, `select count(*) n from audit_events where action like 'bijak.blueprint.%'`),
    ]).toEqual(before)
  })

  it('writes without a CSRF token get 403 CSRF_INVALID', async () => {
    for (const r of routes.filter((x) => x.method !== 'get')) {
      expectError(await admin.noCsrf(r.method === 'post' ? 'post' : 'delete', r.url, r.body), 'CSRF_INVALID', 403)
    }
  })
})
