import { Inject, Injectable } from '@nestjs/common'
import {
  SCHOOL_ADMIN_FLASH,
  type SchoolAdminResetResult,
  type SchoolAdminTeacherCreatedResult,
  type SchoolAdminTeacherListResponse,
  type SchoolAdminToggleActiveResult,
  type SchoolAdminUserWriteResult,
} from '@pp/contract'

import { ClassesRepository } from '../../classes'
import { ManagedUsersService, TEACHER_KIND, type PeopleCtx } from './managed-users.service'
import { parseTeacherCreate } from './people.input'
import { toTeacherRow } from './people.mapper'
import { parseExportQuery, parseListQuery } from './people.query'

/** Teachers of the school (BE-21 Part A, 7 routes). The rules live in `ManagedUsersService`; this adds the teacher-only parts. */
@Injectable()
export class TeachersService {
  constructor(
    @Inject(ManagedUsersService) private readonly managed: ManagedUsersService,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  async list(ctx: PeopleCtx, query: Record<string, unknown>): Promise<SchoolAdminTeacherListResponse> {
    const page = await this.managed.list(ctx, TEACHER_KIND, parseListQuery(query))
    // Active classes owned, from ONE read of the school's classes (not one query per teacher).
    const owned = new Map<string, number>()
    for (const c of await this.classes.schoolClasses(ctx.actor.schoolId)) {
      if (c.isActive && c.teacherId !== null) owned.set(c.teacherId, (owned.get(c.teacherId) ?? 0) + 1)
    }
    return { data: page.rows.map((u) => toTeacherRow(u, owned.get(u.id) ?? 0)), ...this.managed.listEnvelope(page) }
  }

  async exportCsv(ctx: PeopleCtx, query: Record<string, unknown>): Promise<{ csv: string; fileName: string }> {
    const { users, school, fileName } = await this.managed.exportRows(ctx, TEACHER_KIND, parseExportQuery(query))
    return { csv: this.managed.csvOf(TEACHER_KIND, users, school.name, () => ''), fileName }
  }

  detail(ctx: PeopleCtx, id: string) {
    return this.managed.detail(ctx, TEACHER_KIND, id)
  }

  async create(ctx: PeopleCtx, body: unknown): Promise<SchoolAdminTeacherCreatedResult> {
    const created = await this.managed.create(ctx, TEACHER_KIND, parseTeacherCreate(body), null)
    return { ...created, status: SCHOOL_ADMIN_FLASH.created }
  }

  async update(ctx: PeopleCtx, id: string, body: unknown): Promise<SchoolAdminUserWriteResult> {
    return { data: await this.managed.update(ctx, TEACHER_KIND, id, body), status: SCHOOL_ADMIN_FLASH.updated }
  }

  async toggle(ctx: PeopleCtx, id: string): Promise<SchoolAdminToggleActiveResult> {
    return { data: await this.managed.toggle(ctx, TEACHER_KIND, id), status: SCHOOL_ADMIN_FLASH.statusToggled }
  }

  resetPassword(ctx: PeopleCtx, id: string, body: unknown): Promise<SchoolAdminResetResult> {
    return this.managed.resetPassword(ctx, TEACHER_KIND, id, body)
  }
}
