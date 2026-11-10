import { BijakDskpUnitSchema, BijakPoolPreviewSchema, envelopeOf } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ACCOUNTS, bootBuilderApp, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

/**
 * `GET /api/admin/blueprints/:subject/:kertas/pool[?version=]` ("Pratonton Kolam" of the Kontrak page): declared in the contract
 * (`standards/paths.ts`) and called by the FE (`kontrak/server/http.ts`), but the API had no route (404). It serves the same preview as
 * `GET /api/admin/papers/pool-preview`, for the head or for the version asked.
 */

vi.setConfig({ testTimeout: 120_000 })

const Preview = envelopeOf(BijakPoolPreviewSchema)

let t: BuilderTestApp
let admin: Client

let units: { nodeId: string; code: string }[] = []

beforeAll(async () => {
  t = await bootBuilderApp()
  admin = await loginAs(t, ACCOUNTS.admin)
  units = z.array(BijakDskpUnitSchema).parse((await admin.get('/api/admin/bijak/dskp/units?subject=MAT')).body.data)
})
afterAll(async () => {
  await t.close()
})

describe('GET /api/admin/blueprints/:subject/:kertas/pool', () => {
  it('admin gets the preview of the head, equal to the paper builder pool-preview', async () => {
    const res = await admin.get('/api/admin/blueprints/MAT/2/pool')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const preview = Preview.parse(res.body).data
    const builder = Preview.parse((await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=2')).body).data
    expect(preview).toEqual(builder)
    expect(preview.sections.length).toBeGreaterThan(0)
  })

  it('?version= of the head returns the same preview; a version that does not exist is 404', async () => {
    const head = Preview.parse((await admin.get('/api/admin/blueprints/MAT/2/pool')).body).data
    const same = await admin.get(`/api/admin/blueprints/MAT/2/pool?version=${String(head.blueprint.version)}`)
    expect(same.status, JSON.stringify(same.body)).toBe(200)
    expect(Preview.parse(same.body).data).toEqual(head)
    expectError(await admin.get('/api/admin/blueprints/MAT/2/pool?version=9999'), 'NOT_FOUND', 404)
  })

  it('a bad version is 422 with fields.version', async () => {
    for (const q of ['version=0', 'version=abc', 'version=1.5']) {
      const res = await admin.get(`/api/admin/blueprints/MAT/2/pool?${q}`)
      expectError(res, 'VALIDATION_ERROR', 422)
      expect(res.body.error.fields, q).toHaveProperty('version')
    }
  })

  it('an unknown subject or a kertas that is not a positive integer is 404 (before 422)', async () => {
    expectError(await admin.get('/api/admin/blueprints/NOPE/1/pool'), 'NOT_FOUND', 404)
    expectError(await admin.get('/api/admin/blueprints/MAT/0/pool'), 'NOT_FOUND', 404)
    expectError(await admin.get('/api/admin/blueprints/MAT/x/pool'), 'NOT_FOUND', 404)
    expectError(await admin.get('/api/admin/blueprints/NOPE/1/pool?version=abc'), 'NOT_FOUND', 404)
  })

  it('anonymous is 401; teacher, school admin and student are 403; an admin inside Mod Pelajar is 403', async () => {
    expectError(await t.agent().get('/api/admin/blueprints/MAT/2/pool'), 'UNAUTHORIZED', 401)
    for (const account of [ACCOUNTS.teacher, ACCOUNTS.schoolAdmin, ACCOUNTS.student]) {
      const c = await loginAs(t, account)
      expectError(await c.get('/api/admin/blueprints/MAT/2/pool'), 'FORBIDDEN', 403)
    }
    const inMod = await loginAs(t, ACCOUNTS.admin)
    await inMod.enterMod()
    expectError(await inMod.get('/api/admin/blueprints/MAT/2/pool'), 'FORBIDDEN', 403)
  })

  it('a Draf head without ?version= previews the draft (the head, whatever its status); the sibling Spec head is unchanged', async () => {
    const section = {
      label: 'Bahagian A',
      markBudget: 4,
      questionCount: 4,
      rule: { type: 'all' },
      profile: { kind: 'bahagian', groups: [{ from: 1, to: 4, tpMin: 1, tpMax: 4 }] },
      quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: units[0]?.nodeId }, value: 4 }] },
      kbatMarks: 1,
    }
    const base = { subject: 'MAT', durationMin: 60, instructions: ['Jawab semua.'], sections: [section] }
    expect((await admin.post('/api/admin/blueprints', { ...base, kertas: 17, source: 'Draf', code: 'MAT/POOL17' })).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints', { ...base, kertas: 18, source: 'Spec', code: 'MAT/POOL18' })).status).toBe(201)

    const draft = await admin.get('/api/admin/blueprints/MAT/17/pool')
    expect(draft.status, JSON.stringify(draft.body)).toBe(200)
    expect(Preview.parse(draft.body).data.blueprint).toMatchObject({ version: 1, source: 'Draf' })
    const spec = await admin.get('/api/admin/blueprints/MAT/18/pool')
    expect(spec.status, JSON.stringify(spec.body)).toBe(200)
    expect(Preview.parse(spec.body).data.blueprint).toMatchObject({ version: 1, source: 'Spec' })
    // The paper builder keeps refusing a draft head (unchanged).
    expectError(await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=17'), 'NOT_FOUND', 404)
  })

  // G-04: the shortage under a locked "Jana set" said "perlu 6 markah 489" (a bare node id); a unit shortage now carries its DSKP code, level and title.
  // The seed pool of this suite is empty (the first failure is a count), so the labelling is checked directly against the real unit rows.
  it('labelUnits adds code, level and title to a unit shortage and leaves other shortages alone', async () => {
    const { BuilderService } = await import('../../src/modules/exam/builder/builder.service')
    const { BuilderRepository } = await import('../../src/modules/exam/builder/builder.repository')
    const repo = t.app.get(BuilderRepository)
    const service = t.app.get(BuilderService) as unknown as { labelUnits(s: unknown[]): Promise<{ unit?: unknown }[]> }
    expect(service).toBeInstanceOf(BuilderService)
    const nodeId = units[0]!.nodeId
    const out = await service.labelUnits([
      { section: 'Bahagian A', need: 6, have: 2, kind: 'unit', basis: 'marks', unit: { kind: 'unit', nodeId } },
      { section: 'Bahagian B', need: 4, have: 0, kind: 'count' },
      { section: 'Bahagian C', need: 1, have: 0, kind: 'unit', unit: { kind: 't1_t3' } },
    ])
    expect(out[0]!.unit).toMatchObject({ kind: 'unit', nodeId, code: expect.any(String), level: expect.stringMatching(/^T[45]$/), title: expect.any(String) })
    expect(out[1]).not.toHaveProperty('unit')
    expect(out[2]!.unit).toEqual({ kind: 't1_t3' })
    expect((await repo.unitLabels([BigInt(nodeId)])).get(nodeId)?.code).toBe(units[0]!.code)
  })
})
