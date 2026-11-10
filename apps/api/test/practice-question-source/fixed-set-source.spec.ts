import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Be09BijakQuestionSource } from '../../src/modules/bijak/question-bridge'
import { CurriculumRepository } from '../../src/modules/curriculum'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { PICTURE_PLACEHOLDER_LABEL } from '../../src/modules/practice/question-bridge/practice-media'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'
import { filesOf } from '../support/files-stub'

/**
 * KP-15 on the real source: `live(ids, activity, { fixedSet: true })` keeps a flagged or held question in its place with a placeholder stimulus and
 * unchanged marks (the options and key are untouched); without `fixedSet` (an automatic draw) it is dropped. The row and its status never change (KP-14).
 */
let t: QuestionsTestApp
let tag: Tag
let source: Be09PracticeQuestionSource
const made: Record<string, string> = {}
const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

async function publish(key: string): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} tetap` }), admin)
  await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
  await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  made[key] = created.id
  return created.id
}
const hasPlaceholder = (x: { stimuli?: { label: string }[] } | undefined) => x?.stimuli?.some((s) => s.label === PICTURE_PLACEHOLDER_LABEL) === true

beforeAll(async () => {
  t = await bootQuestionsApp()
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  await q(`update questions set is_active = false`)
  await publish('ok')
  await publish('flagged')
  await q(`update question_versions set stimulus_flag = 'stimulus_missing' where question_id = $1`, [made.flagged])
  await publish('held')
  await q(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved"}]'::jsonb where question_id = $1`, [made.held])
  // P-1: the migration holds such a question as is_active = false together with the hold; a fixed set must keep it all the same.
  await q(`update questions set is_active = false where id = $1`, [made.held])
  // P-3: archived in V2 (no live version) and held: the paper still serves its PINNED version.
  await publish('archivedHeld')
  await q(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved"}]'::jsonb, status = 'archived' where question_id = $1`, [made.archivedHeld])
  await q(`update questions set live_version_no = null, is_active = false where id = $1`, [made.archivedHeld])
  source = new Be09PracticeQuestionSource(t.app.get(QuestionsRepository), { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, undefined, filesOf(t.db) as never)
}, 180_000)

afterAll(async () => {
  await t.close()
})

describe('fixed set (mission surface: no drill activity)', () => {
  it('keeps the flagged and held question with a placeholder; the clean one has none', async () => {
    const ids = [made.ok, made.flagged, made.held] as string[]
    const got = await source.live(ids, undefined, { fixedSet: true })
    expect([...got.keys()]).toEqual(ids)
    expect(ids.map((id) => hasPlaceholder(got.get(id)))).toEqual([false, true, true])
    // marks and grading are untouched: the options and the key are the question's own
    expect(got.get(made.held as string)?.correctLabel).toBe(got.get(made.ok as string)?.correctLabel)
    expect(got.get(made.held as string)?.options.length).toBe(got.get(made.ok as string)?.options.length)
  })
  it('an automatic read (no fixedSet) drops them', async () => {
    expect([...(await source.live([made.ok, made.flagged, made.held] as string[])).keys()]).toEqual([made.ok])
  })
})

describe('fixed set (remedial / question set surface: the Bab drill surface)', () => {
  it('keeps the flagged and held question in order with a placeholder; without fixedSet they are dropped', async () => {
    const ids = [made.flagged, made.ok, made.held] as string[]
    const got = await source.live(ids, 'bab', { fixedSet: true })
    expect([...got.keys()]).toEqual(ids)
    expect(ids.map((id) => hasPlaceholder(got.get(id)))).toEqual([true, false, true])
    expect([...(await source.live(ids, 'bab')).keys()]).toEqual([made.ok])
  })
  it('the stored status of the row is unchanged by serving (KP-14)', async () => {
    await source.live([made.held] as string[], 'bab', { fixedSet: true })
    const rows = await t.db.query<{ status: string; live_version_no: number }>(`select v.status, q.live_version_no from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = $1`, [made.held])
    expect(rows[0]).toMatchObject({ status: 'approved', live_version_no: 1 })
  })
})

describe('published paper (Bijak bridge, pinned version): KP-15', () => {
  it('a pinned question whose picture is held is served with a placeholder; a clean one is not; the flag alone changes nothing (decision 56)', async () => {
    const bridge = new Be09BijakQuestionSource(t.app.get(QuestionsRepository), t.app.get(CurriculumRepository), filesOf(t.db) as never)
    const pins = new Map([[made.ok as string, 1], [made.held as string, 1], [made.flagged as string, 1]])
    const got = await bridge.loadQuestions([...pins.keys()], pins)
    expect([...got.keys()].sort()).toEqual([...pins.keys()].sort())
    const text = (id: string) => JSON.stringify(got.get(id))
    expect(text(made.held as string)).toContain('Gambar tiada')
    expect(text(made.ok as string)).not.toContain('Gambar tiada')
    expect(text(made.flagged as string)).not.toContain('Gambar tiada')
  })

  it('P-3: a pinned question with NO live version (archived in V2) and a held picture gets the placeholder, judged at the pinned version', async () => {
    const bridge = new Be09BijakQuestionSource(t.app.get(QuestionsRepository), t.app.get(CurriculumRepository), filesOf(t.db) as never)
    const got = await bridge.loadQuestions([made.archivedHeld as string], new Map([[made.archivedHeld as string, 1]]))
    expect(got.size).toBe(1)
    expect(JSON.stringify(got.get(made.archivedHeld as string))).toContain('Gambar tiada')
  })
})
