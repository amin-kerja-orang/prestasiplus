import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { describeQuestion, eligibilityOf, type QuestionFacts } from '@pp/exam-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { poolTotals, sectionPoolCounts } from '../../src/modules/bijak/papers/pool-source'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

const leaf = (label: string, marks: number, extra: Record<string, unknown> = {}) => ({
  label,
  prompt: { ms: `Jawab bahagian ${label}.` },
  marks,
  mode: 'short_text',
  key: { kind: 'accepted', values: ['jawapan'] },
  ...extra,
})

/** BJS-07: the bank-backed candidate facts round-trip into exam-core eligibility. */
describe('QuestionsBijakPoolSource (BJS-07)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let source: QuestionsBijakPoolSource
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    source = t.app.get(QuestionsBijakPoolSource)
  })
  afterAll(async () => {
    await t.close()
  })

  const essay = (parts: unknown[], over: Record<string, unknown> = {}) =>
    mcqBody(refs, { questionType: 'essay', options: undefined, correctAnswer: undefined, parts, ...over })

  /** Creates a question; `publish` makes its version 1 the live published one (what the workflow ends with). */
  async function make(parts: unknown[], over: Record<string, unknown> = {}, publish = true): Promise<string> {
    const res = await admin.post('/api/questions', essay(parts, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    if (publish) {
      await t.db.query(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1`, [id])
    }
    return id
  }
  const facts = async (subjectId = refs.mathId): Promise<Map<string, QuestionFacts>> =>
    new Map((await source.candidatesOf(subjectId)).map((f) => [f.id, f]))
  const reasonsOf = (f: QuestionFacts | undefined): string[] => describeQuestion(f as QuestionFacts).reasons

  it('a fully tagged question is eligible; facts carry effective unit, TP, marks, mode, key and pools', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const id = await make([leaf('a', 2), leaf('b', 3, { difficultyTp: 5 })], { tag })
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'MAT2-A'), ($1, 'pool', 'MAT2-B')`, [id])
    const f = (await facts()).get(id) as QuestionFacts
    expect(f).toMatchObject({ id, groupId: null, versionNo: 1, tagReview: false, formOrigin: 't4', pools: ['MAT2-A', 'MAT2-B'] })
    expect(f.unit).toMatchObject({ nodeId: tag.unitId, level: 'T4' })
    expect(f.leaves).toMatchObject([
      { marks: 2, mode: 'short_text', tp: 3, kbat: false, hasKey: true },
      { marks: 3, mode: 'short_text', tp: 5, kbat: false, hasKey: true },
    ])
    expect(describeQuestion(f)).toMatchObject({ marks: 5, tp: 5, kbatMarks: 0, reasons: [], modes: ['short_text'] })
    expect(eligibilityOf(f, { allowedModes: [], pool: 'MAT2-A', quota: null }).eligible).toBe(true)
    expect(eligibilityOf(f, { allowedModes: [], pool: 'MAT2-C', quota: null }).reasons).toEqual(['pool_mismatch'])
    expect(eligibilityOf(f, { allowedModes: ['mcq'], pool: null, quota: null }).reasons).toEqual(['mode_not_allowed'])
  })

  it('a multi-unit leaf question: marks per effective unit are summed per leaf, the primary bucket stays the question unit', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const other = await t.db.query<{ id: string }>(
      `select id::text from curriculum_nodes where kind = 'unit' and subject_id = $1 and education_level_id = $2 and id <> $3 order by sort_order, id limit 1`,
      [refs.mathId, refs.t4Id, tag.unitId],
    )
    const second = other[0]?.id as string
    expect(second).toBeTruthy()
    const id = await make([leaf('a', 4, { unitNodeId: second }), leaf('b', 2)], { tag })
    const f = (await facts()).get(id) as QuestionFacts
    expect(f.leaves.map((l) => l.unit?.nodeId)).toEqual([second, tag.unitId])
    const d = describeQuestion(f)
    expect(d.reasons).toEqual([])
    expect(d.bucket).toBe(`unit:${tag.unitId}`)
    expect(d.unitMarks).toEqual({ [`unit:${second}`]: 4, [`unit:${tag.unitId}`]: 2 })
    const quota = (value: number, node: string) => ({ unit: { kind: 'unit' as const, nodeId: node }, value })
    // marks basis needs a quota line for EVERY leaf unit; questions basis only for the primary bucket.
    const marksBasis = { allowedModes: [], quota: { basis: 'marks' as const, lines: [quota(4, tag.unitId)] } }
    expect(eligibilityOf(f, marksBasis).reasons).toEqual(['unit_not_in_quota'])
    expect(eligibilityOf(f, { ...marksBasis, quota: { basis: 'marks', lines: [quota(4, tag.unitId), quota(4, second)] } }).eligible).toBe(true)
    expect(eligibilityOf(f, { allowedModes: [], quota: { basis: 'questions', lines: [quota(1, tag.unitId)] } }).eligible).toBe(true)
  })

  it("kbat: a level counts, 'bukan' overrides a KBAT question, no tag means not KBAT", async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const id = await make([leaf('a', 2, { kbat: 'bukan' }), leaf('b', 3), leaf('c', 4, { kbat: 'mencipta' })], { tag })
    await t.db.query(`update question_versions set kbat = 'menilai' where question_id = $1`, [id])
    const plain = await make([leaf('a', 2)], { tag })
    const all = await facts()
    const f = all.get(id) as QuestionFacts
    expect(f.leaves.map((l) => l.kbat)).toEqual([false, true, true])
    expect(describeQuestion(f)).toMatchObject({ marks: 9, kbatMarks: 7, reasons: [] })
    expect(describeQuestion(all.get(plain) as QuestionFacts).kbatMarks).toBe(0)
  })

  it('tag_review makes a question ineligible (reason tag_review) but it stays a candidate', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const id = await make([leaf('a', 2)], { tag })
    await t.db.query(`update question_versions set tag_review = true where question_id = $1`, [id])
    const f = (await facts()).get(id) as QuestionFacts
    expect(f.tagReview).toBe(true)
    expect(reasonsOf(f)).toEqual(['tag_review'])
    expect(eligibilityOf(f, { allowedModes: [], quota: null }).eligible).toBe(false)
  })

  it('missing unit, TP, marks and key map to their reasons (inheritance respected)', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const noUnit = await make([leaf('a', 2)], { questionText: 'Soalan tanpa unit.' })
    const noTp = await make([leaf('a', 2)], { tag })
    await t.db.query(`update question_versions set difficulty_tp = null where question_id = $1`, [noTp])
    const noMarks = await make([leaf('a', 2)], { tag })
    await t.db.query(
      `update question_parts set marks = 0 where question_version_id in (select id from question_versions where question_id = $1)`,
      [noMarks],
    )
    const noKey = await make([leaf('a', 2)], { tag })
    await t.db.query(
      `delete from answer_keys where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1)`,
      [noKey],
    )
    // A leaf TP override rescues a question whose version has no TP.
    const rescued = await make([leaf('a', 2, { difficultyTp: 4 })], { tag })
    await t.db.query(`update question_versions set difficulty_tp = null where question_id = $1`, [rescued])
    const all = await facts()
    expect(reasonsOf(all.get(noUnit))).toContain('no_unit')
    expect(reasonsOf(all.get(noTp))).toEqual(['no_tp'])
    expect(reasonsOf(all.get(noMarks))).toEqual(['no_marks'])
    expect(reasonsOf(all.get(noKey))).toEqual(['no_key'])
    expect(reasonsOf(all.get(rescued))).toEqual([])
  })

  it('stimulus group: id, position and size (members that are not published still count)', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const group = (await t.db.query<{ id: string }>(`insert into stimulus_groups (label) values ('Kumpulan ujian') returning id::text`))[0]?.id as string
    const a = await make([leaf('a', 2)], { tag })
    const b = await make([leaf('a', 2)], { tag })
    const draft = await make([leaf('a', 2)], { tag }, false)
    for (const [i, id] of [a, b, draft].entries()) {
      await t.db.query(`update questions set group_id = $1, group_position = $2 where id = $3`, [group, i + 1, id])
    }
    const all = await facts()
    expect(all.get(a)).toMatchObject({ groupId: group, groupPosition: 1, groupSize: 3 })
    expect(all.get(b)).toMatchObject({ groupId: group, groupPosition: 2, groupSize: 3 })
    expect(all.has(draft)).toBe(false)
  })

  it('only published, active questions of the subject are candidates', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const sciTag = await tagOf(t.db, refs.sciId, refs.t4Id)
    const draft = await make([leaf('a', 2)], { tag }, false)
    const inactive = await make([leaf('a', 2)], { tag })
    await t.db.query(`update questions set is_active = false where id = $1`, [inactive])
    const sci = await make([leaf('a', 2)], { tag: sciTag, subjectId: refs.sciId })
    const math = await facts()
    expect(math.has(draft)).toBe(false)
    expect(math.has(inactive)).toBe(false)
    expect(math.has(sci)).toBe(false)
    expect((await facts(refs.sciId)).has(sci)).toBe(true)
    expect(await source.candidatesOf('not-an-id')).toEqual([])
  })

  it('totals: publishedTotal = eligibleTotal + excluded.total, per-reason counts and bank links', async () => {
    const list = [...(await facts()).values()]
    const totals = poolTotals(list, refs.mathId)
    expect(totals.publishedTotal).toBe(list.length)
    expect(totals.publishedTotal).toBe(totals.eligibleTotal + totals.excluded.total)
    expect(totals.excluded.total).toBeGreaterThanOrEqual(5)
    const by = new Map(totals.excluded.byReason.map((r) => [r.reason, r]))
    expect([...by.keys()]).toEqual(['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review'])
    for (const r of ['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review'] as const) expect(by.get(r)?.count).toBeGreaterThanOrEqual(1)
    expect(by.get('tag_review')?.bankQuery).toEqual({ subjectId: refs.mathId, status: 'approved', tagReview: 'true' })
    expect(by.get('no_key')?.bankQuery).toMatchObject({ missing: 'key' })
    // modeExcluded: base-eligible questions of the pool whose mode is not allowed in the section.
    const counts = sectionPoolCounts(list, { allowedModes: ['mcq'], pool: 'MAT2-A' })
    expect(counts.eligible).toBe(0)
    expect(counts.modeExcluded).toBe(1)
    expect(sectionPoolCounts(list, { allowedModes: ['short_text'], pool: 'MAT2-A' })).toEqual({ eligible: 1, modeExcluded: 0 })
  })

  it('performance: a 3000-question pool is read in a few round trips', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const model = await make([leaf('a', 2), leaf('b', 3)], { tag })
    await t.db.query(
      `insert into questions (is_active, latest_version_no, live_version_no)
       select true, 1, 1 from generate_series(1, 3000)`,
    )
    // Clone the model version and its parts onto the new questions.
    await t.db.query(
      `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, unit_node_id, difficulty_tp, form_origin, language, published_at)
       select q.id, 1, 'approved', v.type, v.stem_ms, v.subject_id, v.education_level_id, v.unit_node_id, v.difficulty_tp, v.form_origin, v.language, now()
         from questions q, question_versions v
        where v.question_id = $1 and q.id > $1 and q.live_version_no = 1 and not exists (select 1 from question_versions x where x.question_id = q.id)`,
      [model],
    )
    await t.db.query(
      `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode)
       select nv.id, p.position, p.depth, p.label, p.prompt_ms, p.marks, p.mode
         from question_versions nv, question_parts p
        where p.question_version_id = (select id from question_versions where question_id = $1) and nv.question_id > $1
          and not exists (select 1 from question_parts z where z.question_version_id = nv.id)`,
      [model],
    )
    const started = Date.now()
    const all = await source.candidatesOf(refs.mathId)
    const ms = Date.now() - started
    expect(all.length).toBeGreaterThan(3000)
    // Cloned questions have no keys: they are excluded by no_key, which proves the facts are complete at scale.
    expect(poolTotals(all, refs.mathId).excluded.byReason.find((r) => r.reason === 'no_key')?.count).toBeGreaterThanOrEqual(3000)
    console.info(`BJS-07 candidatesOf: ${all.length} questions in ${ms} ms`)
    expect(ms).toBeLessThan(15_000)
  })
})
