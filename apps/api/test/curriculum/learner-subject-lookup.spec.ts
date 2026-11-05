import { describe, expect, it, vi } from 'vitest'

import { CurriculumLearnerService } from '../../src/modules/curriculum/learner.service'
import { PRACTICE_CODE } from '../../src/modules/curriculum/rules'

/**
 * S4-T06 (Codex P2): the learner subject code is looked up by own key. `constructor`, `toString` and `__proto__` are unknown subjects
 * (no rows, the repository is not asked for them) and never reach `repo.learnerChapters` as a practice code. Fake repository, no database.
 */
const LEVELS = [{ id: '4', code: 'T4', order: 10, gradeKey: 'TINGKATAN_4' }]

function service() {
  const learnerChapters = vi.fn().mockResolvedValue([])
  const repo = { offeredLevels: () => Promise.resolve(LEVELS), learnerChapters, activeTopicsByChapter: () => Promise.resolve(new Map()) }
  const ports = { topicProgress: { topicProgress: () => Promise.resolve(new Map()) } }
  return { svc: new CurriculumLearnerService(repo as never, ports as never), learnerChapters }
}

describe('learner subject lookup', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'])('topics and the learning map treat %s as an unknown subject', async (name) => {
    const { svc, learnerChapters } = service()
    expect(await svc.topics({ subject: name })).toEqual([])
    const map = await svc.learningMap({ subject: name, grade: 'TINGKATAN_4' }, 'u')
    expect([map.subject, map.topics]).toEqual([name, []])
    expect(learnerChapters).not.toHaveBeenCalled()
  })

  it('a known subject still asks the repository with its practice code', async () => {
    const { svc, learnerChapters } = service()
    await svc.learningMap({ subject: 'MATEMATIK', grade: 'TINGKATAN_4' }, 'u')
    expect(learnerChapters).toHaveBeenCalledWith({ levelIds: [4n], subjectCodes: [PRACTICE_CODE.MATEMATIK] })
  })
})
