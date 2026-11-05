import { describe, expect, it, vi } from 'vitest'

import { CurriculumLearnerService } from '../../src/modules/curriculum/learner.service'
import { PRACTICE_CODE } from '../../src/modules/curriculum/rules'

/**
 * S4-T06 (Codex P2): inherited object names stay unknown subjects. Any active subject code is accepted now (D11, exact match), so the
 * repository IS asked, but only with the literal text typed (a bound string in `subjects.code IN (...)`), never with a value resolved
 * from `Object.prototype` (`PRACTICE_CODE[constructor]` would be a function). The fake repository holds no such subject: no rows, no topics.
 * Fake repository, no database.
 */
const LEVELS = [{ id: '4', code: 'T4', order: 10, gradeKey: 'TINGKATAN_4' }]

function service() {
  const learnerChapters = vi.fn().mockResolvedValue([])
  const repo = { offeredLevels: () => Promise.resolve(LEVELS), learnerChapters, activeTopicsByChapter: () => Promise.resolve(new Map()) }
  const ports = { topicProgress: { topicProgress: () => Promise.resolve(new Map()) } }
  return { svc: new CurriculumLearnerService(repo as never, ports as never), learnerChapters }
}

describe('learner subject lookup', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'])('topics and the learning map treat %s as an unknown subject: no rows, and only its text reaches the repository', async (name) => {
    const { svc, learnerChapters } = service()
    expect(await svc.topics({ subject: name })).toEqual([])
    const map = await svc.learningMap({ subject: name, grade: 'TINGKATAN_4' }, 'u')
    expect([map.subject, map.topics]).toEqual([name, []])
    // The repository is asked with the typed text only (a string, in the one-element list), and nothing comes back for it.
    for (const [arg] of learnerChapters.mock.calls as [{ subjectCodes?: unknown[] }][]) {
      expect(arg.subjectCodes).toHaveLength(1)
      expect(typeof arg.subjectCodes?.[0]).toBe('string')
      expect(String(arg.subjectCodes?.[0]).toLowerCase()).toBe(name.toLowerCase())
    }
  })

  it('a known subject still asks the repository with its practice code', async () => {
    const { svc, learnerChapters } = service()
    await svc.learningMap({ subject: 'MATEMATIK', grade: 'TINGKATAN_4' }, 'u')
    expect(learnerChapters).toHaveBeenCalledWith({ levelIds: [4n], subjectCodes: [PRACTICE_CODE.MATEMATIK] })
  })
})
