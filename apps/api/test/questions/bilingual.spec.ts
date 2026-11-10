import { QUESTION_MESSAGES, QuestionDetailSchema, QuestionSchema, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * S1-T09b part A (DM-50, FR-QA-17, 60 API-Q-03) [CI]: the bilingual round trip of the stem, the stimulus caption and body, and an option
 * body; the `ms` / `en` / `ms+en` tokens on create and update (stored `ms`, `en`, `ms_en`); a draft saves with an empty English text;
 * Jawi and Arab cannot be bilingual (known R1 limit, 422 on `language`). The English-required rule (send and Terbitkan) is part B.
 * Real database (testcontainers); not run where Docker is absent.
 */
describe('bilingual questions, schema and round trip (S1-T09b part A)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const storedLanguage = async (id: string): Promise<string> =>
    (await t.db.query<{ language: string }>(`select v.language from question_versions v join questions q on q.id = v.question_id and v.version_no = q.latest_version_no where q.id = $1::bigint`, [id]))[0]!.language
  const create = async (over: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data
  }

  it('migration 0129: stimuli.caption_en is a nullable text column and no CHECK was widened', async () => {
    const col = await t.db.query<{ data_type: string; is_nullable: string }>(`select data_type, is_nullable from information_schema.columns where table_name = 'stimuli' and column_name = 'caption_en'`)
    expect(col).toEqual([{ data_type: 'text', is_nullable: 'YES' }])
    const check = await t.db.query<{ def: string }>(`select pg_get_constraintdef(oid) def from pg_constraint where conname = 'ck_question_versions_language'`)
    expect(check[0]?.def).toContain("'ms_en'")
  })

  it.each([
    ['ms', 'ms', 'ms'],
    ['bm', 'ms', 'ms'],
    ['en', 'en', 'en'],
    ['ms+en', 'ms_en', 'ms+en'],
  ])('create with language %s stores %s and reads back %s (never bm)', async (sent, stored, wire) => {
    const q = await create({ language: sent })
    expect(q.language).toBe(wire)
    expect(await storedLanguage(q.id)).toBe(stored)
    expect(parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema).language).toBe(wire)
  })

  it('round-trips the English stem, the part prompt and an option body, and reads them on the detail', async () => {
    const parts = [
      {
        label: '1',
        prompt: { ms: 'Berapakah hasil tambah 2 dan 3?', en: 'What is the sum of 2 and 3?' },
        marks: 1,
        mode: 'mcq',
        options: ['A', 'B', 'C', 'D'].map((label, i) => ({ label, body: { ms: `Pilihan ${String(i + 4)}`, en: `Choice ${String(i + 4)}` } })),
        key: { kind: 'option', correct: 'B' },
      },
    ]
    const q = await create({ language: 'ms+en', questionTextEn: 'What is the sum of 2 and 3?', parts })
    expect(q.questionTextEn).toBe('What is the sum of 2 and 3?')
    const detail = parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema)
    expect(detail.language).toBe('ms+en')
    expect(detail.questionText).toBe('Berapakah hasil tambah 2 dan 3?')
    expect(detail.questionTextEn).toBe('What is the sum of 2 and 3?')
    const leaf = detail.parts?.[0] as { prompt: { ms: string; en?: string }; options: { body: { ms: string; en?: string } }[] }
    expect(leaf.prompt).toEqual({ ms: 'Berapakah hasil tambah 2 dan 3?', en: 'What is the sum of 2 and 3?' })
    expect(leaf.options[1]?.body).toEqual({ ms: 'Pilihan 5', en: 'Choice 5' })
    const row = (await t.db.query<{ stem_en: string | null }>(`select stem_en from question_versions v join questions q on q.id = v.question_id and v.version_no = q.latest_version_no where q.id = $1::bigint`, [q.id]))[0]!
    expect(row.stem_en).toBe('What is the sum of 2 and 3?')
  })

  it('a draft saves with an empty English text (the English-required rule is send and Terbitkan, part B)', async () => {
    for (const questionTextEn of ['', '   ', null, undefined]) {
      const q = await create({ language: 'ms+en', ...(questionTextEn === undefined ? {} : { questionTextEn }) })
      expect(q.status, String(questionTextEn)).toBe('draft')
      expect(q.language).toBe('ms+en')
      expect(q.questionTextEn ?? null).toBeNull()
    }
  })

  it('an update keeps ms_en when the language is omitted or repeated, and can change it back to ms or en', async () => {
    const q = await create({ language: 'ms+en', questionTextEn: 'English stem one.' })
    const put = async (over: Record<string, unknown>) => {
      const res = await admin.put(`/api/questions/${q.id}`, mcqBody(refs, over))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
    await put({})
    expect(await storedLanguage(q.id)).toBe('ms_en')
    await put({ language: 'ms+en', questionTextEn: 'English stem two.' })
    expect(await storedLanguage(q.id)).toBe('ms_en')
    expect(parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema).questionTextEn).toBe('English stem two.')
    await put({ language: 'ms' })
    expect(await storedLanguage(q.id)).toBe('ms')
    // The English stem is kept when the field is omitted: nothing is destroyed by a language switch.
    expect(parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema).questionTextEn).toBe('English stem two.')
    await put({ language: 'ms+en' })
    expect(await storedLanguage(q.id)).toBe('ms_en')
    await put({ language: 'en', questionTextEn: null })
    expect(await storedLanguage(q.id)).toBe('en')
    expect(parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema).questionTextEn ?? null).toBeNull()
  })

  it('Jawi and Arab cannot be bilingual: ms+en on a stored jawi or ar question is a 422 on language, other tokens keep the script', async () => {
    for (const script of ['jawi', 'ar']) {
      const q = await create()
      await t.db.query(`update question_versions v set language = $2 from questions qq where qq.id = v.question_id and v.version_no = qq.latest_version_no and qq.id = $1::bigint`, [q.id, script])
      const err = expectError(await admin.put(`/api/questions/${q.id}`, mcqBody(refs, { language: 'ms+en' })), 'VALIDATION_ERROR')
      expect(err.fields?.language, script).toBe(QUESTION_MESSAGES.language)
      expect(await storedLanguage(q.id)).toBe(script)
      const ok = await admin.put(`/api/questions/${q.id}`, mcqBody(refs, { language: 'ms' }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(await storedLanguage(q.id)).toBe(script)
    }
  })

  it('a stimulus round-trips caption, English caption and the bilingual body; null clears the English caption', async () => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan', caption: 'Rajah 1', captionEn: 'Figure 1', body: { ms: 'Teks petikan.', en: 'Passage text.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const s = mutationEnvelopeOf(StimulusSchema).parse(res.body).data
    expect(s).toMatchObject({ caption: 'Rajah 1', captionEn: 'Figure 1', body: { ms: 'Teks petikan.', en: 'Passage text.' } })
    expect(parseData(await admin.get(`/api/stimuli/${s.id}`), StimulusSchema)).toMatchObject({ captionEn: 'Figure 1' })
    const col = await t.db.query<{ caption_en: string | null; body_en: string | null }>(`select caption_en, body_en from stimuli where id = $1::bigint`, [s.id])
    expect(col).toEqual([{ caption_en: 'Figure 1', body_en: 'Passage text.' }])
    const kept = await admin.put(`/api/stimuli/${s.id}`, { label: 'Petikan 1' })
    expect(mutationEnvelopeOf(StimulusSchema).parse(kept.body).data.captionEn).toBe('Figure 1')
    const cleared = await admin.put(`/api/stimuli/${s.id}`, { captionEn: null })
    expect(mutationEnvelopeOf(StimulusSchema).parse(cleared.body).data.captionEn).toBeNull()
  })
})
