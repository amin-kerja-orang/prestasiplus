import { GamesHubSchema, GAMES_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, expectError, insertMcqQuestions, loginAs, parseData, type Client, type GamesTestApp } from '../helpers'

const M = GAMES_MESSAGES

/** FR-GM-00.1, FR-GM-00.2, AC-GM-00.6, AC-GM-00.7, FR-MUR-21-2, AC-PA-30: what the hub lists and what a start refuses. */
describe('hub list and the question gate', () => {
  let t: GamesTestApp
  let student: Client
  const enabled = async (): Promise<string[]> => parseData(await student.get('/api/games/hub'), GamesHubSchema).enabledGames
  const sessions = async (): Promise<number> => Number((await t.db.query<{ n: string }>('select count(*) as n from game_sessions'))[0]?.n)

  beforeAll(async () => {
    t = await bootGamesApp()
    student = await loginAs(t, ACCOUNTS.student)
    await t.db.query('update questions set is_active = false')
  })
  afterAll(async () => {
    await t.close()
  })

  it('with no playable question only the game without questions is listed', async () => {
    expect(await enabled()).toEqual(['roda-nasib'])
  })

  it('AC-GM-00.6: a pool of 10 and a game that draws 40: no card, and a direct start answers 422 with nothing started', async () => {
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 10, prefix: 'POOL', options: 4 })
    const list = await enabled()
    expect(list).toEqual(expect.arrayContaining(['battle', 'kad-memori'])) // draws of 5 and 6
    expect(list).not.toContain('betul-salah')
    const before = await sessions()
    expectError(await student.get('/api/games/solo/betul-salah?darjah=10'), 'VALIDATION_ERROR', M.startNotEnoughQuestions)
    expect(await sessions()).toBe(before)
  })

  it('AC-GM-00.7: a draft question never counts towards a pool', async () => {
    const before = await enabled()
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 40, prefix: 'DRAFT', status: 'draft' })
    expect(await enabled()).toEqual(before)
  })

  it('a pool that holds the draw lists the game, and the 4-option games count 4-option questions only', async () => {
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 40, prefix: 'THREE', options: 3 })
    const list = await enabled()
    expect(list).toContain('betul-salah')
    expect(list).toContain('papan-bijak')
    expect(list).not.toContain('cabaran-kilat')
    expect(list).not.toContain('tembak-jawapan')
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 30, prefix: 'FOUR', options: 4 })
    expect(await enabled()).toEqual(expect.arrayContaining(['cabaran-kilat', 'tembak-jawapan']))
  })

  it('FR-GM-00.1: a game switched off in `game_enabled_*` is absent, and a later save brings it back', async () => {
    const set = (value: number) =>
      t.db.query(`update gamification_settings set value = $1 where key = 'game_enabled_betul-salah'`, [value])
    await set(0)
    expect(await enabled()).not.toContain('betul-salah')
    await set(1)
    expect(await enabled()).toContain('betul-salah')
  })
})
