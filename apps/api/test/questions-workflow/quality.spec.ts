import { QuestionQualityAuditedSchema, QuestionQualitySummarySchema, questionQualityBandOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bucketOfScore, scoreQuestion } from '../../src/modules/questions/workflow/quality'
import { bootWorkflowApp, count, expectCsrfInvalid, expectError, loginAll, parseData, type Client, type WorkflowTestApp } from './helpers'

type Roles = Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>

const GOOD = { stemText: 'Soalan yang cukup panjang untuk markah penuh', explanation: 'Penjelasan.', untagged: false, sourceType: 'manual', quarantinedOrRejected: false }

describe('scoreQuestion and bands (BE-10 AC 7, BR-M04-21)', () => {
  it('a complete question scores 100 and each deduction is the mock value', () => {
    expect(scoreQuestion(GOOD)).toBe(100)
    expect(scoreQuestion({ ...GOOD, explanation: null })).toBe(85)
    expect(scoreQuestion({ ...GOOD, explanation: '   ' })).toBe(85)
    expect(scoreQuestion({ ...GOOD, untagged: true })).toBe(90)
    expect(scoreQuestion({ ...GOOD, sourceType: null })).toBe(90)
    expect(scoreQuestion({ ...GOOD, quarantinedOrRejected: true })).toBe(85)
    expect(scoreQuestion({ ...GOOD, stemText: 'x'.repeat(19) })).toBe(90)
    expect(scoreQuestion({ ...GOOD, stemText: 'x'.repeat(20) })).toBe(100)
  })

  it('every deduction together scores 40 (the lowest the formula gives)', () => {
    expect(scoreQuestion({ stemText: 'kecil', explanation: null, untagged: true, sourceType: null, quarantinedOrRejected: true })).toBe(40)
  })

  it('band boundaries: 76 | 75, 51 | 50, 26 | 25, 0 and 100', () => {
    const bands: [number, string][] = [[100, 'cemerlang'], [76, 'cemerlang'], [75, 'baik'], [51, 'baik'], [50, 'lemah'], [26, 'lemah'], [25, 'kritikal'], [0, 'kritikal']]
    for (const [score, band] of bands) {
      expect(bucketOfScore(score), String(score)).toBe(band)
      expect(questionQualityBandOf(score)).toBe(band)
    }
  })

  it('75 (explanation and tag missing) is Baik, 80 is Cemerlang, 50 is Lemah', () => {
    expect(bucketOfScore(scoreQuestion({ ...GOOD, explanation: null, untagged: true }))).toBe('baik')
    expect(bucketOfScore(scoreQuestion({ ...GOOD, untagged: true, sourceType: null }))).toBe('cemerlang')
    expect(scoreQuestion({ ...GOOD, explanation: null, quarantinedOrRejected: true, untagged: true, stemText: 'kecil' })).toBe(50)
  })
})

