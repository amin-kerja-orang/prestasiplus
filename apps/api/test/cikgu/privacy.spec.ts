import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import { TEACHER_A, bootCikguApp, client, handoff, type CikguTestApp } from './helpers'

describe('privacy canary (AC14): no essay, name, message or reply in any log line', () => {
  const CANARY_ESSAY = 'KANARI-KARANGAN-ZXQ Pada suatu hari yang cerah kami berjalan ke kebun.'
  const CANARY_NAME = 'Murid Kanari Rahsia'
  const CANARY_CHAT = 'KANARI-MESEJ-WVU terangkan konsep mol'
  let t: CikguTestApp
  const logs = new LogCapture()

  beforeAll(async () => {
    t = await bootCikguApp({ logStream: logs, env: { LOG_LEVEL: 'debug' } })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('a hand-off turn, a chat turn, a failed turn, a listing and an export write no content to the log', async () => {
    const teacher = await client(t, TEACHER_A)
    const mark = await teacher.post('/cikgu/send', { message: handoff({ rubric: 'general', subject: 'Bahasa Melayu', level: 'T3', student: CANARY_NAME, title: 'Kebun', essay: CANARY_ESSAY }) })
    expect(mark.status).toBe(200)
    const chat = await teacher.post('/cikgu/send', { message: CANARY_CHAT })
    expect(chat.status).toBe(200)
    expect((await teacher.post('/cikgu/send', { message: '' })).status).toBe(422)
    expect((await teacher.post('/cikgu/send', { message: CANARY_CHAT.repeat(200) })).status).toBe(422)
    const essays = await teacher.get('/cikgu/essays')
    expect(essays.status).toBe(200)
    expect((await teacher.get(`/cikgu/essays/${essays.body.data[0].id as string}`)).body.data.studentName).toBe(CANARY_NAME)
    expect((await teacher.get('/cikgu/pbd/export.csv')).status).toBe(200)
    // The turn's own text is the example of a request that would be logged by accident: look at everything written.
    const log = logs.lines.join('\n')
    expect(log.length).toBeGreaterThan(0)
    expect(log).toContain('/api/cikgu/send')
    for (const secret of [CANARY_ESSAY, 'KANARI-KARANGAN', CANARY_NAME, 'Kanari Rahsia', CANARY_CHAT, 'KANARI-MESEJ', 'Soalan yang baik', 'Markah: 70/100']) {
      expect(log, secret).not.toContain(secret)
    }
  })
})
