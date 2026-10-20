import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import { STUDENT, TEACHER, bootSponsorshipApp, client, validBody, type SponsorshipTestApp } from './helpers'

describe('privacy canary (SEC-M21-07): no e-mail, category, income or reason in any log line', () => {
  const CANARY_REASON = 'KANARI-SEBAB-ZXQ keluarga tidak berkemampuan'
  const CANARY_EMAIL = 'kanari.rahsia.wvu@example.test'
  let t: SponsorshipTestApp
  const logs = new LogCapture()

  beforeAll(async () => {
    t = await bootSponsorshipApp({ logStream: logs, env: { LOG_LEVEL: 'debug' } })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('a success, a 422, an unknown e-mail, a malformed body and a database failure write none of them to the log', async () => {
    const who = await client(t, STUDENT)
    expect((await who.post(validBody({ reason: CANARY_REASON, studentCategory: 'Yatim', familyIncomeRange: '< RM1,000' }))).status).toBe(201)
    expect((await who.post(validBody({ reason: CANARY_REASON, studentCategory: 'KANARI-KATEGORI' }))).status).toBe(422)
    expect((await who.post(validBody({ studentEmail: CANARY_EMAIL, reason: CANARY_REASON }))).status).toBe(422)
    expect((await who.post(validBody({ studentEmail: 'KANARI-EMEL-TIDAK-SAH', familyIncomeRange: 'KANARI-INCOME' }))).status).toBe(422)

    // A failed insert: a role value longer than nothing is fine, so force the failure by dropping the table's CHECK-free path:
    // an application whose student row disappears between the lookup and the insert violates the foreign key.
    const teacher = await client(t, TEACHER)
    await t.db.query(`alter table foster_applications rename to foster_applications_gone`)
    const failed = await teacher.post(validBody({ reason: CANARY_REASON, studentCategory: 'OKU' }))
    await t.db.query(`alter table foster_applications_gone rename to foster_applications`)
    expect(failed.status).toBe(500)
    expect(JSON.stringify(failed.body)).not.toContain('KANARI')

    const log = logs.lines.join('\n')
    expect(log.length).toBeGreaterThan(0)
    expect(log).toContain('/api/mohon-keluarga-angkat')
    for (const secret of [CANARY_REASON, 'KANARI', CANARY_EMAIL, 'kanari.rahsia', STUDENT, 'Yatim', 'RM1,000', 'keluarga tidak berkemampuan']) {
      expect(log, secret).not.toContain(secret)
    }
  })
})
