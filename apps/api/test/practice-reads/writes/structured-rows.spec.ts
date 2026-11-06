/**
 * S5-T11 part 4b: the per-leaf `practice_answers` rows (A5), the reward (A9), the emit at submit (audit and aggregate) and the teacher
 * "Digunakan" count of a Soalan Berstruktur attempt. The attempt itself (A3, A4) is `structured.spec.ts`.
 */
import { BijakAttemptResultViewSchema, PracticeReadStructuredAttemptResultSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../../../src/db/prisma.service'
import { WalletService } from '../../../src/modules/wallet'
import { usedCountQuery } from '../../../src/modules/classes/question-bridge/teacher-question-stats.provider'
import { type Client, type WritesTestApp, bootWritesApp, leaf, loginAs, loginModPelajar, publishStructured } from './helpers'

const Attempt = envelopeOf(PracticeReadStructuredAttemptResultSchema)
/** A leaf the grader never marks (a points scheme): the pupil marks it herself, also when she left it blank. */
const working = (label: string, marks: number) =>
  ({ label, prompt: { ms: `Bahagian ${label}` }, mode: 'working', marks, cognitiveLevel: 'mengaplikasi', key: { kind: 'points', marks, points: [{ id: 'p', code: 'M', label: 'Kaedah', marks }] } }) as never
/** An answer the grader cannot tell from a wrong one: the part waits for the pupil's own mark. */
const UNSURE = 'jawapan yang salah sekali'

let t: WritesTestApp
let n = 0

beforeAll(async () => {
  t = await bootWritesApp()
}, 120_000)

afterAll(async () => {
  await t.close()
})

const setRate = (rate: number) => t.db.query('update reward_settings set coins_per_correct = $1', [rate])
const balance = async (userId: string) => Number((await t.db.query('select current_syiling from wallets where user_id = $1', [userId]))[0]?.current_syiling ?? 0)
const xpOf = async (userId: string) => Number((await t.db.query('select xp from wallets where user_id = $1', [userId]))[0]?.xp ?? 0)
const ledger = (userId: string) =>
  t.db.query<{ source_id: string; amount: number; is_test: boolean }>(`select source_id, amount, is_test from coin_ledger where user_id = $1 and source = 'quiz_spm' order by id`, [userId])

/** A set with one 4-mark leaf `(a).(i)` (a set needs a nested part to be a structured set), or the given parts. */
const publish = (parts?: Parameters<typeof publishStructured>[2]['parts']) =>
  publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: `Set baris ${String(++n)}`, parts: parts ?? ([{ label: '(a)', prompt: { ms: 'Bahagian' }, children: [leaf('(i)', 4)] }] as never) })

