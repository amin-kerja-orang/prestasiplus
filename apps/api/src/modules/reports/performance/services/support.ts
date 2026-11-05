import { viewerSchoolId } from '../domain/access-policy'
import { DEFAULT_CLASS_COLOR, DISCRIMINATION_GROUP_SHARE, DISCRIMINATION_MIN_MEMBERS } from '../domain/constants'
import { compareIds, discriminationGroupSize, pct, round } from '../domain/rules'
import type { AnswerFactRow, ClassInfo, DirectoryPort, PerformancePorts } from '../ports'
import type { Ctx, PerformanceClassCard } from './types'

export type ViewScope = { kind: 'platform' } | { kind: 'school'; schoolId: string } | { kind: 'none' }

/** Admin sees the platform, school-scoped roles their school, everyone else nothing. */
export function viewScope(ctx: Ctx): ViewScope {
  if (ctx.role === 'admin') return { kind: 'platform' }
  const schoolId = viewerSchoolId(ctx)
  return schoolId === null ? { kind: 'none' } : { kind: 'school', schoolId }
}

export function toCard(c: ClassInfo): PerformanceClassCard {
  return {
    id: c.id,
    name: c.name,
    subjectName: c.subjectName,
    color: c.color ?? DEFAULT_CLASS_COLOR,
    students: c.studentCount,
    year: c.year,
    joinCode: c.joinCode,
    isActive: c.isActive,
  }
}

/** Pupils of the ACTIVE classes a teacher owns (empty for other roles): who the teacher may see by name. */
export async function ownPupilIds(ports: PerformancePorts, ctx: Ctx): Promise<Set<string>> {
  if (ctx.role !== 'teacher') return new Set()
  const classes = await ports.classes.classesForTeacher(ctx.userId)
  const rosters = await ports.classes.membersOf(classes.map((c) => c.id))
  return new Set([...rosters.values()].flat())
}

/** Distinct active members of several classes, ordered by id (one batched read). */
export async function distinctMembers(
  ports: PerformancePorts,
  classes: readonly ClassInfo[],
): Promise<{ all: string[]; byClass: Map<string, string[]> }> {
  const byClass = await ports.classes.membersOf(classes.map((c) => c.id))
  const all = new Set<string>()
  for (const ids of byClass.values()) for (const id of ids) all.add(id)
  return { all: [...all].sort(compareIds), byClass }
}

export async function nameMap(directory: DirectoryPort, ids: readonly string[]): Promise<Map<string, string>> {
  const users = await directory.users(ids)
  return new Map([...users].map(([id, u]) => [id, u.name]))
}

/** Classes of a view scope: platform = all, school = the school, none = []. */
export async function classesIn(ports: PerformancePorts, scope: ViewScope): Promise<ClassInfo[]> {
  if (scope.kind === 'platform') return ports.classes.allClasses()
  if (scope.kind === 'school') return ports.classes.classesOfSchool(scope.schoolId)
  return []
}

export function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const i of items) {
    const k = key(i)
    const list = out.get(k)
    if (list) list.push(i)
    else out.set(k, [i])
  }
  return out
}

/** One pupil's answers to one question, all modes and chapters summed, with the FIRST attempt in scope (by time). */
export interface PupilItemStat {
  attempts: number
  correct: number
  firstAt: Date
  firstCorrect: boolean
}

/** One question over the rows of a scope (S10-T03): totals, pupils and the per-pupil first attempt. */
export interface ItemStat {
  questionId: string
  subjectId: string
  attempts: number
  correct: number
  pupils: Map<string, PupilItemStat>
}

/**
 * Folds answer-fact rows into one stat per question (rows with no question id, '0', are not questions). Every mode is
 * counted (XS-8). The first attempt of a pupil is the row with the earliest `firstAnsweredAt` (ties: lowest mode name).
 */
export function itemStats(rows: readonly AnswerFactRow[]): Map<string, ItemStat> {
  const out = new Map<string, ItemStat>()
  for (const r of rows) {
    if (r.questionId === '0') continue
    let q = out.get(r.questionId)
    if (!q) {
      q = { questionId: r.questionId, subjectId: r.subjectId, attempts: 0, correct: 0, pupils: new Map() }
      out.set(r.questionId, q)
    }
    if (q.subjectId === '0' && r.subjectId !== '0') q.subjectId = r.subjectId
    q.attempts += r.attempts
    q.correct += r.correct
    const p = q.pupils.get(r.userId)
    if (!p) {
      q.pupils.set(r.userId, { attempts: r.attempts, correct: r.correct, firstAt: r.firstAnsweredAt, firstCorrect: r.firstCorrect })
    } else {
      p.attempts += r.attempts
      p.correct += r.correct
      if (r.firstAnsweredAt < p.firstAt) {
        p.firstAt = r.firstAnsweredAt
        p.firstCorrect = r.firstCorrect
      }
    }
  }
  return out
}

/** Pooled answers per pupil over every row of the scope: the ranking basis of the discrimination index. */
export function pooledByPupil(rows: readonly AnswerFactRow[]): Map<string, { n: number; c: number }> {
  const out = new Map<string, { n: number; c: number }>()
  for (const r of rows) {
    const m = out.get(r.userId) ?? { n: 0, c: 0 }
    m.n += r.attempts
    m.c += r.correct
    out.set(r.userId, m)
  }
  return out
}

export interface Discrimination {
  /** Pupils with an answer to the question (N). */
  pupils: number
  upperPct: number
  lowerPct: number
  /** D, 2 decimals. */
  index: number
}

/**
 * Discrimination of one question (R1 decision D113, PRD 20 R1-GUR-6): N = the pupils in scope with an answer to the question;
 * null below DISCRIMINATION_MIN_MEMBERS. They are ranked by pooled accuracy over ALL their answers in scope (ties by pupil id
 * ascending); g = max(1, ceil(0.27 x N)); U = the top g, L = the bottom g; a pupil counts as right when the FIRST attempt in
 * scope on the question was right; D = round((right in U - right in L) / g, 2).
 */
export function discriminationOf(stat: ItemStat, pooled: ReadonlyMap<string, { n: number; c: number }>): Discrimination | null {
  const n = stat.pupils.size
  if (n < DISCRIMINATION_MIN_MEMBERS) return null
  const acc = (id: string): number => {
    const m = pooled.get(id)
    return m ? pct(m.c, m.n) : 0
  }
  const ranked = [...stat.pupils.keys()].sort((a, b) => acc(b) - acc(a) || compareIds(a, b))
  const g = discriminationGroupSize(n, DISCRIMINATION_GROUP_SHARE)
  const right = (ids: readonly string[]): number => ids.filter((id) => stat.pupils.get(id)?.firstCorrect === true).length
  const u = right(ranked.slice(0, g))
  const l = right(ranked.slice(-g))
  return { pupils: n, upperPct: round(pct(u, g), 1), lowerPct: round(pct(l, g), 1), index: round((u - l) / g, 2) }
}
