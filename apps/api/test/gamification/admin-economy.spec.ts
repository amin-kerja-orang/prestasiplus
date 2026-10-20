import {
  GamificationAdminAwardResultSchema,
  GamificationAdminChallengeSchema,
  GamificationAdminOverviewSchema,
  GamificationAdminStudentsResponseSchema,
  GamificationAdminTierSchema,
  GamificationAdminTransactionsResponseSchema,
  GamificationToggleResultSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_MAJU, TEACHER, bareUser, bootGamificationApp, dataOf, fail, ledgerOf, signIn, userIdOf, walletOf, type Client, type GamificationTestApp } from './helpers'

const TIER_BODY = { labelMs: 'Perak Baru', icon: '🥈', color: '#c0c0c0', minSyiling: 500, conversionRate: 40, sortOrder: 2, quizRewardL1: 1, quizRewardL2: 2, quizRewardL3: 3, quizRewardL4: 4, quizRewardL5: 5, pkskRewardCorrect: 5, boardGameRewardCorrect: 5, boardGameRewardWin: 25 }
const CHALLENGE_BODY = { title: 'Cabaran Uji', description: 'Selesaikan 2 kuiz', icon: '📝', challengeType: 'quiz_count', targetValue: 2, rewardSyiling: 10, rewardXp: 5, difficulty: 'easy', sortOrder: 10 }

