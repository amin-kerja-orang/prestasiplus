import { describe, expect, it } from 'vitest'
import type { StartSessionRequest } from '@pp/contract'

import { PracticeStartPlanner, RemedialSelector } from '../../src/modules/practice/start.planner'
import type { PracticeDrillActivity, PracticePorts, PracticeQuestion, PracticeSelection } from '../../src/modules/practice/ports'

/**
 * S1-T06 (DM-27) planner rules, with fake ports: the planner passes the drill surface to the source, a group counts as its number of members
 * toward the target, a group that would exceed it is skipped, and members stay contiguous in the served list (the session rows are inserted in that order).
 */
const question = (id: string, group?: string[]): PracticeQuestion =>
  ({
    id,
    versionNo: 1,
    subjectId: '1',
    educationLevelId: '1',
    chapterId: '9',
    topicId: null,
    difficulty: 3,
    questionType: 'mcq',
    spmPool: true,
    questionText: id,
    textDirection: 'ltr',
    scriptType: 'rumi',
    hasDskp: true,
    contributor: null,
    options: [{ label: 'A', text: 'a' }],
    correctLabel: 'A',
    explanation: null,
    ...(group ? { groupId: 'G', groupPosition: group.indexOf(id) + 1, stimulusGroup: { id: 'G', stimuli: [], optionBank: [], questionIds: group } } : {}),
  }) as PracticeQuestion

function planner(opts: { drawn?: string[]; bank: PracticeQuestion[]; page?: string[]; answered?: string[] }) {
  const seen: { selection?: PracticeSelection; liveActivities: (PracticeDrillActivity | undefined)[] } = { liveActivities: [] }
  const byId = new Map(opts.bank.map((x) => [x.id, x]))
  const ports = {
    questions: {
      sample: (s: PracticeSelection) => {
        seen.selection = s
        return Promise.resolve(opts.drawn ?? [])
      },
      chapterCounts: () => Promise.resolve(new Map([['9', 10]])),
      chapterPage: () => Promise.resolve(opts.page ?? []),
      live: (ids: readonly string[], activity?: PracticeDrillActivity) => {
        seen.liveActivities.push(activity)
        return Promise.resolve(new Map(ids.flatMap((id) => (byId.has(id) ? [[id, byId.get(id) as PracticeQuestion] as const] : []))))
      },
    },
  } as unknown as PracticePorts
  const curriculum = {
    subjectByCode: () => Promise.resolve({ id: 1n, code: 'ZZ', isActive: true, educationLevelIds: [1n] }),
    levels: () => Promise.resolve([{ id: 1n, code: 'T4' }]),
    chapter: () => Promise.resolve({ id: 9n, subjectId: 1n, educationLevelId: 1n }),
  }
  const repo = {
    // S4-T06: the planner reads the offered levels through the repository (`offeredLevels(db)`).
    offeredLevels: () => Promise.resolve([{ id: '1', code: 'T4', order: 10, gradeKey: 'TINGKATAN_4' }]),
    countSessions: () => Promise.resolve(0),
    chapterProgress: () => Promise.resolve(new Map((opts.answered ?? []).map((id, i) => [id, { lastAt: new Date(2026, 0, i + 1) }]))),
  }
  const subscriptions = { trial: () => Promise.resolve({ active: false, remaining: 1 }) }
  return { p: new PracticeStartPlanner(curriculum as never, ports, repo as never, subscriptions as never), seen }
}

const now = new Date('2026-10-19T09:00:00+08:00')
const req = (r: Record<string, unknown>) => r as unknown as StartSessionRequest

