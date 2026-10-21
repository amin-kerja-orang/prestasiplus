import { Inject, Injectable } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'

import { ClassesRepository } from '../../classes'
import { GameUsers } from './game-users'
import { type NamedPupil, type NameViewer, type ShownPupil, canSeeName, displayName, shownPupil } from './name-privacy'

/** The viewer of a request, with the scope loaded once (never per row). */
export class NameResolver {
  constructor(private readonly viewer: NameViewer) {}

  canSee(pupil: Pick<NamedPupil, 'id' | 'schoolId'>): boolean {
    return canSeeName(this.viewer, pupil)
  }

  shown(pupil: NamedPupil): ShownPupil {
    return shownPupil(this.viewer, pupil)
  }

  /** The name only (rows that carry no user id, such as a host or a creator). */
  name(pupil: NamedPupil): string {
    return pupil.isPupil === false || this.canSee(pupil) ? pupil.name : displayName(pupil.name)
  }
}

/**
 * Builds the `NameResolver` of a caller. One user read for a school admin (the school) and one classes read for a
 * teacher (`ClassesRepository.teacherStudentIds`: distinct active pupils of the teacher's active classes); nothing
 * is loaded for the other roles.
 */
@Injectable()
export class NamePrivacy {
  constructor(
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  async resolver(caller: { userId: string; role: RoleCode }): Promise<NameResolver> {
    let schoolId: string | null = null
    let own: ReadonlySet<string> = new Set()
    if (caller.role === 'school_admin') schoolId = (await this.users.get(caller.userId))?.schoolId ?? null
    else if (caller.role === 'teacher') own = new Set(await this.classes.teacherStudentIds(caller.userId))
    return new NameResolver({ role: caller.role, userId: caller.userId, schoolId, ownPupilIds: own })
  }
}
