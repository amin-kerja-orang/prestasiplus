import { Inject, Injectable } from '@nestjs/common'

import { UsersRepository } from '../../users'

/** The only user fields a game response may carry (D54(d)): id, display name, grade, school id. Never e-mail, phone, IC. */
export interface GameUser {
  id: string
  name: string
  grade: number | null
  schoolId: string | null
}

/** Reads users through `UsersRepository` (the owner) and narrows them to the safe shape. */
@Injectable()
export class GameUsers {
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  async get(userId: string): Promise<GameUser | null> {
    const u = await this.users.get(userId)
    return u ? { id: u.id, name: u.name, grade: u.grade, schoolId: u.schoolId } : null
  }

  /** Unknown ids are skipped; the map is keyed by user id. */
  async getMany(userIds: readonly string[]): Promise<Map<string, GameUser>> {
    const rows = userIds.length === 0 ? [] : await this.users.getMany([...new Set(userIds)])
    return new Map(rows.map((u) => [u.id, { id: u.id, name: u.name, grade: u.grade, schoolId: u.schoolId }]))
  }
}
