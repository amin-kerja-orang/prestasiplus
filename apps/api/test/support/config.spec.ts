import { ContentSupportConfigSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootPartC, expectError, type PartCApp } from '../content/audio-helpers'

describe('GET /api/config/support (public)', () => {
  let t: PartCApp

  beforeAll(async () => {
    t = await bootPartC()
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers without a session with the e-mail and WhatsApp number of the singleton row', async () => {
    const res = await t.http().get('/api/config/support')
    expect(res.status).toBe(200)
    expect(ContentSupportConfigSchema.parse(res.body.data)).toEqual({ email: 'sokongan@demo.test', whatsappNumber: '60100000000' })
    expect(Object.keys(res.body as object)).toEqual(['data'])
  })

  it('reads the row live: a change in support_config shows at once', async () => {
    await t.db.query(`update support_config set whatsapp_number = '60123456789' where id = 1`)
    const res = await t.http().get('/api/config/support')
    expect(res.body.data).toEqual({ email: 'sokongan@demo.test', whatsappNumber: '60123456789' })
  })

  it('the singleton cannot be duplicated (id = 1 check)', async () => {
    await expect(t.db.query(`insert into support_config (id, email, whatsapp_number) values (2, 'a@b.test', '1')`)).rejects.toThrow()
  })

  it('a missing row is 404 "Konfigurasi sokongan tidak dijumpai."', async () => {
    await t.db.query(`delete from support_config`)
    expectError(await t.http().get('/api/config/support'), 'NOT_FOUND', 'Konfigurasi sokongan tidak dijumpai.')
  })

  it('is limited per client address: the 3rd request in a minute is 429', async () => {
    const limited = await bootPartC({ THROTTLE_SUPPORT_CONFIG_PER_MINUTE: '2' })
    try {
      expect((await limited.http().get('/api/config/support')).status).toBe(200)
      expect((await limited.http().get('/api/config/support')).status).toBe(200)
      expectError(await limited.http().get('/api/config/support'), 'RATE_LIMITED', 'Too Many Attempts.')
    } finally {
      await limited.close()
    }
  })
})
