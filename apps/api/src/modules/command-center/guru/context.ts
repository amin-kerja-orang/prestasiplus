/**
 * The viewer's context for one request: the viewer set S (active non-test members of the viewer's active classrooms), their
 * names, class names and the MYT windows. Per-student figures come from the repository's grouped reads, never per-row loops.
 */
import type { AnswerFilter, ClassRow, CommandCenterRepository, UserTally } from '../shared/command-center.repository'
import type { BadgeReadPort, FeedbackReadPort, HeadcountReadPort, MoodReadPort } from '../shared/ports'
import { guruWindows, type GuruWindows, type Window } from '../shared/windows'
import type { Viewer } from '../http/viewer'

export interface GuruDeps {
  repo: CommandCenterRepository
  mood: MoodReadPort
  feedback: FeedbackReadPort
  headcount: HeadcountReadPort
  badges: BadgeReadPort
}

export interface Pupil {
  id: string
  name: string
  /** The viewer's active classes the pupil is in, in class-id order. */
  classNames: string[]
  /** Earliest active enrolment in the viewer's classes. */
  joinedAt: Date | null
}

export interface GuruContext {
  viewer: Viewer
  teacherName: string
  now: Date
  windows: GuruWindows
  /** Name A-Z, then id. */
  pupils: Pupil[]
  ids: string[]
  byId: Map<string, Pupil>
  classes: ClassRow[]
  members: Map<string, string[]>
}

export const cmpId = (a: string, b: string): number => (a === b ? 0 : BigInt(a) < BigInt(b) ? -1 : 1)

export async function loadContext(deps: GuruDeps, viewer: Viewer, now: Date): Promise<GuruContext> {
  const { repo } = deps
  const [ids, classes, brief] = await Promise.all([
    repo.teacherStudentIds(viewer.userId),
    repo.classesOfOwner(viewer.userId, { activeClassroomsOnly: true }),
    repo.userBrief(viewer.userId),
  ])
  const [names, memberRows] = await Promise.all([repo.userNames(ids), repo.classMembers(classes.map((c) => c.id))])
  const classNames = new Map<string, string[]>()
  const joined = new Map<string, Date>()
  const members = new Map<string, string[]>()
  const className = new Map(classes.map((c) => [c.id, c.name]))
  for (const m of memberRows) {
    const list = classNames.get(m.studentId) ?? []
    list.push(className.get(m.classId) ?? '')
    classNames.set(m.studentId, list)
    const prev = joined.get(m.studentId)
    if (!prev || m.joinedAt < prev) joined.set(m.studentId, m.joinedAt)
    const ml = members.get(m.classId) ?? []
    ml.push(m.studentId)
    members.set(m.classId, ml)
  }
  const pupils: Pupil[] = ids
    .map((id) => ({ id, name: names.get(id) ?? `Murid ${id}`, classNames: classNames.get(id) ?? [], joinedAt: joined.get(id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name) || cmpId(a.id, b.id))
  return {
    viewer,
    teacherName: brief?.name ?? '',
    now,
    windows: guruWindows(now),
    pupils,
    ids,
    byId: new Map(pupils.map((p) => [p.id, p])),
    classes,
    members,
  }
}

export interface Count {
  answers: number
  correct: number
}

/** Per-pupil answer tallies of a window (current windows end at `now` inclusive; `prev*` windows end exclusive). */
export async function tallies(deps: GuruDeps, ctx: GuruContext, w?: Window, exclusiveTo = false): Promise<Map<string, UserTally>> {
  const f: AnswerFilter = { to: w?.to ?? ctx.now, studentIds: ctx.ids, includeInactive: true }
  if (w) f.from = w.from
  if (exclusiveTo) f.exclusiveTo = true
  return new Map((await deps.repo.answerTallyByUser(f)).map((t) => [t.userId, t]))
}

export function sum(map: Map<string, Count>, only?: Iterable<string>): Count {
  let answers = 0
  let correct = 0
  const keys = only ?? map.keys()
  for (const k of keys) {
    const t = map.get(k)
    if (!t) continue
    answers += t.answers
    correct += t.correct
  }
  return { answers, correct }
}

/** Distinct answer days per pupil inside the last 30 days (MYT day keys). */
export async function answerDaysOf(deps: GuruDeps, ctx: GuruContext): Promise<Map<string, Set<string>>> {
  const rows = await deps.repo.answerDays({ from: ctx.windows.d30.from, to: ctx.now, studentIds: ctx.ids, includeInactive: true })
  const out = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = out.get(r.userId) ?? new Set<string>()
    set.add(r.day)
    out.set(r.userId, set)
  }
  return out
}
