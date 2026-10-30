import {
  CurriculumActiveStateSchema,
  CurriculumDeletedOneSchema,
  CurriculumEducationLevelListItemSchema,
  CurriculumEducationLevelLookupSchema,
  CurriculumEducationLevelSchema,
  CurriculumSubjectListItemSchema,
  CurriculumSubjectLookupSchema,
  CurriculumSubjectSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  bootCurriculumApp,
  count,
  expectError,
  idOf,
  loginAs,
  parseData,
  parseList,
  parseStatus,
  type Client,
  type CurriculumTestApp,
} from './helpers'

/** Port of mock `admin-handlers.test.ts` #1 to #12 (AC1, AC3, AC4). */
describe('admin subjects and education levels', () => {
  let t: CurriculumTestApp
  let admin: Client
  let student: Client
  beforeAll(async () => {
    t = await bootCurriculumApp()
    admin = await loginAs(t, 'admin@demo.test')
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const levelWrite = (over: Record<string, unknown> = {}) => ({
    name: 'Tahap Ujian',
    nameEn: 'Test Level',
    code: 'tu1',
    stage: 'lower_secondary',
    curriculum: 'KSSM',
    order: 12,
    ...over,
  })
  const subjectWrite = (over: Record<string, unknown> = {}) => ({ name: 'A', nameEn: 'B', code: 'tst1', ...over })

  describe('subjects #1 to #6', () => {
    it('#1 lists every subject with questionCount and level names', async () => {
      const res = await admin.get('/api/admin/subjects')
      const items = parseList(res, CurriculumSubjectListItemSchema)
      // 31 observed subjects and the two DSKP-only (inactive) practical subjects.
      expect(items).toHaveLength(33)
      expect(res.body.meta).toMatchObject({ totalItems: 33, page: 1, totalPages: 1 })
      const math = items.find((s) => s.code === 'MATH')!
      expect(math.questionCount).toBe(0)
      expect(math.levels).toHaveLength(5)
      expect(math.levels[0]).toEqual({ id: await idOf(t.db, 'education_levels', 'T1'), name: 'Tingkatan 1' })
      expect(math.educationLevelIds).toHaveLength(5)
      expect(items.find((s) => s.code === 'SS')!.levels).toEqual([])
      expect(items.find((s) => s.code === 'LNR')!.isActive).toBe(false)
    })

    it('#2 returns one subject; an unknown or malformed id is 404 with the flash copy', async () => {
      const id = await idOf(t.db, 'subjects', 'MATH')
      const subject = parseData(await admin.get(`/api/admin/subjects/${id}`), CurriculumSubjectSchema)
      expect(subject).toMatchObject({ id, code: 'MATH', order: 3, name: 'Matematik' })
      expect(subject.createdAt).toMatch(/\+08:00$/)
      for (const bad of ['99999999', 'abc', '0']) expectError(await admin.get(`/api/admin/subjects/${bad}`), 'NOT_FOUND', 'Subjek tidak dijumpai.')
    })

    it('#3 creates a subject (upper-case code, active, de-duplicated links, defaults) and persists it', async () => {
      const [d1, d2] = [await idOf(t.db, 'education_levels', 'T1'), await idOf(t.db, 'education_levels', 'T2')]
      const res = await admin.post('/api/admin/subjects', subjectWrite({ name: ' Subjek Ujian ', color: '#0f766e', isCore: true, order: 40, educationLevelIds: [d1, d2, d2] }))
      const { data, status } = parseStatus(res, CurriculumSubjectSchema, 201)
      expect(status).toBe('Subjek berjaya ditambah.')
      expect(data).toMatchObject({ name: 'Subjek Ujian', code: 'TST1', isActive: true, isCore: true, icon: 'fas fa-book', color: '#0f766e', order: 40, educationLevelIds: [d1, d2] })
      const stored = parseData(await admin.get(`/api/admin/subjects/${data.id}`), CurriculumSubjectSchema)
      expect(stored).toEqual(data)
      expect(await count(t.db, 'select count(*) n from subject_levels where subject_id = $1', [data.id])).toBe(2)
      const list = parseList(await admin.get('/api/admin/subjects'), CurriculumSubjectListItemSchema)
      expect(list.find((s) => s.id === data.id)!.questionCount).toBe(0)
    })

    it('#3 applies the defaults (color #4f46e5, isCore false, order 0, icon fas fa-book) and stores an empty icon as null', async () => {
      const def = parseStatus(await admin.post('/api/admin/subjects', subjectWrite({ code: 'DEF1' })), CurriculumSubjectSchema, 201)
      expect(def.data).toMatchObject({ color: '#4f46e5', isCore: false, order: 0, icon: 'fas fa-book', educationLevelIds: [] })
      const ico = parseStatus(await admin.post('/api/admin/subjects', subjectWrite({ code: 'ICO1', icon: '' })), CurriculumSubjectSchema, 201)
      expect(ico.data.icon).toBeNull()
    })

    it('#3 reads numbers and booleans as strings or numbers like the form posts do', async () => {
      const res = await admin.post('/api/admin/subjects', subjectWrite({ code: 'FRM1', isCore: '1', order: '7' }))
      expect(parseStatus(res, CurriculumSubjectSchema, 201).data).toMatchObject({ isCore: true, order: 7 })
    })

    it('#3 rejects keys it does not own (mass assignment): isActive, id and legacy keys are 422 and nothing is written', async () => {
      const before = await count(t.db, 'select count(*) n from subjects')
      const res = await admin.post('/api/admin/subjects', subjectWrite({ code: 'MASS1', isActive: false, id: '5', legacySource: 'cloud', legacyId: '9', createdAt: '2000-01-01T00:00:00+08:00' }))
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({
        isActive: 'The is active field is prohibited.',
        id: 'The id field is prohibited.',
        legacySource: 'The legacy source field is prohibited.',
        legacyId: 'The legacy id field is prohibited.',
        createdAt: 'The created at field is prohibited.',
      })
      expect(await count(t.db, 'select count(*) n from subjects')).toBe(before)
    })

    it('#3/#4 validate: required, duplicate code, length, colour, order and unknown level, all in one 422', async () => {
      const empty = expectError(await admin.post('/api/admin/subjects', {}), 'VALIDATION_ERROR')
      expect(empty.fields).toEqual({ name: 'The name field is required.', nameEn: 'The name en field is required.', code: 'The code field is required.' })
      expect(expectError(await admin.post('/api/admin/subjects', subjectWrite({ code: 'math' })), 'VALIDATION_ERROR').fields).toEqual({ code: 'The code has already been taken.' })
      expect(expectError(await admin.post('/api/admin/subjects', subjectWrite({ code: 'A'.repeat(21) })), 'VALIDATION_ERROR').fields).toEqual({
        code: 'The code field must not be greater than 20 characters.',
      })
      const bad = expectError(await admin.post('/api/admin/subjects', subjectWrite({ code: 'OK1', color: 'red', order: -1, educationLevelIds: ['1', '999999'] })), 'VALIDATION_ERROR')
      expect(bad.fields).toMatchObject({
        color: 'The color field format is invalid.',
        order: 'The order field must be at least 0.',
        educationLevelIds: 'The selected education level ids is invalid.',
      })
      expect(expectError(await admin.post('/api/admin/subjects', subjectWrite({ code: 'OK2', educationLevelIds: 'not-an-array' })), 'VALIDATION_ERROR').fields).toEqual({
        educationLevelIds: 'The education level ids field must be an array.',
      })
      expect(await count(t.db, `select count(*) n from subjects where code in ('OK1', 'OK2')`)).toBe(0)
    })

    it('#3 a JSON body that is not an object is a 422, never a server error', async () => {
      const post = (text: string) => admin.noCsrf.post('/api/admin/subjects').set('X-CSRF-Token', admin.csrf).type('json').send(text)
      // An array reaches the module's validation; a bare scalar or null is refused by the body parser (400 mapped to 422).
      for (const body of [[1, 2], []]) {
        expect(expectError(await post(JSON.stringify(body)), 'VALIDATION_ERROR').fields, JSON.stringify(body)).toEqual({ _: 'The request body must be a JSON object.' })
      }
      for (const text of ['"text"', '5', 'true', 'null', '{bad json']) expectError(await post(text), 'VALIDATION_ERROR')
    })

    it('#4 keeps omitted educationLevelIds, color, isCore, order and icon; an empty list or icon clears them', async () => {
      const id = await idOf(t.db, 'subjects', 'MATH')
      const before = parseData(await admin.get(`/api/admin/subjects/${id}`), CurriculumSubjectSchema)
      const res = await admin.put(`/api/admin/subjects/${id}`, { name: 'Matematik', nameEn: 'Mathematics', code: 'MATH' })
      const { data } = parseStatus(res, CurriculumSubjectSchema, 200)
      expect(data).toMatchObject({ color: before.color, isCore: before.isCore, order: before.order, icon: before.icon, educationLevelIds: before.educationLevelIds })
      expect(await count(t.db, 'select count(*) n from subject_levels where subject_id = $1', [id])).toBe(11)
      const cleared = parseStatus(await admin.put(`/api/admin/subjects/${id}`, { name: 'Matematik', nameEn: 'Mathematics', code: 'MATH', educationLevelIds: [], icon: '' }), CurriculumSubjectSchema, 200)
      expect(cleared.data).toMatchObject({ educationLevelIds: [], icon: null })
      // Restore for the following tests.
      const all = parseList(await admin.get('/api/admin/education-levels'), CurriculumEducationLevelListItemSchema).map((l) => l.id)
      await admin.put(`/api/admin/subjects/${id}`, { name: 'Matematik', nameEn: 'Mathematics', code: 'MATH', educationLevelIds: all, icon: before.icon })
    })

    it('#4 updates, replaces the links, allows keeping its own code and 404s an unknown id before it validates', async () => {
      const id = await idOf(t.db, 'subjects', 'SRT')
      const d1 = await idOf(t.db, 'education_levels', 'T1')
      const res = await admin.put(`/api/admin/subjects/${id}`, { name: 'Sains Rumah Tangga X', nameEn: 'Home Science', code: 'srt', color: '#123456', isCore: false, order: 28, educationLevelIds: [d1] })
      const { data, status } = parseStatus(res, CurriculumSubjectSchema, 200)
      expect(status).toBe('Subjek berjaya dikemaskini.')
      expect(data).toMatchObject({ id, name: 'Sains Rumah Tangga X', code: 'SRT', educationLevelIds: [d1], isActive: true })
      expect(await count(t.db, 'select count(*) n from subject_levels where subject_id = $1', [id])).toBe(1)
      expect(expectError(await admin.put(`/api/admin/subjects/${id}`, { name: 'a', nameEn: 'b', code: 'BM' }), 'VALIDATION_ERROR').fields).toEqual({ code: 'The code has already been taken.' })
      expectError(await admin.put('/api/admin/subjects/99999999', {}), 'NOT_FOUND', 'Subjek tidak dijumpai.')
    })

    it('#5 toggles active, leaves the lookups, stays in the admin list; bad input is 422 and an unknown id 404', async () => {
      const id = await idOf(t.db, 'subjects', 'PN')
      const off = parseData(await admin.patch(`/api/admin/subjects/${id}/active`, { isActive: false }), CurriculumActiveStateSchema)
      expect(off).toEqual({ id, isActive: false })
      const lookup = parseList(await student.get('/api/subjects'), CurriculumSubjectLookupSchema)
      expect(lookup.map((s) => s.id)).not.toContain(id)
      expect(parseList(await admin.get('/api/admin/subjects'), CurriculumSubjectListItemSchema).map((s) => s.id)).toContain(id)
      expect(parseData(await admin.patch(`/api/admin/subjects/${id}/active`, { isActive: true }), CurriculumActiveStateSchema).isActive).toBe(true)
      expect(parseData(await admin.patch(`/api/admin/subjects/${id}/active`, { isActive: '0' }), CurriculumActiveStateSchema).isActive).toBe(false)
      await admin.patch(`/api/admin/subjects/${id}/active`, { isActive: 1 })
      expect(expectError(await admin.patch(`/api/admin/subjects/${id}/active`, {}), 'VALIDATION_ERROR').fields).toEqual({ isActive: 'The is active field is required.' })
      expect(expectError(await admin.patch(`/api/admin/subjects/${id}/active`, { isActive: 'maybe' }), 'VALIDATION_ERROR').fields).toEqual({ isActive: 'The is active field must be true or false.' })
      expectError(await admin.patch('/api/admin/subjects/99999999/active', { isActive: true }), 'NOT_FOUND', 'Subjek tidak dijumpai.')
    })

    it('#6 409 while the subject has level links, chapters or DSKP nodes (nothing deleted); an empty subject is deleted; 404 afterwards', async () => {
      const id = await idOf(t.db, 'subjects', 'MATH')
      const counts = async () => ({
        links: await count(t.db, 'select count(*) n from subject_levels where subject_id = $1', [id]),
        chapters: await count(t.db, 'select count(*) n from chapters where subject_id = $1', [id]),
        topics: await count(t.db, 'select count(*) n from topics where chapter_id in (select id from chapters where subject_id = $1)', [id]),
        allChapters: await count(t.db, 'select count(*) n from chapters'),
        allTopics: await count(t.db, 'select count(*) n from topics'),
        nodes: await count(t.db, 'select count(*) n from curriculum_nodes where subject_id = $1', [id]),
      })
      const before = await counts()
      expect(before.links).toBe(11)
      expect(before.chapters).toBe(94)
      expect(before.nodes).toBeGreaterThan(0)
      expectError(await admin.delete(`/api/admin/subjects/${id}`), 'CONFLICT', 'Subjek ini masih mempunyai tahap, bab atau nod DSKP.')
      expect(await counts()).toEqual(before)
      expect(parseData(await admin.get(`/api/admin/subjects/${id}`), CurriculumSubjectSchema).id).toBe(id)

      const empty = parseStatus(await admin.post('/api/admin/subjects', subjectWrite({ code: 'del1' })), CurriculumSubjectSchema, 201).data.id
      const res = await admin.delete(`/api/admin/subjects/${empty}`)
      expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Subjek berjaya dipadam.' })
      parseStatus(res, CurriculumDeletedOneSchema, 200)
      expect(await count(t.db, 'select count(*) n from subjects where id = $1', [empty])).toBe(0)
      expectError(await admin.delete(`/api/admin/subjects/${empty}`), 'NOT_FOUND', 'Subjek tidak dijumpai.')
      expectError(await admin.get(`/api/admin/subjects/${empty}`), 'NOT_FOUND', 'Subjek tidak dijumpai.')
    })
  })

  describe('education levels #7 to #12', () => {
    it('#7 lists 5 levels with questionCount and subjectCount', async () => {
      const items = parseList(await admin.get('/api/admin/education-levels'), CurriculumEducationLevelListItemSchema)
      expect(items).toHaveLength(5)
      expect(items[0]).toMatchObject({ code: 'T1', stage: 'lower_secondary', questionCount: 0 })
      // Earlier tests deleted Matematik and re-linked other subjects: the counts follow the pivot table.
      for (const l of items) {
        expect(l.subjectCount).toBe(await count(t.db, 'select count(*) n from subject_levels where education_level_id = $1', [l.id]))
      }
    })

    it('#8 returns one level; an unknown id is 404 with the flash copy', async () => {
      const id = await idOf(t.db, 'education_levels', 'T4')
      expect(parseData(await admin.get(`/api/admin/education-levels/${id}`), CurriculumEducationLevelSchema)).toMatchObject({ code: 'T4', stage: 'upper_secondary', curriculum: 'KSSM', grade: 10 })
      expectError(await admin.get('/api/admin/education-levels/99999999'), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
      expectError(await admin.get('/api/admin/education-levels/abc'), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    })

    it('#9 creates a level (upper-case code, active, grade null) and lists it last with 0 counts', async () => {
      const res = await admin.post('/api/admin/education-levels', levelWrite())
      const { data, status } = parseStatus(res, CurriculumEducationLevelSchema, 201)
      expect(status).toBe('Tahap Pendidikan berjaya ditambah.')
      expect(data).toMatchObject({ code: 'TU1', isActive: true, grade: null, order: 12, name: 'Tahap Ujian' })
      const list = parseList(await admin.get('/api/admin/education-levels'), CurriculumEducationLevelListItemSchema)
      expect(list).toHaveLength(6)
      expect(list[5]).toMatchObject({ code: 'TU1', questionCount: 0, subjectCount: 0 })
      // order defaults to 0 when absent.
      const noOrder = parseStatus(await admin.post('/api/admin/education-levels', levelWrite({ code: 'TU2', order: undefined })), CurriculumEducationLevelSchema, 201)
      expect(noOrder.data.order).toBe(0)
    })

    it('#9/#10 validate: required, stage enum, code length and duplicate, order', async () => {
      const empty = expectError(await admin.post('/api/admin/education-levels', {}), 'VALIDATION_ERROR')
      expect(Object.keys(empty.fields!).sort()).toEqual(['code', 'curriculum', 'name', 'nameEn', 'stage'])
      expect(empty.fields!.stage).toBe('The stage field is required.')
      const bad = expectError(await admin.post('/api/admin/education-levels', levelWrite({ code: 'd1', stage: 'nope', order: -3 })), 'VALIDATION_ERROR')
      expect(bad.fields).toEqual({ code: 'The code has already been taken.', stage: 'The selected stage is invalid.', order: 'The order field must be at least 0.' })
      const long = expectError(await admin.post('/api/admin/education-levels', levelWrite({ code: 'ABCDEFGHIJK' })), 'VALIDATION_ERROR')
      expect(long.fields).toEqual({ code: 'The code field must not be greater than 10 characters.' })
    })

    it('#10 updates (own code allowed in any case), 422 on a clash, 404 on an unknown id', async () => {
      const id = await idOf(t.db, 'education_levels', 'D1')
      const { data, status } = parseStatus(
        await admin.put(`/api/admin/education-levels/${id}`, { name: 'Tahun 1', nameEn: 'Year 1', code: 'd1', stage: 'lower_secondary', curriculum: 'KSSM', order: 1 }),
        CurriculumEducationLevelSchema,
        200,
      )
      expect(status).toBe('Tahap Pendidikan berjaya dikemaskini.')
      expect(data).toMatchObject({ id, name: 'Tahun 1', code: 'D1', grade: 1 })
      const clash = expectError(await admin.put(`/api/admin/education-levels/${id}`, levelWrite({ code: 'd2' })), 'VALIDATION_ERROR')
      expect(clash.fields).toEqual({ code: 'The code has already been taken.' })
      expectError(await admin.put('/api/admin/education-levels/99999999', {}), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    })

    it('#11 toggles active; the lookup drops it, the admin list keeps it (non-primary levels are listed with isActive); 422 and 404', async () => {
      const id = await idOf(t.db, 'education_levels', 'T5')
      expect(parseData(await admin.patch(`/api/admin/education-levels/${id}/active`, { isActive: false }), CurriculumActiveStateSchema)).toEqual({ id, isActive: false })
      expect(parseList(await student.get('/api/education-levels'), CurriculumEducationLevelLookupSchema).map((l) => l.id)).not.toContain(id)
      expect(parseList(await admin.get('/api/admin/education-levels'), CurriculumEducationLevelListItemSchema).map((l) => l.id)).toContain(id)
      await admin.patch(`/api/admin/education-levels/${id}/active`, { isActive: true })
      expect(expectError(await admin.patch(`/api/admin/education-levels/${id}/active`, {}), 'VALIDATION_ERROR').fields).toEqual({ isActive: 'The is active field is required.' })
      expectError(await admin.patch('/api/admin/education-levels/99999999/active', { isActive: true }), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    })

    it('#12 409 while the level has subjects, chapters or DSKP nodes (nothing deleted); an empty level is deleted; 404 afterwards', async () => {
      const id = await idOf(t.db, 'education_levels', 'D1')
      const counts = async () => ({
        links: await count(t.db, 'select count(*) n from subject_levels where education_level_id = $1', [id]),
        chapters: await count(t.db, 'select count(*) n from chapters where education_level_id = $1', [id]),
        all: await count(t.db, 'select count(*) n from chapters'),
        topics: await count(t.db, 'select count(*) n from topics'),
        subtopics: await count(t.db, 'select count(*) n from subtopics'),
        nodes: await count(t.db, 'select count(*) n from curriculum_nodes where education_level_id = $1', [id]),
      })
      const before = await counts()
      expect(before.chapters).toBeGreaterThan(0)
      expectError(await admin.delete(`/api/admin/education-levels/${id}`), 'CONFLICT', 'Tahap Pendidikan ini masih mempunyai subjek, bab atau nod DSKP.')
      expect(await counts()).toEqual(before)

      const empty = parseStatus(await admin.post('/api/admin/education-levels', levelWrite({ code: 'del1' })), CurriculumEducationLevelSchema, 201).data.id
      const res = await admin.delete(`/api/admin/education-levels/${empty}`)
      expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Tahap Pendidikan berjaya dipadam.' })
      expect(await count(t.db, 'select count(*) n from education_levels where id = $1', [empty])).toBe(0)
      expectError(await admin.delete(`/api/admin/education-levels/${empty}`), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    })
  })

  describe('question counts come through the provider (BE-09 stand-in)', () => {
    it('shows the counts the provider reports for levels and subjects', async () => {
      const levelId = await idOf(t.db, 'education_levels', 'T4')
      const subjectId = await idOf(t.db, 'subjects', 'BM')
      const stubbed = await bootCurriculumApp({
        db: t.db,
        questionCounts: {
          async activeByLevel() {
            return new Map([[levelId, 42]])
          },
          async activeBySubject() {
            return new Map([[subjectId, 7]])
          },
        },
      })
      try {
        const c = await loginAs(stubbed, 'admin@demo.test')
        const levels = parseList(await c.get('/api/admin/education-levels'), CurriculumEducationLevelListItemSchema)
        expect(levels.find((l) => l.id === levelId)!.questionCount).toBe(42)
        expect(levels.find((l) => l.id !== levelId)!.questionCount).toBe(0)
        const subjects = parseList(await c.get('/api/admin/subjects'), CurriculumSubjectListItemSchema)
        expect(subjects.find((s) => s.id === subjectId)!.questionCount).toBe(7)
      } finally {
        await stubbed.app.close()
      }
    })
  })
})
