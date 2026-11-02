import { BijakPoolPreviewSchema, envelopeOf } from '@pp/contract'
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

beforeAll(async () => {
  t = await bootBuilderApp()
  admin = await loginAs(t, ACCOUNTS.admin)
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
})
