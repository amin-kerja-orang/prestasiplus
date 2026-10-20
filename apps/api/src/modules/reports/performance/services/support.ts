import { viewerSchoolId } from '../domain/access-policy'
import { DEFAULT_CLASS_COLOR } from '../domain/constants'
import { compareIds } from '../domain/rules'
import type { ClassInfo, DirectoryPort, PerformancePorts } from '../ports'
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
