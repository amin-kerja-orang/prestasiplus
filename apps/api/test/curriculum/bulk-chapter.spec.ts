import { BULK_CHAPTER_CAP, BulkChapterResultSchema, ChapterCoverageSchema, QUESTION_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { AuditActor } from '../../src/modules/curriculum/actor'
import { CurriculumBulkChapterService } from '../../src/modules/curriculum/bulk-chapter.service'
import { bootCurriculumApp, count, expectCsrfInvalid, expectError, idOf, loginAs, parseData, type Client, type CurriculumTestApp } from './helpers'

/**
 * API-DSKP-09 (S4-T03, DM-17, FR-ADM-C05.*, AC-ADM-C05.1/2/4): `POST /api/admin/curriculum/questions/bulk-chapter` sets the Bab of many
 * questions in place on the live approved version, and API-DSKP-10: `GET /api/admin/curriculum/chapter-coverage`. Questions are planted
 * with plain inserts (one `questions` row and one `question_versions` row each), the way the practice specs do.
 */
describe('bulk Bab mapping (API-DSKP-09) and Bab coverage (API-DSKP-10)', () => {
  let t: CurriculumTestApp
  let admin: Client
  let student: Client
  let math: string
  let bm: string
  let t4: string
  let t5: string
  let babT4: string // Matematik T4
  let babT4b: string // a second Matematik T4 Bab
  const URL = '/api/admin/curriculum/questions/bulk-chapter'

  beforeAll(async () => {
    t = await bootCurriculumApp()
    admin = await loginAs(t, 'admin@demo.test')
    student = await loginAs(t, 'pelajar@demo.test')
    math = await idOf(t.db, 'subjects', 'MATH')
    bm = await idOf(t.db, 'subjects', 'BM')
    t4 = await idOf(t.db, 'education_levels', 'T4')
    t5 = await idOf(t.db, 'education_levels', 'T5')
    const chapter = async (subject: string, level: string, n: number): Promise<string> =>
      (await t.db.query<{ id: string }>(
        `insert into chapters (subject_id, education_level_id, name, chapter_number, in_tree) values ($1, $2, $3, $4, true) returning id::text`,
        [subject, level, `Bab ujian ${n}`, n],
      ))[0]!.id
    babT4 = await chapter(math, t4, 901)
    babT4b = await chapter(math, t4, 902)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await t.db.query('delete from audit_events where action = $1', ['curriculum.questions.bulk_chapter'])
    await t.db.query('delete from question_versions')
    await t.db.query('delete from questions')
  })

  type Status = 'approved' | 'draft' | 'review' | 'archived'
  /** One question with one version: an approved one is live (`live_version_no` 1), any other status is not. */
  const addQ = async (o: { subject: string; level: string; status?: Status; chapter?: string | null; active?: boolean }): Promise<string> => {
    const status = o.status ?? 'approved'
    const id = (await t.db.query<{ id: string }>(
      `insert into questions (source_type, live_version_no, is_active) values ('manual', $1, $2) returning id::text`,
      [status === 'approved' ? 1 : null, o.active ?? true],
    ))[0]!.id
    await t.db.query(
      `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, chapter_id, difficulty_tp, published_at)
       values ($1, 1, $2, 'mcq', 'Soalan ujian', $3, $4, $5, 1, case when $2 = 'approved' then now() else null end)`,
      [id, status, o.subject, o.level, o.chapter ?? null],
    )
    return id
  }
  const chapterOf = async (qid: string): Promise<string | null> =>
    (await t.db.query<{ c: string | null }>(`select chapter_id::text c from question_versions where question_id = $1 order by version_no desc limit 1`, [qid]))[0]!.c
  const audits = () => count(t.db, `select count(*) n from audit_events where action = 'curriculum.questions.bulk_chapter'`)
  const post = (body: unknown) => admin.post(URL, body)
  const mathT4Filter = () => ({ subjectId: math, educationLevelId: t4 })
  const result = async (body: unknown) => parseData(await post(body), BulkChapterResultSchema)

  /** 3 eligible, 1 approved with another Bab, 1 draft: all Matematik T4. */
  const plantMathT4 = async () => {
    const eligible = [await addQ({ subject: math, level: t4 }), await addQ({ subject: math, level: t4 }), await addQ({ subject: math, level: t4 })]
    const hasBab = await addQ({ subject: math, level: t4, chapter: babT4b })
    const draft = await addQ({ subject: math, level: t4, status: 'draft' })
    return { eligible, hasBab, draft }
  }

  describe('dry run', () => {
    it('counts matched, eligible and refused without writing a row or an audit entry', async () => {
      const p = await plantMathT4()
      const r = await result({ chapterId: babT4, filter: mathT4Filter(), dryRun: true })
      expect(r).toEqual({ matched: 5, eligible: 3, refused: 2, applied: 0, cap: BULK_CHAPTER_CAP, remaining: 0, capped: false, dryRun: true, auditId: null })
      expect(BULK_CHAPTER_CAP).toBe(10_000)
      for (const id of p.eligible) expect(await chapterOf(id)).toBeNull()
      expect(await chapterOf(p.hasBab)).toBe(babT4b)
      expect(await audits()).toBe(0)
    })

    it('needs no expectedCount, and with overwrite the question that has another Bab is eligible too', async () => {
      await plantMathT4()
      const r = await result({ chapterId: babT4, filter: mathT4Filter(), dryRun: true, overwrite: true })
      expect(r).toMatchObject({ matched: 5, eligible: 4, refused: 1, applied: 0, dryRun: true, auditId: null })
    })

    it('shares the question-list filter: status narrows the matched rows', async () => {
      await plantMathT4()
      const r = await result({ chapterId: babT4, filter: { ...mathT4Filter(), status: 'approved' }, dryRun: true })
      expect(r).toMatchObject({ matched: 4, eligible: 3, refused: 1 })
    })
  })

  describe('apply', () => {
    it('sets the Bab in place on the eligible rows, with expectedCount = matched, and writes one counts-only audit entry', async () => {
      const p = await plantMathT4()
      const versionsBefore = await count(t.db, 'select count(*) n from question_versions')
      const r = await result({ chapterId: babT4, filter: mathT4Filter(), expectedCount: 5 })
      expect(r).toMatchObject({ matched: 5, eligible: 3, refused: 2, applied: 3, cap: BULK_CHAPTER_CAP, remaining: 0, capped: false, dryRun: false })
      expect(r.auditId).toMatch(/^\d+$/)
      for (const id of p.eligible) expect(await chapterOf(id)).toBe(babT4)
      // overwrite is off: the Bab that was there stays; a draft is never touched.
      expect(await chapterOf(p.hasBab)).toBe(babT4b)
      expect(await chapterOf(p.draft)).toBeNull()
      // In place (DM-17): no new version, status and live version unchanged.
      expect(await count(t.db, 'select count(*) n from question_versions')).toBe(versionsBefore)
      expect(await count(t.db, `select count(*) n from question_versions where status = 'approved'`)).toBe(4)
      expect(await count(t.db, `select count(*) n from questions where live_version_no = 1`)).toBe(4)

      const rows = await t.db.query<{ id: string; actor_user_id: string; target_type: string; target_id: string; detail: Record<string, unknown> }>(
        `select id::text, actor_user_id::text, target_type, target_id, detail from audit_events where action = 'curriculum.questions.bulk_chapter'`,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ id: r.auditId, actor_user_id: admin.userId, target_type: 'chapter', target_id: babT4 })
      // Counts only: exactly these keys, no question id.
      expect(rows[0]!.detail).toEqual({ matched: 5, eligible: 3, refused: 2, applied: 3, dryRun: false, overwrite: false })
    })

    it('applies a selection of ids', async () => {
      const a = await addQ({ subject: math, level: t4 })
      const b = await addQ({ subject: math, level: t4 })
      const c = await addQ({ subject: math, level: t4 })
      const r = await result({ chapterId: babT4, ids: [a, b], expectedCount: 2 })
      expect(r).toMatchObject({ matched: 2, eligible: 2, refused: 0, applied: 2 })
      expect([await chapterOf(a), await chapterOf(b), await chapterOf(c)]).toEqual([babT4, babT4, null])
    })

    it('a stale expectedCount is 409 and nothing is written', async () => {
      const p = await plantMathT4()
      const err = expectError(await post({ chapterId: babT4, filter: mathT4Filter(), expectedCount: 6 }), 'CONFLICT')
      expect(err.message).toBe(QUESTION_MESSAGES.filterCountChanged(6, 5))
      for (const id of p.eligible) expect(await chapterOf(id)).toBeNull()
      expect(await audits()).toBe(0)
      // The count the client showed is `matched`, not `eligible`: 3 is stale too.
      expectError(await post({ chapterId: babT4, filter: mathT4Filter(), expectedCount: 3 }), 'CONFLICT')
      expect(await audits()).toBe(0)
    })

    it('overwrite=false keeps an existing Bab (AC-ADM-C05.4: 10 selected, 4 with a Bab -> 6 linked, 4 refused)', async () => {
      const free = await Promise.all(Array.from({ length: 6 }, () => addQ({ subject: math, level: t4 })))
      const had = await Promise.all(Array.from({ length: 4 }, () => addQ({ subject: math, level: t4, chapter: babT4b })))
      const r = await result({ chapterId: babT4, ids: [...free, ...had], expectedCount: 10 })
      expect(r).toMatchObject({ matched: 10, eligible: 6, refused: 4, applied: 6 })
      for (const id of free) expect(await chapterOf(id)).toBe(babT4)
      for (const id of had) expect(await chapterOf(id)).toBe(babT4b)
    })

    it('overwrite=true replaces an existing Bab (AC-ADM-C05.4: all 10 linked)', async () => {
      const free = await Promise.all(Array.from({ length: 6 }, () => addQ({ subject: math, level: t4 })))
      const had = await Promise.all(Array.from({ length: 4 }, () => addQ({ subject: math, level: t4, chapter: babT4b })))
      const r = await result({ chapterId: babT4, ids: [...free, ...had], expectedCount: 10, overwrite: true })
      expect(r).toMatchObject({ matched: 10, eligible: 10, refused: 0, applied: 10 })
      for (const id of [...free, ...had]) expect(await chapterOf(id)).toBe(babT4)
      const audit = (await t.db.query<{ detail: Record<string, unknown> }>(`select detail from audit_events where id = $1`, [r.auditId]))[0]!
      expect(audit.detail).toMatchObject({ applied: 10, overwrite: true })
    })

    it('counts a question of another subject or level as refused and leaves it alone (AC-ADM-C05.2)', async () => {
      const ok = await addQ({ subject: math, level: t4 })
      const otherLevel = await addQ({ subject: math, level: t5 })
      const otherSubject = await addQ({ subject: bm, level: t4 })
      const r = await result({ chapterId: babT4, ids: [ok, otherLevel, otherSubject], expectedCount: 3 })
      expect(r).toMatchObject({ matched: 3, eligible: 1, refused: 2, applied: 1 })
      expect([await chapterOf(ok), await chapterOf(otherLevel), await chapterOf(otherSubject)]).toEqual([babT4, null, null])
    })

    it('a filter of another level than the Bab matches rows but refuses all of them', async () => {
      await addQ({ subject: math, level: t5 })
      await addQ({ subject: math, level: t5 })
      const r = await result({ chapterId: babT4, filter: { subjectId: math, educationLevelId: t5 }, expectedCount: 2 })
      expect(r).toMatchObject({ matched: 2, eligible: 0, refused: 2, applied: 0 })
    })

    it('counts a question that is not approved (draft, review, archived) as refused', async () => {
      const approved = await addQ({ subject: math, level: t4 })
      const others = await Promise.all((['draft', 'review', 'archived'] as const).map((status) => addQ({ subject: math, level: t4, status })))
      const r = await result({ chapterId: babT4, ids: [approved, ...others], expectedCount: 4 })
      expect(r).toMatchObject({ matched: 4, eligible: 1, refused: 3, applied: 1 })
      for (const id of others) expect(await chapterOf(id)).toBeNull()
    })

    it('ignores an id that is not a question (it is not matched)', async () => {
      const a = await addQ({ subject: math, level: t4 })
      const r = await result({ chapterId: babT4, ids: [a, '99999999', 'abc'], dryRun: true })
      expect(r).toMatchObject({ matched: 1, eligible: 1, refused: 0 })
    })

    it('a second identical run finds nothing left to link', async () => {
      await plantMathT4()
      await result({ chapterId: babT4, filter: mathT4Filter(), expectedCount: 5 })
      const again = await result({ chapterId: babT4, filter: mathT4Filter(), expectedCount: 5 })
      expect(again).toMatchObject({ matched: 5, eligible: 0, refused: 5, applied: 0 })
    })
  })

  describe('cap', () => {
    const actor = (): AuditActor => ({ userId: admin.userId, role: 'admin', requestId: null, ip: null, isTest: false })

    it('applies at most the cap, reports remaining and capped, and the next run continues', async () => {
      const service = t.app.get(CurriculumBulkChapterService)
      const ids = await Promise.all(Array.from({ length: 5 }, () => addQ({ subject: math, level: t4 })))
      const body = { chapterId: babT4, filter: mathT4Filter(), expectedCount: 5 }

      const preview = await service.run(actor(), { ...body, dryRun: true }, 2)
      expect(preview).toMatchObject({ matched: 5, eligible: 5, applied: 0, cap: 2, remaining: 3, capped: true, dryRun: true, auditId: null })

      const first = await service.run(actor(), body, 2)
      expect(first).toMatchObject({ matched: 5, eligible: 5, refused: 0, applied: 2, cap: 2, remaining: 3, capped: true, dryRun: false })
      // The lowest question ids go first (stable between runs).
      expect(await Promise.all(ids.map(chapterOf))).toEqual([babT4, babT4, null, null, null])

      const second = await service.run(actor(), body, 2)
      expect(second).toMatchObject({ matched: 5, eligible: 3, refused: 2, applied: 2, remaining: 1, capped: true })
      const third = await service.run(actor(), body, 2)
      expect(third).toMatchObject({ matched: 5, eligible: 1, applied: 1, remaining: 0, capped: false })
      expect(await Promise.all(ids.map(chapterOf))).toEqual(Array(5).fill(babT4))
      expect(await audits()).toBe(3)
    })

    it('rejects a cap that is not a positive integer', async () => {
      const service = t.app.get(CurriculumBulkChapterService)
      await expect(service.run(actor(), { chapterId: babT4, ids: ['1'], dryRun: true }, 0)).rejects.toThrow(RangeError)
    })
  })

  describe('request rules', () => {
    it('needs exactly one of ids or filter (422)', async () => {
      const a = await addQ({ subject: math, level: t4 })
      const both = expectError(await post({ chapterId: babT4, ids: [a], filter: mathT4Filter(), dryRun: true }), 'VALIDATION_ERROR')
      expect(Object.keys(both.fields!)).toContain('ids')
      const neither = expectError(await post({ chapterId: babT4, dryRun: true }), 'VALIDATION_ERROR')
      expect(Object.keys(neither.fields!)).toContain('filter')
    })

    it('needs subjectId and educationLevelId in the filter (422)', async () => {
      for (const filter of [{ subjectId: math }, { educationLevelId: t4 }, {}, { status: 'approved' }]) {
        const err = expectError(await post({ chapterId: babT4, filter, dryRun: true }), 'VALIDATION_ERROR')
        expect(Object.keys(err.fields!)).toContain('filter')
      }
    })

    it('needs 1 to 64 ids (422)', async () => {
      const sixtyFive = Array.from({ length: 65 }, (_, i) => String(i + 1))
      expectError(await post({ chapterId: babT4, ids: sixtyFive, dryRun: true }), 'VALIDATION_ERROR')
      expectError(await post({ chapterId: babT4, ids: [], dryRun: true }), 'VALIDATION_ERROR')
      const sixtyFour = sixtyFive.slice(0, 64)
      expect(await result({ chapterId: babT4, ids: sixtyFour, dryRun: true })).toMatchObject({ matched: 0, eligible: 0, refused: 0 })
    })

    it('needs expectedCount unless dryRun (422), and writes nothing without it', async () => {
      await plantMathT4()
      const err = expectError(await post({ chapterId: babT4, filter: mathT4Filter() }), 'VALIDATION_ERROR')
      expect(err.fields!.expectedCount).toBe(QUESTION_MESSAGES.filterCountNeeded)
      expect(await audits()).toBe(0)
    })

    it('is strict: an unknown key in the body or in the filter is 422', async () => {
      await plantMathT4()
      const body = expectError(await post({ chapterId: babT4, filter: mathT4Filter(), dryRun: true, action: 'approved' }), 'VALIDATION_ERROR')
      expect(Object.keys(body.fields!)).toContain('action')
      expectError(await post({ chapterId: babT4, filter: { ...mathT4Filter(), nope: 1 }, dryRun: true }), 'VALIDATION_ERROR')
      expectError(await post({ ids: ['1'], dryRun: true }), 'VALIDATION_ERROR') // chapterId missing
      expectError(await post({ chapterId: babT4, ids: ['1'], dryRun: true, overwrite: 'yes' }), 'VALIDATION_ERROR')
      expectError(await post([]), 'VALIDATION_ERROR')
    })

    it('an unknown Bab is 404 with the chapter copy, before anything is counted or written', async () => {
      await plantMathT4()
      expectError(await post({ chapterId: '99999999', filter: mathT4Filter(), expectedCount: 5 }), 'NOT_FOUND', 'Bab tidak dijumpai.')
      expectError(await post({ chapterId: 'abc', filter: mathT4Filter(), dryRun: true }), 'NOT_FOUND', 'Bab tidak dijumpai.')
      expect(await audits()).toBe(0)
    })

    it('is admin only and needs the CSRF token', async () => {
      const body = { chapterId: babT4, ids: ['1'], dryRun: true }
      expect((await student.post(URL, body)).status).toBe(403)
      expectCsrfInvalid(await admin.noCsrf.post(URL, body))
      expect((await t.http().post(URL).send(body)).status).toBe(401)
    })
  })

  describe('chapter coverage (API-DSKP-10)', () => {
    const coverage = async (query = '') => parseData(await admin.get(`/api/admin/curriculum/chapter-coverage${query}`), ChapterCoverageSchema)

    it('counts live, active, approved versions with and without a Bab per offered Subjek x Tingkatan', async () => {
      await addQ({ subject: math, level: t4 })
      await addQ({ subject: math, level: t4 })
      await addQ({ subject: math, level: t4, chapter: babT4 })
      await addQ({ subject: math, level: t4, status: 'draft' })
      await addQ({ subject: math, level: t4, active: false })
      await addQ({ subject: bm, level: t4 })
      const { rows } = await coverage()
      const mathT4 = rows.find((r) => r.subjectId === math && r.levelCode === 'T4')
      expect(mathT4).toEqual({ subjectId: math, subjectName: 'Matematik', levelCode: 'T4', approved: 3, withChapter: 1, withoutChapter: 2 })
      expect(rows.find((r) => r.subjectId === bm && r.levelCode === 'T4')).toMatchObject({ approved: 1, withChapter: 0, withoutChapter: 1 })
      expect(rows.find((r) => r.subjectId === math && r.levelCode === 'T5')).toMatchObject({ approved: 0, withChapter: 0, withoutChapter: 0 })
      for (const r of rows) expect(r.withChapter + r.withoutChapter).toBe(r.approved)
      // Darjah is never an offered level (same rule as the DSKP report).
      expect(rows.some((r) => r.levelCode === 'D1')).toBe(false)
    })

    it('is live: a bulk run moves the counts at once', async () => {
      await plantMathT4()
      const before = (await coverage(`?subjectId=${math}&educationLevelId=${t4}`)).rows[0]!
      expect(before).toMatchObject({ approved: 4, withChapter: 1, withoutChapter: 3 })
      await result({ chapterId: babT4, filter: mathT4Filter(), expectedCount: 5 })
      const after = (await coverage(`?subjectId=${math}&educationLevelId=${t4}`)).rows[0]!
      expect(after).toMatchObject({ approved: 4, withChapter: 4, withoutChapter: 0 })
    })

    it('narrows by subjectId and educationLevelId', async () => {
      const one = await coverage(`?subjectId=${math}&educationLevelId=${t4}`)
      expect(one.rows).toHaveLength(1)
      const subject = await coverage(`?subjectId=${math}`)
      expect(subject.rows.length).toBeGreaterThan(1)
      expect(subject.rows.every((r) => r.subjectId === math)).toBe(true)
      expect((await coverage(`?educationLevelId=${t5}`)).rows.every((r) => r.levelCode === 'T5')).toBe(true)
    })

    it('422 on a malformed id, 404 on an unknown one, 403 for a pupil', async () => {
      const bad = expectError(await admin.get('/api/admin/curriculum/chapter-coverage?subjectId=abc&educationLevelId=-1'), 'VALIDATION_ERROR')
      expect(Object.keys(bad.fields!).sort()).toEqual(['educationLevelId', 'subjectId'])
      expectError(await admin.get('/api/admin/curriculum/chapter-coverage?subjectId=99999999'), 'NOT_FOUND', 'Subjek tidak dijumpai.')
      expectError(await admin.get('/api/admin/curriculum/chapter-coverage?educationLevelId=99999999'), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
      expect((await student.get('/api/admin/curriculum/chapter-coverage')).status).toBe(403)
    })
  })
})