const submit = async (c: Client, id: string, answers: Record<string, string>, extra: Record<string, unknown> = {}) => {
  const res = await c.post(`/api/practice/structured/${id}/attempts`, {
    answers: Object.entries(answers).map(([label, text]) => ({ subQuestionId: `${id}-${label}`, text })),
    ...extra,
  })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return Attempt.parse(res.body).data
}
const partsOf = async (c: Client, attemptId: string) => {
  const res = await c.get(`/api/bijak/attempts/${attemptId}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data).result.questions[0]?.parts ?? []
}
const selfMark = async (c: Client, attemptId: string, mark: number, index = 0) => {
  const partId = (await partsOf(c, attemptId))[index]?.partId as string
  const res = await c.post(`/api/bijak/attempts/${attemptId}/self-mark`, { partId, mark })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}
const rowsOf = (attemptId: string) =>
  t.db.query<{ id: string; user_id: string; question_id: string; part_ref: string | null; mode: string; is_correct: boolean; marks_awarded: number | null; marks_max: number; is_test: boolean; attempt_id: string }>(
    `select id::text, user_id::text, question_id::text, part_ref, mode, is_correct, marks_awarded::float8, marks_max::float8, is_test, attempt_id::text from practice_answers where attempt_id = $1 order by part_ref`,
    [attemptId],
  )

describe('A5 one practice_answers row per leaf', () => {
  it('AC-MUR-17-5: a submit writes one row per leaf with mode structured (never spm_mock or spm_ramalan), marks null while a part waits for the pupil', async () => {
    const id = await publish([leaf('(a)', 2), leaf('(b)', 3)])
    const c = await loginAs(t, 'student')
    const out = await submit(c, id, { '(a)': 'jawapan (a)', '(b)': UNSURE })
    const rows = await rowsOf(out.attemptId)
    expect(rows.map((r) => [r.part_ref, r.mode, r.is_correct, r.marks_awarded, r.marks_max, r.is_test])).toEqual([
      ['(a)', 'structured', true, 2, 2, false],
      ['(b)', 'structured', false, null, 3, false],
    ])
    for (const r of rows) expect(r).toMatchObject({ user_id: c.userId, question_id: id, attempt_id: out.attemptId })
    const bad = await t.db.query('select 1 from practice_answers where attempt_id = $1 and mode in (\'spm_mock\', \'spm_ramalan\', \'subjektif\', \'simulasi\')', [out.attemptId])
    expect(bad).toHaveLength(0)
  })

  it('46 section 4.6: only the ANSWERED leaves get a row at submit; a blank leaf has none, and a nested leaf is addressed by its label path', async () => {
    const id = await publish([{ label: '(a)', prompt: { ms: 'Bahagian' }, children: [leaf('(i)', 1), leaf('(ii)', 2)] }] as never)
    const c = await loginAs(t, 'student')
    const out = await submit(c, id, { '(a).(i)': 'jawapan (i)' })
    const rows = await rowsOf(out.attemptId)
    expect(rows.map((r) => [r.part_ref, r.marks_awarded, r.marks_max, r.is_correct])).toEqual([['(a).(i)', 1, 1, true]])
  })

  it('a self-mark on a leaf left blank at submit creates its row then, with the marks', async () => {
    const id = await publish([{ label: '(a)', prompt: { ms: 'Bahagian' }, children: [leaf('(i)', 1), working('(ii)', 3)] }] as never)
    const c = await loginAs(t, 'student')
    const out = await submit(c, id, { '(a).(i)': 'jawapan (i)' })
    expect((await rowsOf(out.attemptId)).map((r) => r.part_ref)).toEqual(['(a).(i)'])
    await selfMark(c, out.attemptId, 2, 1)
    expect((await rowsOf(out.attemptId)).map((r) => [r.part_ref, r.marks_awarded, r.marks_max, r.is_correct, r.mode])).toEqual([
      ['(a).(i)', 1, 1, true, 'structured'],
      ['(a).(ii)', 2, 3, false, 'structured'],
    ])
  })

  it('a Tracking A Bahasa set (scope spm, track bahasa) writes mode tracking_a, and its self-mark keeps it', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student')
    const out = await submit(c, id, { '(a).(i)': UNSURE }, { scope: 'spm', track: 'bahasa' })
    expect((await rowsOf(out.attemptId)).map((r) => r.mode)).toEqual(['tracking_a'])
    await selfMark(c, out.attemptId, 3)
    expect((await rowsOf(out.attemptId)).map((r) => [r.mode, r.marks_awarded])).toEqual([['tracking_a', 3]])
  })

  it('AC-MUR-13-24: the self-mark 3 of 4, then 2, updates the one row; the Sesi list shows 3 / 4 and then 2 / 4', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student2')
    const out = await submit(c, id, { '(a).(i)': UNSURE })
    expect((await rowsOf(out.attemptId)).map((r) => [r.marks_awarded, r.is_correct])).toEqual([[null, false]])
    const history = async () => {
      const res = await c.get('/api/bijak/history')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const row = (res.body.data as { attemptId: string; score?: number; max?: number }[]).find((h) => h.attemptId === out.attemptId)
      return `${String(row?.score)} / ${String(row?.max)}`
    }
    await selfMark(c, out.attemptId, 3)
    const first = await rowsOf(out.attemptId)
    expect(first.map((r) => [r.marks_awarded, r.marks_max, r.is_correct])).toEqual([[3, 4, false]])
    expect(await history()).toBe('3 / 4')
    await selfMark(c, out.attemptId, 2)
    const second = await rowsOf(out.attemptId)
    expect(second.map((r) => [r.marks_awarded, r.marks_max])).toEqual([[2, 4]])
    expect(second[0]?.id).toBe(first[0]?.id) // the same row, never a second one
    expect(await history()).toBe('2 / 4')
    await selfMark(c, out.attemptId, 4)
    expect((await rowsOf(out.attemptId)).map((r) => [r.marks_awarded, r.is_correct])).toEqual([[4, true]])
  })

  it('a Mod Pelajar attempt stamps its rows is_test', async () => {
    const id = await publish()
    const c = await loginModPelajar(t, 'admin@demo.test')
    const out = await submit(c, id, { '(a).(i)': 'jawapan (i)' })
    expect((await rowsOf(out.attemptId)).map((r) => r.is_test)).toEqual([true])
  })
})

describe('A9 reward: rate x the gain over the highest total paid for the question', () => {
  it('pays coinsPerCorrect x the marks at submit and 10 XP per mark: rate 1, then rate 3', async () => {
    const c = await loginAs(t, 'student')
    for (const [rate, coins] of [[1, 2], [3, 6]] as const) {
      await setRate(rate)
      const id = await publish([leaf('(a)', 2), leaf('(b)', 3)])
      const [bal, xp] = [await balance(c.userId), await xpOf(c.userId)]
      const out = await submit(c, id, { '(a)': 'jawapan (a)' }) // (a) 2 of 2, (b) blank
      expect(out.totalAwarded).toBe(2)
      expect(await balance(c.userId), `rate ${String(rate)}`).toBe(bal + coins)
      expect(await xpOf(c.userId)).toBe(xp + 20)
      expect((await ledger(c.userId)).at(-1)).toMatchObject({ source_id: `${out.attemptId}:score:2`, amount: coins, is_test: false })
    }
    await setRate(1)
  })

  it('a second attempt that scores no more than the best pays nothing; one that beats it pays only the new marks', async () => {
    const id = await publish([leaf('(a)', 2), leaf('(b)', 3)])
    const c = await loginAs(t, 'student2')
    const [bal, xp] = [await balance(c.userId), await xpOf(c.userId)]
    await submit(c, id, { '(a)': 'jawapan (a)', '(b)': 'jawapan (b)' }) // 5 marks: 5 syiling
    expect(await balance(c.userId)).toBe(bal + 5)
    await submit(c, id, { '(a)': 'jawapan (a)' }) // 2 marks, below the best 5
    await submit(c, id, { '(a)': 'jawapan (a)', '(b)': 'jawapan (b)' }) // 5 again, not above
    expect(await balance(c.userId)).toBe(bal + 5)
    expect(await xpOf(c.userId)).toBe(xp + 50)
  })

  it('the sequence 2, 3, 1, 4 over attempts of one question pays 2, then 1, then 0, then 1', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student')
    const paid: number[] = []
    for (const total of [2, 3, 1, 4]) {
      const before = await balance(c.userId)
      const out = await submit(c, id, { '(a).(i)': UNSURE }) // nothing paid at submit (0 marks)
      expect(await balance(c.userId)).toBe(before)
      await selfMark(c, out.attemptId, total)
      paid.push((await balance(c.userId)) - before)
    }
    expect(paid).toEqual([2, 1, 0, 1])
  })

  it('a self-mark gain pays the delta only and takes nothing back when the pupil lowers the mark', async () => {
    await setRate(2)
    try {
      const id = await publish()
      const c = await loginAs(t, 'student2')
      const [bal, xp] = [await balance(c.userId), await xpOf(c.userId)]
      const out = await submit(c, id, { '(a).(i)': UNSURE })
      await selfMark(c, out.attemptId, 2)
      expect([await balance(c.userId), await xpOf(c.userId)]).toEqual([bal + 4, xp + 20])
      await selfMark(c, out.attemptId, 3)
      expect([await balance(c.userId), await xpOf(c.userId)]).toEqual([bal + 6, xp + 30])
      await selfMark(c, out.attemptId, 1) // lower: nothing, nothing back
      await selfMark(c, out.attemptId, 3) // back to a paid level: nothing
      expect([await balance(c.userId), await xpOf(c.userId)]).toEqual([bal + 6, xp + 30])
      expect((await ledger(c.userId)).filter((l) => l.source_id.startsWith(out.attemptId)).map((l) => [l.source_id.split(':')[2], l.amount])).toEqual([['2', 4], ['3', 2]])
    } finally {
      await setRate(1)
    }
  })

  it('a self-mark that adds to the marks the auto part paid pays only the rest (provisional submit, then the pupil marks the other part)', async () => {
    const id = await publish([leaf('(a)', 2), leaf('(b)', 3)])
    const c = await loginAs(t, 'student')
    const bal = await balance(c.userId)
    const out = await submit(c, id, { '(a)': 'jawapan (a)', '(b)': UNSURE })
    expect(await balance(c.userId)).toBe(bal + 2)
    await selfMark(c, out.attemptId, 3, 1)
    expect(await balance(c.userId)).toBe(bal + 5)
  })

  it('Mod Pelajar pays nothing: no ledger row, no balance, no XP', async () => {
    const id = await publish()
    const c = await loginModPelajar(t, 'admin@demo.test')
    const [bal, xp, rows] = [await balance(c.userId), await xpOf(c.userId), (await ledger(c.userId)).length]
    const out = await submit(c, id, { '(a).(i)': UNSURE })
    await selfMark(c, out.attemptId, 4)
    expect([await balance(c.userId), await xpOf(c.userId), (await ledger(c.userId)).length]).toEqual([bal, xp, rows])
  })

  it('an attempt in Mod Pelajar is not counted as paid: the account own first real attempt still pays in full', async () => {
    const id = await publish()
    const c = await loginAs(t, 'admin')
    const bal = await balance(c.userId)
    await submit(await loginModPelajar(t, 'admin@demo.test'), id, { '(a).(i)': 'jawapan (i)' }) // the test attempt of the same account: pays nothing
    expect(await balance(c.userId)).toBe(bal)
    await submit(c, id, { '(a).(i)': 'jawapan (i)' })
    expect(await balance(c.userId)).toBe(bal + 4)
  })

  it('a different question starts from zero (the highest paid is per question)', async () => {
    const [x, y] = [await publish(), await publish()]
    const c = await loginAs(t, 'student2')
    const bal = await balance(c.userId)
    await submit(c, x, { '(a).(i)': 'jawapan (i)' })
    await submit(c, y, { '(a).(i)': 'jawapan (i)' })
    expect(await balance(c.userId)).toBe(bal + 8)
  })

  it('a ledger failure does not fail the submit: the attempt, its rows and its result stay', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student')
    await t.db.query(`alter table coin_ledger add constraint zz_block_structured check (source <> 'quiz_spm' or source_id not like '%:score:%') not valid`)
    try {
      const out = await submit(c, id, { '(a).(i)': 'jawapan (i)' })
      expect(await rowsOf(out.attemptId)).toHaveLength(1)
      expect(out.totalAwarded).toBe(4)
    } finally {
      await t.db.query('alter table coin_ledger drop constraint zz_block_structured')
    }
  })
})

describe('A9 reward: concurrency, the rate at pay time, retry after a failure', () => {
  it('two simultaneous submits of the same question pay the gain once: one ledger row for the level, the balance rises by the marks only', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student2')
    const [bal, xp] = [await balance(c.userId), await xpOf(c.userId)]
    const made = await Promise.all([submit(c, id, { '(a).(i)': 'jawapan (i)' }), submit(c, id, { '(a).(i)': 'jawapan (i)' })])
    const ids = made.map((m) => m.attemptId)
    const paid = (await ledger(c.userId)).filter((l) => ids.some((a) => l.source_id.startsWith(a)))
    expect(paid.map((l) => [l.source_id.split(':')[2], l.amount])).toEqual([['4', 4]])
    expect([await balance(c.userId), await xpOf(c.userId)]).toEqual([bal + 4, xp + 40])
  })

  it('a submit racing a self-mark of an earlier attempt of the question pays the total once', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student')
    const first = await submit(c, id, { '(a).(i)': UNSURE }) // waits for the pupil's mark
    const bal = await balance(c.userId)
    const partId = (await partsOf(c, first.attemptId))[0]?.partId as string
    const [second] = await Promise.all([
      submit(c, id, { '(a).(i)': 'jawapan (i)' }), // 4 marks
      c.post(`/api/bijak/attempts/${first.attemptId}/self-mark`, { partId, mark: 4 }), // 4 marks
    ])
    const paid = (await ledger(c.userId)).filter((l) => l.source_id.startsWith(first.attemptId) || l.source_id.startsWith(second.attemptId))
    expect(paid).toHaveLength(1)
    expect(paid[0]?.amount).toBe(4)
    expect(await balance(c.userId)).toBe(bal + 4)
  })

  it('the rate is read at pay time: after the admin changes it, the next gain pays at the new rate', async () => {
    try {
      await setRate(1)
      const id = await publish([leaf('(a)', 2), leaf('(b)', 3)])
      const c = await loginAs(t, 'student')
      const bal = await balance(c.userId)
      await submit(c, id, { '(a)': 'jawapan (a)' }) // 2 marks at rate 1
      await setRate(3)
      await submit(c, id, { '(a)': 'jawapan (a)', '(b)': 'jawapan (b)' }) // gain 3 at rate 3
      expect(await balance(c.userId)).toBe(bal + 2 + 9)
    } finally {
      await setRate(1)
    }
  })

  it('a failed payment does not mark the level paid: a later attempt at the same level pays it', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student2')
    const bal = await balance(c.userId)
    const spy = vi.spyOn(t.app.get(WalletService), 'credit').mockRejectedValueOnce(new Error('wallet down'))
    try {
      const failed = await submit(c, id, { '(a).(i)': 'jawapan (i)' }) // 4 marks, the payment throws
      expect(failed.totalAwarded).toBe(4)
      expect(await balance(c.userId)).toBe(bal)
      expect((await ledger(c.userId)).filter((l) => l.source_id.startsWith(failed.attemptId))).toHaveLength(0)
    } finally {
      spy.mockRestore()
    }
    await submit(c, id, { '(a).(i)': 'jawapan (i)' })
    expect(await balance(c.userId)).toBe(bal + 4)
  })

  it('a failed self-mark payment is recovered by the next raise, which pays the whole gain over the highest paid level', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student')
    const bal = await balance(c.userId)
    const out = await submit(c, id, { '(a).(i)': UNSURE })
    const spy = vi.spyOn(t.app.get(WalletService), 'credit').mockRejectedValueOnce(new Error('wallet down'))
    try {
      await selfMark(c, out.attemptId, 2) // the payment throws
    } finally {
      spy.mockRestore()
    }
    expect(await balance(c.userId)).toBe(bal)
    await selfMark(c, out.attemptId, 3)
    expect(await balance(c.userId)).toBe(bal + 3)
  })
})

describe('emit at submit: audit and aggregate', () => {
  it('writes the BIJAK_ATTEMPT_SUBMITTED audit line and one aggregate row at submit; a self-mark then regrades it once (regrade_count 1)', async () => {
    const id = await publish()
    const c = await loginAs(t, 'student')
    const out = await submit(c, id, { '(a).(i)': UNSURE })
    const audit = await t.db.query<{ action: string; target_type: string }>(`select action, target_type from audit_events where target_id = $1`, [out.attemptId])
    expect(audit).toEqual([{ action: 'bijak.attempt.submitted', target_type: 'bijak_attempt' }])
    const who = await t.db.query<{ actor_user_id: string; actor_role: string; ip_hash: string | null; request_id: string | null }>(
      `select actor_user_id::text, actor_role, ip_hash, request_id from audit_events where target_id = $1`,
      [out.attemptId],
    )
    expect(who[0]).toMatchObject({ actor_user_id: c.userId, actor_role: 'student' })
    expect(who[0]?.request_id).toEqual(expect.any(String))
    expect(who[0]?.ip_hash).toEqual(expect.any(String))
    const agg = () =>
      t.db.query<{ regrade_count: number; units_awarded: number; units_max: number; provisional: boolean; is_test: boolean; paper_id: string | null }>(
        `select regrade_count, units_awarded::float8, units_max::float8, provisional, is_test, paper_id::text from practice_attempt_aggregates where attempt_id = $1`,
        [out.attemptId],
      )
    expect(await agg()).toEqual([{ regrade_count: 0, units_awarded: 0, units_max: 4, provisional: true, is_test: false, paper_id: null }])
    await selfMark(c, out.attemptId, 3)
    expect(await agg()).toEqual([{ regrade_count: 1, units_awarded: 3, units_max: 4, provisional: false, is_test: false, paper_id: null }])
  })

  it('a Mod Pelajar attempt is flagged is_test in the aggregate', async () => {
    const id = await publish()
    const out = await submit(await loginModPelajar(t, 'admin@demo.test'), id, { '(a).(i)': 'jawapan (i)' })
    const agg = await t.db.query<{ is_test: boolean }>('select is_test from practice_attempt_aggregates where attempt_id = $1', [out.attemptId])
    expect(agg).toEqual([{ is_test: true }])
  })
})

describe('teacher "Digunakan" count', () => {
  it('counts the question once a pupil submitted it (the rows of the attempt are real answers), and not a Mod Pelajar attempt', async () => {
    const teacher = await loginAs(t, 'teacher')
    const id = await publish()
    await t.db.query('update questions set created_by_id = $1 where id = $2', [teacher.userId, id])
    const used = async () => ((await t.app.get(PrismaService).client.$queryRaw<{ n: number }[]>(usedCountQuery(BigInt(teacher.userId))))[0]?.n ?? 0)
    const before = await used()
    await submit(await loginModPelajar(t, 'admin@demo.test'), id, { '(a).(i)': 'jawapan (i)' })
    expect(await used()).toBe(before)
    await submit(await loginAs(t, 'student'), id, { '(a).(i)': 'jawapan (i)' })
    expect(await used()).toBe(before + 1)
  })
})
