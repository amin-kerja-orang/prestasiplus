import { SUPPORT_SETTINGS_MESSAGES, SupportSettingsSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootPartC, expectError, fieldsOf, jsonOf, loginPartC, type LoggedIn, type PartCApp } from '../content/audio-helpers'

describe('support contact settings (API-ADM-10, FR-ADM-N07)', () => {
  let t: PartCApp
  let admin: LoggedIn
  let student: LoggedIn
  let teacher: LoggedIn

  beforeAll(async () => {
    t = await bootPartC()
    admin = await loginPartC(t, 'admin@demo.test')
    student = await loginPartC(t, 'pelajar@demo.test')
    teacher = await loginPartC(t, 'guru@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const put = (who: LoggedIn, body: object) => who.agent.put('/api/admin/settings/support').set('X-CSRF-Token', who.csrf).send(body)
  const audits = () => t.db.query<{ detail: unknown }>(`select detail from audit_events where action = 'support.config.updated' order by id`)
  const row = async () => (await t.db.query<{ email: string; whatsapp_number: string }>(`select email, whatsapp_number from support_config where id = 1`))[0]

  it('GET gives the saved values with phone and hours empty; PUT and GET are admin only', async () => {
    const res = await jsonOf(admin).get('/admin/settings/support')
    expect(res.status).toBe(200)
    expect(SupportSettingsSchema.parse(res.body.data)).toEqual({ email: 'sokongan@demo.test', phone: '', whatsapp: '60100000000', hours: '' })
    expectError(await t.http().get('/api/admin/settings/support'), 'UNAUTHORIZED')
    for (const who of [student, teacher]) {
      expectError(await jsonOf(who).get('/admin/settings/support'), 'FORBIDDEN')
      expectError(await put(who, { email: 'a@demo.test' }), 'FORBIDDEN')
    }
    expectError(await admin.agent.put('/api/admin/settings/support').send({ email: 'a@demo.test' }), 'CSRF_INVALID')
  })

  it('AC-ADM-N07.2 an invalid value shows its message and nothing is saved', async () => {
    const before = await row()
    const auditsBefore = (await audits()).length
    const bad = await put(admin, { email: 'bukan-emel', whatsapp: '123' })
    expectError(bad, 'VALIDATION_ERROR')
    expect(fieldsOf(bad)).toEqual({ email: SUPPORT_SETTINGS_MESSAGES.emailInvalid, whatsapp: SUPPORT_SETTINGS_MESSAGES.phoneInvalid })
    expect(await row()).toEqual(before)
    expect(await audits()).toHaveLength(auditsBefore)
  })

  it('phone and hours are refused by name until they have a store', async () => {
    const res = await put(admin, { phone: '60100000000', hours: 'Isnin' })
    expectError(res, 'VALIDATION_ERROR')
    expect(fieldsOf(res)).toHaveProperty('phone')
    expect(fieldsOf(res)).toHaveProperty('hours')
  })

  it('a save is audited by field name, an omitted field stays, no change writes nothing, public config follows', async () => {
    const res = await put(admin, { email: 'bantuan@demo.test' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ email: 'bantuan@demo.test', phone: '', whatsapp: '60100000000', hours: '' })
    const after = await audits()
    expect(after.at(-1)?.detail).toMatchObject({ changed: ['email'] })
    expect(JSON.stringify(after.at(-1)?.detail)).not.toContain('bantuan@demo.test')
    expect((await put(admin, { email: 'bantuan@demo.test' })).status).toBe(200)
    expect(await audits()).toHaveLength(after.length)
    expect((await t.http().get('/api/config/support')).body.data).toMatchObject({ email: 'bantuan@demo.test' })
  })

  it('null clears a field, and a missing row is created on the first save', async () => {
    expect((await put(admin, { whatsapp: null })).body.data).toMatchObject({ whatsapp: '' })
    await t.db.query(`delete from support_config`)
    expect((await jsonOf(admin).get('/admin/settings/support')).body.data).toEqual({ email: '', phone: '', whatsapp: '', hours: '' })
    expect((await put(admin, { whatsapp: '+60123456789' })).body.data).toEqual({ email: '', phone: '', whatsapp: '+60123456789', hours: '' })
    expect(await row()).toEqual({ email: '', whatsapp_number: '+60123456789' })
  })
})
