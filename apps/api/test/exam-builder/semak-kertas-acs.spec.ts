import { BIJAK_BUILDER_MESSAGES as MSG } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { serveSeededBlueprints } from '../support/serve-blueprints'
import { MAX_EDITOR_CANDIDATES } from '../../src/modules/exam/builder/builder.constants'
import { FakeBank, matBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

/**
 * R1-T51 (A3): the backend part of the Semak Kertas / Pembina Set acceptance criteria that had no named test.
 * AC-R1-21.3 "Kemas kini metadata" (Tajuk, Tempoh (minit), Kod kertas (kulit), Arahan kulit kertas), the "Kontrak Simulasi" block
 * and the read-only message after Terbit; AC-R1-21.6 the bank picker limits.
 * The text of a flash and the labels are front end; here the stored result and the refusals are proven.
 */
describe('R1-T51 Semak Kertas and Pembina Set: backend criteria', () => {
  let t: BuilderTestApp
  let admin: Client
  let bank: FakeBank

  beforeAll(async () => {
    bank = matBank()
    // 1100 more approved MAT kertas 2 questions: more than the picker shows.
    for (let i = 0; i < 1100; i++) bank.add({ id: String(730000 + i), marks: 1 })
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank, pool: 'builder-source' })
    await serveSeededBlueprints(t.db)
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }

  describe('AC-R1-21.3 Kemas kini metadata', () => {
    it('Tajuk, Tempoh (minit), Kod kertas (kulit) and Arahan kulit kertas are saved (trimmed) and come back on the editor', async () => {
      const id = await newPaper()
      const before = (await admin.get(`/api/admin/papers/${id}`)).body.data.paper
      expect(before.code).toBe('1449/2') // starts as the Kontrak code
      const res = await admin.put(`/api/admin/papers/${id}`, {
        title: '  Percubaan Set Uji  ',
        durationMin: 150,
        code: '  1449/2-B  ',
        instructions: ['  Jawab SEMUA soalan.  ', 'Tulis nama anda.'],
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.paper).toMatchObject({ title: 'Percubaan Set Uji', durationMin: 150, code: '1449/2-B', instructions: ['Jawab SEMUA soalan.', 'Tulis nama anda.'] })
      const again = (await admin.get(`/api/admin/papers/${id}`)).body.data.paper
      expect(again).toMatchObject({ title: 'Percubaan Set Uji', durationMin: 150, code: '1449/2-B' })
      // the paper code is the paper's own: the Kontrak and a copy keep theirs apart
      expect((await t.db.query<{ code: string }>(`select code from blueprints where code = '1449/2-B'`)).length).toBe(0)
      const copy = await admin.post(`/api/admin/papers/${id}/copy`)
      expect((await admin.get(`/api/admin/papers/${copy.body.data.id as string}`)).body.data.paper.code).toBe('1449/2-B')
    })

    it('a blank Tajuk, a zero Tempoh and a Kod kertas over 32 characters are refused (422, nothing saved); a blank Kod kertas falls back to the subject code (T48, V2 rule)', async () => {
      const id = await newPaper()
      const tooLong = await admin.put(`/api/admin/papers/${id}`, { code: 'X'.repeat(33) })
      expect(tooLong.status, JSON.stringify(tooLong.body)).toBe(422)
      expect(tooLong.body.error.fields.code).toBe(MSG.codeTooLong)
      expect((await admin.put(`/api/admin/papers/${id}`, { title: '   ' })).status).toBe(422)
      expect((await admin.put(`/api/admin/papers/${id}`, { durationMin: 0 })).status).toBe(422)
      expect((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.code).toBe('1449/2')
      const blank = await admin.put(`/api/admin/papers/${id}`, { code: '   ' })
      expect(blank.status, JSON.stringify(blank.body)).toBe(200)
      expect(blank.body.data.paper.code).toBe('MAT')
    })

    it('after Terbit the metadata is read-only with the Salin set message, and a student-facing Kod kertas is the one saved at Terbit', async () => {
      const id = await newPaper()
      expect((await admin.put(`/api/admin/papers/${id}`, { code: '1449/2-C' })).status).toBe(200)
      await t.db.query(`update papers set status = 'published' where id = $1`, [id])
      expectError(await admin.put(`/api/admin/papers/${id}`, { code: '1449/2-D' }), 'VALIDATION_ERROR', 422, MSG.paperLocked)
      expect((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.code).toBe('1449/2-C')
    })
  })

  describe('AC-R1-21.3 Kontrak Simulasi block', () => {
    it('shows the Kontrak of the paper; a pair that has none cannot start a paper (the "Tiada kontrak" state is the 422 noBlueprint)', async () => {
      const id = await newPaper()
      const editor = (await admin.get(`/api/admin/papers/${id}`)).body.data
      expect(editor.blueprint).toMatchObject({ code: '1449/2', subject: 'MAT', kertas: 2 })
      expect(editor.blueprint.sections).toHaveLength(3)
      const none = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 9 })
      expectError(none, 'VALIDATION_ERROR', 422, MSG.noBlueprint)
    })
  })

  describe('AC-R1-21.6 the bank picker', () => {
    it(`the editor lists at most ${String(MAX_EDITOR_CANDIDATES)} candidates (the picker limit), in bank order, and never a hidden one`, async () => {
      const id = await newPaper()
      const e = (await admin.get(`/api/admin/papers/${id}`)).body.data
      const ids = (e.questions as { id: string }[]).map((x) => x.id)
      expect(ids).toHaveLength(MAX_EDITOR_CANDIDATES)
      expect(ids).not.toContain('700010') // draft
      expect(ids).not.toContain('700011') // other subject
    })

    it('the section pool search ("Cari soalan...") filters the whole bank by text and pages the result', async () => {
      const id = await newPaper()
      const [a] = ((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
      const hit = await admin.get(`/api/admin/papers/${id}/sections/${a}/pool?q=${encodeURIComponent('Soalan 731050 v1')}`)
      expect(hit.status, JSON.stringify(hit.body)).toBe(200)
      expect(hit.body.meta.totalItems).toBe(1)
      expect(hit.body.data[0].questionIds).toEqual(['731050'])
      const none = await admin.get(`/api/admin/papers/${id}/sections/${a}/pool?q=${encodeURIComponent('tiada padanan sama sekali')}`)
      expect(none.body.data).toEqual([])
      expect(none.body.meta.totalItems).toBe(0)
    })
  })
})
