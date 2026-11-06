import { PerformanceItemAnalysisMeSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { categoryOf } from '../../../../src/modules/reports/performance/services/item-analysis-me.service'
import { ctxOf, world, type World } from '../fakes/fixtures'
import type { AnswerRow } from '../fakes/in-memory-answer-facts'

/** API-RPT-05 (R1-MUR-6): the pupil's own Analisa Item, from the single answer store, every mode. All names are fictitious. */
let w: World
const ME = '900'
const me = ctxOf('student', ME, { level: 'self', label: 'Murid' })
const at = (minute: number): Date => new Date(`2026-09-20T10:${String(minute).padStart(2, '0')}:00+08:00`)

/** One answer of the pupil (subject 1, Latih Tubi unless `over` says otherwise). */
function ans(questionId: string, isCorrect: boolean, over: Partial<AnswerRow> = {}): void {
  w.answers.add({ userId: ME, subjectId: '1', questionId, mode: 'latih_tubi', isCorrect, answeredAt: at(0), ...over })
}
const run = async (query: Parameters<World['mine']['me']>[1] = {}) => {
  const r = await w.mine.me(me, query)
  PerformanceItemAnalysisMeSchema.parse(r)
  return r
}
const categories = (r: Awaited<ReturnType<typeof run>>): Record<string, string> => Object.fromEntries(r.items.map((i) => [i.questionId, i.category]))

beforeEach(() => {
  w = world()
  w.directory.addSubject('BM', '1', 'Bahasa Melayu').addSubject('MATH', '10', 'Matematik')
  for (const q of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'm1', 'm2']) w.content.add({ questionId: q })
})

describe('categories (FR-MUR-6-3)', () => {
  it('the rule: 1 attempt and 0 correct is isyarat_awal; 2 or more and 0 correct is pemulihan; 2 or more and some right is pengukuhan; the rest in no list', () => {
    expect(categoryOf(1, 0)).toBe('isyarat_awal')
    expect(categoryOf(2, 0)).toBe('pemulihan')
    expect(categoryOf(5, 0)).toBe('pemulihan')
    expect(categoryOf(2, 1)).toBe('pengukuhan')
    expect(categoryOf(5, 4)).toBe('pengukuhan')
    expect(categoryOf(1, 1)).toBeNull()
    expect(categoryOf(2, 2)).toBeNull()
    expect(categoryOf(0, 0)).toBeNull()
  })

  it('AC-MUR-6-4: a pupil with no answers gets zeros and no items (the page shows its empty copy)', async () => {
    expect(await run()).toEqual({ tiles: { answered: 0, needRemedial: 0, needStrengthen: 0, mastery: null }, subjects: [], counts: { isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 }, items: [] })
  })

  it('AC-MUR-6-1: a question answered wrong twice is under Pemulihan and "Perlu Pemulihan" is 1', async () => {
    ans('q1', false, { answeredAt: at(1) })
    ans('q1', false, { answeredAt: at(2) })
    const r = await run()
    expect(categories(r)).toEqual({ q1: 'pemulihan' })
    expect(r.tiles).toMatchObject({ answered: 2, needRemedial: 1, needStrengthen: 0 })
    expect(r.items[0]).toMatchObject({ attempts: 2, correct: 0, wrongTimes: 2 })
  })

  it('AC-MUR-6-2: a question answered right then wrong is under Pengukuhan', async () => {
    ans('q1', true, { answeredAt: at(1) })
    ans('q1', false, { answeredAt: at(2) })
    const r = await run()
    expect(categories(r)).toEqual({ q1: 'pengukuhan' })
    expect(r.tiles).toMatchObject({ needRemedial: 0, needStrengthen: 1 })
    expect(r.items[0]).toMatchObject({ attempts: 2, correct: 1, wrongTimes: 1 })
  })

  it('AC-MUR-6-3: a question answered wrong once is under Isyarat Awal only', async () => {
    ans('q1', false)
    const r = await run()
    expect(categories(r)).toEqual({ q1: 'isyarat_awal' })
    expect(r.counts).toEqual({ isyaratAwal: 1, pemulihan: 0, pengukuhan: 0 })
    expect(r.tiles).toMatchObject({ needRemedial: 0, needStrengthen: 0 })
  })

  it('AC-MUR-6-7: wrong once in Latih Tubi and wrong once in a Bijak sitting (two rows, two modes) is Pemulihan with 2 percubaan and 0 betul', async () => {
    ans('q1', false, { mode: 'latih_tubi' })
    ans('q1', false, { mode: 'simulasi', answeredAt: at(3) })
    const r = await run()
    expect(categories(r)).toEqual({ q1: 'pemulihan' })
    expect(r.items[0]).toMatchObject({ attempts: 2, correct: 0 })
    expect(r.tiles.needRemedial).toBe(1)
  })

  it('AC-MUR-6-8: a Battle answer counts, so a question wrong twice in Battle is under Pemulihan', async () => {
    ans('q1', false, { mode: 'battle' })
    ans('q1', false, { mode: 'battle', answeredAt: at(1) })
    expect(categories(await run())).toEqual({ q1: 'pemulihan' })
    // one in Battle and one in Latih Tubi: still both attempts
    ans('q2', false, { mode: 'battle' })
    ans('q2', false, { mode: 'latih_tubi', answeredAt: at(1) })
    const r = await run()
    expect(r.items.find((i) => i.questionId === 'q2')).toMatchObject({ category: 'pemulihan', attempts: 2 })
  })

  it('a question always right, or right once, is in no list but its answers count in the tiles', async () => {
    ans('q1', true)
    ans('q2', true)
    ans('q2', true, { answeredAt: at(1) })
    const r = await run()
    expect(r.items).toEqual([])
    expect(r.counts).toEqual({ isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 })
    expect(r.tiles).toEqual({ answered: 3, needRemedial: 0, needStrengthen: 0, mastery: 100 })
  })
})

