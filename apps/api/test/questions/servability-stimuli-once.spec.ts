import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { ServabilityReadsService, ServabilityService } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * The own-stimulus reads of the servability facts run ONCE per `factsOf` call (one chunk of the overview / paper scans): the kuiz's
 * `linkedAssets` and the bridge's `outside` are both derived from the single `outsideStimuliOf` read, and the facts are the same
 * as two separate reads gave (REQ-C-022 finding 1, D90).
 */
describe('servability facts: the own stimuli are read once per chunk', () => {
  let t: QuestionsTestApp
  let svc: ServabilityService
  let tag: Tag
  const withStimulus: string[] = []
  let plain = ''
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(ServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const questions = t.app.get(QuestionsService)
    const admin = await adminActor(t.db)
    const live = async (text: string, kind?: 'passage' | 'table'): Promise<string> => {
      const created = await questions.create(mcqInput(tag, { questionText: text }), admin)
      await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
      await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
      if (kind) {
        const stimulusId = await questions.createStimulus({ kind, label: `Sendiri ${text}`, bodyMs: `Isi ${text}`, bodyEn: null, altText: null, assetFileId: null })
        const [version] = await q(`select id::text id from question_versions where question_id = $1 and version_no = 1`, [created.id])
        await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)`, [version!.id, stimulusId])
      }
      return created.id
    }
    withStimulus.push(await live('Soalan satu dengan petikan sendiri.', 'passage'), await live('Soalan dua dengan jadual sendiri.', 'table'))
    plain = await live('Soalan tiga tanpa rangsangan sendiri.')
    // A published paper so the overview scan has something to evaluate.
    const [p] = await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', 'Terbit stimulus', $1, 2, 90, 'published') returning id::text id`, [tag.subjectId])
    const [sec] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 3, 3) returning id::text id`, [p!.id])
    for (const [i, id] of [...withStimulus, plain].entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [sec!.id, id, i + 1])
  })
  afterAll(async () => {
    await t.close()
  })

  it('one versionStimuli and one stimulusUseCounts per factsOf call, however many questions carry stimuli', async () => {
    const versionStimuli = vi.spyOn(QuestionsRepository.prototype, 'versionStimuli')
    const useCounts = vi.spyOn(QuestionsRepository.prototype, 'stimulusUseCounts')
    try {
      const facts = await svc.factsOf([...withStimulus, plain])
      expect(versionStimuli).toHaveBeenCalledTimes(1)
      expect(useCounts).toHaveBeenCalledTimes(1)
      // both views come from that one read: the chunk's map holds both questions' own stimuli (each shared by one question only), and
      // the kuiz map holds the same ids as the bridge map (no leaf-only picture here)
      for (const id of [...withStimulus, plain]) {
        const f = facts.get(id)!
        expect(f.outside.size).toBe(2)
        expect([...f.linkedAssets.keys()].sort()).toEqual([...f.outside.keys()].sort())
        for (const s of f.outside.values()) expect(s).toMatchObject({ sharedBy: 1 })
      }
    } finally {
      versionStimuli.mockRestore()
      useCounts.mockRestore()
    }
  })

  it('reports() and the jana-free pass read once as well, and a chunk without own stimuli reads nothing', async () => {
    const versionStimuli = vi.spyOn(QuestionsRepository.prototype, 'versionStimuli')
    const useCounts = vi.spyOn(QuestionsRepository.prototype, 'stimulusUseCounts')
    try {
      await svc.reports(withStimulus)
      await svc.factsOf(withStimulus, { jana: false })
      expect(versionStimuli).toHaveBeenCalledTimes(2)
      expect(useCounts).toHaveBeenCalledTimes(2)
      versionStimuli.mockClear()
      useCounts.mockClear()
      await svc.factsOf([plain])
      expect(versionStimuli).not.toHaveBeenCalled()
      expect(useCounts).not.toHaveBeenCalled()
    } finally {
      versionStimuli.mockRestore()
      useCounts.mockRestore()
    }
  })

  it('the overview reads the own stimuli at most once per factsOf chunk', async () => {
    const factsOf = vi.spyOn(ServabilityService.prototype, 'factsOf')
    const versionStimuli = vi.spyOn(QuestionsRepository.prototype, 'versionStimuli')
    const useCounts = vi.spyOn(QuestionsRepository.prototype, 'stimulusUseCounts')
    try {
      await t.app.get(ServabilityReadsService).overview()
      expect(factsOf.mock.calls.length).toBeGreaterThan(0)
      expect(versionStimuli.mock.calls.length).toBeLessThanOrEqual(factsOf.mock.calls.length)
      expect(useCounts.mock.calls.length).toBeLessThanOrEqual(factsOf.mock.calls.length)
    } finally {
      factsOf.mockRestore()
      versionStimuli.mockRestore()
      useCounts.mockRestore()
    }
  })
})
