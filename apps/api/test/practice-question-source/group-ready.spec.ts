import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ServabilityActivity } from '@pp/contract'

import { prngStream } from '../../src/db/prng'
import type { PracticeDrillActivity } from '../../src/modules/practice/ports'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { GROUP_SURFACES } from '../../src/modules/questions/serving'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'

/**
 * S1-T06 (S5 cross-sector, D105, FR-MUR-QP-6/7, AC-QP-6/7, DM-27, D91): the practice code is GROUP-READY. With today's surface list (no drill in it)
 * every draw and count is what it was; with a list that includes the drills the draw is whole-group (`drawUnits`), the counts agree with it,
 * an incomplete group is out as a whole, and figures are served only where the surface allows them.
 */
const DRILLS: readonly PracticeDrillActivity[] = ['latih_tubi_spm', 'databank', 'bab']
const WITH_DRILLS: readonly ServabilityActivity[] = [...GROUP_SURFACES, ...DRILLS]

let t: QuestionsTestApp
let tag: Tag
let repo: QuestionsRepository
let today: Be09PracticeQuestionSource
let ready: Be09PracticeQuestionSource
let chapterId: string
const made: Record<string, string> = {}
let seq = 0

const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)
const sourceOf = (surfaces: readonly ServabilityActivity[]) => new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, surfaces)

async function fileRow(): Promise<string> {
  seq += 1
  const [row] = await q(
    `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
     values ($1, null, 'question_image', 'image/png', 10, $2, $3) returning id::text id`,
    [`gr${String(seq)}`.padEnd(22, 'A'), 'c'.repeat(64), `gr-key-${String(seq)}`],
  )
  return row?.id as string
}

async function publish(key: string, over: Record<string, unknown> = {}, approve = true): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} kesiapan kumpulan`, ...over }), admin)
  if (approve) {
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  }
  await q(`update question_versions set chapter_id = $2 where question_id = $1`, [created.id, chapterId])
  made[key] = created.id
  return created.id
}

const group = async (label: string): Promise<string> => {
  const svc = t.app.get(QuestionsService)
  const passage = await svc.createStimulus({ kind: 'passage', label, bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
  return svc.createStimulusGroup({ label, scope: 'section', stimulusIds: [passage], optionBank: [] })
}

const selection = { activity: 'latih_tubi_spm', spmPool: true } as const
const all = async (s: Be09PracticeQuestionSource): Promise<string[]> => s.sample({ subjectId: tag.subjectId, ...selection }, 100, prngStream('group-ready:all'))

beforeAll(async () => {
  t = await bootQuestionsApp()
  repo = t.app.get(QuestionsRepository)
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  // This spec owns the subject: the seeded questions are switched off so only the ones made here are eligible.
  await q(`update questions set is_active = false`)
  chapterId = (await q(`select id::text id from chapters where subject_id = $1 order by id limit 1`, [tag.subjectId]))[0]?.id as string
  for (let i = 1; i <= 6; i++) await publish(`single${String(i)}`)

  const good = await group('Petikan lengkap')
  for (const k of ['g1', 'g2', 'g3']) await publish(k, { stimulusGroupId: good })
  const bad = await group('Petikan tidak lengkap')
  await publish('b1', { stimulusGroupId: bad })
  await publish('b2', { stimulusGroupId: bad }, false) // a member that is not approved: the whole group is out (group_incomplete)

  await publish('figure')
  const stimulus = await q(`insert into stimuli (kind, label, alt_text, asset_file_id) values ('image', 'Rajah 1', 'Rajah', $1) returning id::text id`, [await fileRow()])
  await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1`, [made.figure, stimulus[0]?.id])
  await publish('optionImage')
  await q(`update part_options set image_file_id = $2 where id = (select o.id from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 order by o.id limit 1)`, [made.optionImage, await fileRow()])

  today = sourceOf(GROUP_SURFACES)
  ready = sourceOf(WITH_DRILLS)
}, 180_000)

afterAll(async () => {
  await t.close()
})

describe('today\'s surfaces: behaviour unchanged (regression)', () => {
  it('the drills are not group surfaces', () => {
    for (const d of DRILLS) expect(GROUP_SURFACES).not.toContain(d)
  })

  it('a draw serves the ungrouped text questions only; a group member, a figure and an option image are never drawn', async () => {
    const ids = await all(today)
    expect([...ids].sort()).toEqual([1, 2, 3, 4, 5, 6].map((i) => made[`single${String(i)}`]).sort())
  })

  it('live() refuses a figure and a group member on every drill; chapter counts are the ungrouped text count', async () => {
    const wanted = [made.g1, made.figure, made.optionImage, made.single1] as string[]
    for (const a of DRILLS) expect([...(await today.live(wanted, a)).keys()]).toEqual([made.single1])
    expect([...(await today.live(wanted)).keys()]).toEqual([made.single1])
    expect((await today.chapterCounts([chapterId], true)).get(chapterId)).toBe(6)
  })

  it('the overview cards count ungrouped questions only', async () => {
    const repoOv = new OverviewRepository({ client: t.db.prisma } as never)
    const cells = await repoOv.bankMatrix()
    expect(cells.filter((c) => c.subjectId === tag.subjectId).reduce((s, c) => s + c.n, 0)).toBe(6 + 2) // + the figure and the option-image question (ungrouped)
    expect((await repoOv.chapterQuestionCounts([chapterId])).get(chapterId)).toBe(8)
  })
})