describe('M14 admin economy (BE-23, AC4, AC8)', () => {
  let t: GamificationTestApp
  let admin: Client
  let student: Client
  let teacher: Client
  let anyId = ''

  const idOf = async (sql: string, ...p: unknown[]) => (await t.db.query<{ id: string }>(sql, p))[0]!.id
  const tierId = (name: string) => idOf(`select id::text from tiers where tier_name = $1`, name)
  const auditCount = async (action: string) => Number((await t.db.query<{ n: string }>(`select count(*)::text n from audit_events where action = $1`, [action]))[0]!.n)

  beforeAll(async () => {
    t = await bootGamificationApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000' } })
    admin = await signIn(t, ADMIN)
    student = await signIn(t, STUDENT)
    teacher = await signIn(t, TEACHER)
    anyId = await tierId('bronze')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards: anonymous 401, student and teacher 403, a write without CSRF 403 CSRF_INVALID', () => {
    const READS = ['/admin/gamification/overview', '/admin/gamification/tiers', '/admin/gamification/challenges', '/admin/gamification/students', '/admin/gamification/transactions', '/admin/gamification/settings', '/admin/reward-control']
    const WRITES: [string, string][] = [
      ['post', '/admin/gamification/award'],
      ['post', '/admin/gamification/challenges'],
      ['put', '/admin/gamification/challenges/1'],
      ['delete', '/admin/gamification/challenges/1'],
      ['post', '/admin/gamification/challenges/1/toggle'],
      ['post', '/admin/gamification/tiers'],
      ['put', '/admin/gamification/tiers/1'],
      ['post', '/admin/gamification/tiers/1/toggle'],
      ['put', '/admin/gamification/settings'],
      ['put', '/admin/reward-control/settings'],
      ['put', '/admin/reward-control/rewards/1/cost'],
      ['post', '/admin/reward-control/draws'],
    ]

    it('anonymous is 401 on every route', async () => {
      for (const p of READS) fail(await t.http().get(`/api${p}`), 401, 'UNAUTHORIZED')
      for (const [verb, p] of WRITES) fail(await t.http()[verb as 'post'](`/api${p}`).send({}), 401, 'UNAUTHORIZED')
    })

    it('a student and a teacher are 403 on every route (FORBIDDEN)', async () => {
      for (const who of [student, teacher]) {
        for (const p of READS) fail(await who.get(p), 403, 'FORBIDDEN')
        for (const [verb, p] of WRITES) {
          const res = verb === 'post' ? await who.post(p) : verb === 'put' ? await who.put(p) : await who.del(p)
          fail(res, 403, 'FORBIDDEN')
        }
      }
    })

    it('an admin write without the CSRF header is 403 CSRF_INVALID and changes nothing', async () => {
      const before = await auditCount('gamification.tier.created')
      fail(await admin.noCsrfPost('/admin/gamification/tiers', { ...TIER_BODY, tierName: 'nocsrf' }), 403, 'CSRF_INVALID')
      fail(await admin.noCsrfPut('/admin/gamification/settings', { settings: [{ key: 'flat_quiz_reward', value: 9 }] }), 403, 'CSRF_INVALID')
      fail(await admin.noCsrfDel('/admin/gamification/challenges/1'), 403, 'CSRF_INVALID')
      fail(await admin.noCsrfPost('/admin/gamification/award', { userId: '1', amount: 5, reason: 'x' }), 403, 'CSRF_INVALID')
      expect(await auditCount('gamification.tier.created')).toBe(before)
      expect((await t.db.query(`select 1 from tiers where tier_name = 'nocsrf'`)).length).toBe(0)
    })

    it('every answer is no-store', async () => {
      expect((await admin.get('/admin/gamification/overview')).headers['cache-control']).toMatch(/no-store/)
    })
  })

  describe('GET /overview (S1)', () => {
    it('cards, tier distribution (by tier key), top 10 and the latest 10 rows, from the seeded wallets', async () => {
      const d = GamificationAdminOverviewSchema.parse(dataOf(await admin.get('/admin/gamification/overview')))
      const wallets = Number((await t.db.query<{ n: string }>(`select count(*)::text n from wallets`))[0]!.n)
      const sum = Number((await t.db.query<{ n: string }>(`select sum(total_syiling_earned)::text n from wallets`))[0]!.n)
      expect(d.cards).toMatchObject({ activeStudents: wallets, syilingGenerated: sum, tokensConverted: 0, conversions: 0, activeChallenges: 10, completedToday: 0 })
      expect(d.tierDistribution.map((x) => x.key)).toEqual(['bronze', 'gold', 'platinum', 'silver'])
      expect(d.tierDistribution.reduce((a, x) => a + x.count, 0)).toBe(wallets)
      expect(d.top10.map((x) => x.rank)).toEqual(d.top10.map((_, i) => i + 1))
      const totals = d.top10.map((x) => x.totalSyilingEarned)
      expect(totals).toEqual([...totals].sort((a, b) => b - a))
      expect(d.recent.length).toBe(10)
    })

    it('conversions and completions are counted; test rows and test-only wallets are left out', async () => {
      const u = await bareUser(t, 'Tukar Statistik')
      await t.wallet.credit({ userId: u, amount: 200, source: 'quiz_practice', sourceId: 'ov-1', description: 'Latih Tubi: 20 betul', isTest: false })
      await t.gamification.convert({ userId: u, isTest: false }, 100, null)
      await t.gamification.convert({ userId: u, isTest: true }, 50, null) // a Mod Pelajar conversion is not counted
      const testOnly = await bareUser(t, 'Hanya Ujian')
      await t.wallet.credit({ userId: testOnly, amount: 900, source: 'admin_award', sourceId: 'ov-2', description: 'Ujian', isTest: true })
      const before = GamificationAdminOverviewSchema.parse(dataOf(await admin.get('/admin/gamification/overview')))
      expect(before.cards.conversions).toBe(1)
      expect(before.cards.tokensConverted).toBe(2)
      const wallets = Number((await t.db.query<{ n: string }>(`select count(*)::text n from wallets`))[0]!.n)
      expect(before.cards.activeStudents).toBe(wallets - 1) // the test-only wallet is not counted
      expect(before.top10.find((x) => x.name === 'Pengguna Hanya Ujian')).toBeUndefined()
      expect(before.recent.every((r) => r.source !== 'admin_award' || r.amount !== 900)).toBe(true)
    })

    it('completedToday counts users whose real completions today cover every active challenge', async () => {
      const u = await bareUser(t, 'Selesai Semua')
      const all = await t.db.query<{ id: string }>(`select id::text from challenges where is_active`)
      for (const c of all) await t.gamification.claimChallenge(u, c.id, { isTest: false })
      const d = GamificationAdminOverviewSchema.parse(dataOf(await admin.get('/admin/gamification/overview')))
      expect(d.cards.completedToday).toBe(1)
    })
  })

  describe('tiers (S2)', () => {
    it('GET lists all 4 seeded tiers including inactive ones, by sortOrder', async () => {
      const list = dataOf<unknown[]>(await admin.get('/admin/gamification/tiers')).map((x) => GamificationAdminTierSchema.parse(x))
      expect(list.map((x) => x.tierName)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
      expect(list[0]).toMatchObject({ labelMs: 'Gangsa', minSyiling: 0, conversionRate: 50, perks: ['Akses asas hadiah', 'Ganjaran kuiz standard', 'Profil asas'], isActive: true })
    })

    it('PUT saves a tier, keeps the perks when none are posted, takes a JSON text or a list; tierName cannot change; audited', async () => {
      const id = await tierId('silver')
      const before = await auditCount('gamification.tier.updated')
      const res = await admin.put(`/admin/gamification/tiers/${id}`, { ...TIER_BODY, tierName: 'hacked', quizRewardL1: 2 })
      expect(res.status).toBe(200)
      const tier = GamificationAdminTierSchema.parse(dataOf(res))
      expect(tier).toMatchObject({ id, tierName: 'silver', labelMs: 'Perak Baru', quizRewardL1: 2 })
      expect(tier.perks).toHaveLength(4)
      expect(dataOf<{ perks: string[] }>(await admin.put(`/admin/gamification/tiers/${id}`, { ...TIER_BODY, perks: JSON.stringify(['Satu']) })).perks).toEqual(['Satu'])
      expect(dataOf<{ perks: string[] }>(await admin.put(`/admin/gamification/tiers/${id}`, { ...TIER_BODY, perks: ['A', ' B ', ''] })).perks).toEqual(['A', 'B'])
      expect(await auditCount('gamification.tier.updated')).toBe(before + 3)
    })

    it('PUT validates every field (422, all failing fields) and answers 404 for an unknown or non-numeric id', async () => {
      const id = await tierId('silver')
      const err = fail(await admin.put(`/admin/gamification/tiers/${id}`, { ...TIER_BODY, quizRewardL1: undefined, labelMs: '', conversionRate: 0, color: 'red', boardGameRewardWin: -1 }), 422, 'VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
      expect(Object.keys(err.fields!).sort()).toEqual(['boardGameRewardWin', 'color', 'conversionRate', 'labelMs', 'quizRewardL1'])
      expect(err.fields!.quizRewardL1).toBe('Medan ini diperlukan.')
      expect(err.fields!.color).toBe('Medan ini tidak sah.')
      fail(await admin.put('/admin/gamification/tiers/999999', TIER_BODY), 404, 'NOT_FOUND', 'Tier tidak dijumpai.')
      fail(await admin.put('/admin/gamification/tiers/abc', TIER_BODY), 404, 'NOT_FOUND', 'Not Found.')
    })

    it('POST creates a tier (lower-case key, one text as perks, default colour, active), refuses a duplicate name and a bad name', async () => {
      const body = { ...TIER_BODY, tierName: 'Diamond', labelMs: 'Berlian', icon: '💎', color: undefined, minSyiling: 10_000, conversionRate: 15, sortOrder: 5, perks: 'Bonus 2x XP' }
      const res = await admin.post('/admin/gamification/tiers', body)
      expect(res.status).toBe(201)
      expect(GamificationAdminTierSchema.parse(dataOf(res))).toMatchObject({ tierName: 'diamond', perks: ['Bonus 2x XP'], color: '#3b82f6', isActive: true, conversionRate: 15 })
      const dup = fail(await admin.post('/admin/gamification/tiers', { ...body, tierName: 'DIAMOND' }), 422, 'VALIDATION_ERROR', 'Nama tier sudah wujud.')
      expect(dup.fields).toEqual({ tierName: 'Nama tier sudah wujud.' })
      expect(fail(await admin.post('/admin/gamification/tiers', { ...body, tierName: 'bad name!' }), 422, 'VALIDATION_ERROR').fields).toHaveProperty('tierName')
    })

    it('POST toggle flips the tier and answers { isActive }; 404 for an unknown tier; holders keep it', async () => {
      const id = await tierId('platinum')
      expect(GamificationToggleResultSchema.parse(dataOf(await admin.post(`/admin/gamification/tiers/${id}/toggle`)))).toEqual({ isActive: false })
      expect(dataOf(await admin.post(`/admin/gamification/tiers/${id}/toggle`))).toEqual({ isActive: true })
      fail(await admin.post('/admin/gamification/tiers/999999/toggle'), 404, 'NOT_FOUND', 'Tier tidak dijumpai.')
      expect(await auditCount('gamification.tier.active_changed')).toBeGreaterThanOrEqual(2)
    })
  })

  describe('AC8: a wallet tier never goes down when an admin edits tiers', () => {
    it('raising the threshold, deactivating the tier or lowering the ladder leaves the holder on the tier; wallets are not touched', async () => {
      const u = await bareUser(t, 'Tier Kekal')
      await t.wallet.credit({ userId: u, amount: 2500, source: 'quiz_practice', sourceId: 'ac8', description: 'Latih Tubi: 250 betul', isTest: false })
      expect((await walletOf(t, u))!.tier_name).toBe('gold')
      const walletStamp = async () => (await t.db.query<{ updated_at: string; tier_id: string }>(`select updated_at::text, tier_id::text from wallets where user_id = $1`, [u]))[0]!
      const stamp = await walletStamp()
      const gold = await tierId('gold')
      // a) the threshold goes above the balance
      await admin.put(`/admin/gamification/tiers/${gold}`, { ...TIER_BODY, labelMs: 'Emas', minSyiling: 100_000, conversionRate: 30, sortOrder: 3 })
      expect((await walletOf(t, u))!.tier_name).toBe('gold')
      // b) the tier is deactivated
      await admin.post(`/admin/gamification/tiers/${gold}/toggle`)
      expect((await walletOf(t, u))!.tier_name).toBe('gold')
      // c) a further credit is re-evaluated against the CURRENT ladder and still never lowers the tier
      await t.wallet.credit({ userId: u, amount: 10, source: 'quiz_practice', sourceId: 'ac8-2', description: 'Latih Tubi: 1 betul', isTest: false })
      expect((await walletOf(t, u))!.tier_name).toBe('gold')
      // d) the admin writes themselves never changed the wallet row
      expect((await walletStamp()).tier_id).toBe(stamp.tier_id)
      await admin.post(`/admin/gamification/tiers/${gold}/toggle`)
      await admin.put(`/admin/gamification/tiers/${gold}`, { ...TIER_BODY, labelMs: 'Emas', minSyiling: 2000, conversionRate: 30, sortOrder: 3 })
    })
  })

  describe('challenges (S3)', () => {
    it('GET lists every challenge (active or not) by (sortOrder, id) without the internal metric', async () => {
      const list = dataOf<Record<string, unknown>[]>(await admin.get('/admin/gamification/challenges'))
      expect(list).toHaveLength(10)
      list.forEach((c) => GamificationAdminChallengeSchema.parse(c))
      expect(list.every((c) => !('metric' in c))).toBe(true)
      expect(list.slice(0, 4).map((c) => c.title)).toEqual(['Rajin Berlatih', 'Si Tepat', 'Penjelajah Topik', 'Kilat Matematik'])
    })

    it('POST creates (201, active, default metric of the type), PUT replaces (metric kept for the same type, reset for another), toggle, DELETE answers 200 { deleted: 1 }', async () => {
      const created = await admin.post('/admin/gamification/challenges', CHALLENGE_BODY)
      expect(created.status).toBe(201)
      const c = GamificationAdminChallengeSchema.parse(dataOf(created))
      expect(c).toMatchObject({ ...CHALLENGE_BODY, isActive: true })
      const metric = async () => (await t.db.query<{ metric: string }>(`select metric from challenges where id = $1`, [c.id]))[0]!.metric
      expect(await metric()).toBe('sessions')
      await t.db.query(`update challenges set metric = 'correct' where id = $1`, [c.id]) // an admin-set metric of the same type survives an edit
      expect(dataOf(await admin.put(`/admin/gamification/challenges/${c.id}`, { ...CHALLENGE_BODY, title: 'Cabaran Ubah', targetValue: 4 }))).toMatchObject({ title: 'Cabaran Ubah', targetValue: 4 })
      expect(await metric()).toBe('correct')
      await admin.put(`/admin/gamification/challenges/${c.id}`, { ...CHALLENGE_BODY, challengeType: 'accuracy', targetValue: 80 })
      expect(await metric()).toBe('best_accuracy')
      expect(GamificationToggleResultSchema.parse(dataOf(await admin.post(`/admin/gamification/challenges/${c.id}/toggle`)))).toEqual({ isActive: false })
      const del = await admin.del(`/admin/gamification/challenges/${c.id}`)
      expect(del.status).toBe(200)
      expect(dataOf(del)).toEqual({ deleted: 1 })
      fail(await admin.del(`/admin/gamification/challenges/${c.id}`), 404, 'NOT_FOUND', 'Cabaran tidak dijumpai.')
      fail(await admin.post(`/admin/gamification/challenges/${c.id}/toggle`), 404, 'NOT_FOUND', 'Cabaran tidak dijumpai.')
      fail(await admin.put(`/admin/gamification/challenges/${c.id}`, CHALLENGE_BODY), 404, 'NOT_FOUND', 'Cabaran tidak dijumpai.')
      expect(await auditCount('gamification.challenge.created')).toBeGreaterThanOrEqual(1)
      expect(await auditCount('gamification.challenge.deleted')).toBeGreaterThanOrEqual(1)
    })

    it('every field is required; an unknown type or difficulty and a zero target are 422 with the mock copy', async () => {
      const err = fail(await admin.post('/admin/gamification/challenges', { ...CHALLENGE_BODY, title: '  ', challengeType: 'weird', difficulty: 'extreme', targetValue: 0, sortOrder: undefined, description: 'x'.repeat(256) }), 422, 'VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
      expect(err.fields).toEqual({ title: 'Medan ini diperlukan.', description: 'Medan ini tidak sah.', challengeType: 'Medan ini tidak sah.', targetValue: 'Medan ini tidak sah.', difficulty: 'Medan ini tidak sah.', sortOrder: 'Medan ini diperlukan.' })
      fail(await admin.put('/admin/gamification/challenges/abc', CHALLENGE_BODY), 404, 'NOT_FOUND', 'Not Found.')
    })

    it('deleting a challenge removes its completions (FK cascade) and leaves the ledger rows already paid', async () => {
      const created = GamificationAdminChallengeSchema.parse(dataOf(await admin.post('/admin/gamification/challenges', CHALLENGE_BODY)))
      const u = await bareUser(t, 'Hapus Cabaran')
      await t.gamification.claimChallenge(u, created.id, { isTest: false })
      await admin.del(`/admin/gamification/challenges/${created.id}`)
      expect((await t.db.query(`select 1 from challenge_completions where challenge_id = $1`, [created.id])).length).toBe(0)
      expect(await ledgerOf(t, u)).toHaveLength(1)
    })
  })

  describe('students (S4) and award', () => {
    it('GET: 20 a page, ranked by lifetime syiling then oldest wallet, with name, e-mail and tier colour; meta is the list meta', async () => {
      const res = await admin.get('/admin/gamification/students')
      const body = GamificationAdminStudentsResponseSchema.parse(res.body)
      expect(body.meta).toMatchObject({ page: 1, pageSize: 20 })
      const total = Number((await t.db.query<{ n: string }>(`select count(*)::text n from wallets`))[0]!.n)
      expect(body.meta.totalItems).toBe(total)
      const totals = body.data.map((r) => r.totalSyilingEarned)
      expect(totals).toEqual([...totals].sort((a, b) => b - a))
      expect(body.data.find((r) => r.email === 'pelajar@demo.test')).toMatchObject({ currentSyiling: expect.any(Number), tierKey: 'bronze', tierColor: '#cd7f32', xp: expect.any(Number) })
    })

    it('GET: tier filter, name or e-mail search (a % is literal), the four sorts, an invalid page reads as 1 and an out-of-range page is empty', async () => {
      const get = async (q: string) => GamificationAdminStudentsResponseSchema.parse((await admin.get(`/admin/gamification/students${q}`)).body)
      const bronze = await get('?tier=bronze')
      expect(bronze.data.every((r) => r.tierKey === 'bronze')).toBe(true)
      expect((await get('?search=pelajarmaju')).data.map((r) => r.email)).toEqual(['pelajarmaju@demo.test'])
      expect((await get('?search=%25')).data).toEqual([])
      expect((await get('?search=')).meta.totalItems).toBe((await get('')).meta.totalItems)
      const byTokens = (await get('?sort=token_balance')).data.map((r) => r.tokenBalance)
      expect(byTokens).toEqual([...byTokens].sort((a, b) => b - a))
      const byLevel = (await get('?sort=level')).data.map((r) => r.level)
      expect(byLevel).toEqual([...byLevel].sort((a, b) => b - a))
      const byCurrent = (await get('?sort=current_syiling')).data.map((r) => r.currentSyiling)
      expect(byCurrent).toEqual([...byCurrent].sort((a, b) => b - a))
      expect((await get('?sort=bogus')).data).toEqual((await get('')).data)
      expect((await get('?page=abc')).meta.page).toBe(1)
      const far = await get('?page=99')
      expect(far.data).toEqual([])
      expect(far.meta.page).toBe(99)
    })

    it('POST award: a bonus / admin_award row with the reason as description, balance and lifetime up, the tier follows, 200', async () => {
      const id = await userIdOf(t.db, STUDENT_MAJU)
      const before = (await walletOf(t, id))!
      const res = await admin.post('/admin/gamification/award', { userId: id, amount: 250, reason: '  Hadiah ujian  ' })
      expect(res.status).toBe(200)
      const d = GamificationAdminAwardResultSchema.parse(dataOf(res))
      expect(d).toMatchObject({ userId: id, currentSyiling: before.current_syiling + 250 })
      expect((await ledgerOf(t, id)).find((r) => r.id === d.transactionId)).toMatchObject({ type: 'bonus', source: 'admin_award', amount: 250, description: 'Hadiah ujian', balance_after: d.currentSyiling, is_test: false })
      expect(await walletOf(t, id)).toMatchObject({ total_syiling_earned: before.total_syiling_earned + 250 })
      expect((await walletOf(t, id))!.tier_name).toBe(before.current_syiling + 250 >= 500 ? 'silver' : before.tier_name)
      expect(await auditCount('gamification.award.granted')).toBeGreaterThanOrEqual(1)
    })

    it('POST award creates the wallet of a user who has none', async () => {
      const u = await bareUser(t, 'Tanpa Dompet Award')
      await admin.post('/admin/gamification/award', { userId: u, amount: 10, reason: 'Sambutan' })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 10, tier_name: 'bronze' })
    })

    it('POST award: 422 for a range, reason or id problem, 404 for an unknown user, nothing is written', async () => {
      const id = await userIdOf(t.db, STUDENT)
      const rows = (await ledgerOf(t, id)).length
      for (const body of [{ userId: id, amount: 0, reason: 'x' }, { userId: id, amount: 10_001, reason: 'x' }, { userId: id, amount: 5.5, reason: 'x' }, { userId: id, amount: 5, reason: '   ' }, { userId: id, amount: 5, reason: 'x'.repeat(256) }, { userId: 'abc', amount: 5, reason: 'x' }, { amount: 5, reason: 'x' }]) {
        fail(await admin.post('/admin/gamification/award', body), 422, 'VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
      }
      fail(await admin.post('/admin/gamification/award', { userId: '999999', amount: 5, reason: 'x' }), 404, 'NOT_FOUND', 'Pengguna tidak dijumpai.')
      expect(await ledgerOf(t, id)).toHaveLength(rows)
    })
  })

  describe('transactions (S5)', () => {
    it('25 a page, newest first, with the name; the total is every ledger row', async () => {
      const body = GamificationAdminTransactionsResponseSchema.parse((await admin.get('/admin/gamification/transactions')).body)
      const total = Number((await t.db.query<{ n: string }>(`select count(*)::text n from coin_ledger`))[0]!.n)
      expect(body.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: total })
      expect(body.data).toHaveLength(Math.min(25, total))
      const times = body.data.map((r) => Date.parse(r.createdAt))
      expect(times.every((x, i) => i === 0 || (times[i - 1] as number) >= x)).toBe(true)
      expect(body.data[0]!.name).toBeTruthy()
    })

    it('type filter, an unknown type is empty, dates are inclusive Malaysia days and a malformed date is ignored', async () => {
      const get = async (q: string) => GamificationAdminTransactionsResponseSchema.parse((await admin.get(`/admin/gamification/transactions${q}`)).body)
      const bonus = await get('?type=bonus')
      expect(bonus.data.every((r) => r.type === 'bonus')).toBe(true)
      expect((await get('?type=nonsense')).data).toEqual([])
      expect((await get('?type=nonsense')).meta.totalItems).toBe(0)
      const day = await get('?dateFrom=2026-05-11&dateTo=2026-05-11')
      expect(day.meta.totalItems).toBe(Number((await t.db.query<{ n: string }>(`select count(*)::text n from coin_ledger where created_at >= '2026-05-11T00:00:00+08:00' and created_at < '2026-05-12T00:00:00+08:00'`))[0]!.n))
      expect(day.meta.totalItems).toBeGreaterThan(0)
      expect((await get('?dateFrom=garbage&dateTo=2026-13-45')).meta.totalItems).toBe((await get('')).meta.totalItems)
      expect((await get('?page=0')).meta.page).toBe(1)
    })
  })

  void anyId
})
