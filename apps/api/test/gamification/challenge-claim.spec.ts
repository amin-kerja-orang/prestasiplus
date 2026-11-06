import { randomUUID } from 'node:crypto'

import { GamificationChallengesResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_EMPTY, STUDENT_MAJU, bareUser, bootGamificationApp, challengeIdByTitle, fail, ledgerOf, signIn, signInMod, userIdOf, walletOf, type Client, type GamificationTestApp } from './helpers'

/**
 * S7-T04 part 12, API-GAME-11 (rulings 12, 20 and 21 on #500): `POST /gamification/challenges/{id}/claim`.
 * The order of the checks: Mod Pelajar 403, unknown or inactive 404, claim of the day exists (same clientUuid 200 / else 409
 * CHALLENGE_CLAIMED), clientUuid on another claim 409 IDEMPOTENCY_MISMATCH, progress below the target 409 CHALLENGE_NOT_DONE.
 */
describe('POST /api/gamification/challenges/{id}/claim', () => {
  let t: GamificationTestApp
  let student: Client
  let maju: Client
  let empty: Client
  let studentId: string
  let majuId: string
  let emptyId: string
  const id: Record<string, string> = {}
  const reward: Record<string, { syiling: number; xp: number }> = {}
  const TITLES = ['Mula Hari Ini', 'Kilat Matematik', 'Si Tepat', 'Penjelajah Topik', 'Jawab 5 Betul', 'Latihan 10 Minit', 'Ketepatan 90%', 'Rajin Berlatih', 'Kombo 10']

  const claimsOf = (userId: string) =>
    t.db.query<{ challenge_id: string; myt_date: string; reward_syiling: number; reward_xp: number; client_uuid: string | null }>(
      `select challenge_id::text, myt_date::text, reward_syiling, reward_xp, client_uuid::text from challenge_claims where user_id = $1 order by id`,
      [userId],
    )
  const claim = (who: Client, title: string, body: object = {}) => who.post(`/gamification/challenges/${id[title]}/claim`, body)
  const meetTargets = () => {
    // 12/12 correct in one 11-minute session over 3 chapters: every challenge but "Rajin Berlatih" (3 sessions) and the streak one is met.
    t.facts.day = { sessions: [{ sessionId: 's1', mode: 'random', correct: 12, total: 12, timeSpent: 660 }], chapterIds: ['1', '2', '3'] }
  }

  beforeAll(async () => {
    t = await bootGamificationApp()
    for (const title of TITLES) {
      id[title] = await challengeIdByTitle(t, title)
      const r = (await t.db.query<{ reward_syiling: number; reward_xp: number }>(`select reward_syiling, reward_xp from challenges where id = $1`, [id[title]]))[0]!
      reward[title] = { syiling: r.reward_syiling, xp: r.reward_xp }
    }
    student = await signIn(t, STUDENT)
    maju = await signIn(t, STUDENT_MAJU)
    empty = await signIn(t, STUDENT_EMPTY)
    studentId = await userIdOf(t.db, STUDENT)
    majuId = await userIdOf(t.db, STUDENT_MAJU)
    emptyId = await userIdOf(t.db, STUDENT_EMPTY)
    meetTargets()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('guards: 401 anonymous, 403 CSRF_INVALID without the token', async () => {
    fail(await t.http().post(`/api/gamification/challenges/${id['Mula Hari Ini']}/claim`).send({}), 401, 'UNAUTHORIZED')
    const res = await student.noCsrfPost(`/gamification/challenges/${id['Mula Hari Ini']}/claim`)
    fail(res, 403, 'CSRF_INVALID')
  })

  it('step 1: Mod Pelajar is refused with 403 FORBIDDEN before anything else, nothing written', async () => {
    const mod = await signInMod(t, ADMIN)
    fail(await mod.post(`/gamification/challenges/${id['Mula Hari Ini']}/claim`), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
    fail(await mod.post(`/gamification/challenges/999999/claim`), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
    expect(await t.db.query(`select 1 from challenge_claims`)).toHaveLength(0)
  })

  it('step 2: unknown, malformed and inactive challenges are 404', async () => {
    fail(await student.post('/gamification/challenges/999999/claim'), 404, 'NOT_FOUND', 'Cabaran tidak dijumpai.')
    fail(await student.post('/gamification/challenges/abc/claim'), 404, 'NOT_FOUND')
    await t.db.query(`update challenges set is_active = false where id = $1`, [id['Mula Hari Ini']])
    fail(await claim(student, 'Mula Hari Ini'), 404, 'NOT_FOUND', 'Cabaran tidak dijumpai.')
    await t.db.query(`update challenges set is_active = true where id = $1`, [id['Mula Hari Ini']])
    expect(await claimsOf(studentId)).toEqual([])
  })

  it('a clientUuid that is not a UUID is 422 with fields.clientUuid', async () => {
    const err = fail(await claim(student, 'Mula Hari Ini', { clientUuid: 'not-a-uuid' }), 422, 'VALIDATION_ERROR')
    expect(err.fields).toEqual({ clientUuid: 'Medan ini tidak sah.' })
  })

  it('step 5: progress below the target is 409 CHALLENGE_NOT_DONE and writes nothing', async () => {
    fail(await claim(student, 'Rajin Berlatih'), 409, 'CHALLENGE_NOT_DONE', 'Cabaran belum selesai.')
    expect(await claimsOf(studentId)).toEqual([])
    expect(await ledgerOf(t, studentId)).toEqual(expect.not.arrayContaining([expect.objectContaining({ source: 'challenge' })]))
  })

  it('step 6: a finished challenge is credited once: claim row, ledger row (source challenge), XP, the stored amounts returned', async () => {
    const before = await walletOf(t, studentId)
    const res = await claim(student, 'Mula Hari Ini')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const r = reward['Mula Hari Ini']!
    expect(res.body.data).toMatchObject({ claimed: true, rewardSyiling: r.syiling, rewardXp: r.xp })
    const day = '2026-10-19'
    expect(await claimsOf(studentId)).toEqual([{ challenge_id: id['Mula Hari Ini'], myt_date: day, reward_syiling: r.syiling, reward_xp: r.xp, client_uuid: null }])
    const rows = (await ledgerOf(t, studentId)).filter((x) => x.source === 'challenge')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'earn', source_id: `challenge:${id['Mula Hari Ini']}:${day}`, amount: r.syiling, is_test: false })
    const after = await walletOf(t, studentId)
    expect(after!.current_syiling).toBe((before?.current_syiling ?? 0) + r.syiling)
    expect(after!.xp).toBe((before?.xp ?? 0) + r.xp)
  })

  it('step 3: a second claim the same day without a key is 409 CHALLENGE_CLAIMED and moves nothing', async () => {
    const before = await walletOf(t, studentId)
    fail(await claim(student, 'Mula Hari Ini'), 409, 'CHALLENGE_CLAIMED', 'Ganjaran sudah dituntut.')
    fail(await claim(student, 'Mula Hari Ini', { clientUuid: randomUUID() }), 409, 'CHALLENGE_CLAIMED', 'Ganjaran sudah dituntut.')
    expect(await walletOf(t, studentId)).toEqual(before)
    expect(await claimsOf(studentId)).toHaveLength(1)
  })

  it('step 3: the same clientUuid replays with 200 and the stored amounts, writing no second claim, ledger row or XP', async () => {
    const key = randomUUID()
    const first = await claim(maju, 'Kilat Matematik', { clientUuid: key })
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    const ledger = (await ledgerOf(t, majuId)).length
    const wallet = await walletOf(t, majuId)
    // the amounts on the challenge change afterwards: the replay answers from the stored claim
    await t.db.query(`update challenges set reward_syiling = reward_syiling + 7, reward_xp = reward_xp + 7 where id = $1`, [id['Kilat Matematik']])
    const again = await claim(maju, 'Kilat Matematik', { clientUuid: key })
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(again.body.data).toEqual({ claimed: true, rewardSyiling: reward['Kilat Matematik']!.syiling, rewardXp: reward['Kilat Matematik']!.xp })
    await t.db.query(`update challenges set reward_syiling = reward_syiling - 7, reward_xp = reward_xp - 7 where id = $1`, [id['Kilat Matematik']])
    expect((await ledgerOf(t, majuId)).length).toBe(ledger)
    expect(await walletOf(t, majuId)).toEqual(wallet)
    expect((await claimsOf(majuId)).filter((c) => c.client_uuid === key)).toHaveLength(1)
  })

  it('step 4: a clientUuid already on another claim of the user is 409 CONFLICT IDEMPOTENCY_MISMATCH and writes nothing', async () => {
    const key = randomUUID()
    expect((await claim(maju, 'Si Tepat', { clientUuid: key })).status).toBe(200)
    const before = await walletOf(t, majuId)
    const res = await claim(maju, 'Penjelajah Topik', { clientUuid: key })
    fail(res, 409, 'CONFLICT')
    expect(res.body.error.details).toEqual({ reason: 'IDEMPOTENCY_MISMATCH' })
    expect(await walletOf(t, majuId)).toEqual(before)
    expect((await claimsOf(majuId)).some((c) => c.challenge_id === id['Penjelajah Topik'])).toBe(false)
    // another user may use the same key (DM-79 is per user)
    expect((await claim(empty, 'Si Tepat', { clientUuid: key })).status).toBe(200)
  })

  it('the order holds: a claimed challenge answers CHALLENGE_CLAIMED even if its progress fell (step 3 before step 5)', async () => {
    t.facts.day = { sessions: [], chapterIds: [] }
    fail(await claim(maju, 'Si Tepat', { clientUuid: randomUUID() }), 409, 'CHALLENGE_CLAIMED')
    fail(await claim(maju, 'Jawab 5 Betul'), 409, 'CHALLENGE_NOT_DONE')
    meetTargets()
  })

  it('coins disabled: reward_syiling 0, XP still paid, no ledger row, and a replay is still 200', async () => {
    await t.db.query(`update users set is_complimentary = true where id = $1`, [emptyId])
    const key = randomUUID()
    const before = await walletOf(t, emptyId)
    const res = await claim(empty, 'Latihan 10 Minit', { clientUuid: key })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ claimed: true, rewardSyiling: 0, rewardXp: reward['Latihan 10 Minit']!.xp })
    expect((await claimsOf(emptyId)).find((c) => c.challenge_id === id['Latihan 10 Minit'])).toMatchObject({ reward_syiling: 0, client_uuid: key })
    expect((await ledgerOf(t, emptyId)).filter((x) => x.source_id === `challenge:${id['Latihan 10 Minit']}:2026-10-19`)).toEqual([])
    expect((await walletOf(t, emptyId))!.xp).toBe((before?.xp ?? 0) + reward['Latihan 10 Minit']!.xp)
    const again = await claim(empty, 'Latihan 10 Minit', { clientUuid: key })
    expect(again.status).toBe(200)
    expect(again.body.data).toEqual({ claimed: true, rewardSyiling: 0, rewardXp: reward['Latihan 10 Minit']!.xp })
  })

  it('two simultaneous claims write ONE claim row and ONE ledger row; the loser is 409 (or 200 with the same key)', async () => {
    const before = (await ledgerOf(t, majuId)).filter((x) => x.source === 'challenge').length
    const out = await Promise.all(Array.from({ length: 5 }, () => claim(maju, 'Ketepatan 90%')))
    expect(out.filter((r) => r.status === 200)).toHaveLength(1)
    for (const r of out.filter((x) => x.status !== 200)) fail(r, 409, 'CHALLENGE_CLAIMED')
    expect((await claimsOf(majuId)).filter((c) => c.challenge_id === id['Ketepatan 90%'])).toHaveLength(1)
    expect((await ledgerOf(t, majuId)).filter((x) => x.source === 'challenge')).toHaveLength(before + 1)

    const key = randomUUID()
    const keyed = await Promise.all(Array.from({ length: 5 }, () => claim(maju, 'Jawab 5 Betul', { clientUuid: key })))
    expect(keyed.every((r) => r.status === 200)).toBe(true)
    expect(new Set(keyed.map((r) => JSON.stringify(r.body.data.rewardSyiling))).size).toBe(1)
    expect((await claimsOf(majuId)).filter((c) => c.challenge_id === id['Jawab 5 Betul'])).toHaveLength(1)
    expect((await ledgerOf(t, majuId)).filter((x) => x.source === 'challenge')).toHaveLength(before + 2)
  })

  it('a tier-up by the credit adds the notice "Tahniah! Anda naik ke tier {label}." (ruling 21)', async () => {
    const tiers = await t.db.query<{ id: string; min_syiling: number; label_ms: string }>(`select id::text, min_syiling, label_ms from tiers where is_active order by min_syiling`)
    const [lower, upper] = [tiers[0]!, tiers[1]!]
    await t.db.query(`update wallets set tier_id = $1::bigint, total_syiling_earned = $2, current_syiling = $2 where user_id = $3`, [lower.id, upper.min_syiling - 1, studentId])
    const res = await claim(student, 'Si Tepat')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.notices).toEqual([`Tahniah! Anda naik ke tier ${upper.label_ms}.`])
    // a replay carries no notices
    const key = randomUUID()
    expect((await claim(student, 'Penjelajah Topik', { clientUuid: key })).body.data.notices).toBeUndefined()
    expect((await claim(student, 'Penjelajah Topik', { clientUuid: key })).body.data.notices).toBeUndefined()
  })

  it('the Malaysia day decides: 23:59 and 00:01 MYT are two claims; the same MYT day again is 409', async () => {
    t.clock.set('2026-10-20T15:59:00Z') // 23:59 MYT on the 20th
    const who = await signIn(t, STUDENT_MAJU)
    expect((await claim(who, 'Kilat Matematik')).status).toBe(200)
    fail(await claim(who, 'Kilat Matematik'), 409, 'CHALLENGE_CLAIMED')
    t.clock.set('2026-10-20T16:01:00Z') // 00:01 MYT on the 21st
    const next = await signIn(t, STUDENT_MAJU)
    expect((await claim(next, 'Kilat Matematik')).status).toBe(200)
    t.clock.set('2026-10-21T10:00:00Z') // still the 21st
    fail(await claim(await signIn(t, STUDENT_MAJU), 'Kilat Matematik'), 409, 'CHALLENGE_CLAIMED')
    const days = (await claimsOf(majuId)).filter((c) => c.challenge_id === id['Kilat Matematik']).map((c) => c.myt_date)
    expect(days).toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
    const keys = (await ledgerOf(t, majuId)).filter((x) => x.source === 'challenge' && x.source_id?.startsWith(`challenge:${id['Kilat Matematik']}:`)).map((x) => x.source_id)
    expect(keys).toEqual([`challenge:${id['Kilat Matematik']}:2026-10-19`, `challenge:${id['Kilat Matematik']}:2026-10-20`, `challenge:${id['Kilat Matematik']}:2026-10-21`])
  })

  it('GET /gamification/challenges reports claimed per challenge and meta.claimed from the claims of the Malaysia day', async () => {
    const who = await signIn(t, STUDENT_MAJU)
    const body = GamificationChallengesResponseSchema.parse((await who.get('/gamification/challenges')).body)
    const today = new Set((await claimsOf(majuId)).filter((c) => c.myt_date === '2026-10-21').map((c) => c.challenge_id))
    expect(today.size).toBeGreaterThan(0)
    for (const c of body.data) expect(c.claimed, c.title).toBe(today.has(c.id))
    expect(body.meta.claimed).toBe(body.data.filter((c) => c.claimed).length)
    expect(body.meta.claimed).toBe(today.size)
    // a pupil with no claim today sees none
    const fresh = GamificationChallengesResponseSchema.parse((await (await signIn(t, STUDENT_MAJU)).get('/gamification/challenges')).body)
    expect(fresh.meta.claimed).toBe(today.size)
    t.clock.set('2026-10-19T09:00:00+08:00')
  })

  it('completing a challenge no longer credits: settleChallenges writes the completion rows and no ledger row, no XP, no claim', async () => {
    const u = await bareUser(t, 'Tanpa Kredit')
    const done = await t.gamification.settleChallenges(u, { isTest: false })
    expect(done.completedIds.length).toBeGreaterThan(0)
    expect(await t.db.query(`select 1 from challenge_completions where user_id = $1`, [u])).toHaveLength(done.completedIds.length)
    expect(await ledgerOf(t, u)).toEqual([])
    expect(await walletOf(t, u)).toBeUndefined()
    expect(await claimsOf(u)).toEqual([])
  })

  it('best_combo (S7-T04 part 14): settleChallenges writes the completion once the combo reaches the target; the claim credits exactly once', async () => {
    const day = '2026-10-19'
    const key = 'Kombo 10'
    const sourceId = `challenge:${id[key]}:${day}`
    const completions = () => t.db.query(`select 1 from challenge_completions where user_id = $1 and challenge_id = $2`, [studentId, id[key]])
    const credits = async () => (await ledgerOf(t, studentId)).filter((x) => x.source_id === sourceId)
    try {
      // a combo below the target completes nothing and the claim is refused
      t.facts.combo = 9
      expect((await t.gamification.settleChallenges(studentId, { isTest: false })).completedIds).not.toContain(id[key])
      expect(await completions()).toHaveLength(0)
      fail(await claim(student, key), 409, 'CHALLENGE_NOT_DONE', 'Cabaran belum selesai.')
      // the practice reaches the target: the completion row is written, still no credit
      t.facts.combo = 10
      expect((await t.gamification.settleChallenges(studentId, { isTest: false })).completedIds).toContain(id[key])
      expect(await completions()).toHaveLength(1)
      expect(await credits()).toHaveLength(0)
      // the claim credits exactly once
      const before = await walletOf(t, studentId)
      const first = await claim(student, key)
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      const r = reward[key]!
      expect(first.body.data).toMatchObject({ claimed: true, rewardSyiling: r.syiling, rewardXp: r.xp })
      const rows = await credits()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ type: 'earn', source: 'challenge', amount: r.syiling })
      expect((await walletOf(t, studentId))!.current_syiling).toBe((before?.current_syiling ?? 0) + r.syiling)
      // a second claim gives no second credit
      fail(await claim(student, key), 409, 'CHALLENGE_CLAIMED', 'Ganjaran sudah dituntut.')
      expect(await credits()).toHaveLength(1)
      expect((await claimsOf(studentId)).filter((c) => c.challenge_id === id[key])).toHaveLength(1)
    } finally {
      t.facts.combo = 0
    }
  })
})
