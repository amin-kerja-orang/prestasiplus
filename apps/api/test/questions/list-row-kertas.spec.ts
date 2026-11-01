import { QuestionRowSchema, QuestionSchema, listEnvelopeOf, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/** REQ-C-010: `GET /api/questions` rows carry `kertas` and `numberLabel` (V2 Studio columns "Kertas" and "No."). */
describe('admin question list rows: kertas and numberLabel', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const make = async (over: Record<string, unknown>): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  const rows = async () => listEnvelopeOf(QuestionRowSchema).parse((await admin.get('/api/questions?pageSize=100')).body).data

  it('a question with a kertas and a number label shows both; one without shows null', async () => {
    const withBoth = await make({ kertas: '2', questionText: 'Soalan kertas dua dengan nombor label.' })
    await t.db.query(`update question_versions set number_label = '12(a)' where question_id = $1`, [withBoth])
    const bare = await make({ questionText: 'Soalan tanpa kertas dan tanpa nombor.' })
    const list = await rows()
    expect(list.find((r) => r.id === withBoth)).toMatchObject({ kertas: '2', numberLabel: '12(a)' })
    expect(list.find((r) => r.id === bare)).toMatchObject({ kertas: null, numberLabel: null })
  })

  it('the kertas follows the trailing digit of the paper code: 1, 2, 3; another digit or none is null', async () => {
    for (const [code, kertas] of [['MATH/1', '1'], ['1449/2', '2'], ['SEJ/3', '3'], ['1449/4', null], ['SPM2023', null]] as const) {
      const id = await make({ questionText: `Soalan untuk kod kertas ${code} dalam ujian.` })
      await t.db.query(`update question_versions set paper_code = $2 where question_id = $1`, [id, code])
      expect((await rows()).find((r) => r.id === id)?.kertas, code).toBe(kertas)
    }
  })
})
