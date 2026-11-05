import { INTAKE_BATCH_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootIntakeApp, createBatch, DECLARATION, getBatch, type IntakeTestApp, levelId, loginAs, type LoggedIn } from '../helpers'

/** S1-T03 (DM-09, DM-85, D2, D10, D11): the declared header of a batch: level, paper code, exam board, Set and year. */
let t: IntakeTestApp
let teacher: LoggedIn
let admin: LoggedIn

beforeAll(async () => {
  t = await bootIntakeApp()
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
})
afterAll(async () => {
  await t.close()
})

const create = (who: LoggedIn, over: Record<string, unknown>) => who.agent.post('/api/intake/batches').set('X-CSRF-Token', who.csrf).send({ ...DECLARATION, ...over })
const thisYear = new Date().getFullYear()

describe('the batch header is stored and echoed', () => {
  it('stores the level, paper code, exam board and Set and returns them in the summary and on read', async () => {
    const level = await levelId('T5')
    const res = await create(admin, { kertas: 2, year: 2024, educationLevelId: level, paperCode: '1449/2', examBoard: 'SPM (LP)', setLabel: 'Set 1' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data).toMatchObject({ educationLevelId: level, paperCode: '1449/2', examBoard: 'SPM (LP)', setLabel: 'Set 1', kertas: 2, year: 2024 })
    const rows = await t.db.query<{ l: string; c: string; b: string; s: string }>(`select education_level_id::text l, paper_code c, exam_board b, set_label s from intake_batches where id = $1`, [res.body.data.id])
    expect(rows[0]).toEqual({ l: level, c: '1449/2', b: 'SPM (LP)', s: 'Set 1' })
    const read = await getBatch(admin, res.body.data.id)
    expect(read).toMatchObject({ educationLevelId: level, paperCode: '1449/2', examBoard: 'SPM (LP)', setLabel: 'Set 1' })
  })

  it('a blank paper code, exam board and Set are stored as null (D10a)', async () => {
    const res = await create(admin, { educationLevelId: await levelId('T4'), paperCode: '  ', examBoard: '', setLabel: '' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data).toMatchObject({ paperCode: null, examBoard: null, setLabel: null })
    const rows = await t.db.query<{ c: string | null; b: string | null; s: string | null }>(`select paper_code c, exam_board b, set_label s from intake_batches where id = $1`, [res.body.data.id])
    expect(rows[0]).toEqual({ c: null, b: null, s: null })
  })

  it('a batch that leaves the optional fields out echoes null for them', async () => {
    const batch = await createBatch(teacher)
    expect(batch).toMatchObject({ educationLevelId: null, paperCode: null, examBoard: null, setLabel: null })
  })
})

describe('paper code (D10)', () => {
  it('refuses a code that is not NNNN/N with the U-09 copy', async () => {
    const res = await create(admin, { educationLevelId: await levelId(), paperCode: '1449' })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.paperCode).toBe(INTAKE_BATCH_MESSAGES.paperCodeInvalid)
  })

  it('D10b: refuses a code whose trailing digit differs from the Kertas, with the ruled copy', async () => {
    const res = await create(admin, { kertas: 3, educationLevelId: await levelId(), paperCode: '1449/2' })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.paperCode).toBe('Kod kertas tidak sepadan dengan Kertas 3.')
    expect((await t.db.query(`select 1 from intake_batches where paper_code = '1449/2' and kertas = 3`)).length).toBe(0)
  })

  it('accepts the matching digit for Kertas 1 to 4', async () => {
    for (const k of [1, 2, 3, 4] as const) {
      const res = await create(admin, { kertas: k, educationLevelId: await levelId(), paperCode: `1449/${String(k)}` })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    }
  })
})

describe('level (DM-09) and the Set', () => {
  it('an Admin Pusat batch must name a level; a Guru batch may leave it out', async () => {
    const res = await create(admin, {})
    expect(res.status).toBe(422)
    expect(res.body.error.fields.educationLevelId).toBe(INTAKE_BATCH_MESSAGES.levelRequired)
    expect((await create(teacher, {})).status).toBe(201)
  })

  it('refuses an unknown level id for both', async () => {
    for (const who of [admin, teacher]) {
      const res = await create(who, { educationLevelId: '999999' })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.educationLevelId).toBe(INTAKE_BATCH_MESSAGES.levelRequired)
    }
  })

  it('refuses a Set over 20 characters with the U-08 copy', async () => {
    const res = await create(admin, { educationLevelId: await levelId(), setLabel: 'x'.repeat(21) })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.setLabel).toBe('Set tidak boleh melebihi 20 aksara.')
  })
})

describe('year range of an Admin Pusat batch (D11)', () => {
  it.each([2014, thisYear + 1])('refuses the year %i', async (year) => {
    const res = await create(admin, { year, educationLevelId: await levelId() })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.year).toBe(INTAKE_BATCH_MESSAGES.yearRequired)
  })

  it.each([2015, thisYear])('accepts the year %i', async (year) => {
    expect((await create(admin, { year, educationLevelId: await levelId() })).status).toBe(201)
  })

  it('a Guru batch keeps the wider contract range', async () => {
    expect((await create(teacher, { year: 2010 })).status).toBe(201)
  })
})
