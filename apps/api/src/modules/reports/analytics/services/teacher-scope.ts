import { ClassesRepository, type ClassRecord } from '../../../classes'
import type { Ctx } from './scope'

/** The viewer's own active classes (BR-M11-01); the admin has none. */
export async function ownClasses(classes: ClassesRepository, ctx: Ctx): Promise<ClassRecord[]> {
  if (ctx.role !== 'teacher') return []
  return (await classes.forTeacher(ctx.userId)).filter((c) => c.kind === 'classroom' && c.isActive)
}

export const classOptions = (own: readonly ClassRecord[]): { id: string; name: string }[] => own.map((c) => ({ id: c.id, name: c.name }))

/**
 * The pupils of an S1 / S6 scope. A `classroomId` that is not an own class is ignored on S1 (the "Semua Kelas"
 * population) and gives an empty scope on S6 (FR-M11-79): `ignoreUnknown` selects which.
 */
export async function populationOf(
  classes: ClassesRepository,
  ctx: Ctx,
  own: readonly ClassRecord[],
  classroomId: string | undefined,
  ignoreUnknown: boolean,
): Promise<{ classroom: ClassRecord | null; ids: string[] }> {
  if (own.length === 0) return { classroom: null, ids: [] }
  if (classroomId !== undefined && classroomId !== '') {
    const mine = own.find((c) => c.id === classroomId)
    if (mine) return { classroom: mine, ids: await classes.memberIds(mine.id) }
    if (!ignoreUnknown) return { classroom: null, ids: [] }
  }
  return { classroom: null, ids: await classes.teacherStudentIds(ctx.userId) }
}
