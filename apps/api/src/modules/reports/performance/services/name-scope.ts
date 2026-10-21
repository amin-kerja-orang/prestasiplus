import type { RoleCode } from '@pp/contract'

import type { ClassesReadPort, DirectoryPort } from '../ports'

/** Pupils (among the listed ones) whose names the viewer may see beyond the own row; see `canSeeName`. */
export interface NameScope {
  ownPupils: ReadonlySet<string>
  schoolPupils: ReadonlySet<string>
}

const NONE: NameScope = { ownPupils: new Set(), schoolPupils: new Set() }

/**
 * Resolves the `canSeeName` scope of a viewer for the pupils of one response, in a fixed number of batch
 * reads (no N+1): a teacher = members of the own ACTIVE classes (2 reads); a school admin = listed pupils of
 * the own school (2 reads); admin, student and officer need none.
 */
export async function resolveNameScope(
  viewer: { userId: string; role: RoleCode },
  pupilIds: readonly string[],
  classes: ClassesReadPort,
  directory: DirectoryPort,
): Promise<NameScope> {
  if (pupilIds.length === 0) return NONE
  if (viewer.role === 'teacher') {
    const own = await classes.classesForTeacher(viewer.userId)
    if (own.length === 0) return NONE
    const members = await classes.membersOf(own.map((c) => c.id))
    return { ownPupils: new Set([...members.values()].flat()), schoolPupils: new Set() }
  }
  if (viewer.role === 'school_admin') {
    const users = await directory.users([viewer.userId, ...pupilIds])
    const school = users.get(viewer.userId)?.schoolId ?? null
    if (school === null) return NONE
    const inSchool = pupilIds.filter((id) => {
      const u = users.get(id)
      return u !== undefined && u.isStudent && u.schoolId === school
    })
    return { ownPupils: new Set(), schoolPupils: new Set(inSchool) }
  }
  return NONE
}
