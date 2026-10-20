import { Inject, Injectable } from '@nestjs/common'
import {
  SCHOOL_ADMIN_FLASH,
  type SchoolAdminPupilCreatedResult,
  type SchoolAdminPupilFormOptions,
  type SchoolAdminPupilListResponse,
  type SchoolAdminResetResult,
  type SchoolAdminUserWriteResult,
} from '@pp/contract'

import { ClassesRepository } from '../../classes'
import type { UserRecord } from '../../users'
import { ManagedUsersService, PUPIL_KIND, type PeopleCtx } from './managed-users.service'
import { parsePupilCreate } from './people.input'
import { toPupilRow } from './people.mapper'
import { parseExportQuery, parseListQuery } from './people.query'

const byName = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, 'ms') || (BigInt(a.id) < BigInt(b.id) ? -1 : 1)

/** Pupils of the school (BE-21 Part A, 7 routes). The rules live in `ManagedUsersService`; this adds classes and the form options. */
@Injectable()
export class PupilsService {
  constructor(
    @Inject(ManagedUsersService) private readonly managed: ManagedUsersService,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  /** Names of the ACTIVE classes (both kinds) each pupil is actively enrolled in: two batch reads, however many pupils. */
  private async classNamesOf(users: readonly UserRecord[]): Promise<Map<string, string[]>> {
    const ids = users.map((u) => u.id)
    const classIdsByPupil = await this.classes.classIdsOfStudents(ids)
    const all = [...new Set([...classIdsByPupil.values()].flat())]
    const active = new Map((await this.classes.byIds(all)).filter((c) => c.isActive).map((c) => [c.id, c]))
    return new Map(
      ids.map((id) => [
        id,
        (classIdsByPupil.get(id) ?? [])
          .flatMap((cid) => {
            const c = active.get(cid)
            return c ? [c] : []
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'ms') || (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
          .map((c) => c.name),
      ]),
    )
  }

  async list(ctx: PeopleCtx, query: Record<string, unknown>): Promise<SchoolAdminPupilListResponse> {
    const page = await this.managed.list(ctx, PUPIL_KIND, parseListQuery(query))
    const names = await this.classNamesOf(page.rows)
    return { data: page.rows.map((u) => toPupilRow(u, names.get(u.id) ?? [])), ...this.managed.listEnvelope(page) }
  }

  /** The school and its active classrooms A to Z: the valid targets of `classId`. No password field exists. */
  async formOptions(ctx: PeopleCtx): Promise<SchoolAdminPupilFormOptions> {
    const school = await this.managed.schoolOf(ctx)
    const classes = (await this.classes.schoolClasses(ctx.actor.schoolId))
      .filter((c) => c.kind === 'classroom' && c.isActive)
      .sort(byName)
      .map((c) => ({ id: c.id, name: c.name }))
    return { school: this.managed.schoolInfo(school), classes }
  }

  async exportCsv(ctx: PeopleCtx, query: Record<string, unknown>): Promise<{ csv: string; fileName: string }> {
    const { users, school, fileName } = await this.managed.exportRows(ctx, PUPIL_KIND, parseExportQuery(query))
    const names = await this.classNamesOf(users)
    return { csv: this.managed.csvOf(PUPIL_KIND, users, school.name, (u) => (names.get(u.id) ?? []).join(', ')), fileName }
  }

  detail(ctx: PeopleCtx, id: string) {
    return this.managed.detail(ctx, PUPIL_KIND, id)
  }

  async create(ctx: PeopleCtx, body: unknown): Promise<SchoolAdminPupilCreatedResult> {
    const parsed = parsePupilCreate(body)
    const created = await this.managed.create(
      ctx,
      PUPIL_KIND,
      { fields: parsed.fields, value: parsed.value ? { name: parsed.value.name, email: parsed.value.email, phone: null } : null },
      parsed.value?.classId ?? null,
    )
    return { ...created, status: SCHOOL_ADMIN_FLASH.pupilCreated(created.credential.name) }
  }

  async update(ctx: PeopleCtx, id: string, body: unknown): Promise<SchoolAdminUserWriteResult> {
    return { data: await this.managed.update(ctx, PUPIL_KIND, id, body), status: SCHOOL_ADMIN_FLASH.updated }
  }

  resetPassword(ctx: PeopleCtx, id: string, body: unknown): Promise<SchoolAdminResetResult> {
    return this.managed.resetPassword(ctx, PUPIL_KIND, id, body)
  }
}
