/**
 * M04-T2: question quality (SRS §7 #12–#13, BR-M04-21/22, FR-M04-59…63, E2E-M04-34/35) and the
 * report → deactivate transaction of the reports store (BR-M04-11/12/13, E2E-M04-37/38/42/43/60):
 * admin guards, the S6 summary and its anchor counts, the audit, and the atomic report effects.
 *
 * The report HTTP endpoints belong to M04-T6a/T6b/T6c; the repository contract they use (`reports`)
 * is tested here.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { RepositoryError } from '@/mock/repository'

import type { QualityAuditResponse, QualitySummary } from '../../api/quality'
import { questions, reports, structured } from '../../mock'
import { AUDIT_DONE_TEXT } from '../../mock/handlers/quality'
import { showPrimaryLevels } from '../../mock/repository/visible-levels'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  bootM04,
  callAs,
  GURU,
  IBU_BAPA,
  PELAJAR,
  type Call,
} from './workflow-helpers'

const NOW_MS = Date.parse('2026-09-25T15:40:00+08:00')

let runtime: MockRuntime
let call: Call
let dirty = false

beforeAll(async () => {
  // The documented counts include the Darjah questions; the hiding (D72) is in secondary-only.test.ts.
  showPrimaryLevels()
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 180_000)

afterAll(async () => {
  await runtime.reset()
})

const summary = async () =>
  (await call<{ data: QualitySummary }>('GET', '/api/question-quality', ADMIN)).body.data

describe('admin guards (SEC-M04-01)', () => {
  const endpoints: ['GET' | 'POST', string][] = [
    ['GET', '/api/question-quality'],
    ['POST', '/api/question-quality/audit'],
  ]
  it.each(endpoints)(
    '%s %s: 401 without a session, 403 for a student and a teacher',
    async (method, url) => {
      expect((await call(method, url, null)).status).toBe(401)
      expect((await call(method, url, PELAJAR)).status).toBe(403)
      expect((await call(method, url, GURU)).status).toBe(403)
      expect((await call(method, url, IBU_BAPA)).status).toBe(403)
      expect((await call(method, url, ADMIN_SEKOLAH)).status).toBe(403)
    },
  )
})

describe('#12 S6 summary: the observed anchor counts (SRS §6.11 Quality, §4.1)', () => {
  let s: QualitySummary

  beforeAll(async () => {
    s = await summary()
  }, 120_000)

  it('KPI cards: Jumlah Soalan = Q-ALL, Purata Skor 94.1, Cemerlang, Perlu Tindakan Aktif', () => {
    expect(s.total).toBe(465_278)
    expect(s.total).toBe(questions.count('Q-ALL'))
    expect(s.scoredCount).toBe(147_026)
    expect(s.scoredCount).toBe(questions.count('Q-SCORED'))
    expect(s.average).toBe(94.1)
    expect(s.excellentCount).toBe(146_275)
    expect(s.activeActionCount).toBe(2)
  })

  it('bucket cards: Skor 51-75 749, Skor ≤ 50 2, Legacy Generic 373', () => {
    expect(s.buckets).toEqual({ baik: 749, lemahKritikal: 2, legacyGeneric: 373 })
    // 146,275 + 749 + 2 = every scored question.
    expect(s.excellentCount + s.buckets.baik + 2).toBe(s.scoredCount)
  })

  it('distribution bar: shares of the scored questions with one decimal', () => {
    expect(s.distribution.cemerlang).toBe(99.5)
    expect(s.distribution.baik).toBe(0.5)
    // The 2 anchors (score 50) are Lemah; nothing is Kritikal: labels only on non-empty segments.
    expect(s.distribution.lemah).toBe(0)
    expect(s.distribution.kritikal).toBe(0)
    const raw = (n: number) => (n * 100) / s.scoredCount
    expect(s.distribution.lemah).toBeCloseTo(raw(2), 0)
  })

  it('action list: the two archived Matematik T5 anchors, id descending, legacy 570024 excluded', () => {
    expect(s.actionList.map((r) => r.id)).toEqual([129_216, 129_114])
    expect(s.actionList[1]).toEqual({
      id: 129_114,
      questionText: '34^-1/2 =',
      subject: { id: 3, name: 'Matematik' },
      level: { id: 11, name: 'Tingkatan 5' },
      sourceSet: 'trial_matematik_johor_set2_k1',
      qualityScore: 50,
    })
    expect(s.actionList.map((r) => r.id)).not.toContain(570_024)
    expect(s.actionList).toHaveLength(s.activeActionCount)
    // 570024 is a scored legacy row (`baik`, 55) outside the action list.
    expect(questions.get(570_024)).toMatchObject({ qualityScore: 55, legacyGeneric: true })
  })

  it('"Mengikut Subjek": subjects with scored questions, Purata descending, S6 means and shares', () => {
    const averages = s.bySubject.map((x) => x.average)
    expect([...averages].sort((a, b) => b - a)).toEqual(averages)
    expect(s.bySubject.reduce((n, x) => n + x.count, 0)).toBe(s.scoredCount)
    expect(s.bySubject[0]).toMatchObject({ subjectId: 7, name: 'Pendidikan Moral', average: 96.4 })
    expect(s.bySubject.some((x) => x.count === 0)).toBe(false)
    const share = (id: number) => s.bySubject.find((x) => x.subjectId === id)?.excellentPct
    // SRS §6.13.1: the shares read 99 %, 98 % and 97 %, every other subject 100 %.
    expect([share(3), share(2), share(4)]).toEqual([99, 98, 97])
    expect(
      s.bySubject
        .filter((x) => x.excellentPct < 100)
        .map((x) => x.subjectId)
        .sort(),
    ).toEqual([2, 3, 4])
  })

  it('"Mengikut Tingkatan": only Tingkatan 1 to 5 in order with count and mean (D72: no Darjah)', () => {
    expect(s.byLevel.map((l) => l.levelId)).toEqual([7, 8, 9, 10, 11])
    expect(s.byLevel[0]).toMatchObject({ name: 'Tingkatan 1' })
    expect(s.byLevel.some((l) => /darjah/i.test(l.name))).toBe(false)
    // The hidden Darjah questions stay scored but are not listed here.
    expect(s.byLevel.reduce((n, l) => n + l.count, 0)).toBeLessThan(s.scoredCount)
    for (const l of s.byLevel) {
      if (l.count === 0) expect(l.average).toBe(0)
      else expect(l.average).toBeGreaterThan(0)
    }
  })

  it('has not been audited yet', () => {
    expect(s.lastAuditAt).toBeNull()
  })

  it('repeated reads are cheap once the store is warm', async () => {
    const t = Date.now()
    await summary()
    expect(Date.now() - t).toBeLessThan(2000)
  })
})

describe('#13 audit (BR-M04-22)', () => {
  it('records lastAuditAt and answers the flash text', async () => {
    dirty = true
    const r = await call<QualityAuditResponse>('POST', '/api/question-quality/audit', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ lastAuditAt: '2026-09-25T15:40:00+08:00' })
    expect(r.body.status).toBe(AUDIT_DONE_TEXT)
    expect(AUDIT_DONE_TEXT).toBe('Audit kualiti selesai.')
    expect((await summary()).lastAuditAt).toBe('2026-09-25T15:40:00+08:00')
  })

  it('leaves the observed scores alone: the S6 counts are the same after an audit', async () => {
    dirty = true
    const before = await summary()
    await call('POST', '/api/question-quality/audit', ADMIN)
    const after = await summary()
    expect({ ...after, lastAuditAt: null }).toEqual({ ...before, lastAuditAt: null })
  })

  it('scores a question created at runtime with score(q) and moves it into its bucket', async () => {
    dirty = true
    const made = questions.create(
      {
        subjectId: 3,
        educationLevelId: 11,
        difficultyLevel: 2,
        questionText: 'Soalan baharu yang lebih daripada dua puluh aksara.',
        options: ['a', 'b', 'c', 'd'],
        correctAnswer: 0,
      },
      { createdBy: ADMIN, now: NOW_MS },
    )
    // BR-M04-09: not scored until the next audit.
    expect(made.qualityScore).toBeNull()
    const before = await summary()
    expect(before.scoredCount).toBe(147_026)

    await call('POST', '/api/question-quality/audit', ADMIN)
    // no explanation −15, untagged −10, no source −10 → 65 = baik.
    expect(questions.get(made.id)).toMatchObject({ qualityScore: 65, qualityBucket: 'baik' })
    const after = await summary()
    expect(after.scoredCount).toBe(147_027)
    expect(after.buckets.baik).toBe(750)
    expect(after.excellentCount).toBe(146_275)
    expect(after.total).toBe(465_279)
    // The average moves with the new score: (Σ + 65) / 147,027.
    expect(after.average).toBeCloseTo((before.average * 147_026 + 65) / 147_027, 1)
  })

  it('an explanation and a DSKP tag lift the score of the next audit', async () => {
    dirty = true
    const made = questions.create(
      {
        subjectId: 4,
        educationLevelId: 11,
        difficultyLevel: 3,
        questionText: 'Apakah maksud satelit buatan dalam Sains?',
        options: ['a', 'b', 'c', 'd'],
        correctAnswer: 1,
        explanation: 'Kerana ...',
        dskpSpId: 6191,
      },
      { createdBy: ADMIN, now: NOW_MS },
    )
    await call('POST', '/api/question-quality/audit', ADMIN)
    // Only "no source" (−10) applies → 90 = cemerlang.
    expect(questions.get(made.id)).toMatchObject({ qualityScore: 90, qualityBucket: 'cemerlang' })
    expect((await summary()).excellentCount).toBe(146_276)
  })

  it('a second audit after an edit rescored the row again', async () => {
    dirty = true
    const made = questions.create(
      {
        subjectId: 3,
        educationLevelId: 11,
        difficultyLevel: 2,
        questionText: 'Soalan yang akan disunting kemudian.',
        options: ['a', 'b', 'c', 'd'],
        correctAnswer: 0,
      },
      { createdBy: ADMIN, now: NOW_MS },
    )
    await call('POST', '/api/question-quality/audit', ADMIN)
    expect(questions.get(made.id)?.qualityScore).toBe(65)
    questions.update(made.id, { explanation: 'Sudah ada penjelasan.', dskpSpId: 6191 }, NOW_MS)
    await call('POST', '/api/question-quality/audit', ADMIN)
    expect(questions.get(made.id)).toMatchObject({ qualityScore: 90, qualityBucket: 'cemerlang' })
  })
})

describe('reports: create → deactivate in one transaction (BR-M04-11/12/13)', () => {
  const create = (
    questionId: number,
    questionType: 'mcq' | 'structured' = 'mcq',
    reasons: string[] = ['wrong_answer'],
  ) =>
    reports.create(
      {
        questionId,
        questionType,
        reasons,
        source: questionType === 'mcq' ? 'spm' : 'structured_attempt',
      },
      5001,
      NOW_MS,
    )

  it('an MCQ report is saved pending and takes the question out of practice at once', () => {
    dirty = true
    expect(questions.getEligible(564_161)).not.toBeNull()
    const eligible = questions.count('Q-ELIGIBLE')
    const res = create(564_161)
    expect(res).toMatchObject({ success: true, message: 'Laporan berjaya dihantar.' })
    expect(reports.get(res.id)).toMatchObject({
      status: 'pending',
      questionId: 564_161,
      reporterId: 5001,
      reasons: ['wrong_answer'],
      createdAt: '2026-09-25T15:40:00+08:00',
    })
    expect(questions.get(564_161)).toMatchObject({ isActive: false, status: 'approved' })
    expect(questions.getEligible(564_161)).toBeNull()
    expect(questions.count('Q-ELIGIBLE')).toBe(eligible - 1)
    // R-STATUS: 2 seeded pending + 1.
    expect(reports.count('R-STATUS', 'pending')).toBe(3)
  })

  it('"Tolak & Aktifkan Semula" reactivates, "Nyahaktif Segera" deactivates again (E2E-M04-42/43/60)', () => {
    dirty = true
    const { id } = create(564_160)
    reports.update(
      id,
      {
        status: 'dismissed',
        adminNotes: 'Soalan dan jawapan disemak — tiada masalah',
        reactivate: true,
      },
      NOW_MS,
    )
    expect(reports.get(id)).toMatchObject({
      status: 'dismissed',
      adminNotes: 'Soalan dan jawapan disemak — tiada masalah',
    })
    expect(questions.getEligible(564_160)).not.toBeNull()
    reports.update(
      id,
      { status: 'reviewed', adminNotes: 'Dinyahaktifkan segera oleh admin', forceDeactivate: true },
      NOW_MS,
    )
    expect(questions.getEligible(564_160)).toBeNull()
    // The seeded report 6 (question 136891): an inactive anchor reactivated by "Tolak & Aktifkan Semula".
    expect(questions.getEligible(136_891)).toBeNull()
    reports.update(6, { status: 'dismissed', reactivate: true }, NOW_MS)
    expect(questions.getEligible(136_891)).not.toBeNull()
  })

  it('a structured question goes inactive at its third open report, not before (E2E-M04-38)', () => {
    dirty = true
    expect(structured.get(4455)?.isActive).toBe(true)
    create(4455, 'structured', ['typo'])
    create(4455, 'structured', ['other'])
    expect(structured.get(4455)?.isActive).toBe(true)
    create(4455, 'structured', ['wrong_answer'])
    expect(structured.get(4455)?.isActive).toBe(false)
    // Fixed / dismissed reports no longer count: reactivate, then only 1 open report remains
    const open = reports.list('pending').filter((r) => r.questionId === 4455)
    expect(open).toHaveLength(3)
    reports.update(open[0]?.id as number, { status: 'dismissed', reactivate: true }, NOW_MS)
    expect(structured.get(4455)?.isActive).toBe(true)
  })

  it('validates before writing: no reason, a reason of the other set, a bad source, a long comment', () => {
    const before = reports.count('R-STATUS')
    const attempts: (() => unknown)[] = [
      () => create(564_161, 'mcq', []),
      () => create(564_161, 'structured', ['duplicate']),
      () =>
        reports.create(
          { questionId: 564_161, reasons: ['typo'], source: 'nowhere' as never },
          5001,
          NOW_MS,
        ),
      () =>
        reports.create(
          { questionId: 564_161, reasons: ['typo'], comment: 'x'.repeat(501), source: 'spm' },
          5001,
          NOW_MS,
        ),
    ]
    for (const attempt of attempts) expect(attempt).toThrow(RepositoryError)
    expect(reports.count('R-STATUS')).toBe(before)
    expect(questions.getEligible(564_161)).not.toBeNull()
  })

  it('writes the report and the deactivation in one transaction: a failure after both rolls both back', () => {
    const before = reports.count('R-STATUS')
    expect(() =>
      runtime.db.transaction(() => {
        create(564_159)
        // Both writes are visible inside the transaction …
        expect(reports.count('R-STATUS')).toBe(before + 1)
        expect(questions.get(564_159)?.isActive).toBe(false)
        throw new Error('the request failed afterwards')
      }),
    ).toThrow('the request failed afterwards')
    // … and neither survives the rollback.
    expect(reports.count('R-STATUS')).toBe(before)
    expect(questions.get(564_159)?.isActive).toBe(true)
    expect(questions.getEligible(564_159)).not.toBeNull()
  })

  it('accepts the M10 teacher_databank source and the "outdated" reason (FR-M04-124)', () => {
    dirty = true
    const res = reports.create(
      { questionId: 564_157, reasons: ['outdated'], source: 'teacher_databank' },
      5,
      NOW_MS,
    )
    expect(res.success).toBe(true)
    expect(reports.get(res.id)).toMatchObject({
      reasons: ['outdated'],
      source: 'teacher_databank',
      reporterId: 5,
    })
  })
})
