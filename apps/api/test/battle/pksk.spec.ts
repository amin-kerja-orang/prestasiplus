import { BATTLE_MESSAGES, BattleArenaViewSchema, BattleLobbySchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { PkskQuestionsService } from '../../src/modules/questions'
import { bootBattleApp, client, matchBot, parseData, STUDENT_G10, STUDENT_G10_B, type BattleTestApp, type Client } from './arena-helpers'

type Option = { text: string; isCorrect: boolean }
const one = (n = 4): Option[] => Array.from({ length: n }, (_, i) => ({ text: `Pilihan ${i + 1}`, isCorrect: i === 1 }))

/** S7-T01 part 2, the Battle PKSK tab (48 GAME-01, ruling 3 on #497): domains, grant at match start, draw, arena. */
describe('Battle PKSK tab', () => {
  let t: BattleTestApp
  let a: Client
  let b: Client
  let adminId: string
  let domains: { id: string; code: string }[]
  let domain: { id: string; code: string }
  let n = 0

  const start = (who: Client, level: 'T1' | 'T4' = 'T1', domainId = domain.id, path = '/battle/quick-match', extra: object = {}) =>
    who.post(path, { question_type: 'pksk', pksk_domain_id: domainId, pksk_target_level: level, ...extra })

  const grant = async (who: Client, level: 'T1' | 'T4' | 'ALL', expiresAt: string | null = null) => {
    const [pkg] = await t.db.query<{ id: string }>('select id::text from pksk_packages where level = $1', [level])
    await t.db.query('insert into pksk_accesses (user_id, package_id, expires_at, status) values ($1, $2, $3, $4)', [who.id, pkg!.id, expiresAt, 'active'])
  }

  /** Adds approved PKSK questions through the owner's write path and returns their ids. */
  const addQuestions = async (count: number, options: Option[], code = domain.code, level: 'T1' | 'T4' = 'T1'): Promise<string[]> => {
    const service = t.get(PkskQuestionsService)
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      n += 1
      const q = await service.create({ domainCode: code, targetLevel: level, status: 'approved', questionText: `Soalan PKSK ${n}`, difficultyLevel: null, explanation: null, options }, adminId)
      ids.push(q.id)
    }
    t.get(BattleDeps).invalidateCache()
    return ids
  }

  beforeAll(async () => {
    t = await bootBattleApp()
    a = await client(t, STUDENT_G10)
    b = await client(t, STUDENT_G10_B)
    adminId = (await client(t, 'admin@demo.test')).id
    domains = await t.db.query<{ id: string; code: string }>('select id::text, code from pksk_domains where is_active order by display_order, id')
    domain = domains[0]!
  }, 180_000)
  afterAll(async () => t.close())
  beforeEach(async () => {
    await t.db.query('delete from pksk_accesses')
    t.get(BattleDeps).invalidateCache()
  })

  describe('lobby', () => {
    it('lists the active domains and a pupil without a grant has no access', async () => {
      const lobby = parseData(BattleLobbySchema, await a.get('/battle/lobby'))
      expect(lobby.pkskDomains.map((d) => d.id)).toEqual(domains.map((d) => d.id))
      expect(lobby.pkskAccess).toEqual({ T1: false, T4: false })
    })

    it('shows the grant per level and leaves out an inactive domain', async () => {
      await grant(a, 'T1')
      const last = domains.at(-1)!
      await t.db.query('update pksk_domains set is_active = false where id = $1', [last.id])
      const lobby = parseData(BattleLobbySchema, await a.get('/battle/lobby'))
      expect(lobby.pkskAccess).toEqual({ T1: true, T4: false })
      expect(lobby.pkskDomains.map((d) => d.id)).not.toContain(last.id)
      await t.db.query('update pksk_domains set is_active = true where id = $1', [last.id])
    })

    it('an expired grant is no access; the active role admin has both levels', async () => {
      await grant(a, 'ALL', '2020-01-01')
      expect(parseData(BattleLobbySchema, await a.get('/battle/lobby')).pkskAccess).toEqual({ T1: false, T4: false })
      const admin = await client(t, 'admin@demo.test')
      expect(parseData(BattleLobbySchema, await admin.get('/battle/lobby')).pkskAccess).toEqual({ T1: true, T4: true })
    })
  })

  describe('grant at match start', () => {
    it('no grant: Quick Match and Battle Sekolah are 403 with the empty body; nothing is queued', async () => {
      await addQuestions(10, one())
      const before = await t.db.query('select 1 from battle_queues')
      for (const path of ['/battle/quick-match', '/battle/school-battle']) {
        const res = await start(a, 'T1', domain.id, path)
        expect(res.status).toBe(403)
        expect(res.body).toEqual({})
      }
      expect(await t.db.query('select 1 from battle_queues')).toHaveLength(before.length)
    })

    it('a grant for the other level is 403; an unknown domain is 422 first', async () => {
      await grant(a, 'T4')
      expect((await start(a, 'T1')).status).toBe(403)
      expect((await start(a, 'T1', '999999')).status).toBe(422)
    })

    it('Cabar Kawan: the sender needs a grant, then the receiver at accept', async () => {
      await addQuestions(10, one())
      const invite = { receiver_id: b.id }
      const refused = await start(a, 'T1', domain.id, '/battle/invite', invite)
      expect(refused.status).toBe(403)
      expect(refused.body).toEqual({ error: BATTLE_MESSAGES.pkskNoAccess })

      await grant(a, 'ALL')
      expect((await start(a, 'T1', domain.id, '/battle/invite', invite)).status).toBe(200)
      const [inv] = await t.db.query<{ id: string }>(`select id::text from battle_invitations where receiver_id = $1 and question_type = 'pksk' and status = 'pending'`, [b.id])
      const denied = await b.post(`/battle/invite/${inv!.id}/accept`)
      expect(denied.status).toBe(422)
      expect(denied.body).toEqual({ error: BATTLE_MESSAGES.pkskNoAccess })
      await grant(b, 'T1')
      const accepted = await b.post(`/battle/invite/${inv!.id}/accept`)
      expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    })
  })

  describe('draw', () => {
    it('a pool below the battle size is 422; only servable questions count', async () => {
      await grant(a, 'ALL')
      const pick = domains[1]!
      const code = pick.code
      await addQuestions(9, one(), code)
      await addQuestions(2, [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: true }], code)
      await addQuestions(2, one(5), code)
      await addQuestions(2, [], code)
      await addQuestions(2, one(), code, 'T4')
      const res = await start(a, 'T1', pick.id)
      expect(res.status).toBe(422)
      expect(res.body).toEqual({})
    })

    it('a group, a stimulus or an option image keeps a question out', async () => {
      await grant(a, 'ALL')
      const pick = domains[3]!
      await addQuestions(9, one(), pick.code)
      const [grouped, linked, withImage] = await addQuestions(3, one(), pick.code)
      const version = async (id: string | undefined) =>
        (await t.db.query<{ id: string }>('select v.id::text from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1', [id]))[0]!.id

      const [group] = await t.db.query<{ id: string }>(`insert into stimulus_groups (label) values ('Rajah 1') returning id::text`)
      await t.db.query('update questions set group_id = $1, group_position = 1 where id = $2', [group!.id, grouped])
      const [stimulus] = await t.db.query<{ id: string }>(`insert into stimuli (kind, body_ms) values ('passage', 'Petikan') returning id::text`)
      await t.db.query('insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)', [await version(linked), stimulus!.id])
      const [file] = await t.db.query<{ id: string }>(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('pkskbattleimage0000001', 'question_image', 'image/png', 1, repeat('a', 64), 'pksk-battle-image') returning id::text`)
      await t.db.query('update part_options set image_file_id = $1 where part_id in (select id from question_parts where question_version_id = $2)', [file!.id, await version(withImage)])
      t.get(BattleDeps).invalidateCache()

      expect((await start(a, 'T1', pick.id)).status).toBe(422)
      await addQuestions(1, one(), pick.code)
      expect((await start(a, 'T1', pick.id)).status).toBe(200)
    })

    it('Quick Match reaches a battle of ten different questions of that domain only', async () => {
      await grant(a, 'ALL')
      const pick = domains[2]!
      const ids = await addQuestions(12, one(), pick.code)
      await addQuestions(5, one(), domains[4]!.code)
      const res = await start(a, 'T1', pick.id)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const uuid = await matchBot(a, res.body.queue_id as string)
      const drawn = await t.db.query<{ question_id: string }>('select question_id::text from battle_questions where battle_id = $1 order by position', [uuid])
      expect(drawn).toHaveLength(10)
      expect(new Set(drawn.map((d) => d.question_id)).size).toBe(10)
      for (const d of drawn) expect(ids).toContain(d.question_id)
    })
  })

  describe('arena', () => {
    it('serves text and options with no key, and grades the one correct option', async () => {
      await grant(a, 'ALL')
      const pick = domains[5]!
      await addQuestions(10, one(3), pick.code)
      const res = await start(a, 'T1', pick.id)
      const uuid = await matchBot(a, res.body.queue_id as string)
      const view = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
      expect(view.question?.text).toMatch(/^Soalan PKSK /)
      expect(view.question?.options).toEqual([
        { id: 0, label: 'A', text: 'Pilihan 1' },
        { id: 1, label: 'B', text: 'Pilihan 2' },
        { id: 2, label: 'C', text: 'Pilihan 3' },
      ])
      expect(JSON.stringify(view)).not.toMatch(/isCorrect|correct_answer|correctOptionId/)

      const wrong = await a.post(`/battle/arena/${uuid}/answer`, { questionId: view.question?.id, optionId: 0, seconds: 1 })
      expect(wrong.status, JSON.stringify(wrong.body)).toBe(200)
      expect(wrong.body.data).toMatchObject({ correct: false, correctOptionId: 1 })
      const second = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
      const right = await a.post(`/battle/arena/${uuid}/answer`, { questionId: second.question?.id, optionId: 1, seconds: 1 })
      expect(right.body.data).toMatchObject({ correct: true, correctOptionId: 1 })
    })
  })
})
