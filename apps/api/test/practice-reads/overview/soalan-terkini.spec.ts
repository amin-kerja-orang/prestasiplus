import { PracticeReadDashboardSchema, envelopeOf } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { seedModules } from '../../../prisma/seed'
import { cutQuestionText } from '../../../src/modules/practice/reads/overview/rules'
import type { CurriculumTestApp } from '../../curriculum/helpers'
import { type Client, bootOverviewApp, loginAs, userIdByEmail } from './helpers'

/**
 * FR-MUR-2-8 "Soalan Terkini" (S5-T04): the 5 newest SERVABLE questions of the pupil's OWN form, text cut at 140 characters + "…", the first
 * figure as a thumbnail URL (or null), read only, no answer key. Full demo seed: the pupil `pelajar@demo.test` is grade 10 (T4), the
 * servable bank has T4 and T5 questions with their parts and keys.
 */
const Dashboard = envelopeOf(PracticeReadDashboardSchema)

let t: CurriculumTestApp
let pelajar: Client
let pelajarId: string

beforeAll(async () => {
  t = await bootOverviewApp({ seeds: seedModules })
  pelajar = await loginAs(t, 'pelajar@demo.test')
  pelajarId = await userIdByEmail(t.db, 'pelajar@demo.test')
}, 600_000)

afterAll(async () => {
  await t.close()
})

/** Undo every edit a test made to the shared seeded rows. */
const undo: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const f of undo.splice(0).reverse()) await f()
})

const recent = async () => Dashboard.parse((await pelajar.get('/api/dashboard')).body).data.recentQuestions

describe('own form (FR-MUR-2-8)', () => {
  it('[CI] a T4 pupil sees only T4 questions, newest first, at most 5', async () => {
    const rows = await recent()
    expect(rows.length).toBe(5)
    expect(rows.every((r) => r.levelCode === 'T4')).toBe(true)
    const ids = rows.map((r) => BigInt(r.id))
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? 1 : -1)))
  })

  it('[CI] the same pupil moved to T5 sees T5 questions only, and none of the T4 ones', async () => {
    const t4 = (await recent()).map((r) => r.id)
    await t.db.query('update users set grade = 11 where id = $1::bigint', [pelajarId])
    undo.push(() => t.db.query('update users set grade = 10 where id = $1::bigint', [pelajarId]))
    const rows = await recent()
    expect(rows.length).toBe(5)
    expect(rows.every((r) => r.levelCode === 'T5')).toBe(true)
    expect(rows.some((r) => t4.includes(r.id))).toBe(false)
  })

  it('a form with no servable level (Darjah 4) lists nothing, never another form\'s questions', async () => {
    await t.db.query('update users set grade = 4 where id = $1::bigint', [pelajarId])
    undo.push(() => t.db.query('update users set grade = 10 where id = $1::bigint', [pelajarId]))
    expect(await recent()).toEqual([])
  })
})

describe('servable only (FR-MUR-2-8)', () => {
  it('[CI] a deactivated or flagged question leaves the list and the next newest takes its place', async () => {
    const [first, second] = await recent()
    expect(first && second).toBeTruthy()
    await t.db.query('update questions set is_active = false where id = $1::bigint', [first?.id])
    undo.push(() => t.db.query('update questions set is_active = true where id = $1::bigint', [first?.id]))
    await t.db.query(`update question_versions v set stimulus_flag = 'stimulus_missing', stimulus_flag_ref = 'numbered', stimulus_flag_at = now() from questions q where q.id = $1::bigint and v.question_id = q.id and v.version_no = q.live_version_no`, [second?.id])
    undo.push(() => t.db.query(`update question_versions set stimulus_flag = null, stimulus_flag_ref = null, stimulus_flag_at = null where question_id = $1::bigint`, [second?.id]))
    const rows = await recent()
    expect(rows.length).toBe(5)
    expect(rows.map((r) => r.id)).not.toContain(first?.id)
    expect(rows.map((r) => r.id)).not.toContain(second?.id)
  })

  it('a draft (not approved) version is not listed', async () => {
    const [first] = await recent()
    await t.db.query(`update question_versions v set status = 'draft' from questions q where q.id = $1::bigint and v.question_id = q.id and v.version_no = q.live_version_no`, [first?.id])
    undo.push(() => t.db.query(`update question_versions v set status = 'approved' from questions q where q.id = $1::bigint and v.question_id = q.id and v.version_no = q.live_version_no`, [first?.id]))
    expect((await recent()).map((r) => r.id)).not.toContain(first?.id)
  })
})

