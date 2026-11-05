import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { groupOf, wireStimulus } from '../../src/modules/practice/practice.service'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'
import { PracticeQuizQuestionSchema } from '@pp/contract'

/**
 * S5-T03 part B (D105, FR-MUR-QP-6/7): the drill serves figure questions WITH their figure and stimulus groups WHOLE, with the shipped
 * surface list (`GROUP_SURFACES`). 200 draws: no figure question without its figure, no group split.
 */
let t: QuestionsTestApp
let tag: Tag
let source: Be09PracticeQuestionSource
let chapterId: string
const made: Record<string, string> = {}
let seq = 0
const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

async function fileRow(): Promise<string> {
  seq += 1
  const [row] = await q(
    `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
     values ($1, null, 'question_image', 'image/png', 10, $2, $3) returning id::text id`,
    [`fg${String(seq)}`.padEnd(22, 'B'), 'd'.repeat(64), `fg-key-${String(seq)}`],
  )
  return row?.id as string
}

async function publish(key: string, over: Record<string, unknown> = {}, approve = true): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} rajah dan kumpulan`, ...over }), admin)
  if (approve) {
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  }
  await q(`update question_versions set chapter_id = $2 where question_id = $1`, [created.id, chapterId])
  made[key] = created.id
  return created.id
}

const imageStimulus = async (label: string): Promise<string> =>
  (await q(`insert into stimuli (kind, label, alt_text, asset_file_id) values ('image', $2, 'Rajah', $1) returning id::text id`, [await fileRow(), label]))[0]?.id as string

beforeAll(async () => {
  t = await bootQuestionsApp()
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  await q(`update questions set is_active = false`)
  chapterId = (await q(`select id::text id from chapters where subject_id = $1 order by id limit 1`, [tag.subjectId]))[0]?.id as string
  const files = {
    publicIdsOf: async (ids: readonly string[]) => {
      const rows = ids.length === 0 ? [] : await t.db.query<{ id: string; public_id: string }>(`select id::text id, public_id from files where id = any($1::bigint[])`, [ids])
      return new Map(rows.map((r) => [r.id, r.public_id]))
    },
  }
  // The shipped surface list: no override.
  source = new Be09PracticeQuestionSource(t.app.get(QuestionsRepository), { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, undefined, files)

  for (let i = 1; i <= 5; i++) await publish(`single${String(i)}`)
  // A figure question: its figure is linked to its version.
  await publish('figure')
  await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1`, [made.figure, await imageStimulus('Rajah 1')])
  // A whole group of 3 sharing a figure, and an incomplete group (one member a draft).
  const svc = t.app.get(QuestionsService)
  const good = await svc.createStimulusGroup({ label: 'Rajah 2', scope: 'section', stimulusIds: [await imageStimulus('Rajah 2')], optionBank: [] })
  for (const k of ['g1', 'g2', 'g3']) await publish(k, { stimulusGroupId: good })
  const bad = await svc.createStimulusGroup({ label: 'Rajah 3', scope: 'section', stimulusIds: [await imageStimulus('Rajah 3')], optionBank: [] })
  await publish('b1', { stimulusGroupId: bad })
  await publish('b2', { stimulusGroupId: bad }, false)
  // A figure with no picture: it cannot be drawn, so the question is never served.
  await publish('lost')
  const noFile = (await q(`insert into stimuli (kind, label, alt_text) values ('image', 'Tanpa fail', 'x') returning id::text id`))[0]?.id
  await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1`, [made.lost, noFile])
}, 180_000)

afterAll(async () => {
  await t.close()
})

describe('Latih Tubi serves figures with their figure and groups whole (S5-T03 part B)', () => {
  it('no figure question without its figure, and no split group, in 200 draws', async () => {
    const figure = made.figure as string
    const members = ['g1', 'g2', 'g3'].map((k) => made[k] as string)
    const seen = { figure: 0, group: 0 }
    for (let i = 0; i < 200; i++) {
      const count = 3 + (i % 5)
      const ids = await source.sample({ subjectId: tag.subjectId, activity: 'latih_tubi_spm', spmPool: true }, count, prngStream(`s5t03b:${String(i)}`))
      expect(ids.length, `draw ${String(i)} not above the count`).toBeLessThanOrEqual(count)
      const live = await source.live(ids, 'latih_tubi_spm')
      expect([...live.keys()].sort(), `draw ${String(i)}: every drawn id is served`).toEqual([...ids].sort())
      // A group is served whole or not at all, members contiguous in group order.
      const inGroup = ids.filter((id) => members.includes(id))
      expect(inGroup.length === 0 || inGroup.length === 3, `draw ${String(i)}: group split ${inGroup.join()}`).toBe(true)
      if (inGroup.length === 3) {
        const at = ids.indexOf(members[0] as string)
        expect(ids.slice(at, at + 3)).toEqual(members)
        seen.group++
      }
      for (const id of ids) {
        const served = live.get(id)!
        expect(ids).not.toContain(made.b1)
        expect(ids).not.toContain(made.b2)
        expect(ids).not.toContain(made.lost)
        if (id === figure || members.includes(id)) {
          // The figure travels with the question: every stimulus has its picture token, and the wire shape parses.
          expect(served.stimuli?.length ?? 0, `question ${id} has its stimulus`).toBeGreaterThan(0)
          for (const st of served.stimuli ?? []) expect(st.assetFileId, `question ${id} stimulus ${st.id} has its picture`).toMatch(/^[A-Za-z0-9_-]{22}$/)
          if (id === figure) seen.figure++
        }
      }
    }
    // Both kinds really were drawn (the draws are not trivially text-only).
    expect(seen.figure).toBeGreaterThan(0)
    expect(seen.group).toBeGreaterThan(0)
  })

  it('the wire: stimuli and group {id, index, size} of a member, and the strict schema accepts it', async () => {
    const ids = ['g1', 'g2', 'g3'].map((k) => made[k] as string)
    const live = await source.live(ids, 'latih_tubi_spm')
    const second = live.get(ids[1] as string)!
    const g = groupOf(second)
    expect(g).toEqual({ id: second.groupId, index: 2, size: 3 })
    const wire = (second.stimuli ?? []).map(wireStimulus)
    expect(wire).toHaveLength(1)
    expect(wire[0]).toMatchObject({ kind: 'image', label: 'Rajah 2', alt: 'Rajah', text: null, table: null, caption: null, source: null })
    expect(wire[0]?.imageId).toMatch(/^[A-Za-z0-9_-]{22}$/)
    const parsed = PracticeQuizQuestionSchema.parse({
      id: second.id,
      questionText: second.questionText,
      textDirection: second.textDirection,
      scriptType: second.scriptType,
      wrongTimes: 0,
      hasDskp: second.hasDskp,
      contributor: null,
      options: second.options.map((o, i) => ({ id: i, label: o.label, text: o.text })),
      stimuli: wire,
      group: g,
    })
    expect(parsed.group).toMatchObject({ index: 2, size: 3 })
    // A question outside a group has none.
    const single = (await source.live([made.single1 as string], 'latih_tubi_spm')).get(made.single1 as string)!
    expect(groupOf(single)).toBeNull()
    expect(single.stimuli).toEqual([])
  })

  it('a replay (versions with display) keeps the group of the served members', async () => {
    const refs = ['g1', 'g2', 'g3'].map((k) => ({ questionId: made[k] as string, versionNo: 1 }))
    const got = await source.versions(refs, { display: true })
    const second = [...got.values()].find((v) => v.id === made.g2)!
    expect(groupOf(second)).toMatchObject({ index: 2, size: 3 })
    expect(second.stimuli?.length).toBe(1)
  })
})
