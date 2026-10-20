import { mytDay } from '../../../../db/clock'
import type { BijakGroupBy, BijakSittingFact, BijakTotals } from '../ports'
import { compareIds } from './rules'

/** Sums of a set of sittings (the shape of one `BijakTotals` row without its key). */
export interface Figures {
  sittings: number
  score: number
  max: number
  seconds: number
  gradedScore: number
  gradedMax: number
}

export const emptyFigures = (): Figures => ({ sittings: 0, score: 0, max: 0, seconds: 0, gradedScore: 0, gradedMax: 0 })

export function addFact(f: Figures, s: BijakSittingFact): Figures {
  f.sittings += 1
  f.score += s.score
  f.max += s.maxScore
  f.seconds += s.durationSeconds
  if (!s.provisional) {
    f.gradedScore += s.score
    f.gradedMax += s.maxScore
  }
  return f
}

export function figuresOf(facts: readonly BijakSittingFact[]): Figures {
  const f = emptyFigures()
  for (const s of facts) addFact(f, s)
  return f
}

/**
 * The reference GROUP BY (what the SQL adapter must reproduce): one row per key, ordered by the key
 * parts. Used by the in-memory fake and by the port-contract suite.
 */
export function reduceFacts(facts: readonly BijakSittingFact[], groupBy: BijakGroupBy): BijakTotals[] {
  const keyOf = (s: BijakSittingFact): Pick<BijakTotals, 'userId' | 'subjectId' | 'schoolId' | 'day'> => {
    switch (groupBy) {
      case 'user':
        return { userId: s.userId }
      case 'user_subject':
        return { userId: s.userId, subjectId: s.subjectId }
      case 'subject':
        return { subjectId: s.subjectId }
      case 'school':
        return { schoolId: s.schoolId ?? '' }
      case 'day':
        return { day: mytDay(s.submittedAt) }
      case 'user_day':
        return { userId: s.userId, day: mytDay(s.submittedAt) }
    }
  }
  const groups = new Map<string, { key: ReturnType<typeof keyOf>; f: Figures; users: Set<string>; last: Date; subjectName?: string }>()
  for (const s of facts) {
    const key = keyOf(s)
    const id = [key.userId, key.subjectId, key.schoolId, key.day].join('|')
    let g = groups.get(id)
    if (!g) {
      g = { key, f: emptyFigures(), users: new Set(), last: s.submittedAt }
      if (key.subjectId !== undefined) g.subjectName = s.subjectName
      groups.set(id, g)
    }
    addFact(g.f, s)
    g.users.add(s.userId)
    if (s.submittedAt > g.last) g.last = s.submittedAt
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        compareIds(a.key.userId ?? '', b.key.userId ?? '') ||
        compareIds(a.key.subjectId ?? '', b.key.subjectId ?? '') ||
        compareIds(a.key.schoolId ?? '', b.key.schoolId ?? '') ||
        (a.key.day ?? '').localeCompare(b.key.day ?? ''),
    )
    .map((g) => ({
      ...g.key,
      ...(g.subjectName !== undefined ? { subjectName: g.subjectName } : {}),
      ...g.f,
      pupils: g.users.size,
      lastSubmittedAt: g.last,
    }))
}
