import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BattleLobbySchema } from '@pp/contract'

import { addMcqs, bootBattleApp, client, parseData, STUDENT_G10, subjectsOf, type BattleTestApp, type Subjects } from './arena-helpers'

describe('lobby (M16-15)', () => {
  let t: BattleTestApp
  let s: Subjects
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const emailOfGrade = async (grade: number) => (await rows<{ email: string }>(`select email from users u where grade = $1 and email is not null and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student') order by id limit 1`, [grade]))[0]?.email as string

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.bm, s.t4, 10)
  }, 180_000)
  afterAll(async () => t.close())

  it('grade 10: "Tingkatan 4", SPM unlocked, subjects by id with icon, colour and core, only subjects with an SPM pool in spmSubjects', async () => {
    const me = await client(t, STUDENT_G10)
    const res = await me.get('/battle/lobby')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const lobby = parseData(BattleLobbySchema, res)
    expect(lobby).toMatchObject({ grade: 10, gradeLabel: 'Tingkatan 4', spmUnlocked: true, pkskDomains: [] })
    const db = await rows<{ id: string; name: string; icon: string | null; color: string; is_core: boolean }>(`select id::text, name, icon, color, is_core from subjects where is_active order by subjects.id`)
    expect(lobby.subjects).toEqual(db.map((r) => ({ id: r.id, name: r.name, icon: r.icon, colour: r.color, core: r.is_core })))
    const withPool = await rows<{ id: string; name: string }>(
      `select sub.id::text, sub.name from subjects sub
        join question_versions v on v.subject_id = sub.id
        join questions q on q.id = v.question_id and q.live_version_no = v.version_no and q.is_active and v.status = 'published' and v.type = 'mcq'
        join education_levels ol on ol.id = v.education_level_id and ol.code in ('T4','T5') and ol.is_active
        join subject_levels sl on sl.subject_id = v.subject_id and sl.education_level_id = v.education_level_id
       where sub.is_active
         and not exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pksk_domain') group by sub.id, sub.name order by sub.id`,
    )
    expect(withPool.length).toBeGreaterThan(0)
    expect(lobby.spmSubjects).toEqual(withPool.map((r) => ({ id: r.id, name: r.name })))
    expect(lobby.spmSubjects?.map((x) => x.id)).toContain(s.bm)
    expect(lobby.subjects.find((x) => x.core)).toBeDefined()
  })

  it.each([
    [9, 'Tingkatan 3', false],
    [2, 'Darjah 2', false],
    [11, 'Tingkatan 5', true],
  ])('grade %i: "%s", spmUnlocked %s', async (grade, label, unlocked) => {
    const email = await emailOfGrade(grade)
    const lobby = parseData(BattleLobbySchema, await (await client(t, email)).get('/battle/lobby'))
    expect(lobby.gradeLabel).toBe(label)
    expect(lobby.spmUnlocked).toBe(unlocked)
    expect('spmSubjects' in lobby).toBe(unlocked)
  })

  it('a caller without a grade (staff) gets an empty label and no SPM; any signed-in role may read it', async () => {
    for (const email of ['admin@demo.test', 'guru@demo.test']) {
      const res = await (await client(t, email)).get('/battle/lobby')
      expect(res.status, email).toBe(200)
      expect(parseData(BattleLobbySchema, res)).toMatchObject({ grade: null, gradeLabel: '', spmUnlocked: false })
      expect(res.body.data).not.toHaveProperty('spmSubjects')
    }
  })
})
