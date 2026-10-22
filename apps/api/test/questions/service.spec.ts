import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, questionIdOf, type QuestionsTestApp } from './helpers'
import { adminActor, apiError, mcqInput, tagBody, tagOf, userIdOf, type Tag } from './fixtures'

const FORBIDDEN_KEYS = ['key', 'explanation', 'modelAnswer', 'sourceFile', 'correctAnswer', 'tfAnswer', 'correctAnswerText', 'altAnswers', 'correct', 'values']

/** Every property name anywhere in a JSON-like value. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      allKeys(v, out)
    }
  }
  return out
}

describe('QuestionsService (real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let teacherId: string
  let teacher2Id: string
  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
    teacherId = await userIdOf(t.db, 'guru@demo.test')
    teacher2Id = await userIdOf(t.db, 'guruadmin@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  describe('create', () => {
    it('stores a flat MCQ as a draft with a single leaf and an option key; owner is the actor', async () => {
      const q = await svc.create(mcqInput(tag), admin)
      expect(q).toMatchObject({ createdById: admin.userId, latestVersionNo: 1, liveVersionNo: null, isActive: true })
      expect(q.version.status).toBe('draft')
      expect(q.version.difficultyTp).toBe(3)
      const leaf = q.version.parts[0] as unknown as { mode: string; marks: number; key: unknown; options: { label: string }[] }
      expect(leaf.mode).toBe('mcq')
      expect(leaf.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
      expect(leaf.key).toEqual({ kind: 'option', correct: 'B' })
      expect(q.subject?.id).toBe(tag.subjectId)
      expect(q.level?.id).toBe(tag.levelId)
    })

    it('stores true_false as short_text accepted Benar/Salah, short_answer and essay as their leaves', async () => {
      const tf = await svc.create(mcqInput(tag, { questionType: 'true_false', options: undefined, correctAnswer: undefined, tfAnswer: false }), admin)
      expect((tf.version.parts[0] as unknown as { key: unknown }).key).toEqual({ kind: 'accepted', values: ['Salah'] })
      const sa = await svc.create(mcqInput(tag, { questionType: 'short_answer', options: undefined, correctAnswer: undefined, correctAnswerText: 'Kuala Lumpur', altAnswers: ['KL'] }), admin)
      expect((sa.version.parts[0] as unknown as { mode: string; key: unknown }).key).toEqual({ kind: 'accepted', values: ['Kuala Lumpur', 'KL'] })
      const es = await svc.create(mcqInput(tag, { questionType: 'essay', options: undefined, correctAnswer: undefined, modelAnswer: 'Contoh jawapan.' }), admin)
      expect(es.version.parts[0]).toMatchObject({ mode: 'essay' })
      expect(es.version.type).toBe('essay')
    })

    it('unknown subject, level or difficulty is 422 with the field keys', async () => {
      const err = await apiError(() => svc.create(mcqInput(tag, { subjectId: '999999999', educationLevelId: '999999999', difficultyLevel: 9 }), admin))
      expect(err.getStatus()).toBe(422)
      expect(Object.keys(err.fields ?? {}).sort()).toEqual(['difficultyLevel', 'educationLevelId', 'subjectId'])
      expect((await apiError(() => svc.create(mcqInput(tag, { subjectId: 'abc' }), admin))).fields).toHaveProperty('subjectId')
    })

    it('an unknown or non-question image file id is 422 on questionImage', async () => {
      const parts = [{ label: '1', prompt: { ms: 'q' }, mode: 'mcq', marks: 1, options: ['A', 'B', 'C'].map((l) => ({ label: l, body: { ms: l }, imageId: l === 'A' ? '999999999' : null })), key: { kind: 'option', correct: 'A' } }]
      const err = await apiError(() => svc.create(mcqInput(tag, { parts: parts as never }), admin))
      expect(err.getStatus()).toBe(422)
      expect(Object.keys(err.fields ?? {})[0]).toMatch(/^(questionImage|optionImages\.0)$/)
    })

    it('the unit defaults to the ancestor unit of the first SP when only dskpSpId is sent', async () => {
      const q = await svc.create(mcqInput(tag, { dskpSpId: tag.spId }), admin)
      expect(q.version.spIds).toEqual([tag.spId])
      expect(q.version.unitId).toBe(tag.unitId)
    })
  })

  describe('update, remove, bulk', () => {
    it('editing a draft rewrites the same version in place', async () => {
      const q = await svc.create(mcqInput(tag), admin)
      const out = await svc.update(q.id, { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 4, questionText: 'Teks soalan yang telah dikemaskini.', options: ['W', 'X', 'Y', 'Z'], correctAnswer: 3 }, admin)
      expect(out.latestVersionNo).toBe(1)
      expect(out.version.stemMs).toBe('Teks soalan yang telah dikemaskini.')
      expect(out.version.difficultyTp).toBe(4)
      expect((out.version.parts[0] as unknown as { key: unknown }).key).toEqual({ kind: 'option', correct: 'D' })
      expect(await t.db.query(`select 1 from question_versions where question_id = $1`, [q.id])).toHaveLength(1)
    })

    it('editing a published question makes version 2 a draft while version 1 keeps serving (Q-5)', async () => {
      const id = await questionIdOf(t.db, 'SEED-MCQ-SCI-T4')
      const live = await repo.get(id)
      const out = await svc.update(id, { subjectId: live!.version.subjectId!, educationLevelId: live!.version.educationLevelId!, difficultyLevel: 2, questionText: 'Teks sains yang disunting menjadi versi dua.' }, admin)
      expect(out).toMatchObject({ latestVersionNo: 2, liveVersionNo: 1 })
      expect(out.version.status).toBe('draft')
      expect((await repo.get(id))?.version.stemMs).toBe(live?.version.stemMs)
      expect((await svc.getPublicForLearner(id)).questionText).toBe(live?.version.stemMs)
      expect(await repo.eligibleForPractice(id)).toBe(true)
    })

    it('update and remove of an unknown id are 404', async () => {
      expect((await apiError(() => svc.update('999999999', { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 2, questionText: 'Teks yang panjang cukup.' }, admin))).getStatus()).toBe(404)
      expect((await apiError(() => svc.remove('999999999', admin))).getStatus()).toBe(404)
    })

    it('remove deletes the question with its versions', async () => {
      const q = await svc.create(mcqInput(tag), admin)
      await svc.remove(q.id, admin)
      expect(await repo.get(q.id, 'latest')).toBeNull()
      expect(await t.db.query(`select 1 from question_versions where question_id = $1`, [q.id])).toEqual([])
    })

    it('bulkAction counts each existing id once and skips unknown ids and refused transitions', async () => {
      const a = (await svc.create(mcqInput(tag), admin)).id
      const b = (await svc.create(mcqInput(tag), admin)).id
      expect(await svc.bulkAction('review', [a, b, a, '999999999', 'zz'], admin)).toEqual({ affected: 2, ids: [a, b], failed: [expect.objectContaining({ id: '999999999', code: 'NOT_FOUND' }), expect.objectContaining({ id: 'zz', code: 'NOT_FOUND' })] })
      // draft -> approved is outside the table: nothing changes.
      const c = (await svc.create(mcqInput(tag), admin)).id
      expect(await svc.bulkAction('approved', [c], admin)).toEqual({ affected: 0, ids: [], failed: [expect.objectContaining({ id: c, code: 'CONFLICT' })] })
      expect((await svc.getStatus(c)).status).toBe('draft')
      expect(await svc.bulkAction('approved', [a, b], admin)).toEqual({ affected: 2, ids: [a, b], failed: [] })
      expect((await svc.getStatus(a)).status).toBe('approved')
    })

    it('bulk publish skips an untagged question (gate) and publishes a tagged one', async () => {
      const untagged = (await svc.create(mcqInput(tag), admin)).id
      const tagged = (await svc.create(mcqInput(tag, { tag: tagBody(tag, 3) }), admin)).id
      await svc.bulkAction('review', [untagged, tagged], admin)
      await svc.bulkAction('approved', [untagged, tagged], admin)
      expect(await svc.bulkAction('published', [untagged, tagged], admin)).toEqual({ affected: 1, ids: [tagged], failed: [expect.objectContaining({ id: untagged, code: 'VALIDATION_ERROR' })] })
      expect((await svc.getStatus(untagged)).status).toBe('approved')
      expect((await svc.getStatus(tagged)).status).toBe('published')
    })

    it('bulk delete removes existing ids only', async () => {
      const a = (await svc.create(mcqInput(tag), admin)).id
      expect(await svc.bulkAction('delete', [a, a, '999999999'], admin)).toEqual({ affected: 1, ids: [a], failed: [expect.objectContaining({ id: '999999999', code: 'NOT_FOUND' })] })
      expect(await repo.get(a, 'latest')).toBeNull()
    })
  })

  describe('reads', () => {
    it('list is newest first with counts per status over the whole filter and ignores unknown filter values', async () => {
      const res = await svc.list({ page: 1, pageSize: 5 })
      expect(res.rows).toHaveLength(5)
      const ids = res.rows.map((r) => BigInt(r.id))
      expect(ids).toEqual([...ids].sort((x, y) => (x > y ? -1 : 1)))
      expect(res.total).toBeGreaterThanOrEqual(19)
      expect(Object.keys(res.counts).sort()).toEqual(['approved', 'archived', 'draft', 'published', 'review'])
      const published = await svc.list({ page: 1, pageSize: 100, status: 'published' })
      expect(published.rows.every((r) => r.version.status === 'published')).toBe(true)
      expect((await svc.list({ page: 1, pageSize: 20, subjectId: '999999999' })).total).toBe(0)
      expect((await svc.list({ page: 1, pageSize: 20, search: 'zzz-tiada-padanan-zzz' })).total).toBe(0)
    })

    it('summary has one tile per active subject; approved is the published count', async () => {
      const s = await svc.summary()
      expect(s.total).toBeGreaterThanOrEqual(19)
      const math = s.subjects.find((x) => x.id === tag.subjectId)
      expect(math?.approved).toBeGreaterThanOrEqual(1)
      expect(math!.total).toBeGreaterThanOrEqual(math!.approved)
    })

    it('getAdmin returns the DSKP chain and the creator name; unknown id is 404', async () => {
      const d = await svc.getAdmin(await questionIdOf(t.db, 'SEED-MCQ-MATH-T4'))
      expect(d.dskp?.sp.code).toBeTruthy()
      expect(d.dskp?.sk.code).toBeTruthy()
      expect(d.createdByName).toBeTruthy()
      expect((await apiError(() => svc.getAdmin('999999999'))).getStatus()).toBe(404)
    })

    it('structured: only structured questions, stats over the whole store, sub-questions in the part tree', async () => {
      const list = await svc.listStructured({ page: 1, pageSize: 25 })
      expect(list.total).toBe(3)
      expect(list.rows.every((r) => r.version.type === 'structured')).toBe(true)
      expect(list.stats.total).toBe(3)
      expect(list.stats.published).toBe(3)
      const one = await svc.getStructured(list.rows[0]!.id)
      expect(one.version.parts.length).toBeGreaterThan(0)
      expect((await apiError(async () => svc.getStructured(await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')))).getStatus()).toBe(404)
    })
  })

  describe('Guru (own rows)', () => {
    it('create saves as review, owned by the caller; the other teacher gets 404 on get, update and remove', async () => {
      const g = await svc.createGuru(
        { subjectId: tag.subjectId, educationLevelId: tag.levelId, questionType: 'mcq', difficultyLevel: 'medium', questionText: 'Soalan guru untuk ujian perkhidmatan.', options: ['a', 'b', 'c', 'd'], correctAnswer: 2 } as never,
        teacherId,
      )
      expect(g.version.status).toBe('review')
      expect(g.createdById).toBe(teacherId)
      expect(g.version.difficultyTp).toBe(3)
      expect((await apiError(() => svc.getOwn(g.id, teacher2Id))).getStatus()).toBe(404)
      expect((await apiError(() => svc.updateOwn(g.id, { questionText: 'Teks sunting guru lain.' } as never, teacher2Id))).getStatus()).toBe(404)
      expect((await apiError(() => svc.removeOwn(g.id, teacher2Id))).getStatus()).toBe(404)
      expect((await svc.getOwn(g.id, teacherId)).id).toBe(g.id)
    })

    it('listOwn shows only the caller rows, id ascending; updateOwn edits and removeOwn deletes', async () => {
      const mine = await svc.listOwn(teacherId, 1)
      expect(mine.rows.length).toBeGreaterThanOrEqual(2)
      expect(mine.rows.every((r) => r.createdById === teacherId)).toBe(true)
      const ids = mine.rows.map((r) => BigInt(r.id))
      expect(ids).toEqual([...ids].sort((x, y) => (x < y ? -1 : 1)))
      expect((await svc.listOwn(teacher2Id, 1)).total).toBe(0)
      const first = mine.rows.at(-1)! // the row created above, never the seeded review row
      const upd = await svc.updateOwn(first.id, { questionText: 'Teks guru yang telah disunting.' } as never, teacherId)
      expect(upd.version.stemMs).toBe('Teks guru yang telah disunting.')
      await svc.removeOwn(first.id, teacherId)
      expect(await repo.get(first.id, 'latest')).toBeNull()
    })

    it('contributionCountsFor counts the owner rows by status', async () => {
      const c = await svc.contributionCountsFor(teacherId)
      expect(c.total).toBe(Object.values(c.byStatus).reduce((a, b) => a + b, 0))
      expect(c.byStatus.review).toBeGreaterThanOrEqual(1)
      expect((await svc.contributionCountsFor(teacher2Id)).total).toBe(0)
      expect((await svc.contributionCountsFor('999999999')).total).toBe(0)
    })
  })

  describe('learners', () => {
    it('getPublicForLearner is 404 for draft, review, archived, unknown and inactive ids', async () => {
      for (const ref of ['SEED-DRAFT-BM-T4', 'SEED-REVIEW-SCI-T5', 'SEED-ARCHIVED-MATH-T4']) {
        expect((await apiError(async () => svc.getPublicForLearner(await questionIdOf(t.db, ref)))).getStatus(), ref).toBe(404)
      }
      expect((await apiError(() => svc.getPublicForLearner('999999999'))).getStatus()).toBe(404)
      const id = await questionIdOf(t.db, 'SEED-MCQ-BM-T4')
      await repo.deactivate(id)
      expect((await apiError(() => svc.getPublicForLearner(id))).getStatus()).toBe(404)
      await repo.reactivate(id)
      expect((await svc.getPublicForLearner(id)).id).toBe(id)
    })

    it('the public projection never carries a key, explanation, model answer or source (recursive scan)', async () => {
      for (const ref of ['SEED-MCQ-MATH-T5', 'SEED-STR-TREE', 'SEED-STR-ECF', 'SEED-STR-ANYN', 'SEED-GRP-AYAT-1', 'SEED-GRP-PASAR-2']) {
        const pub = await svc.getPublicForLearner(await questionIdOf(t.db, ref))
        const keys = allKeys(pub)
        for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden), `${ref}: ${forbidden}`).toBe(false)
        expect(pub.parts?.length).toBeGreaterThan(0)
      }
    })

    it('gradeAnswer grades an MCQ against the live key; 404 for a question with no live version', async () => {
      const id = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
      const live = await repo.get(id)
      const correct = (live!.version.parts[0] as unknown as { key: { correct: string } }).key.correct
      const wrong = correct === 'A' ? 'B' : 'A'
      expect(await svc.gradeAnswer(id, [{ value: { kind: 'option', label: correct } }])).toMatchObject({ marks: 1, maxMarks: 1, needsReview: false })
      expect(await svc.gradeAnswer(id, [{ value: { kind: 'option', label: wrong } }])).toMatchObject({ marks: 0, maxMarks: 1 })
      expect((await apiError(async () => svc.gradeAnswer(await questionIdOf(t.db, 'SEED-DRAFT-BM-T4'), []))).getStatus()).toBe(404)
    })
  })
})