describe('tiles and subjects', () => {
  it('"Soalan Dijawab" is the answer rows of every mode, also a row with no question id; "Tahap Penguasaan" is pooled and has one decimal', async () => {
    ans('q1', true)
    ans('q1', false, { mode: 'simulasi', answeredAt: at(1) })
    ans('q2', false, { mode: 'battle' })
    w.answers.add({ userId: ME, subjectId: '1', mode: 'structured', isCorrect: true, answeredAt: at(2) })
    const r = await run()
    expect(r.tiles).toMatchObject({ answered: 4, mastery: 50 })
    ans('q3', true)
    expect((await run()).tiles.mastery).toBe(60)
  })

  it('wire precision: accuracy and mastery are numbers with one decimal (2 of 3 is 66.7, not 66.67 and not 67)', async () => {
    ans('q1', true)
    ans('q2', true)
    ans('q3', false)
    const r = await run()
    expect(r.tiles.mastery).toBe(66.7)
    expect(r.subjects[0]?.accuracy).toBe(66.7)
    for (const v of [r.tiles.mastery, ...r.subjects.map((s) => s.accuracy)]) {
      expect(String(v).replace(/^\d+\.?/, '').length).toBeLessThanOrEqual(1)
    }
  })

  it('subject cards: attempts, unique questions, accuracy, and the three counters; ascending accuracy', async () => {
    // Bahasa Melayu: q1 wrong 2x (Pemulihan), q2 right+wrong (Pengukuhan), q3 wrong once (Isyarat Awal), q4 right once => 6 answers, 2 right
    ans('q1', false)
    ans('q1', false, { answeredAt: at(1) })
    ans('q2', true)
    ans('q2', false, { answeredAt: at(1) })
    ans('q3', false)
    ans('q4', true)
    // Matematik: m1 right twice, m2 right once => 3 answers, 3 right
    for (const q of ['m1', 'm1', 'm2']) w.answers.add({ userId: ME, subjectId: '10', questionId: q, mode: 'kuiz', isCorrect: true, answeredAt: at(4) })
    const r = await run()
    expect(r.subjects).toEqual([
      { code: 'BM', name: 'Bahasa Melayu', attempts: 6, uniqueQuestions: 4, accuracy: 33.3, wrongAnswers: 4, weakRepeated: 2, earlySignalWeak: 1 },
      { code: 'MATH', name: 'Matematik', attempts: 3, uniqueQuestions: 2, accuracy: 100, wrongAnswers: 0, weakRepeated: 0, earlySignalWeak: 0 },
    ])
    expect(r.counts).toEqual({ isyaratAwal: 1, pemulihan: 1, pengukuhan: 1 })
  })

  it('weakRepeated counts distinct questions, not attempts', async () => {
    for (let i = 0; i < 5; i++) ans('q1', false, { answeredAt: at(i) })
    const r = await run()
    expect(r.subjects[0]).toMatchObject({ attempts: 5, uniqueQuestions: 1, wrongAnswers: 5, weakRepeated: 1 })
  })

  it('subjectCode narrows the tiles, the subjects, the counts and the items; an unknown code is the empty payload', async () => {
    ans('q1', false)
    ans('q1', false, { answeredAt: at(1) })
    w.answers.add({ userId: ME, subjectId: '10', questionId: 'm1', mode: 'kuiz', isCorrect: false, answeredAt: at(2) })
    const bm = await run({ subjectCode: 'BM' })
    expect(bm.tiles).toMatchObject({ answered: 2, needRemedial: 1 })
    expect(bm.subjects.map((s) => s.code)).toEqual(['BM'])
    expect(bm.counts).toEqual({ isyaratAwal: 0, pemulihan: 1, pengukuhan: 0 })
    expect(bm.items.map((i) => i.questionId)).toEqual(['q1'])
    const math = await run({ subjectCode: 'MATH' })
    expect(math.items.map((i) => i.questionId)).toEqual(['m1'])
    expect(math.counts).toEqual({ isyaratAwal: 1, pemulihan: 0, pengukuhan: 0 })
    expect((await run({ subjectCode: 'TIADA' })).tiles.answered).toBe(0)
  })

  it('a pupil only ever sees the own answers: another pupil and a Mod Pelajar row are left out', async () => {
    ans('q1', false)
    w.answers.add({ userId: '901', subjectId: '1', questionId: 'q2', mode: 'latih_tubi', isCorrect: false, answeredAt: at(0) })
    ans('q3', false, { isTest: true })
    const r = await run()
    expect(r.tiles.answered).toBe(1)
    expect(r.items.map((i) => i.questionId)).toEqual(['q1'])
  })
})

