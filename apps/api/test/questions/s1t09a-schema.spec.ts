import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { draftsFromParts } from '../../src/modules/questions/tree'
import { adminActor, apiError, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

const shortPart = (over: Record<string, unknown> = {}) => ({
  label: '',
  prompt: { ms: 'Nyatakan satu contoh.' },
  mode: 'short_text',
  marks: 2,
  cognitiveLevel: 'mengaplikasi',
  key: { kind: 'accepted', values: ['a'] },
  ...over,
})

const MARKS_MIN = 'Nilai mata mesti sekurang-kurangnya 1.'

/** S1-T09a part 2: migrations 0133 (DM-54, DM-55) and 0134 (DM-69), the modeConfig round trip, strict write / lenient read. */
describe('S1-T09a schema (migrations 0133, 0134)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const make = (parts: unknown[]) =>
    svc.create(mcqInput(tag, { questionType: 'short_answer', options: undefined, correctAnswer: undefined, questionText: 'Soalan ujian skema v2.', parts: parts as never }), admin)

  it('0133 adds nullable jsonb scheme_rules and mode_config with DM comments; existing rows stay NULL', async () => {
    const cols = await t.db.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
      `select table_name, column_name, data_type, is_nullable from information_schema.columns
       where (table_name, column_name) in (('question_versions','scheme_rules'),('question_parts','mode_config')) order by table_name`,
    )
    expect(cols).toEqual([
      { table_name: 'question_parts', column_name: 'mode_config', data_type: 'jsonb', is_nullable: 'YES' },
      { table_name: 'question_versions', column_name: 'scheme_rules', data_type: 'jsonb', is_nullable: 'YES' },
    ])
    const [c] = await t.db.query<{ n: string }>(`select count(*) n from question_versions where scheme_rules is not null`)
    expect(c?.n).toBe('0')
    const [d] = await t.db.query<{ d: string }>(
      `select col_description('question_parts'::regclass, (select attnum from pg_attribute where attrelid = 'question_parts'::regclass and attname = 'mode_config')) d`,
    )
    expect(d?.d).toContain('DM-55')
  })

  it('0134 widens ck_question_versions_type: accepts the three new types, rejects bogus', async () => {
    const [q] = await t.db.query<{ id: string }>(`select id::text id from question_versions limit 1`)
    expect(q).toBeDefined()
    for (const type of ['mcq_multi', 'true_false', 'fill_blank', 'short', 'table']) {
      await t.db.query(`update question_versions set type = $1 where id = $2`, [type, q?.id])
    }
    await expect(t.db.query(`update question_versions set type = 'bogus' where id = $1`, [q?.id])).rejects.toThrow(/ck_question_versions_type/)
  })

  it('a write of modeConfig on a part round-trips (draft mapping, store and read)', async () => {
    const modeConfig = { maxWords: 50, hardLimit: true }
    expect(draftsFromParts([shortPart({ modeConfig }) as never])[0]?.modeConfig).toEqual(modeConfig)
    expect(draftsFromParts([shortPart() as never])[0]?.modeConfig).toBeNull()
    const q = await make([shortPart({ modeConfig })])
    const [row] = await t.db.query<{ mode_config: unknown }>(
      `select p.mode_config from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1`,
      [q.id],
    )
    expect(row?.mode_config).toEqual(modeConfig)
    expect((await repo.get(q.id, 'latest'))?.version.parts[0]).toMatchObject({ modeConfig })
  })

  it('the write path is strict: marks 0 without example and duplicate option labels are refused with the PRD message', async () => {
    const err = await apiError(() => make([shortPart({ marks: 0 })]))
    expect(err.getStatus()).toBe(422)
    expect(Object.values(err.fields ?? {})).toContain(MARKS_MIN)
    const dup = await apiError(() =>
      make([
        {
          label: '',
          prompt: { ms: 'Pilih.' },
          mode: 'mcq',
          marks: 1,
          cognitiveLevel: 'mengaplikasi',
          options: ['A', 'A', 'B'].map((label) => ({ label, body: { ms: label } })),
          key: { kind: 'option', correct: 'A' },
        },
      ]),
    )
    expect(dup.getStatus()).toBe(422)
  })

  it('the read path stays lenient: a stored row with marks 0 and no example still reads', async () => {
    const q = await make([shortPart()])
    await t.db.query(`update question_parts set marks = 0 where question_version_id in (select id from question_versions where question_id = $1)`, [q.id])
    expect((await repo.get(q.id, 'latest'))?.version.parts[0]).toMatchObject({ marks: 0, mode: 'short_text' })
  })
})
