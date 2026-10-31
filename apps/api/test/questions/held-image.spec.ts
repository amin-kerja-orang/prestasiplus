import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * R1-T45b / PIPE AC-16.3: a loaded legacy question that is held inactive only because its image was not copied (import issue
 * `legacy_image_unresolved`) becomes active again when the admin uploads the image in the edit form and publishes that version. A question
 * held for any other reason, or whose image is still missing, stays inactive. The path is the real one: upload, PUT edit, review, approve.
 */
describe('a question held for a missing image is served again once its image is uploaded (AC-16.3)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-held-image-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const upload = async (): Promise<string> => {
    const res = await admin.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body.data as { id: string }).id
  }
  /** A legacy-shaped held question: approved, live, inactive, with the loader's import issues on its version. */
  async function held(issues: unknown[]): Promise<string> {
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query(`update question_versions set import_issues = $2::jsonb where question_id = $1`, [id, JSON.stringify(issues)])
    await t.db.query(`update questions set is_active = false where id = $1`, [id])
    return id
  }
  const stemIssue = { code: 'legacy_image_unresolved', target: 'question', path: 'soalan/rajah.png' }
  const optionIssue = (label: string) => ({ code: 'legacy_image_unresolved', target: 'option', label, path: `pilihan/${label}.png` })
  const state = async (id: string) =>
    (await t.db.query<{ is_active: boolean; live: number | null; latest: number }>(`select is_active, live_version_no live, latest_version_no latest from questions where id = $1`, [id]))[0]!
  async function publishEdit(id: string, over: Record<string, unknown>): Promise<void> {
    const put = await admin.put(`/api/questions/${id}`, mcqBody(refs, over))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids: [id] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.failed, `${action} ${JSON.stringify(res.body)}`).toEqual([])
    }
  }

  it('the held question is inactive and not served; an edit alone (a draft) does not serve it', async () => {
    const id = await held([stemIssue])
    expect(await state(id)).toMatchObject({ is_active: false, live: 1 })
    const put = await admin.put(`/api/questions/${id}`, mcqBody(refs, { questionImageFileId: await upload() }))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await state(id)).toMatchObject({ is_active: false, live: 1, latest: 2 })
  })

  it('uploading the question image and publishing the edit makes it active and live on the new version', async () => {
    const id = await held([stemIssue])
    await publishEdit(id, { questionImageFileId: await upload() })
    expect(await state(id)).toMatchObject({ is_active: true, live: 2 })
  })

  it('an option image hold needs every missing option image; the right ones make it active', async () => {
    const id = await held([optionIssue('A'), optionIssue('C')])
    await publishEdit(id, { optionImageFileIds: [await upload(), null, null, null] })
    expect(await state(id)).toMatchObject({ is_active: false }) // C is still missing
    const fixed = await held([optionIssue('A'), optionIssue('C')])
    await publishEdit(fixed, { optionImageFileIds: [await upload(), null, await upload(), null] })
    expect(await state(fixed)).toMatchObject({ is_active: true, live: 2 })
  })

  it('an edit that does not supply the image leaves it held', async () => {
    const id = await held([stemIssue])
    await publishEdit(id, { questionText: 'Soalan yang disunting tanpa gambar?' })
    expect(await state(id)).toMatchObject({ is_active: false, live: 2 })
  })

  it('a question held for another reason as well (markup, personal data) stays inactive even with the image', async () => {
    const id = await held([stemIssue, { code: 'html_math', target: 'stem' }])
    await publishEdit(id, { questionImageFileId: await upload() })
    expect(await state(id)).toMatchObject({ is_active: false })
  })

  it('a question an admin switched off (no import issue) is not switched on by an approval', async () => {
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag }))
    const id = res.body.data.id as string
    await t.db.query(`update questions set is_active = false where id = $1`, [id])
    await publishEdit(id, { questionImageFileId: await upload() })
    expect(await state(id)).toMatchObject({ is_active: false })
  })
})