describe('tapis (decision 7)', () => {
  beforeEach(() => {
    ans('q1', false)
    ans('q1', false, { answeredAt: at(1) }) // pemulihan
    ans('q2', true)
    ans('q2', false, { answeredAt: at(1) }) // pengukuhan
    ans('q3', false) // isyarat awal
  })

  it('semua (default) lists every category', async () => {
    expect(Object.keys(categories(await run())).sort()).toEqual(['q1', 'q2', 'q3'])
    expect(Object.keys(categories(await run({ tapis: 'semua' }))).sort()).toEqual(['q1', 'q2', 'q3'])
  })

  it('ada_betul keeps the questions with at least one right answer', async () => {
    expect(categories(await run({ tapis: 'ada_betul' }))).toEqual({ q2: 'pengukuhan' })
  })

  it('selalu_salah keeps the questions answered at least twice, all wrong (not the one-attempt question)', async () => {
    expect(categories(await run({ tapis: 'selalu_salah' }))).toEqual({ q1: 'pemulihan' })
  })

  it('tapis filters items only: tiles, subjects and counts do not change', async () => {
    const all = await run()
    for (const tapis of ['ada_betul', 'selalu_salah'] as const) {
      const r = await run({ tapis })
      expect(r.tiles).toEqual(all.tiles)
      expect(r.subjects).toEqual(all.subjects)
      expect(r.counts).toEqual(all.counts)
    }
  })

  it('selalu_salah is evaluated within the subject filter', async () => {
    // q1 is also answered right in subject 10 rows? no: a different question of another subject
    w.answers.add({ userId: ME, subjectId: '10', questionId: 'm1', mode: 'kuiz', isCorrect: false, answeredAt: at(5) })
    w.answers.add({ userId: ME, subjectId: '10', questionId: 'm1', mode: 'kuiz', isCorrect: false, answeredAt: at(6) })
    expect(categories(await run({ subjectCode: 'MATH', tapis: 'selalu_salah' }))).toEqual({ m1: 'pemulihan' })
    expect(categories(await run({ subjectCode: 'BM', tapis: 'selalu_salah' }))).toEqual({ q1: 'pemulihan' })
  })
})