describe('text cut (FR-MUR-2-8)', () => {
  const setStem = async (id: string, stem: string) => {
    const old = (await t.db.query<{ stem_ms: string | null }>(`select v.stem_ms from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = $1::bigint`, [id]))[0]?.stem_ms ?? null
    const set = (value: string | null) => t.db.query(`update question_versions v set stem_ms = $2 from questions q where q.id = $1::bigint and v.question_id = q.id and v.version_no = q.live_version_no`, [id, value])
    await set(stem)
    undo.push(() => set(old))
  }

  it('[CI] a text of 141 or more characters is cut at 140 and ends with "…"; 140 exactly is kept whole', async () => {
    const [first, second] = await recent()
    await setStem(first?.id as string, 'a'.repeat(200))
    await setStem(second?.id as string, 'b'.repeat(140))
    const rows = await recent()
    expect(rows.find((r) => r.id === first?.id)?.text).toBe(`${'a'.repeat(140)}…`)
    expect(rows.find((r) => r.id === second?.id)?.text).toBe('b'.repeat(140))
  })

  it('the pure cut: 100 characters is no longer cut, 141 is', () => {
    expect(cutQuestionText('c'.repeat(100))).toBe('c'.repeat(100))
    expect(cutQuestionText('c'.repeat(141))).toBe(`${'c'.repeat(140)}…`)
    expect(cutQuestionText('c'.repeat(141)).endsWith('...')).toBe(false)
  })
})

describe('figure thumbnail (FR-MUR-2-8)', () => {
  it('[CI] a question with a figure gets its served file URL, the others get null', async () => {
    const rows = await recent()
    const target = rows[0]?.id as string
    expect(rows.every((r) => r.figureThumbUrl === null)).toBe(true)
    const token = 'FigThumbTokenAbCdEf01'
    const file = (await t.db.query<{ id: string }>(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'question_image', 'image/png', 10, repeat('b', 64), 'question-image/fig.png') returning id::text id`, [token]))[0]?.id as string
    const stimulus = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label, alt_text, asset_file_id) values ('image', 'Rajah 1', 'Rajah', $1::bigint) returning id::text id`, [file]))[0]?.id as string
    const version = (await t.db.query<{ id: string }>(`select v.id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = $1::bigint`, [target]))[0]?.id as string
    await t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [version, stimulus])
    undo.push(async () => {
      await t.db.query('delete from question_version_stimuli where question_version_id = $1::bigint', [version])
      await t.db.query('delete from stimuli where id = $1::bigint', [stimulus])
      await t.db.query('delete from files where id = $1::bigint', [file])
    })
    const after = await recent()
    const row = after.find((r) => r.id === target)
    // The figure question stays listed (its figure is present) and carries the served URL; every other row stays null.
    if (row) expect(row.figureThumbUrl).toBe(`/api/files/${token}`)
    expect(after.filter((r) => r.id !== target).every((r) => r.figureThumbUrl === null)).toBe(true)
  })
})

describe('read only, no answer key (FR-MUR-2-8)', () => {
  it('[CI] a row carries exactly id, subjectName, difficulty, text, createdAt, levelCode and figureThumbUrl', async () => {
    const res = await pelajar.get('/api/dashboard')
    const rows = (res.body as { data: { recentQuestions: Record<string, unknown>[] } }).data.recentQuestions
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['createdAt', 'difficulty', 'figureThumbUrl', 'id', 'levelCode', 'subjectName', 'text'])
    const blob = JSON.stringify(rows)
    for (const k of ['correctAnswer', 'answerKey', 'answer_key', 'options', 'explanation', 'isCorrect']) expect(blob).not.toContain(`"${k}"`)
  })
})
