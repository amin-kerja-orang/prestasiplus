import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * AC-R1-11.4 (backend side): "the legacy questions that qualified before still appear; image-bearing items stay excluded until their image is
 * uploaded". The production count (406,396 legacy questions before and after) is UAT evidence and stays with ops. What a spec can pin is that the
 * three read-only SELECTs of `docs/ops/r1-runbook.md` section 3.6b (the text below is copied from it, `r1/ac-gaps-a1b`) mean what the runbook says:
 * the identity holds, a held-image question is counted by (2) and never by (3), and a question that was served before is still served after a
 * held one is added or edited. If the runbook SQL or the hold rule drifts, this spec goes red.
 */
const IDENTITY = `
SELECT (SELECT count(*) FROM questions WHERE live_version_no IS NOT NULL) AS live_questions,
       (SELECT count(*) FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved' WHERE q.is_active) AS servable,
       (SELECT count(*) FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved' WHERE NOT q.is_active) AS live_approved_inactive,
       (SELECT count(*) FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status <> 'approved') AS live_not_approved`
const HELD_IMAGE = `
SELECT count(*) AS held_image_inactive
  FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE NOT q.is_active AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb`
const HELD_IMAGE_SERVED = `
SELECT count(*) AS held_image_but_served
  FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
 WHERE q.is_active AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb`

describe('R1-11.4: the runbook no-regression SELECTs (3.6b) on a seeded bank', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>
  let storageDir = ''
  const saved = { FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR, THROTTLE_QUESTIONS_WRITE_PER_MINUTE: process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'pp-legacy-select-'))
    process.env.FILE_STORAGE_DIR = storageDir
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
    await rm(storageDir, { recursive: true, force: true })
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  const num = async (sql: string): Promise<Record<string, number>> =>
    Object.fromEntries(Object.entries((await t.db.query<Record<string, string>>(sql))[0]!).map(([k, v]) => [k, Number(v)]))
  const read = async () => ({ id: await num(IDENTITY), held: (await num(HELD_IMAGE)).held_image_inactive!, heldServed: (await num(HELD_IMAGE_SERVED)).held_image_but_served! })

  /** A legacy-shaped held question: approved, live, inactive, with the loader's `legacy_image_unresolved` import issue on its version. */
  async function held(): Promise<string> {
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query(`update question_versions set import_issues = $2::jsonb where question_id = $1`, [id, JSON.stringify([{ code: 'legacy_image_unresolved', target: 'question', path: 'soalan/rajah.png' }])])
    await t.db.query(`update questions set is_active = false where id = $1`, [id])
    return id
  }

  it('on the seeded bank the identity holds (live = servable + live_approved_inactive + live_not_approved) and nothing is held', async () => {
    const r = await read()
    expect(r.id.servable).toBeGreaterThan(0)
    expect(r.id.live_questions).toBe(r.id.servable! + r.id.live_approved_inactive! + r.id.live_not_approved!)
    expect(r.held).toBe(0)
    expect(r.heldServed).toBe(0)
  })

  it('a held-image legacy question is live but inactive: (2) counts it, (3) never does, the identity still holds and servable does not drop', async () => {
    const before = await read()
    await held()
    const after = await read()
    expect(after.id.live_questions).toBe(before.id.live_questions! + 1)
    expect(after.id.live_approved_inactive).toBe(before.id.live_approved_inactive! + 1)
    expect(after.id.servable).toBe(before.id.servable) // nothing that was served before dropped out, and the held one is not served
    expect(after.id.live_questions).toBe(after.id.servable! + after.id.live_approved_inactive! + after.id.live_not_approved!)
    expect(after.held).toBe(before.held + 1)
    expect(after.heldServed).toBe(0)
  })

  // (2) reads the import issues of the LIVE version, so an edit published without the image moves the question out of (2); it stays inactive, and
  // (3) stays 0: that is the exclusion the AC asks for. (The runbook's "expected = the loader report" is a before-any-edit figure.)
  // With the H-A18 media gate the approval of an edit that still lacks the image is REFUSED (the old version stays live); without it the approval goes
  // through. Either way the question stays inactive and unserved, which is what this test pins.
  it('an admin edit that does not bring the missing image leaves the question inactive and unserved: (3) stays 0, servable is unchanged', async () => {
    const id = await held()
    const before = await read()
    const put = await admin.put(`/api/questions/${id}`, mcqBody(refs, { questionText: 'Soalan yang disunting tanpa gambar?' }))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids: [id] })
      expect(res.status, JSON.stringify(res.body)).toBe(200) // a refused row is in failed[], not an HTTP error
    }
    const after = await read()
    expect(after.heldServed).toBe(0)
    expect(after.id.servable).toBe(before.id.servable)
    const [row] = await t.db.query<{ is_active: boolean; live: number }>(`select is_active, live_version_no live from questions where id = $1`, [id])
    expect(row!.is_active).toBe(false)
    expect([1, 2]).toContain(row!.live) // 2 when the approval went through, 1 when the media gate refused it
    expect(after.id.live_questions).toBe(after.id.servable! + after.id.live_approved_inactive! + after.id.live_not_approved!)
  })
})
