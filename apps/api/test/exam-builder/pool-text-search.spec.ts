import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionBankBuilderSource } from '../../src/modules/exam/builder'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1 perf (T54 F2): "Cari soalan" matches the picker text in SQL (`matchText`) and describes only the page that is shown. The SQL match must
 * give exactly the questions the in-memory filter gave: `preview` (stem, then " {label} {prompt}" of a leaf first part) or topic, contains
 * the needle, case-insensitively. Real BE-09 bank.
 */
describe('QuestionBankBuilderSource.matchText equals the describe-based text filter', () => {
  let t: FullApp
  let admin: FullClient
  let source: QuestionBankBuilderSource
  let ids: string[]
  let unitTitle: string

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)

  beforeAll(async () => {
    t = await bootFullApp()
    admin = await loginFull(t, ACCOUNTS.admin)
    source = t.app.get(QuestionBankBuilderSource)
    const subject = String((await q(`select id::text id from subjects where code = 'MATH'`))[0]!.id)
    const level = String((await q(`select id::text id from education_levels where code = 'T4'`))[0]!.id)
    const unit = (await q(`select id::text id, title from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`))[0]!
    unitTitle = String(unit.title)
    const tag = { unitId: String(unit.id), spIds: [] as string[], tp: 3 }
    const base = { subjectId: subject, educationLevelId: level, difficultyLevel: 3, kertas: '2' }
    const make = async (body: Record<string, unknown>): Promise<string> => {
      const res = await admin.post('/api/questions', { ...base, ...body })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      return res.body.data.id as string
    }
    const leaf = (label: string, prompt: string) => ({ label, mode: 'short_text', prompt: { ms: prompt }, marks: 1, key: { kind: 'accepted', values: ['x'] } })
    ids = [
      // flat questions: the stem is the whole preview (the part prompt equals the stem)
      await make({ questionType: 'mcq', questionText: 'Berapakah hasil tambah 2 dan 3?', options: ['4', '5', '6', '7'], correctAnswer: 1, tag }),
      await make({ questionType: 'mcq', questionText: 'Nyatakan 100% daripada nilai x_y itu.', options: ['4', '5', '6', '7'], correctAnswer: 1 }),
      await make({ questionType: 'mcq', questionText: 'Ungkapan \\ dan [kurungan] (ujian)', options: ['4', '5', '6', '7'], correctAnswer: 1 }),
      // structured: stem + first leaf part
      await make({ questionType: 'essay', questionText: 'Rajah menunjukkan sebuah segi empat tepat.', parts: [leaf('a', 'Kira luas segi empat tepat itu.'), leaf('b', 'Kira perimeternya.')] }),
      await make({ questionType: 'essay', questionText: '   Stem berjarak   ', parts: [leaf('1', 'Bahagian pertama berjarak.')] }),
      await make({ questionType: 'essay', questionText: 'Stem yang sama dengan petunjuk', parts: [leaf('a', 'Stem yang sama dengan petunjuk')] }),
    ]
    expect(ids).toHaveLength(6)
  })
  afterAll(async () => {
    await t.close()
  })

  async function expected(needle: string): Promise<Set<string>> {
    const info = await source.describe(ids.map((id) => ({ id })))
    const low = needle.toLowerCase()
    return new Set([...info].filter(([, i]) => i.preview.toLowerCase().includes(low) || i.topic.toLowerCase().includes(low)).map(([id]) => id))
  }

  const needles = [
    'hasil', 'HASIL', 'Tambah 2', 'dan 3?', '%', '_', 'x_y', '100%', '\\', '[kurungan]', '(ujian)',
    'segi empat', 'tepat. a kira', 'Kira luas', 'perimeter', 'stem berjarak 1 bahagian', 'bahagian pertama', 'stem yang sama', 'petunjuk a ', 'tiada-padanan-ini',
  ]

  it('gives the same questions as the in-memory filter for every needle (stem, leaf part, joins, wildcards, spaces)', async () => {
    for (const needle of needles) {
      const hit = await source.matchText(ids, needle)
      expect([...hit].sort(), JSON.stringify(needle)).toEqual([...(await expected(needle))].sort())
    }
  })

  it('matches the topic (the unit title) too, and a literal % or _ is not a wildcard', async () => {
    expect(unitTitle.length).toBeGreaterThan(3)
    const needle = unitTitle.slice(1, 6)
    const hit = await source.matchText(ids, needle)
    expect([...hit].sort()).toEqual([...(await expected(needle))].sort())
    expect(hit.size).toBeGreaterThan(0) // only the first question carries the unit tag
    expect((await source.matchText(ids, '%')).size).toBe(1)
    expect((await source.matchText(ids, '_')).size).toBe(1)
  })

  it('an empty needle, no ids and an unknown id match nothing; only the given ids are searched', async () => {
    expect((await source.matchText(ids, '')).size).toBe(0)
    expect((await source.matchText([], 'hasil')).size).toBe(0)
    expect((await source.matchText(['987654321', 'abc'], 'hasil')).size).toBe(0)
    expect([...(await source.matchText([ids[0]!], 'hasil'))]).toEqual([ids[0]])
    expect((await source.matchText([ids[3]!], 'hasil')).size).toBe(0)
  })
})
