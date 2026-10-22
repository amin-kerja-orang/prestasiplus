import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { intakeTeacherEnabled } from '../../src/modules/intake/intake-teacher.gate'
import { textPdf } from '../intake-files/pdf-fixtures'
import { bootWorkflowApp, expectError, loginAs, type LoggedIn, readyBatch, type WorkflowTestApp } from './helpers'
import { createBatch, uploadFiles } from '../intake-files/helpers'

/**
 * AZ-35 (LEAD decision AZ-29 item 7 = ADMIN): until ClamAV scans uploads, intake is Admin Pusat only. With
 * `INTAKE_TEACHER_ENABLED` unset (the default) a teacher gets 403 on every intake files and workflow route, before any
 * body is read or any row is written; Admin Pusat is untouched. Turning the flag on restores the teacher paths (the
 * other intake suites run with it on).
 */
const ROUTES: readonly (readonly ['get' | 'post' | 'patch' | 'delete', string])[] = [
  ['post', '/api/intake/batches'],
  ['get', '/api/intake/batches'],
  ['get', '/api/intake/batches/{batch}'],
  ['post', '/api/intake/batches/{batch}/files'],
  ['post', '/api/intake/batches/{batch}/cancel'],
  ['get', '/api/intake/files/{file}/pages'],
  ['get', '/api/intake/files/{file}/pages/1/image'],
  ['get', '/api/intake/files/{file}/pages/1/thumb'],
  ['get', '/api/intake/figures/1/image'],
  ['get', '/api/intake/files/{file}/original'],
  ['post', '/api/intake/batches/{batch}/extract'],
  ['get', '/api/intake/batches/{batch}/review'],
  ['post', '/api/intake/batches/{batch}/items'],
  ['post', '/api/intake/batches/{batch}/stimuli'],
  ['patch', '/api/intake/stimuli/1'],
  ['delete', '/api/intake/stimuli/1'],
  ['get', '/api/intake/items'],
  ['post', '/api/intake/items/bulk'],
  ['get', '/api/intake/items/1'],
  ['patch', '/api/intake/items/1'],
  ['post', '/api/intake/items/1/accept'],
  ['post', '/api/intake/items/1/reject'],
  ['post', '/api/intake/items/1/duplicate'],
]

const send = (who: LoggedIn, method: (typeof ROUTES)[number][0], path: string) => {
  const req = who.agent[method](path).set('X-CSRF-Token', who.csrf)
  return method === 'get' ? req : req.send({})
}

describe('AZ-35: intake is Admin Pusat only while INTAKE_TEACHER_ENABLED is off (default)', () => {
  let t: WorkflowTestApp
  let teacher: LoggedIn
  let admin: LoggedIn
  let batch: string
  let file: string

  beforeAll(async () => {
    t = await bootWorkflowApp({ INTAKE_TEACHER_ENABLED: undefined })
    teacher = await loginAs(t, 'guru@demo.test')
    admin = await loginAs(t, 'admin@demo.test')
    const ready = await readyBatch(t, admin)
    batch = ready.batchId
    file = (await t.db.query<{ id: string }>(`select id::text as id from intake_files where batch_id = $1 limit 1`, [batch]))[0]!.id
  }, 120_000)
  afterAll(async () => {
    await t?.close()
  })

  it('the flag reads true/1 as on and anything else, unset included, as off', () => {
    expect([true, 'true', 'TRUE', ' 1 '].map(intakeTeacherEnabled)).toEqual([true, true, true, true])
    expect([undefined, null, '', 'false', '0', 'yes', false].map(intakeTeacherEnabled)).toEqual([false, false, false, false, false, false, false])
  })

  it('a teacher gets 403 FORBIDDEN on every intake files and workflow route', async () => {
    for (const [method, raw] of ROUTES) {
      const path = raw.replace('{batch}', batch).replace('{file}', file)
      expectError(await send(teacher, method, path), 'FORBIDDEN')
    }
  })

  it('a refused teacher upload or create writes nothing', async () => {
    const before = await t.db.query<{ n: number }>(`select count(*)::int as n from intake_batches`)
    expectError(await uploadFiles(teacher, batch, [{ bytes: textPdf(1) }]), 'FORBIDDEN')
    expectError(await teacher.agent.post('/api/intake/batches').set('X-CSRF-Token', teacher.csrf).send({ declaration: true }), 'FORBIDDEN')
    expect(await t.db.query<{ n: number }>(`select count(*)::int as n from intake_batches`)).toEqual(before)
  })

  it('Admin Pusat keeps every route', async () => {
    expect((await admin.agent.get('/api/intake/batches')).status).toBe(200)
    expect((await admin.agent.get(`/api/intake/batches/${batch}`)).status).toBe(200)
    expect((await admin.agent.get(`/api/intake/batches/${batch}/review`)).status).toBe(200)
    expect((await admin.agent.get('/api/intake/items')).status).toBe(200)
    await createBatch(admin)
  })
})

describe('AZ-35: INTAKE_TEACHER_ENABLED=true re-opens intake to the teacher', () => {
  let t: WorkflowTestApp
  beforeAll(async () => {
    t = await bootWorkflowApp({ INTAKE_TEACHER_ENABLED: 'true' })
  }, 120_000)
  afterAll(async () => {
    await t?.close()
  })

  it('a teacher creates and lists an own batch', async () => {
    const teacher = await loginAs(t, 'guru@demo.test')
    const created = await createBatch(teacher)
    const list = await teacher.agent.get('/api/intake/batches')
    expect(list.status).toBe(200)
    expect(JSON.stringify(list.body)).toContain(created.id)
  })
})
