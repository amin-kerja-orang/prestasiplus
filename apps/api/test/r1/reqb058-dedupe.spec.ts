import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { pinServableForNewSitting, QuestionsRepository } from '../../src/modules/questions'
import { ACCOUNTS } from '../exam-builder/helpers'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * REQ-B-058, optional Minor 3 (A1b pre-review): ONE question, ONE pinned version, placed in TWO sections of one paper. The builder cannot publish
 * such a paper (DUPLICATE_QUESTION is a hard Terbit blocker), so only an old or hand-made paper has it; it must still be handled safely. The pins of
 * the paper then hold the same (question, version) twice: `getVersions` reads each distinct pin ONCE (its `wanted` map), so the takedown rule is
 * applied once per version (not once per placement) and nothing is duplicated or fails on a duplicate key.
 *
 * MUTATIONS (what was changed, and which test went red; restored afterwards):
 *  (re-run on BASE c3098c9a, throwaway merge, after the Bab step: both mutations still red as listed)
 *  1. questions.repository.ts `getVersions`: the `wanted` map replaced by a plain list (no dedupe)  -> "getVersions reads a repeated pin once ..." and "(a) takedown applies once ..."
 *  2. kuiz.service.ts `visiblePaper`: the REQ-B-058 `.some(...)` check removed                         -> "(a) takedown applies once ..." (Kuiz page, check) and "a pin with no archive reason, placed twice, is a takedown too ..."
 */
const REFUSED = 'Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.'

