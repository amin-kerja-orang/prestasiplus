import { KirkpatrickOverviewSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { treatDemoAsSecondary } from '../support/secondary'
import {
  ADMIN,
  SCHOOL_ADMIN_A,
  TEACHER_A,
  type Client,
  type KirkpatrickTestApp,
  bootKirkpatrickApp,
  buildWorld,
  client,
} from './helpers'

const NO_DATA = 'Data tidak mencukupi untuk perbandingan.'

describe('Overview comparison: no data is not a decline (FR-X4-3)', () => {
  let t: KirkpatrickTestApp
  let admin: Client
  let teacherA: Client
  let adminA: Client

  beforeAll(async () => {
    t = await bootKirkpatrickApp()
    await treatDemoAsSecondary(t.db, false)
    await buildWorld(t)
    // Move every answer of October back by 60 days: the first month with an answer is July, the current month (October) is empty.
    await t.db.query(`update practice_sessions set started_at = started_at - interval '60 days', completed_at = completed_at - interval '60 days' where completed_at >= '2026-10-01'`)
    await t.db.query(`update practice_answers set answered_at = answered_at - interval '60 days' where answered_at >= '2026-10-01'`)
    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    adminA = await client(t, SCHOOL_ADMIN_A)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('an empty "after" panel gives delta null and the single no-data sentence, never Penurunan', async () => {
    for (const who of [admin, teacherA, adminA]) {
      const data = envelopeOf(KirkpatrickOverviewSchema).parse((await who.get('/kirkpatrick/overview')).body).data
      expect(data.comparison.after?.answers ?? 0).toBe(0)
      expect(data.comparison.delta).toBeNull()
      expect(data.comparison.sentences).toEqual([NO_DATA])
      expect(data.comparison.sentences.join(' ')).not.toMatch(/Penurunan|Peningkatan|kurang aktif/)
    }
  })
})
