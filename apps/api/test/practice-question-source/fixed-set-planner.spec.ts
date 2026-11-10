import type { StartSessionRequest } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import type { PracticeDrillActivity, PracticePorts, PracticeQuestion } from '../../src/modules/practice/ports'
import { PICTURE_PLACEHOLDER_LABEL } from '../../src/modules/practice/question-bridge/practice-media'
import { PracticeStartPlanner, RemedialSelector } from '../../src/modules/practice/start.planner'

/**
 * KP-15 planner rules, with fake ports. A FIXED set (a teacher's mission, an assigned remedial test, a question set) asks the source for
 * `fixedSet: true` and so keeps a question whose picture is missing or held (placeholder, same place); an AUTOMATIC draw (Ulang Kaji / revision,
 * the remedial top-up, chapter history top-up) never does and gets it dropped. The fake source behaves as the real one: `BAD` is unservable.
 */
const BAD = 'bad'
const question = (id: string, placeholder = false): PracticeQuestion =>
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
    ...(placeholder ? { stimuli: [{ id: `${id}-gambar-tiada`, kind: 'passage', label: PICTURE_PLACEHOLDER_LABEL, alt: PICTURE_PLACEHOLDER_LABEL, text: 'x' }] } : {}),
  }) as PracticeQuestion

const ALL = ['a1', BAD, 'a3']

function build() {
  const calls: { activity: PracticeDrillActivity | undefined; fixedSet: boolean }[] = []
  const live = (ids: readonly string[], activity?: PracticeDrillActivity, opts: { fixedSet?: boolean } = {}) => {
    calls.push({ activity, fixedSet: opts.fixedSet === true })
    return Promise.resolve(
      new Map(
        ids.flatMap((id) => {
          if (id === BAD && opts.fixedSet !== true) return []
          return [[id, question(id, id === BAD)] as const]
        }),
      ),
    )
  }
  const resolution = { status: 'ok', questionIds: ALL, subjectId: '1', coinsPerCorrect: 1, completed: false }
  const ports = {
    questions: {
      live,
      chapterCounts: () => Promise.resolve(new Map([['9', 10]])),
      chapterPage: () => Promise.resolve([]),
    },
    assignments: { resolve: () => Promise.resolve(resolution) },
  } as unknown as PracticePorts
  const curriculum = {
    subjectByCode: () => Promise.resolve({ id: 1n, code: 'ZZ', isActive: true, educationLevelIds: [1n] }),
    levels: () => Promise.resolve([{ id: 1n, code: 'T4' }]),
    chapter: () => Promise.resolve({ id: 9n, subjectId: 1n, educationLevelId: 1n }),
  }
  const repo = {
    offeredLevels: () => Promise.resolve([{ id: '1', code: 'T4', order: 10, gradeKey: 'TINGKATAN_4' }]),
    countSessions: () => Promise.resolve(0),
    linkedSessions: () => Promise.resolve([]),
    chapterProgress: () => Promise.resolve(new Map([[BAD, { lastAt: new Date(2026, 0, 1) }]])),
    queue: () => Promise.resolve(ALL.map((questionId) => ({ questionId }))),
    weakTopicQuestionIds: () => Promise.resolve([]),
    weakDimensions: () => Promise.resolve({ chapterIds: [], levelIds: [], answered: 0 }),
  }
  const p = new PracticeStartPlanner(curriculum as never, ports, repo as never, { trial: () => Promise.resolve({ active: false, remaining: 1 }) } as never)
  return { p, calls, ports, repo }
}

const now = new Date('2026-10-19T09:00:00+08:00')
const req = (r: Record<string, unknown>) => r as unknown as StartSessionRequest
const placeholderOf = (q: PracticeQuestion | undefined) => q?.stimuli?.some((s) => s.label === PICTURE_PLACEHOLDER_LABEL) === true

describe('KP-15 planner: fixed sets keep the question with a placeholder', () => {
  it('a mission keeps all three in order; the bad one carries the placeholder; the source is asked with fixedSet', async () => {
    const { p, calls } = build()
    const plan = await p.plan('u', req({ mode: 'mission', missionId: '5' }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(ALL)
    expect(plan.served.map(placeholderOf)).toEqual([false, true, false])
    expect(calls.every((c) => c.fixedSet)).toBe(true)
  })

  it('an assigned remedial test keeps all three in order with the placeholder, fixedSet set', async () => {
    const { p, calls } = build()
    const plan = await p.plan('u', req({ mode: 'remedial', remedialTestId: '6' }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(ALL)
    expect(placeholderOf(plan.served[1])).toBe(true)
    expect(calls.every((c) => c.fixedSet && c.activity === 'bab')).toBe(true)
  })

  it("a teacher's question set keeps all three in order with the placeholder, fixedSet set", async () => {
    const { p, calls } = build()
    const plan = await p.plan('u', req({ mode: 'question_set', questionSetId: '7' }), now, false)
    expect(plan.served.map((q) => q.id)).toEqual(ALL)
    expect(placeholderOf(plan.served[1])).toBe(true)
    expect(calls.every((c) => c.fixedSet)).toBe(true)
  })
})

describe('KP-15 planner: automatic draws stay hidden', () => {
  it('Ulang Kaji / revision (RemedialSelector) drops the bad question and never asks for fixedSet', async () => {
    const { calls, ports, repo } = build()
    const drill = await new RemedialSelector(repo as never, ports).select('u', '1')
    expect(drill.served.map((q) => q.id)).toEqual(['a1', 'a3'])
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => !c.fixedSet)).toBe(true)
  })

  it('the chapter history top-up drops the bad answered question and never asks for fixedSet', async () => {
    const { p, calls } = build()
    const plan = await p.plan('u', req({ mode: 'chapter', chapterId: '9', count: 5 }), now, false).catch((e: unknown) => e)
    // the only answered question is the bad one: dropped, so there is nothing to serve
    expect(plan).toBeInstanceOf(Error)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => !c.fixedSet)).toBe(true)
  })
})
