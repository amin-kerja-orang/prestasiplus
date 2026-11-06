import { INTAKE_FILE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IntakeExtractionInput } from '../../../src/modules/intake/files/intake-extraction-input'
import { textPdf } from '../pdf-fixtures'
import { bootIntakeApp, createBatch, expectFilesError, getBatch, type IntakeTestApp, loginAs, type LoggedIn, uploadFiles, uploadOk } from '../helpers'

/** S1-T03 (kertas range): Kertas 1..4 on a batch (DM-08) and the 30 MB default intake file limit. */
let t: IntakeTestApp
let teacher: LoggedIn
let admin: LoggedIn

beforeAll(async () => {
  t = await bootIntakeApp()
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test') // Admin Pusat is exempt from the daily page quota
})
afterAll(async () => {
  await t.close()
})

const create = (kertas: number) =>
  teacher.agent
    .post('/api/intake/batches')
    .set('X-CSRF-Token', teacher.csrf)
    .send({ paperType: 'trial', subject: 'MAT', kertas, year: 2025, source: 'x', copyright: 'sendiri', declaration: true })

describe('batch kertas 1..4', () => {
  it.each([3, 4])('creates a batch with kertas %i, stores it and reads it back unchanged', async (kertas) => {
    const batch = await createBatch(teacher, { kertas: kertas as 3 | 4 })
    expect(batch.kertas).toBe(kertas)
    expect((await getBatch(teacher, batch.id)).kertas).toBe(kertas)
    const rows = await t.db.query<{ kertas: number }>(`select kertas from intake_batches where id = $1`, [batch.id])
    expect(rows[0]?.kertas).toBe(kertas)
  })

  it.each([0, 5])('refuses kertas %i with 422', async (kertas) => {
    const res = await create(kertas)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })

  it.each([3, 4])('the AI extraction input keeps kertas %i (no fold to 1)', async (kertas) => {
    const batch = await createBatch(teacher, { kertas: kertas as 3 | 4 })
    const req = await t.app.get(IntakeExtractionInput).build(batch.id)
    expect(req.kertas).toBe(kertas)
  })
})

describe('intake file limit defaults to 30 MB', () => {
  const padded = (mb: number) => Buffer.concat([textPdf(1), Buffer.alloc(mb * 1024 * 1024, 0x20)])

  it('accepts a 25 MB PDF', async () => {
    const batch = await createBatch(admin)
    await uploadOk(admin, batch.id, [{ bytes: padded(25) }])
  })

  it('refuses a 31 MB PDF with the size message for 30', async () => {
    const batch = await createBatch(admin)
    expectFilesError(await uploadFiles(admin, batch.id, [{ bytes: padded(31) }]), INTAKE_FILE_MESSAGES.size(30))
  })
})