describe('items (FR-MUR-6-5, -7, -10)', () => {
  it('an archived or unknown question is dropped from the list, the counts, the tiles and the subject counters', async () => {
    // q9 has no content (archived): wrong twice
    ans('q9', false)
    ans('q9', false, { answeredAt: at(1) })
    ans('q1', false)
    ans('q1', false, { answeredAt: at(1) })
    const r = await run()
    expect(r.items.map((i) => i.questionId)).toEqual(['q1'])
    expect(r.counts.pemulihan).toBe(1)
    expect(r.tiles.needRemedial).toBe(1)
    expect(r.subjects[0]).toMatchObject({ weakRepeated: 1 })
    // the answers themselves still count in "Soalan Dijawab"
    expect(r.tiles.answered).toBe(4)
  })

  it('an item carries subject, chapter, source, the question without a key, the explanation and the stimulus group', async () => {
    w.answers.addChapter('c1', { name: 'Bab Satu', subjectCode: 'BM' })
    w.content.add({
      questionId: 'q1',
      source: 'Set Contoh',
      explanation: 'Kerana contoh.',
      stimulusGroup: { id: 'g1', stimuli: [{ id: 's1', kind: 'passage', label: 'Petikan', body: { ms: 'Teks petikan.' }, imageId: null, alt: null }], questionIds: ['q1', 'q2'] },
    })
    ans('q1', false, { chapterId: 'c1' })
    ans('q1', false, { chapterId: 'c1', answeredAt: at(1) })
    const [item] = (await run()).items
    expect(item).toMatchObject({ questionId: 'q1', subject: 'Bahasa Melayu', chapter: 'Bab Satu', source: 'Set Contoh', explanation: 'Kerana contoh.' })
    expect(item?.stimulusGroup?.id).toBe('g1')
    expect(item?.question.questionText).toBe('Soalan q1')
    expect(JSON.stringify(item)).not.toMatch(/correctAnswer|"key"/)
  })

  it('a question with no chapter, no explanation and no group reads null; the time is Malaysian time', async () => {
    ans('q1', false, { answeredAt: new Date('2026-09-20T02:30:00Z') })
    const [item] = (await run()).items
    expect(item).toMatchObject({ chapter: null, explanation: null, stimulusGroup: null, source: '', lastAnsweredAt: '2026-09-20T10:30:00.000+08:00' })
  })

  it('inside the list: attempts descending, then the last attempt descending', async () => {
    ans('q1', false, { answeredAt: at(1) })
    ans('q1', false, { answeredAt: at(2) })
    ans('q2', false, { answeredAt: at(10) })
    ans('q2', false, { answeredAt: at(11) })
    ans('q3', false, { answeredAt: at(3) })
    ans('q3', false, { answeredAt: at(4) })
    ans('q3', false, { answeredAt: at(5) })
    ans('q4', false, { answeredAt: at(20) })
    expect((await run()).items.map((i) => i.questionId)).toEqual(['q3', 'q2', 'q1', 'q4'])
  })
})

describe('who may call it', () => {
  it('only a student: teacher, school admin, admin, officer, parent and sponsor are refused', async () => {
    for (const role of ['teacher', 'school_admin', 'admin', 'ppd_officer', 'parent', 'sponsor'] as const) {
      await expect(w.mine.me(ctxOf(role, ME), {}), role).rejects.toMatchObject({ status: 403 })
    }
  })
})