describe('question quality routes (BE-10 AC 7)', () => {
  let t: WorkflowTestApp
  let c: Roles
  let levelId: string
  let subjectIds: string[]

  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    levelId = (await t.db.query<{ id: string }>("select id::text from education_levels where stage <> 'primary' order by id limit 1"))[0]!.id
    subjectIds = (await t.db.query<{ id: string }>('select id::text from subjects order by id limit 2')).map((r) => r.id)
    const base = { subjectId: subjectIds[0]!, educationLevelId: levelId }
    const seed = (id: string, quality: Record<string, unknown>) =>
      t.fake.seed({ id, quality: { subjectId: base.subjectId, subjectName: 'Matematik', educationLevelId: base.educationLevelId, levelName: 'Tingkatan 4', ...quality } })
    seed('101', { ...GOOD }) // 100 cemerlang
    seed('102', { ...GOOD, untagged: true, sourceType: null }) // 80 cemerlang
    seed('103', { ...GOOD, explanation: null, untagged: true }) // 75 baik
    seed('104', { ...GOOD, explanation: null, untagged: true, quarantinedOrRejected: true, stemText: 'kecil', sourceSet: 'Set A' }) // 50 lemah
    seed('105', { ...GOOD, explanation: null, untagged: true, sourceType: null, quarantinedOrRejected: true, stemText: 'kecil', isLegacy: true }) // 40 lemah, legacy
    seed('106', { ...GOOD, explanation: null, untagged: true, sourceType: null, quarantinedOrRejected: true, stemText: 'kecil', subjectId: subjectIds[1]!, subjectName: 'Sains' }) // 40 lemah
  })
  afterAll(async () => {
    await t.close()
  })

  it('401 without a session, 403 for teacher, school admin and student', async () => {
    expectError(await t.http().get('/api/question-quality'), 'UNAUTHORIZED')
    expectError(await t.http().post('/api/question-quality/audit'), 'UNAUTHORIZED')
    for (const who of [c.teacher, c.schoolAdmin, c.student]) {
      expectError(await who.get('/api/question-quality'), 'FORBIDDEN')
      expectError(await who.post('/api/question-quality/audit'), 'FORBIDDEN')
    }
  })

  it('the audit without CSRF is 403 CSRF_INVALID', async () => {
    expectCsrfInvalid(await c.admin.noCsrf.post('/api/question-quality/audit'))
  })

  it('before any audit nothing is scored and lastAuditAt is null', async () => {
    const s = parseData(await c.admin.get('/api/question-quality'), QuestionQualitySummarySchema)
    expect(s).toMatchObject({ total: 6, scoredCount: 0, average: 0, lastAuditAt: null, actionList: [] })
  })

  it('the audit scores every question, stores one run and one score per question', async () => {
    const res = await c.admin.post('/api/question-quality/audit')
    expect(res.status).toBe(200)
    const body = QuestionQualityAuditedSchema.parse(res.body)
    expect(body.status).toBe('Audit kualiti selesai.')
    expect(await count(t.db, 'select count(*) n from quality_audits')).toBe(1)
    expect(await count(t.db, 'select count(*) n from question_quality_scores')).toBe(6)
    const rows = await t.db.query<{ question_id: string; score: number; bucket: string }>('select question_id::text, score, bucket from question_quality_scores order by question_id')
    expect(rows.map((r) => [r.question_id, r.score, r.bucket])).toEqual([
      ['101', 100, 'cemerlang'], ['102', 80, 'cemerlang'], ['103', 75, 'baik'], ['104', 50, 'lemah'], ['105', 40, 'lemah'], ['106', 40, 'lemah'],
    ])
    const [run] = await t.db.query<{ scored_count: number; finding_count: number; average_score: number; finished_at: string | null }>('select scored_count, finding_count, average_score, finished_at from quality_audits')
    expect(run).toMatchObject({ scored_count: 6, finding_count: 6 })
    expect(run!.average_score).toBeCloseTo(385 / 6)
    expect(run!.finished_at).not.toBeNull()
  })

  it('the summary counts everything from the stored scores', async () => {
    const s = parseData(await c.admin.get('/api/question-quality'), QuestionQualitySummarySchema)
    expect(s.total).toBe(6)
    expect(s.scoredCount).toBe(6)
    expect(s.average).toBe(64.2)
    expect(s.excellentCount).toBe(2)
    expect(s.buckets).toEqual({ baik: 1, lemahKritikal: 2, legacyGeneric: 1 })
    expect(s.activeActionCount).toBe(2)
    expect(s.distribution).toEqual({ cemerlang: 33.3, baik: 16.7, lemah: 50, kritikal: 0 })
    expect(s.actionList.map((r) => [r.id, r.qualityScore])).toEqual([['106', 40], ['104', 50]])
    expect(s.actionList[1]).toMatchObject({ questionText: 'kecil', sourceSet: 'Set A', subject: { id: subjectIds[0] } })
    expect(s.bySubject.map((x) => [x.subjectId, x.count])).toEqual([[subjectIds[0], 5], [subjectIds[1], 1]])
    expect(s.bySubject[0]).toMatchObject({ average: 69, excellentPct: 40 })
    expect(s.byLevel.find((l) => l.levelId === levelId)).toMatchObject({ count: 6, average: 64.2 })
    expect(s.byLevel.some((l) => l.count === 0)).toBe(true)
    expect(s.lastAuditAt).toMatch(/\+08:00$/)
  })

  it('a second audit adds a run, rescoring changed questions and dropping deleted ones', async () => {
    t.fake.questions.get('103')!.quality.explanation = 'Sekarang ada penjelasan.'
    t.fake.questions.delete('106')
    t.fake.seed({ id: '107', quality: { ...GOOD, subjectId: subjectIds[0]!, educationLevelId: levelId } })
    expect((await c.admin.post('/api/question-quality/audit')).status).toBe(200)
    expect(await count(t.db, 'select count(*) n from quality_audits')).toBe(2)
    expect(await count(t.db, 'select count(*) n from question_quality_scores')).toBe(6)
    const rows = await t.db.query<{ question_id: string; score: number }>("select question_id::text, score from question_quality_scores where question_id in (103, 106, 107) order by question_id")
    expect(rows.map((r) => [r.question_id, r.score])).toEqual([['103', 90], ['107', 100]])
    const [run] = await t.db.query<{ finding_count: number }>('select finding_count from quality_audits order by id desc limit 1')
    expect(run!.finding_count).toBe(2) // 103 changed, 107 is new
  })
})
