import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { BuilderRepository } from '../../src/modules/exam/builder/builder.repository'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder/question-bank.source'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * REQ-B-013 (follow-up of T07 and T08): (a) `versionStimuli` is a PINNED read and says so; its callers are listed. (b) a deactivated
 * subject offers no candidate to the paper builder or to the Bijak pool, and a pinned Darjah version is no longer found by the practice
 * replay. (c) a stimulus group's members are judged at the LIVE version, else the latest (as T29).
 */
const SRC = join(__dirname, '..', '..', 'src')
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'generated') sourceFiles(p, out)
    } else if (name.endsWith('.ts')) out.push(p)
  }
  return out
}

describe('REQ-B-013a versionStimuli is a pinned read', () => {
  /** The only places allowed to call it: each passes versions it already holds (served or placed), never ids from a list or a draw. */
  const ALLOWED = ['modules/bijak/question-bridge/be09-question-source.ts', 'modules/questions/questions.repository.ts']

  it('has no caller outside the allowed list (a new pupil caller must scope its refs and be added here on purpose)', () => {
    const callers = sourceFiles(SRC)
      .filter((f) => /\bversionStimuli\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split('\\').join('/'))
    expect(callers.filter((c) => !ALLOWED.includes(c))).toEqual([])
  })

  it('the bridge source, when it calls it, passes the live version it just read (getMany live), nothing else', () => {
    const file = join(SRC, 'modules/bijak/question-bridge/be09-question-source.ts')
    const text = readFileSync(file, 'utf8')
    if (!/versionStimuli\(/.test(text)) return // the call arrives with R1E2E-05b
    expect(text).toMatch(/versionStimuli\(\s*records\.map\(\(r\) => \(\{ questionId: r\.id, versionNo: r\.version\.versionNo \}\)\)/)
    expect(text).toMatch(/getMany\(ids, 'live'\)/)
  })
})

describe('REQ-B-013 b, c (real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let builder: QuestionBankBuilderSource
  let pool: QuestionsBijakPoolSource
  let n = 0
  const q = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)

  async function published(over: Record<string, unknown> = {}): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: `Soalan REQ-B-013 nombor ${String(++n)} untuk ujian skop.`, tag: tagBody(tag, 3), ...over }), admin)
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    return created.id
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    const prisma = t.app.get(PrismaService)
    builder = new QuestionBankBuilderSource(prisma, repo, new BuilderRepository(prisma))
    pool = t.app.get(QuestionsBijakPoolSource)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  it('versionStimuli reads exactly the version asked for, whatever its status (the caller holds the pin)', async () => {
    const id = await published()
    const [stim] = await q<{ id: string }>(`insert into stimuli (kind, label, body_ms) values ('passage', 'Petikan', 'Isi') returning id::text id`)
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1 and version_no = 1`, [id, stim!.id])
    await svc.update(id, { ...mcqInput(tag, { questionText: 'Versi dua selepas disunting untuk ujian skop.', tag: tagBody(tag, 3) }) } as never, admin)
    // An edit clones the links into version 2; drop them there so the two versions differ.
    await q(`delete from question_version_stimuli where question_version_id = (select id from question_versions where question_id = $1 and version_no = 2)`, [id])
    const got = await repo.versionStimuli([{ questionId: id, versionNo: 1 }, { questionId: id, versionNo: 2 }, { questionId: id, versionNo: 9 }])
    expect(got.get(`${id}:1`)?.map((s) => s.id)).toEqual([stim!.id])
    expect(got.get(`${id}:2`)).toEqual([]) // version 2 (a draft) carries none: no fallback to the live or the first version
    expect(got.get(`${id}:9`)).toEqual([]) // unknown version: empty, never another version
  })

  it('a deactivated subject offers no candidate to the paper builder and none to the Bijak pool; reactivated, it does again', async () => {
    const id = await published()
    expect(await builder.candidates({ subject: 'MAT', kertas: 2 })).toContain(id)
    expect((await pool.candidatesOf(tag.subjectId)).map((f) => f.id)).toContain(id)
    await q(`update subjects set is_active = false where id = $1`, [tag.subjectId])
    try {
      expect(await builder.candidates({ subject: 'MAT', kertas: 2 })).not.toContain(id)
      expect((await pool.candidatesOf(tag.subjectId)).map((f) => f.id)).not.toContain(id)
    } finally {
      await q(`update subjects set is_active = true where id = $1`, [tag.subjectId])
    }
    expect(await builder.candidates({ subject: 'MAT', kertas: 2 })).toContain(id)
    expect((await pool.candidatesOf(tag.subjectId)).map((f) => f.id)).toContain(id)
  })

  it('M05 practice: a pinned Darjah version is not found any more (replay drops it, check refuses it): a deliberate effect of R1-B21', async () => {
    const id = await published()
    const practice = new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository)
    expect((await practice.versions([{ questionId: id, versionNo: 1 }])).size).toBe(1)
    const [d1] = await q<{ id: string }>(`select id::text id from education_levels where stage = 'primary' limit 1`)
    await q(`update question_versions set education_level_id = $2 where question_id = $1`, [id, d1!.id])
    expect((await practice.versions([{ questionId: id, versionNo: 1 }])).size).toBe(0)
  })

  it('a stimulus group is judged at the live version: a draft that moved a live member to Darjah does not hide it, a Darjah live member stays hidden', async () => {
    const passage = await svc.createStimulus({ kind: 'passage', label: 'Petikan', bodyMs: 'Teks.', bodyEn: null, altText: null, assetFileId: null })
    const groupId = await svc.createStimulusGroup({ label: 'Kumpulan', scope: 'section', stimulusIds: [passage], optionBank: [] })
    const secondaryLive = await published({ stimulusGroupId: groupId })
    const darjahLive = await published({ stimulusGroupId: groupId })
    const [d1] = await q<{ id: string }>(`select id::text id from education_levels where stage = 'primary' limit 1`)
    // secondaryLive: live v1 is secondary; a newer DRAFT v2 sits at Darjah. darjahLive: live v1 is Darjah; a newer draft v2 is secondary.
    for (const id of [secondaryLive, darjahLive]) {
      await svc.update(id, { ...mcqInput(tag, { questionText: `Versi dua ${id} untuk ujian kumpulan.`, tag: tagBody(tag, 3), stimulusGroupId: groupId }) } as never, admin)
    }
    await q(`update question_versions set education_level_id = $2 where question_id = $1 and version_no = 2`, [secondaryLive, d1!.id])
    await q(`update question_versions set education_level_id = $2 where question_id = $1 and version_no = 1`, [darjahLive, d1!.id])
    const group = (await builder.groups([groupId])).get(groupId)
    expect(group?.questionIds).toEqual([secondaryLive])
  })
})