describe('planner: group-ready', () => {
  it('Latih Tubi asks the source for its own surface and keeps the drawn order: a 3-member group counts as 3 of 5, members contiguous', async () => {
    const group = ['g1', 'g2', 'g3']
    const bank = [question('s1'), ...group.map((g) => question(g, group)), question('s2')]
    const { p, seen } = planner({ drawn: ['s1', 'g1', 'g2', 'g3', 's2'], bank })
    const plan = await p.plan('u', req({ mode: 'latih_tubi', subjectCode: 'ZZ', count: 5 }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(['s1', 'g1', 'g2', 'g3', 's2'])
    expect(seen.selection?.activity).toBe('latih_tubi_spm')
    expect(seen.liveActivities).toEqual(['latih_tubi_spm'])
  })

  it('past year passes the databank surface; revision-like paths pass none', async () => {
    const bank = [question('s1'), question('s2')]
    const a = planner({ drawn: ['s1', 's2'], bank })
    await a.p.plan('u', req({ mode: 'past_year', subjectCode: 'ZZ', count: 10 }), now, false)
    expect(a.seen.selection?.activity).toBe('databank')
    expect(a.seen.liveActivities).toEqual(['databank'])
  })

  const hs = ['h1', 'h2', 'h3', 'h4']
  const gs = ['g1', 'g2', 'g3']
  const bank = [...['s1', 's2', 's3', 's4', 's5', 's6'].map((id) => question(id)), ...hs.map((id) => question(id, hs)), ...gs.map((id) => question(id, gs))]

  it('chapter history fill is unit-wise: an answered group member brings its whole group, which counts as its members and stays contiguous', async () => {
    const { p, seen } = planner({ page: ['s1'], answered: ['h2'], bank })
    const plan = await p.plan('u', req({ mode: 'chapter', chapterId: '9', count: 5 }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(['s1', 'h1', 'h2', 'h3', 'h4']) // 1 + 4 = 5: fits exactly
    expect(seen.liveActivities.every((a) => a === 'bab')).toBe(true)
  })

  it('a group that would exceed the count is skipped, never split: the next unit that fits is taken', async () => {
    // fresh: 3 singles; answered oldest first: h1 (group of 4: 3 + 4 > 5, skipped), g1 (group of 3: 3 + 3 > 5, skipped), s5 (fits)
    const { p } = planner({ page: ['s1', 's2', 's3'], answered: ['h1', 'g1', 's5'], bank })
    const plan = await p.plan('u', req({ mode: 'chapter', chapterId: '9', count: 5 }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(['s1', 's2', 's3', 's5'])
  })

  it('a group is taken once however many of its members were answered', async () => {
    const { p } = planner({ page: [], answered: ['g1', 'g3', 's5'], bank })
    const plan = await p.plan('u', req({ mode: 'chapter', chapterId: '9', count: 5 }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(['g1', 'g2', 'g3', 's5'])
  })

  it('without a stimulusGroup (today: no drill is a group surface) the history fill is the old per-question rule', async () => {
    const { p } = planner({ page: ['s1'], answered: ['s2', 's3', 's4', 's5', 's6'], bank })
    const plan = await p.plan('u', req({ mode: 'chapter', chapterId: '9', count: 5 }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(['s1', 's2', 's3', 's4', 's5'])
  })

  it('ramalan and mission stay text-only (no drill surface); remedial and the revision drill ask with the Bab surface, so a wrong figure or group question is drilled again WITH its rajah (T-C13, D105)', async () => {
    const calls: (PracticeDrillActivity | undefined)[] = []
    const figure = { ...question('f1'), stemImageId: 'F' } as PracticeQuestion
    const mixed = [question('t1'), question('g1', ['g1', 'g2']), question('g2', ['g1', 'g2']), figure, question('t2')]
    const byId = new Map(mixed.map((x) => [x.id, x]))
    // The fake source behaves as the real one: with no drill surface only text, ungrouped questions come back.
    const live = (ids: readonly string[], activity?: PracticeDrillActivity) => {
      calls.push(activity)
      const textOnly = (x: PracticeQuestion) => activity !== undefined || (x.groupId === undefined && (x as { stemImageId?: string }).stemImageId === undefined)
      return Promise.resolve(new Map(ids.flatMap((id) => (byId.has(id) && textOnly(byId.get(id) as PracticeQuestion) ? [[id, byId.get(id) as PracticeQuestion] as const] : []))))
    }
    const all = ['t1', 'g1', 'g2', 'f1', 't2']
    const ports = {
      questions: { live },
      ramalan: { ramalanQuestionIds: () => Promise.resolve(all) },
      assignments: { resolve: () => Promise.resolve({ status: 'ok', questionIds: all, subjectId: '1', coinsPerCorrect: 1, completed: false }) },
    } as unknown as PracticePorts
    const curriculum = { subjectByCode: () => Promise.resolve({ id: 1n, code: 'ZZ', isActive: true, educationLevelIds: [1n] }) }
    const repo = {
      countSessions: () => Promise.resolve(0),
      linkedSessions: () => Promise.resolve([]),
      queue: () => Promise.resolve(all.map((questionId) => ({ questionId }))),
      weakTopicQuestionIds: () => Promise.resolve([]),
      weakDimensions: () => Promise.resolve({ chapterIds: [], levelIds: [], answered: 0 }),
    }
    const p = new PracticeStartPlanner(curriculum as never, ports, repo as never, { trial: () => Promise.resolve({ active: false, remaining: 1 }) } as never)

    const ramalan = await p.plan('u', req({ mode: 'ramalan', subjectCode: 'ZZ', year: 2024, setNo: 1 }), now, false)
    const mission = await p.plan('u', req({ mode: 'mission', missionId: '5' }), now, false)
    expect(calls).toEqual([undefined, undefined])
    calls.length = 0
    const remedial = await p.plan('u', req({ mode: 'remedial', remedialTestId: '6' }), now, false)
    await new RemedialSelector(repo as never, ports).select('u', '1') // the auto revision drill and the remedial suggestions
    for (const plan of [ramalan, mission, remedial]) expect(plan.served.length).toBeGreaterThan(0)
    // The remedial test and the revision drill carry the wrong figure / group questions with their rajah.
    expect(remedial.served.map((q) => q.id)).toEqual(all)
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(calls.every((a) => a === 'bab')).toBe(true)
  })
})
