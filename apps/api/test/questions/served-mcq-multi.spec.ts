import { SERVABILITY_ACTIVITIES, type ServabilityActivity } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mulberry32 } from '../../src/db/prng'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { ServabilityService, filterOf } from '../../src/modules/questions/serving'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S1-T09a part 6a, AC-PA-35 (D-PA-6): an `mcq_multi` question is excluded from the single-option drills (Latih Tubi, Bab, Databank, Tracking A
 * objective, Remedial, Misi, PKSK, games) by ONE SQL predicate (`NOT_MCQ_MULTI_SQL` inside `SPM_SERVABLE_SQL`) and its JS twin (the type check of
 * the practice shape verdict, reported as `shape_unsupported`), and stays served for the Bijak sitting (simulasi) and Set Soalan Guru.
 * The fixture is a plain MCQ whose stored type is switched to `mcq_multi`, next to a plain control.
 */
describe('mcq_multi served rule (AC-PA-35)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let servability: ServabilityService
  let practice: Be09PracticeQuestionSource
  let tag: Tag
  let plain: string
  let multi: string
  let multiOnPaper: string
  let chapterId: string
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function publish(text: string, type = 'mcq'): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4) }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2', type = $2 where question_id = $1`, [created.id, type])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    return created.id
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    servability = t.app.get(ServabilityService)
    practice = new Be09PracticeQuestionSource(repo, {} as UsersRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [tag.subjectId])
    plain = await publish('Soalan biasa pilihan tunggal untuk peraturan dihidangkan.')
    multi = await publish('Soalan pelbagai jawapan untuk peraturan dihidangkan.', 'mcq_multi')
    multiOnPaper = await publish('Soalan pelbagai jawapan pada kertas untuk peraturan dihidangkan.', 'mcq_multi')
    const chapter = (await q(`select id::text id from chapters where subject_id = $1 limit 1`, [tag.subjectId]))[0]
    chapterId = chapter?.id ?? ''
    if (chapter) await q(`update question_versions set chapter_id = $2 where question_id = any($1::bigint[])`, [[plain, multi, multiOnPaper], chapter.id])
    const [paper] = await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', 'Kertas multi', $1, 2, 90, 'published', now()) returning id::text id`, [tag.subjectId])
    const [section] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text id`, [paper!.id])
    await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [section!.id, multiOnPaper])
  })
  afterAll(async () => {
    await t.close()
  })

  const reasons = async (id: string, activity: ServabilityActivity) => (await servability.report(id))!.activities.find((a) => a.activity === activity)!

  it('[CI] control: the plain MCQ is drawn by the SPM pool, the multi is not (the shared SPM predicate)', async () => {
    const ids = await repo.eligibleIds({ subjectId: tag.subjectId, spmPool: true })
    expect(ids).toContain(plain)
    expect(ids).not.toContain(multi)
    expect(ids).not.toContain(multiOnPaper)
  })

  it('[CI] Latih Tubi, Databank, Tracking A, Misi and Battle SPM (spmPool without a type filter) never draw an mcq_multi', async () => {
    const drawn = await practice.sample({ subjectId: tag.subjectId, spmPool: true }, 20_000, mulberry32(3))
    expect(drawn).toContain(plain)
    expect(drawn).not.toContain(multi)
    const sampled = await repo.sampleIds({ subjectId: tag.subjectId, spmPool: true }, 20_000, 5)
    expect(sampled).toContain(plain)
    expect(sampled).not.toContain(multi)
    expect(await repo.count({ subjectId: tag.subjectId, spmPool: true, status: 'approved', active: true })).toBe((await repo.eligibleIds({ subjectId: tag.subjectId, spmPool: true })).length)
  })

  it('[CI] the complement (spmPool false) does not serve an mcq_multi either', async () => {
    expect(await repo.eligibleAmong([plain, multi, multiOnPaper], { spmPool: false })).not.toContain(multi)
  })

  it('[CI] each drill filter of the serving rules (latih_tubi_spm, databank, bab, kuiz) excludes it and keeps the plain MCQ in scope', async () => {
    for (const activity of ['latih_tubi_spm', 'databank'] as const) {
      const hit = await repo.eligibleAmong([plain, multi], filterOf(activity))
      expect(hit, activity).not.toContain(multi)
    }
    if (chapterId !== '') {
      const bab = await repo.eligibleAmong([plain, multi], filterOf('bab', { chapterId }))
      expect(bab).toContain(plain)
      expect(bab).not.toContain(multi)
    }
  })

  it('[CI] Remedial, Misi and games read type mcq: the multi is out of those filters, the plain MCQ is in', async () => {
    const remedial = { type: 'mcq' as const }
    const game = { type: 'mcq' as const, ungrouped: true, mcqShape: { minOptions: 2, maxOptions: 4 } }
    for (const f of [remedial, game]) {
      const hit = await repo.eligibleAmong([plain, multi], f)
      expect(hit).toContain(plain)
      expect(hit).not.toContain(multi)
    }
  })

  it('[CI] the indicator reports the multi as not served in Latih Tubi, Databank and Bab (shape_unsupported), the SQL and JS halves agree', async () => {
    for (const activity of ['latih_tubi_spm', 'databank'] as const) {
      const r = await reasons(multi, activity)
      expect(r.served, activity).toBe(false)
      expect(r.reasons.map((x) => x.code)).toContain('shape_unsupported')
      expect(await repo.eligibleAmong([multi], filterOf(activity))).toEqual([])
      expect((await reasons(plain, activity)).served, `plain ${activity}`).toBe(true)
    }
    if (chapterId !== '') {
      expect((await reasons(multi, 'bab')).reasons.map((x) => x.code)).toContain('shape_unsupported')
      expect((await reasons(plain, 'bab')).served).toBe(true)
    }
    expect((await servability.report(multi))!.activities.map((a) => a.activity)).toEqual([...SERVABILITY_ACTIVITIES])
  })

  it('[CI] Bijak sitting (simulasi_paper) and Set Soalan Guru still serve it', async () => {
    // Simulasi (kertas): the paper is the authority; the type is not a reason.
    const paper = await reasons(multiOnPaper, 'simulasi_paper')
    expect(paper.reasons.map((x) => x.code)).not.toContain('shape_unsupported')
    // Learner scope with no drill filter (what the sitting bank read and Set Soalan Guru's `getMany('live')` use): the multi is there.
    expect(await repo.eligibleAmong([plain, multi], {})).toEqual(expect.arrayContaining([plain, multi]))
    const live = await repo.getMany([multi], 'live')
    expect(live.map((r) => r.id)).toEqual([multi])
    expect(live[0]!.version.type).toBe('mcq_multi')
  })

  it('[CI] Jana Kertas is unchanged by the rule: the bank scope still contains the multi', async () => {
    expect(await repo.eligibleAmong([multi], filterOf('jana_kertas'))).toEqual([multi])
  })
})
