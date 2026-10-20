import { MasterNoteActionResultSchema, MasterNoteListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CANNED_NOTES, nextCannedIndex } from '../../src/modules/questions/workflow/master-notes/canned-notes'
import { bootWorkflowApp, expectCsrfInvalid, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

type Roles = Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>

describe('master notes (BE-10, BR-M04-23)', () => {
  let t: WorkflowTestApp
  let c: Roles
  const ids: string[] = []

  const insert = async (questionId: string, flagged: boolean, approved: boolean, chapter: string | null = 'Bab 1'): Promise<string> => {
    const [row] = await t.db.query<{ id: string }>(
      `insert into master_notes (question_id, chapter_label, model, tokens, confidence, note_text, trap_text, flagged, teacher_approved)
       values ($1::bigint, $2, 'model-demo', 500, 0.9, 'Nota asal ' || $1, 'Perangkap asal', $3, $4) returning id::text`,
      [questionId, chapter, flagged, approved],
    )
    ids.push(row!.id)
    return row!.id
  }
  const get = async (query = '') => {
    const res = await c.admin.get(`/api/master-notes${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return MasterNoteListResponseSchema.parse(res.body)
  }
  const row = async (id: string) => (await t.db.query<{ flagged: boolean; teacher_approved: boolean; note_text: string; trap_text: string; tokens: number }>('select flagged, teacher_approved, note_text, trap_text, tokens from master_notes where id = $1::bigint', [id]))[0]!

  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    t.fake.seed({ id: '501', brief: { stemText: 'Apakah ibu negara Malaysia?', subjectName: 'Sejarah', chapterName: 'Bab Negara' } })
    await insert('501', true, false) // flagged
    await insert('501', true, false, null) // flagged, no chapter label
    await insert('501', false, true) // approved
    await insert('999', false, false) // neither, unknown question
    for (let i = 0; i < 14; i += 1) await insert('501', true, false)
  })
  afterAll(async () => {
    await t.close()
  })

  it('401 without a session, 403 for teacher, school admin and student', async () => {
    expectError(await t.http().get('/api/master-notes'), 'UNAUTHORIZED')
    expectError(await t.http().post('/api/master-notes/1/approve'), 'UNAUTHORIZED')
    for (const who of [c.teacher, c.schoolAdmin, c.student]) {
      expectError(await who.get('/api/master-notes'), 'FORBIDDEN')
      expectError(await who.post(`/api/master-notes/${ids[0]}/approve`), 'FORBIDDEN')
    }
  })

  it('an action without CSRF is 403 CSRF_INVALID', async () => {
    expectCsrfInvalid(await c.admin.noCsrf.post(`/api/master-notes/${ids[0]}/approve`))
  })

  it('the default tab is flagged, 15 per page, id descending, with the summary', async () => {
    const r = await get()
    expect(r.meta).toMatchObject({ activeTab: 'flagged', page: 1, pageSize: 15, totalItems: 16, totalPages: 2, summary: { flagged: 16, teacherApproved: 1, total: 18 } })
    expect(r.data).toHaveLength(15)
    expect(Number(r.data[0]!.id)).toBeGreaterThan(Number(r.data[1]!.id))
    expect(r.data[0]).toMatchObject({ questionId: '501', subjectName: 'Sejarah', questionText: 'Apakah ibu negara Malaysia?', model: 'model-demo', tokens: 500, flagged: true, teacherApproved: false })
    expect((await get('?page=2')).data).toHaveLength(1)
  })

  it('tabs: approved and all; an unknown tab falls back to flagged', async () => {
    const a = await get('?tab=approved')
    expect(a.meta.activeTab).toBe('approved')
    expect(a.data).toHaveLength(1)
    expect((await get('?tab=all')).meta.totalItems).toBe(18)
    expect((await get('?tab=zzz')).meta).toMatchObject({ activeTab: 'flagged', totalItems: 16 })
  })

  it('a note whose question is unknown shows "—" and empty text; a missing chapter falls back to the question chapter or null', async () => {
    const all = [...(await get('?tab=all')).data, ...(await get('?tab=all&page=2')).data]
    const unknown = all.find((n) => n.questionId === '999')
    expect(unknown).toMatchObject({ subjectName: '—', questionText: '', chapter: 'Bab 1' })
    const noLabel = all.find((n) => n.id === ids[1])
    expect(noLabel!.chapter).toBe('Bab Negara')
  })

  it('approve sets teacherApproved and clears the flag', async () => {
    const id = ids[0]!
    const res = await c.admin.post(`/api/master-notes/${id}/approve`)
    expect(res.status).toBe(200)
    expect(MasterNoteActionResultSchema.parse(res.body)).toEqual({ ok: true })
    expect(await row(id)).toMatchObject({ flagged: false, teacher_approved: true })
  })

  it('unflag clears only the flag', async () => {
    const id = ids[1]!
    expect((await c.admin.post(`/api/master-notes/${id}/unflag`)).status).toBe(200)
    expect(await row(id)).toMatchObject({ flagged: false, teacher_approved: false })
  })

  it('regen cycles the three canned notes, keeps the flags and never calls the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network must not be used'))
    try {
      const id = ids[4]! // flagged
      for (const expected of [0, 1, 2, 0]) {
        expect((await c.admin.post(`/api/master-notes/${id}/regen`)).status).toBe(200)
        const r = await row(id)
        expect(r).toMatchObject({ note_text: CANNED_NOTES[expected]!.noteText, trap_text: CANNED_NOTES[expected]!.trapText, tokens: CANNED_NOTES[expected]!.tokens, flagged: true, teacher_approved: false })
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('an unknown note is 404, an unknown action is 404', async () => {
    expectError(await c.admin.post('/api/master-notes/987654/approve'), 'NOT_FOUND')
    expectError(await c.admin.post('/api/master-notes/abc/approve'), 'NOT_FOUND')
    expectError(await c.admin.post(`/api/master-notes/${ids[0]}/delete`), 'NOT_FOUND')
  })

  it('nextCannedIndex starts at 0 for an original note and wraps after the last', () => {
    expect(nextCannedIndex('Nota asal')).toBe(0)
    expect(nextCannedIndex(CANNED_NOTES[2]!.noteText)).toBe(0)
    expect(nextCannedIndex(CANNED_NOTES[0]!.noteText)).toBe(1)
  })
})
