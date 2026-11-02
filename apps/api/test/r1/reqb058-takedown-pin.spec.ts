import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ACCOUNTS } from '../exam-builder/helpers'
import { makePng } from '../files/fixtures'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * REQ-B-058 (content safety): a published paper serves the version its placement PINNED (REQ-B-032). The pinned read has no status filter,
 * so a pinned version that was taken down (archived "withdrawn" or "source_takedown") kept being served to NEW sittings once a later
 * version was approved. A new sitting and the Kuiz paper are now refused (403, the "paper being updated" line) when a pin is taken down;
 * a `superseded` pin is still served; a RUNNING sitting keeps its pinned version, as before.
 */
const REFUSED = 'Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.'

describe('REQ-B-058 a taken-down pinned version is not served to new sittings', () => {
  let t: FullApp
  let admin: FullClient
  let pupil: FullClient
  /** A pupil with no sitting on the paper: the list hides an unavailable paper from this pupil (a pupil with a sitting keeps the card). */
  let fresh: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let target = ''
  /** The stem picture of version 1 of `target` (only version 1 carries it), by its public token. */
  let v1Image = ''
  let paper = ''
  let running = ''
  const V1 = 'Versi satu: berapakah 2 + 3?'
  const V2 = 'Versi dua: berapakah 7 + 8?'
  let counter = 0

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function upload(): Promise<string> {
    const res = await admin.upload('/api/files?purpose=question_image', makePng({ width: 4 + counter++, height: 4 }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const body = (text: string, imageId: string, correct: number, extra: Record<string, unknown> = {}) => ({
    subjectId: subject,
    educationLevelId: level,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: text,
    options: ['3', '4', '5', '6'],
    correctAnswer: correct,
    explanation: 'Penjelasan ujian.',
    cognitiveLevel: 'mengaplikasi',
    kertas: '2',
    tag,
    questionImageFileId: imageId,
    ...extra,
  })
  async function advance(ids: string[]): Promise<void> {
    // H-A18: the submit gate needs a Bab; the fixtures (and the new version 2) carry the first chapter of the subject and level
    await q(
      `update question_versions set chapter_id = (select id from chapters where subject_id = $2::bigint and education_level_id = $3::bigint order by id limit 1) where question_id = any($1::bigint[]) and chapter_id is null`,
      [ids, subject, level],
    )
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data, `${action}: ${JSON.stringify(res.body.data)}`).toMatchObject({ affected: ids.length, failed: [] })
    }
  }
  const setReason = (versionNo: number, reason: string) =>
    q(`update question_versions set archive_reason = '${reason}' where question_id = ${target} and version_no = ${String(versionNo)}`)
  /** A NEW sitting (`restart: true`: an open sitting would otherwise just be resumed). */
  const newSitting = () => pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam', restart: true })
  const stemOf = async (attemptId: string): Promise<string> => {
    const res = await pupil.get(`/api/bijak/attempts/${attemptId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const json = JSON.stringify(res.body)
    return json.includes(V1) ? V1 : json.includes(V2) ? V2 : ''
  }
  const kuiz = () => pupil.get(`/api/bijak/kuiz/papers/${paper}`)
  const listed = async (c: FullClient): Promise<boolean> => {
    const res = await c.get('/api/bijak/papers')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body.data as { id: string }[]).some((p) => p.id === paper)
  }
  const kuizCheck = () => pupil.post(`/api/bijak/kuiz/papers/${paper}/check`, { itemId: target, optionId: 'B' })

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    pupil = await loginFull(t, ACCOUNTS.student)
    fresh = await loginFull(t, 'pelajar2@demo.test')
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }

    v1Image = await upload()
    const first = await admin.post('/api/questions', body(V1, v1Image, 1))
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    target = first.body.data.id as string
    const rest: string[] = []
    for (const [i, extra] of [{}, {}, {}, { pointsValue: 2 }, { pointsValue: 2 }].entries()) {
      const r = await admin.post('/api/questions', body(`Soalan lain ${String(i)}: berapakah ${String(i)} + 1?`, await upload(), 1, extra))
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      rest.push(r.body.data.id as string)
    }
    const ids = [target, ...rest]
    await advance(ids)
    for (const [i, id] of ids.entries()) expect((await admin.put(`/api/admin/section-pools/${id}`, { pools: [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'] })).status).toBe(200)
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    paper = created.body.data.id as string
    const sections = ((await admin.get(`/api/admin/papers/${paper}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) {
      const placed = await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[at[i]!], questionId: id })
      expect(placed.status, JSON.stringify(placed.body)).toBe(201)
    }
    const published = await admin.post(`/api/admin/papers/${paper}/publish`)
    expect(published.body.data, JSON.stringify(published.body)).toMatchObject({ ok: true, errors: [] })
  })
  afterAll(async () => {
    await t.close()
  })

  it('baseline: version 1 is live and pinned; a sitting starts and Kuiz serves the paper', async () => {
    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    running = start.body.data.attemptId as string
    expect(await stemOf(running)).toBe(V1)
    expect((await kuiz()).status).toBe(200)
  })

  it('(c) a later version is approved and version 1 is superseded: the pin is still served (new sitting starts on version 1, Kuiz serves it)', async () => {
    const edit = await admin.put(`/api/questions/${target}`, body(V2, await upload(), 2))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    await advance([target])
    const rows = await q(`select version_no n, status, archive_reason from question_versions where question_id = ${target} order by version_no`)
    expect(rows.map((r) => [r.n, r.status, r.archive_reason])).toEqual([[1, 'archived', 'superseded'], [2, 'approved', null]])
    expect((await q(`select live_version_no n from questions where id = ${target}`))[0]?.n).toBe(2)
    expect((await q(`select pinned_version_no v from paper_placements where question_id = ${target} and paper_section_id in (select id from paper_sections where paper_id = ${paper})`))[0]?.v).toBe(1)

    const res = await newSitting()
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(await stemOf(res.body.data.attemptId as string)).toBe(V1)
    // that restart abandoned the baseline sitting; start a fresh one that stays open to the end (it is the sitting of (d))
    running = res.body.data.attemptId as string
    const page = await kuiz()
    expect(page.status, JSON.stringify(page.body)).toBe(200)
    expect(JSON.stringify(page.body)).toContain(V1)
    expect((await kuizCheck()).status).toBe(200)
    expect(await listed(fresh), 'a superseded pin is listed').toBe(true)
  })

  /*
   * The pin is then taken down. The end state of "withdraw the live version while a newer draft sits on top, then approve the draft" is
   * version 1 archived "withdrawn" with version 2 live (the question-report "Arkib" path); a source takedown leaves "source_takedown". An
   * archived question cannot be edited back into review through the API, so the reason is set directly on the pinned version row.
   */
  it('version 1 is withdrawn after a later version went live: it stays pinned, archived "withdrawn"', async () => {
    await setReason(1, 'withdrawn')
    const rows = await q(`select version_no n, status, archive_reason from question_versions where question_id = ${target} order by version_no`)
    expect(rows.map((r) => [r.n, r.status, r.archive_reason])).toEqual([[1, 'archived', 'withdrawn'], [2, 'approved', null]])
  })

  it('(a) a withdrawn pin is refused to a new sitting with 403 and the "being updated" line', async () => {
    const res = await newSitting()
    expect(res.status, JSON.stringify(res.body)).toBe(403)
    expect(res.body.error.message).toBe(REFUSED)
  })

  it('(e) Kuiz refuses the same paper (page and check) with the same line', async () => {
    for (const res of [await kuiz(), await kuizCheck()]) {
      expect(res.status, JSON.stringify(res.body)).toBe(403)
      expect(res.body.error.message).toBe(REFUSED)
    }
  })

  it('the paper list does not offer the taken-down paper to a pupil with no sitting on it; a pupil with a sitting keeps the card', async () => {
    expect(await listed(fresh)).toBe(false)
    expect(await listed(pupil)).toBe(true)
  })

  it('(d) the sitting started before the takedown keeps serving version 1, and "Mula" without restart resumes it', async () => {
    expect(await stemOf(running)).toBe(V1)
    const again = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(again.body.data.attemptId).toBe(running)
  })

  it('(b) the same with archive reason source_takedown', async () => {
    await setReason(1, 'source_takedown')
    const res = await newSitting()
    expect(res.status, JSON.stringify(res.body)).toBe(403)
    expect(res.body.error.message).toBe(REFUSED)
    for (const k of [await kuiz(), await kuizCheck()]) {
      expect(k.status, JSON.stringify(k.body)).toBe(403)
      expect(k.body.error.message).toBe(REFUSED)
    }
    expect(await stemOf(running)).toBe(V1) // the running sitting is untouched
    expect(await listed(fresh)).toBe(false)
  })

  it('a pin with no archive reason recorded is refused too (not a supersede)', async () => {
    await q(`update question_versions set archive_reason = null where question_id = ${target} and version_no = 1`)
    expect((await newSitting()).status).toBe(403)
    expect((await kuiz()).status).toBe(403)
    expect(await listed(fresh)).toBe(false)
  })

  /*
   * REQ-B-074 (B3 Lows on REQ-B-058). L1: the picture of a taken-down pinned version stays readable by a token holder (rule B had no archive-reason check).
   * L2: a takedown archives only the latest and the live version of each question, so an older `superseded` version from the same source stayed servable
   * once a newer version was approved; the source paper's `takedown_at` is the authority and is checked with the pin.
   */
  const setReasonSql = (reason: string | null) => q(`update question_versions set archive_reason = ${reason === null ? 'null' : `'${reason}'`} where question_id = ${target} and version_no = 1`)
  /** `fresh` has no sitting on the paper; `pupil` has (REQ-B-074: any sitting on the paper keeps the picture of its pinned version). */
  const readImage = (who: FullClient = fresh) => who.get(`/api/files/${v1Image}`)

  it('L1: the picture of the pinned version is readable only while the pin is superseded (withdrawn, source_takedown or no reason: 404)', async () => {
    for (const [reason, readable] of [['superseded', true], ['withdrawn', false], ['source_takedown', false], [null, false], ['superseded', true]] as const) {
      await setReasonSql(reason)
      const res = await readImage()
      expect(res.status, `archive_reason ${String(reason)}: ${JSON.stringify(res.body).slice(0, 120)}`).toBe(readable ? 200 : 404)
      // the pupil whose sitting is running keeps the picture of the version it was started on
      expect((await readImage(pupil)).status, `sitting, ${String(reason)}`).toBe(200)
    }
  })

  it('L2: a SUPERSEDED version 1 whose source paper is taken down is refused to new sittings, Kuiz and the list, and its picture is 404; lifting the takedown_at restores it', async () => {
    await setReasonSql('superseded')
    const [sp] = await q(`insert into source_papers (rights_status) values ('own') returning id::text id`)
    await q(`update question_versions set source_paper_id = ${String(sp!.id)} where question_id = ${target} and version_no = 1`)
    // control: the source is not taken down
    expect((await newSitting()).status).toBe(201)
    expect((await kuiz()).status).toBe(200)
    expect(await listed(fresh)).toBe(true)
    expect((await readImage()).status).toBe(200)
    // the source paper is taken down: version 1 stays `superseded`, as the real takedown leaves it
    await q(`update source_papers set takedown_at = now() where id = ${String(sp!.id)}`)
    const res = await newSitting()
    expect(res.status, JSON.stringify(res.body)).toBe(403)
    expect(res.body.error.message).toBe(REFUSED)
    for (const k of [await kuiz(), await kuizCheck()]) {
      expect(k.status, JSON.stringify(k.body)).toBe(403)
      expect(k.body.error.message).toBe(REFUSED)
    }
    expect(await listed(fresh)).toBe(false)
    expect((await readImage()).status).toBe(404)
    expect((await readImage(pupil)).status, 'a sitting on the paper keeps the picture').toBe(200)
    expect((await q(`select status, archive_reason from question_versions where question_id = ${target} and version_no = 1`))[0]).toMatchObject({ status: 'archived', archive_reason: 'superseded' })
    // lifting it (not a product feature; shows the check reads the source row) restores the pin
    await q(`update source_papers set takedown_at = null where id = ${String(sp!.id)}`)
    expect((await newSitting()).status).toBe(201)
    expect((await readImage()).status).toBe(200)
  })
})
