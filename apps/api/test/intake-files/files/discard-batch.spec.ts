import type { RoleGrant } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthContext } from '../../../src/common/scope/auth-context'
import { IntakeUploadService } from '../../../src/modules/intake/files/intake-upload.service'
import { textPdf } from '../pdf-fixtures'
import { bootIntakeApp, countRows, createBatch, type IntakeTestApp, loginAs, type LoggedIn, uploadOk } from '../helpers'

let t: IntakeTestApp
let admin: LoggedIn
let auth: AuthContext

beforeAll(async () => {
  t = await bootIntakeApp()
  admin = await loginAs(t, 'admin@demo.test')
  const id = String((await t.db.query<{ id: string }>(`select id::text id from users where email = 'admin@demo.test'`))[0]!.id)
  auth = {
    sessionRowId: '0',
    userId: id,
    roles: [] as RoleGrant[],
    active: { role: 'admin', scope: { level: 'national' } },
    mode: null,
    capabilities: [],
    mustChangePassword: false,
  } as unknown as AuthContext
}, 120_000)
afterAll(async () => {
  await t.close()
})

const who = { ip: null, requestId: null }

describe('IntakeUploadService.discardBatch', () => {
  it('cancels the batch and removes its file rows, pages and stored objects', async () => {
    const files = await countRows(t.db, 'files')
    const b = await createBatch(admin)
    await uploadOk(admin, b.id, [{ bytes: textPdf(2, 301) }, { bytes: textPdf(1, 302) }])
    expect(await countRows(t.db, 'files')).toBe(files + 2)
    await t.app.get(IntakeUploadService).discardBatch(auth, b.id, who)
    expect(await countRows(t.db, 'files')).toBe(files)
    expect(await t.db.query(`select 1 from intake_files where batch_id = $1`, [b.id])).toHaveLength(0)
    expect((await t.db.query<{ status: string }>(`select status from intake_batches where id = $1`, [b.id]))[0]!.status).toBe('cancelled')
  })

  it('is a no-op for an empty or unknown batch and never throws', async () => {
    const svc = t.app.get(IntakeUploadService)
    const b = await createBatch(admin)
    await expect(svc.discardBatch(auth, b.id, who)).resolves.toBeUndefined()
    await expect(svc.discardBatch(auth, b.id, who)).resolves.toBeUndefined() // already cancelled
    await expect(svc.discardBatch(auth, '999999999', who)).resolves.toBeUndefined()
    await expect(svc.discardBatch(auth, 'abc', who)).resolves.toBeUndefined()
  })
})