describe('REQ-B-058: one question placed in two sections of one paper (the getVersions dedupe)', () => {
  let t: FullApp
  let admin: FullClient
  let pupil: FullClient
  let fresh: FullClient
  let target = ''
  let other = ''
  let paper = ''
  let subject = ''
  let level = ''
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)
  const body = (text: string, correct: number) => ({
    subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'mcq', questionText: text, options: ['3', '4', '5', '6'], correctAnswer: correct,
    explanation: 'Penjelasan ujian.', cognitiveLevel: 'mengaplikasi', kertas: '2', tag,
  })
  async function advance(ids: string[]): Promise<void> {
    // H-A18: the submit gate needs a Bab; the fixtures (and the new version 2) carry the first chapter of the subject and level (same inline step as reqb058-takedown-pin.spec.ts)
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
  /** The pins of the paper, as the services build them: one entry per PLACEMENT (the same pin twice here). */
  const pinsOfPaper = async () =>
    (await q(`select pl.question_id::text qid, pl.pinned_version_no::int v from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = ${paper} order by s.position, pl.position`)).map((r) => ({ questionId: String(r.qid), versionNo: Number(r.v) }))
  const newSitting = () => pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam', restart: true })
  const kuizPage = (n: number) => pupil.get(`/api/bijak/kuiz/papers/${paper}?page=${String(n)}`)
  const kuizCheck = () => pupil.post(`/api/bijak/kuiz/papers/${paper}/check`, { itemId: target, optionId: 'B' })
  const listed = async (c: FullClient): Promise<boolean> => {
    const res = await c.get('/api/bijak/papers')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body.data as { id: string }[]).some((p) => p.id === paper)
  }
  const setReason = (reason: string) => q(`update question_versions set archive_reason = '${reason}' where question_id = ${target} and version_no = 1`)

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
    const a = await admin.post('/api/questions', body('Versi satu: berapakah 2 + 3?', 1))
    const b = await admin.post('/api/questions', body('Soalan lain: berapakah 4 + 3?', 1))
    expect(a.status, JSON.stringify(a.body)).toBe(201)
    expect(b.status, JSON.stringify(b.body)).toBe(201)
    target = a.body.data.id as string
    other = b.body.data.id as string
    await advance([target, other])
    // the paper is written directly: the builder refuses it at Terbit (DUPLICATE_QUESTION). Bahagian A = target + other, Bahagian B = target again, both pinned to version 1.
    const subj = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
    const made = await t.db.prisma.paper.create({
      data: {
        kind: 'pilihan', title: 'Kertas soalan berulang', subjectId: subj.id, kertas: 2, paperCode: '1449/2', printedDurationMin: 60, status: 'published', publishedAt: new Date(),
        sections: {
          create: [
            { position: 1, label: 'Bahagian A', questionCount: 2, markBudget: 0, placements: { create: [{ questionId: BigInt(target), position: 1, pinnedVersionNo: 1 }, { questionId: BigInt(other), position: 2, pinnedVersionNo: 1 }] } },
            { position: 2, label: 'Bahagian B', questionCount: 1, markBudget: 0, placements: { create: [{ questionId: BigInt(target), position: 1, pinnedVersionNo: 1 }] } },
          ],
        },
      },
    })
    paper = made.id.toString()
  })
  afterAll(async () => {
    await t.close()
  })

  it('getVersions reads a repeated pin once: three placements, two distinct (question, version) pins, two records, no duplicate key', async () => {
    const pins = await pinsOfPaper()
    expect(pins).toHaveLength(3)
    expect(pins.filter((p) => p.questionId === target)).toHaveLength(2)
    const records = await t.app.get(QuestionsRepository).getVersions(pins)
    const keys = records.map((r) => `${r.id}@${String(r.version.versionNo)}`)
    expect(keys).toEqual([`${target}@1`, `${other}@1`])
    expect(new Set(keys).size).toBe(keys.length)
    // asking for the same pin many times changes nothing
    const many = await t.app.get(QuestionsRepository).getVersions(Array.from({ length: 5 }, () => ({ questionId: target, versionNo: 1 })))
    expect(many.map((r) => r.id)).toEqual([target])
  })

  it('baseline: both placements are served (a new sitting starts, Kuiz pages 1 and 2 show the question, the paper is listed)', async () => {
    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const p1 = await kuizPage(1)
    const p2 = await kuizPage(2)
    expect(p1.status, JSON.stringify(p1.body)).toBe(200)
    expect(p2.status, JSON.stringify(p2.body)).toBe(200)
    expect((p1.body.data.items as { id: string }[]).map((i) => i.id)).toEqual([target, other])
    expect((p2.body.data.items as { id: string }[]).map((i) => i.id)).toEqual([target])
    expect(p1.body.data.markableTotal).toBe(3) // one per PLACEMENT: the repeated question is counted at each place
    expect(await listed(fresh)).toBe(true)
  })

  it('a superseded pin placed twice is still served: no false takedown', async () => {
    const edit = await admin.put(`/api/questions/${target}`, body('Versi dua: berapakah 7 + 8?', 2))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    await advance([target])
    expect((await q(`select version_no n, status, archive_reason from question_versions where question_id = ${target} order by version_no`)).map((r) => [r.n, r.status, r.archive_reason])).toEqual([[1, 'archived', 'superseded'], [2, 'approved', null]])
    expect((await newSitting()).status).toBe(201)
    expect((await kuizPage(1)).status).toBe(200)
    expect((await kuizPage(2)).status).toBe(200)
    expect(await listed(fresh)).toBe(true)
  })

  it('(a) takedown applies once: the pinned version (placed twice) is taken down; one version is reported taken down, and the new sitting, Kuiz (both pages, check) and the list refuse the paper cleanly', async () => {
    await setReason('source_takedown')
    const records = await t.app.get(QuestionsRepository).getVersions(await pinsOfPaper())
    expect(records.filter((r) => !pinServableForNewSitting(r.version)).map((r) => `${r.id}@${String(r.version.versionNo)}`)).toEqual([`${target}@1`]) // once, not twice
    const sitting = await newSitting()
    expect(sitting.status, JSON.stringify(sitting.body)).toBe(403)
    expect(sitting.body.error.message).toBe(REFUSED)
    for (const res of [await kuizPage(1), await kuizPage(2), await kuizCheck()]) {
      expect(res.status, JSON.stringify(res.body)).toBe(403)
      expect(res.body.error.message).toBe(REFUSED)
    }
    expect(await listed(fresh)).toBe(false)
  })

  it('a pin with no archive reason, placed twice, is a takedown too; restoring "superseded" serves both placements again', async () => {
    await q(`update question_versions set archive_reason = null where question_id = ${target} and version_no = 1`)
    expect((await newSitting()).status).toBe(403)
    expect((await kuizPage(2)).status).toBe(403)
    await setReason('superseded')
    expect((await newSitting()).status).toBe(201)
    expect((await kuizPage(2)).status).toBe(200)
  })
})
