import type { QuestionPart } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FilesService } from '../../src/modules/files'
import { checkKeysGate, QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'
import { adminActor, apiError, mcqInput, rich, shortLeaf, tagBody, tagOf, userIdOf, type Tag } from './fixtures'

let fileSeq = 0
const ES = { subjectId: '', educationLevelId: '' }

/** Review fixes of BE-09: withdraw with a draft n+1, edit resets approval, size caps, image ownership, concurrency, keys gate. */
describe('BE-09 hardening (real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let teacher: { userId: string; role: 'teacher' }
  let teacher2: { userId: string; role: 'teacher' }
  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    ES.subjectId = tag.subjectId
    ES.educationLevelId = tag.levelId
    admin = await adminActor(t.db)
    teacher = { userId: await userIdOf(t.db, 'guru@demo.test'), role: 'teacher' }
    teacher2 = { userId: await userIdOf(t.db, 'guruadmin@demo.test'), role: 'teacher' }
  })
  afterAll(async () => {
    await t.close()
  })

  const edit = (text: string) => ({ ...ES, difficultyLevel: 3, questionText: text })

  async function published(): Promise<string> {
    const q = await svc.create(mcqInput(tag, { status: 'published', tag: tagBody(tag, 3) }), admin)
    return q.id
  }

  it('withdrawing a published question with a draft n+1 ends the live version too', async () => {
    const id = await published()
    await svc.update(id, edit('Versi dua yang masih draf sebelum ditarik balik.'), admin)
    expect(await svc.getStatus(id)).toMatchObject({ status: 'draft', latestVersionNo: 2, liveVersionNo: 1 })
    await svc.setStatus(id, 'archived', admin.userId)
    expect(await svc.getStatus(id)).toMatchObject({ status: 'archived', liveVersionNo: null })
    expect((await apiError(() => svc.getPublicForLearner(id))).getStatus()).toBe(404)
    expect(await repo.eligibleForPractice(id)).toBe(false)
    expect((await svc.list({ page: 1, pageSize: 100, status: 'archived' })).rows.map((r) => r.id)).toContain(id)
    const rows = await t.db.query<{ version_no: number; status: string; archive_reason: string | null }>(
      `select version_no, status, archive_reason from question_versions where question_id = $1 order by version_no`, [id])
    expect(rows).toEqual([
      { version_no: 1, status: 'archived', archive_reason: 'withdrawn' },
      { version_no: 2, status: 'archived', archive_reason: null },
    ])
  })

  it('an admin edit of an approved version resets it to draft; a Guru edit of their approved row goes back to review', async () => {
    const a = (await svc.create(mcqInput(tag), admin)).id
    await svc.setStatus(a, 'review', admin.userId)
    await svc.setStatus(a, 'approved', admin.userId)
    const out = await svc.update(a, edit('Teks admin selepas kelulusan diubah.'), admin)
    expect(out.version.status).toBe('draft')
    expect(out.latestVersionNo).toBe(1)

    const g = await svc.createGuru({ ...mcqInput(tag), difficultyLevel: 3, options: ['a', 'b', 'c', 'd'], correctAnswer: 0 } as never, teacher.userId)
    await svc.setStatus(g.id, 'approved', admin.userId)
    const back = await svc.updateOwn(g.id, { questionText: 'Teks guru selepas kelulusan diubah.' } as never, teacher.userId)
    expect(back.version.status).toBe('review')
  })

  it('caps the part tree: more than 20 top parts, more than 200 parts in all, or a 4th level is 422 on parts', async () => {
    const leaf = (l: string): QuestionPart => shortLeaf(l, 1, ['x'])
    const many = Array.from({ length: 21 }, (_, i) => leaf(String(i)))
    const wide = Array.from({ length: 15 }, (_, i) => ({ label: String(i), prompt: rich('b'), children: Array.from({ length: 14 }, (_, j) => leaf(String(j))) })) as unknown as QuestionPart[]
    const deep = [{ label: 'a', prompt: rich('b'), children: [{ label: 'i', prompt: rich('b'), children: [{ label: 'A', prompt: rich('b'), children: [leaf('x')] }] }] }] as unknown as QuestionPart[]
    for (const parts of [many, wide, deep]) {
      const err = await apiError(() => svc.create(mcqInput(tag, { questionType: 'essay', parts }), admin))
      expect(err.getStatus()).toBe(422)
      expect(Object.keys(err.fields ?? {})).toEqual(['parts'])
    }
    const ok = await svc.create(mcqInput(tag, { questionType: 'essay', parts: Array.from({ length: 20 }, (_, i) => leaf(String(i))) }), admin)
    expect(ok.version.parts).toHaveLength(20)
  })

  it('caps distinct image ids per question at 50 without looking any of them up', async () => {
    const leafWithImages = (n: number): QuestionPart => ({
      label: String(n), prompt: rich('q'), mode: 'mcq', marks: 1,
      options: 'ABCDEFGH'.split('').map((l, i) => ({ label: l, body: rich(l), imageId: String(100000 + n * 10 + i) })),
      key: { kind: 'option', correct: 'A' },
    }) as unknown as QuestionPart
    const parts = Array.from({ length: 7 }, (_, i) => leafWithImages(i))
    const err = await apiError(() => svc.create(mcqInput(tag, { questionType: 'essay', parts }), admin))
    expect(err.getStatus()).toBe(422)
    expect(Object.keys(err.fields ?? {})).toEqual(['imageIds'])
  })

  async function fileFor(owner: string | null, purpose = 'question_image'): Promise<string> {
    const n = String(++fileSeq)
    const rows = await t.db.query<{ id: string }>(
      `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
       values ($1, $2, $3, 'image/png', 10, $4, $5) returning id::text`,
      [`p${n}`.padEnd(22, 'A'), owner, purpose, 'a'.repeat(64), `key-${n}`],
    )
    return rows[0]!.id
  }
  const withImage = (imageId: string): QuestionPart[] => [{
    label: '1', prompt: rich('q'), mode: 'mcq', marks: 1,
    options: ['A', 'B', 'C'].map((l) => ({ label: l, body: rich(l), imageId: l === 'A' ? imageId : null })),
    key: { kind: 'option', correct: 'A' },
  }] as unknown as QuestionPart[]

  it('metaOf reads the row only: purpose and owner, null for an unknown or malformed id', async () => {
    const id = await fileFor(teacher.userId)
    expect(await t.app.get(FilesService).metaOf(id)).toEqual({ purpose: 'question_image', ownerUserId: teacher.userId })
    expect(await t.app.get(FilesService).metaOf('999999999')).toBeNull()
    expect(await t.app.get(FilesService).metaOf('abc')).toBeNull()
  })

  const tokenOf = async (id: string): Promise<string> => (await t.db.query<{ public_id: string }>('select public_id from files where id = $1', [id]))[0]!.public_id

  it('an attached image must be the actor own file, by public token; an admin may use any; an unowned file is admin only (SW12-01-A)', async () => {
    const mine = await fileFor(teacher.userId)
    const theirs = await fileFor(teacher2.userId)
    const orphan = await fileFor(null)
    const wrongPurpose = await fileFor(teacher.userId, 'avatar')
    const make = (actor: typeof teacher | typeof admin, imageId: string) =>
      svc.create(mcqInput(tag, { questionType: 'essay', parts: withImage(imageId) }), actor)
    const [mineT, orphanT, theirsT] = [await tokenOf(mine), await tokenOf(orphan), await tokenOf(theirs)]
    expect((await make(teacher, mineT)).version.status).toBe('draft')
    // Intended change: a teacher no longer reaches an unowned file (its uploader was deleted), nor any file by its decimal internal id.
    const noOwner = await apiError(() => make(teacher, orphanT))
    expect(Object.keys(noOwner.fields ?? {})).toEqual(['optionImages.0'])
    const byInternalId = await apiError(() => make(teacher, mine))
    expect(Object.keys(byInternalId.fields ?? {})).toEqual(['optionImages.0'])
    const err = await apiError(() => make(teacher, theirsT))
    expect(err.getStatus()).toBe(422)
    // Same key and message as a missing file or a wrong purpose: no existence oracle.
    const missing = await apiError(() => make(teacher, 'A'.repeat(22)))
    expect(err.fields).toEqual(missing.fields)
    expect(noOwner.fields).toEqual(missing.fields)
    expect(Object.keys(err.fields ?? {})).toEqual(['optionImages.0'])
    expect((await make(admin, theirs)).version.status).toBe('draft')
    expect((await make(admin, orphan)).version.status).toBe('draft')
    expect((await make(admin, theirsT)).version.status).toBe('draft')
    expect(Object.keys((await apiError(() => make(admin, wrongPurpose))).fields ?? {})).toEqual(['optionImages.0'])
  })

  it('two parallel edits of a published question both succeed and leave one version 2', async () => {
    const id = await published()
    const results = await Promise.allSettled([
      svc.update(id, edit('Suntingan serentak nombor satu.'), admin),
      svc.update(id, edit('Suntingan serentak nombor dua.'), admin),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    const rows = await t.db.query<{ version_no: number; status: string }>(`select version_no, status from question_versions where question_id = $1 order by version_no`, [id])
    expect(rows).toEqual([{ version_no: 1, status: 'published' }, { version_no: 2, status: 'draft' }])
  })

  it('gradeAnswer is 404 for a deactivated question, like getPublicForLearner', async () => {
    const id = await published()
    await repo.deactivate(id)
    expect((await apiError(() => svc.gradeAnswer(id, []))).getStatus()).toBe(404)
    await repo.reactivate(id)
    expect((await svc.gradeAnswer(id, [])).maxMarks).toBe(1)
  })

  it('create with status published also runs the keys gate; a valid key passes', async () => {
    const bad = [{
      label: '1', prompt: rich('Kira'), mode: 'working', marks: 3,
      key: { kind: 'points', marks: 2, points: [{ id: 'p', code: 'K', label: 'k', marks: 2 }] },
    }] as unknown as QuestionPart[]
    const good = [{
      label: '1', prompt: rich('Kira'), mode: 'working', marks: 3,
      key: { kind: 'points', marks: 3, points: [{ id: 'p', code: 'K', label: 'k', marks: 3 }] },
    }] as unknown as QuestionPart[]
    const before = (await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n
    const err = await apiError(() => svc.create(mcqInput(tag, { questionType: 'essay', status: 'published', tag: tagBody(tag), parts: bad }), admin))
    expect(err.getStatus()).toBe(422)
    expect(Object.keys(err.fields ?? {})).toEqual(['parts.1.key'])
    expect((await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n).toBe(before)
    // The same tree is fine as a draft; fixed, it publishes.
    expect((await svc.create(mcqInput(tag, { questionType: 'essay', parts: bad }), admin)).version.status).toBe('draft')
    expect((await svc.create(mcqInput(tag, { questionType: 'essay', status: 'published', tag: tagBody(tag), parts: good }), admin)).version.status).toBe('published')
    // An invalid key (wrong kind for the mode) never reaches the gate: 422 from the schema.
    const wrong = [{ label: '1', prompt: rich('x'), mode: 'mcq', marks: 1, options: [], key: { kind: 'accepted', values: ['x'] } }] as unknown as QuestionPart[]
    expect((await apiError(() => svc.create(mcqInput(tag, { questionType: 'essay', status: 'published', tag: tagBody(tag), parts: wrong }), admin))).getStatus()).toBe(422)
  })

  const badTree = [{
    label: '1', prompt: rich('Kira'), mode: 'working', marks: 3,
    key: { kind: 'points', marks: 2, points: [{ id: 'p', code: 'K', label: 'k', marks: 2 }] },
  }] as unknown as QuestionPart[]
  const goodTree = [{
    label: '1', prompt: rich('Kira'), mode: 'working', marks: 3,
    key: { kind: 'points', marks: 3, points: [{ id: 'p', code: 'K', label: 'k', marks: 3 }] },
  }] as unknown as QuestionPart[]
  async function approvedWith(parts: QuestionPart[]): Promise<string> {
    const id = (await svc.create(mcqInput(tag, { questionType: 'essay', tag: tagBody(tag), parts }), admin)).id
    await svc.setStatus(id, 'review', admin.userId)
    await svc.setStatus(id, 'approved', admin.userId)
    return id
  }

  it('setStatus approved to published runs the keys gate: mismatched point marks are 422 and nothing changes', async () => {
    const id = await approvedWith(badTree)
    const err = await apiError(() => svc.setStatus(id, 'published', admin.userId))
    expect(err.getStatus()).toBe(422)
    expect(Object.keys(err.fields ?? {})).toEqual(['parts.1.key'])
    expect(await svc.getStatus(id)).toMatchObject({ status: 'approved', liveVersionNo: null })
    expect((await svc.setStatus(await approvedWith(goodTree), 'published', admin.userId)).version.status).toBe('published')
  })

  it('bulk publish skips the invalid-key row and counts only the valid one', async () => {
    const bad = await approvedWith(badTree)
    const good = await approvedWith(goodTree)
    expect(await svc.bulkAction('published', [bad, good], admin)).toEqual({ affected: 1, ids: [good], failed: [expect.objectContaining({ id: bad, code: 'VALIDATION_ERROR' })] })
    expect((await svc.getStatus(bad)).status).toBe('approved')
    expect((await svc.getStatus(good)).status).toBe('published')
  })

  it('every seeded published question passes the keys gate', async () => {
    const records = await repo.getMany(await repo.eligibleIds())
    expect(records.length).toBeGreaterThanOrEqual(16)
    for (const r of records) expect(checkKeysGate(r.version.parts), r.id).toEqual({})
  })

  it('bulkAction reports the ids it changed', async () => {
    const a = (await svc.create(mcqInput(tag), admin)).id
    expect(await svc.bulkAction('review', [a, a, '999999999'], admin)).toEqual({ affected: 1, ids: [a], failed: [expect.objectContaining({ id: '999999999', code: 'NOT_FOUND' })] })
  })
})
