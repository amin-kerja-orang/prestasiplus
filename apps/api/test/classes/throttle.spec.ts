import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { TEACHER_A, bootClassesApp, client, createClass, type ClassesTestApp, type Client } from './helpers'

describe('class route throttles (D57, 429)', () => {
  let t: ClassesTestApp
  let teacher: Client

  beforeAll(async () => {
    t = await bootClassesApp({
      env: { THROTTLE_CLASSES_READ_PER_MINUTE: '3', THROTTLE_CLASSES_WRITE_PER_MINUTE: '2', THROTTLE_CLASS_JOIN_PER_MINUTE: '3' },
    })
    teacher = await client(t, TEACHER_A)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('writes are limited per user', async () => {
    await createClass(t, teacher, { name: 'Satu' })
    await createClass(t, teacher, { name: 'Dua' })
    const res = await teacher.post('/guru/classes', { name: 'Tiga' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
  })

  it('reads are limited per user', async () => {
    t.clock.advance(61_000)
    for (let i = 0; i < 3; i++) expect((await teacher.get('/guru/classes')).status).toBe(200)
    expect((await teacher.get('/guru/classes')).status).toBe(429)
  })
})