describe('with the drills in the surface list: whole groups and figures', () => {
  it('(a) a full draw serves every servable unit: 6 singles, 2 figure questions and the whole 3-member group, never the incomplete group', async () => {
    const ids = await all(ready)
    expect([...ids].sort()).toEqual(['single1', 'single2', 'single3', 'single4', 'single5', 'single6', 'figure', 'optionImage', 'g1', 'g2', 'g3'].map((k) => made[k]).sort())
    expect(ids).not.toContain(made.b1)
    expect(ids).not.toContain(made.b2)
  })

  it('(a) 200 seeded draws of 5: a group is whole or absent, members are contiguous in group order, the count never exceeds 5', async () => {
    const members = ['g1', 'g2', 'g3'].map((k) => made[k] as string)
    let withGroup = 0
    let without = 0
    for (let i = 0; i < 200; i++) {
      const ids = await ready.sample({ subjectId: tag.subjectId, ...selection }, 5, prngStream(`group-ready:${String(i)}`))
      expect(ids.length).toBeLessThanOrEqual(5)
      expect(new Set(ids).size).toBe(ids.length)
      const at = members.map((m) => ids.indexOf(m))
      if (at[0] === -1 && at[1] === -1 && at[2] === -1) {
        without += 1
      } else {
        withGroup += 1
        expect(at, `group whole in order: ${ids.join(',')}`).toEqual([at[0], (at[0] as number) + 1, (at[0] as number) + 2])
        expect(at[0]).toBeGreaterThanOrEqual(0)
      }
    }
    expect(withGroup).toBeGreaterThan(0)
    expect(without).toBeGreaterThan(0)
  })

  it('(a) a group that does not fit the count is skipped, not split: a draw of 2 never holds a member of the 3-member group', async () => {
    for (let i = 0; i < 50; i++) {
      const ids = await ready.sample({ subjectId: tag.subjectId, ...selection }, 2, prngStream(`group-ready:two:${String(i)}`))
      expect(ids.length).toBe(2)
      for (const k of ['g1', 'g2', 'g3']) expect(ids).not.toContain(made[k])
    }
  })

  it('(b) a group with an unapproved member is excluded whole from the draw AND the counts (group_incomplete)', async () => {
    expect(await all(ready)).not.toContain(made.b1)
    const ov = new OverviewRepository({ client: t.db.prisma } as never, WITH_DRILLS)
    expect((await ov.chapterQuestionCounts([chapterId])).get(chapterId)).toBe(11) // 6 + 2 + the complete group of 3; the incomplete group's b1 is not counted
    expect((await ready.chapterCounts([chapterId], true)).get(chapterId)).toBe(11)
  })

  it('(c) card count = details = draw (D91): bank card, chapter card, exact chapter count and the full draw agree', async () => {
    const ov = new OverviewRepository({ client: t.db.prisma } as never, WITH_DRILLS)
    const drawn = (await all(ready)).length
    expect(drawn).toBe(11)
    expect(
      (await ov.bankMatrix())
        .filter((c) => c.subjectId === tag.subjectId)
        .reduce((s, c) => s + c.n, 0),
    ).toBe(drawn)
    expect((await ov.chapterQuestionCounts([chapterId])).get(chapterId)).toBe(drawn)
    expect((await ready.chapterCounts([chapterId], true)).get(chapterId)).toBe(drawn)
    expect((await ready.chapterCounts([chapterId])).get(chapterId)).toBe(drawn)
    expect((await ready.chapterQuestionIds(chapterId)).length).toBe(drawn)
    expect((await ready.chapterPage(chapterId, [], 50)).length).toBe(drawn)
  })

  it('(d) figure and option-image questions are served only when the surface allows; the member carries its group', async () => {
    const wanted = [made.figure, made.optionImage, made.g2] as string[]
    const on = await ready.live(wanted, 'latih_tubi_spm')
    expect([...on.keys()].sort()).toEqual([...wanted].sort())
    expect(on.get(made.figure as string)?.stemImageId).toBeTruthy()
    expect(on.get(made.optionImage as string)?.options.some((o) => o.imageId !== undefined)).toBe(true)
    const member = on.get(made.g2 as string)
    expect(member?.groupId).toBeTruthy()
    expect(member?.stimulusGroup?.questionIds).toEqual(['g1', 'g2', 'g3'].map((k) => made[k]))
    // A mode with no drill surface (revision, mission, remedial) stays text-only, even with the drills in the list.
    expect([...(await ready.live(wanted)).keys()]).toEqual([])
    // Only the drill that is in the list: a list with `bab` alone serves nothing extra on Latih Tubi.
    expect([...(await sourceOf([...GROUP_SURFACES, 'bab']).live(wanted, 'latih_tubi_spm')).keys()]).toEqual([])
    expect([...(await sourceOf([...GROUP_SURFACES, 'bab']).live(wanted, 'bab')).keys()].sort()).toEqual([...wanted].sort())
  })

  it('chapterPage: a group with an answered member is left for the history fill; whole groups only, within the limit', async () => {
    const page = await ready.chapterPage(chapterId, [made.g1 as string], 50)
    for (const k of ['g1', 'g2', 'g3']) expect(page).not.toContain(made[k])
    const small = await ready.chapterPage(chapterId, [], 4)
    const at = ['g1', 'g2', 'g3'].map((k) => small.indexOf(made[k] as string))
    expect(small.length).toBeLessThanOrEqual(4)
    expect(at.every((i) => i === -1) || at[1] === (at[0] as number) + 1).toBe(true)
  })
})
