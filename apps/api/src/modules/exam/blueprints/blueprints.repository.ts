import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import type { BlueprintWithSections } from './blueprint-view'

export interface SubjectRef {
  id: bigint
  code: string
  name: string
}

export interface NewBlueprintSection {
  label: string
  instruction: string | null
  ruleType: 'all' | 'choose'
  ruleN: number | null
  questionCount: number
  markBudget: number
  compulsory: boolean
  pool: string
}

export interface NewBlueprint {
  subjectId: bigint
  kertas: number
  version: number
  /** Database source code: verified, spec or draft. */
  source: string
  code: string
  durationMin: number
  instructions: string[]
  referenceSheets: Prisma.InputJsonValue
  totalMarks: number
  sections: NewBlueprintSection[]
}

export interface BlueprintListFilter {
  subjectId?: bigint
  kertas?: number
  skip: number
  take: number
}

const WITH_SECTIONS = { sections: { orderBy: { position: 'asc' } } } as const

/** Blueprint ("Kontrak") rows of BE-15's tables, for the admin writes of BE-39. Runs on the open transaction when there is one. */
@Injectable()
export class BlueprintsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** Curriculum subject of a curriculum code (the caller maps the Bijak code first). */
  subjectByCode(code: string): Promise<SubjectRef | null> {
    return this.db.subject.findUnique({ where: { code }, select: { id: true, code: true, name: true } })
  }

  subjectsByIds(ids: bigint[]): Promise<SubjectRef[]> {
    if (ids.length === 0) return Promise.resolve([])
    return this.db.subject.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } })
  }

  /** The active row of (subject, kertas), any source. */
  active(subjectId: bigint, kertas: number): Promise<BlueprintWithSections | null> {
    return this.db.blueprint.findFirst({ where: { subjectId, kertas, status: 'active' }, include: WITH_SECTIONS })
  }

  async hasRows(subjectId: bigint, kertas: number): Promise<boolean> {
    return (await this.db.blueprint.count({ where: { subjectId, kertas } })) > 0
  }

  async maxVersion(subjectId: bigint, kertas: number): Promise<number> {
    const agg = await this.db.blueprint.aggregate({ where: { subjectId, kertas }, _max: { version: true } })
    return agg._max.version ?? 0
  }

  /** `FOR UPDATE` on one blueprint row (call inside a transaction). */
  async lock(id: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM blueprints WHERE id = ${id} FOR UPDATE`
    return rows.length > 0
  }

  /** The row re-read after the lock (status as of now). */
  byId(id: bigint): Promise<BlueprintWithSections | null> {
    return this.db.blueprint.findUnique({ where: { id }, include: WITH_SECTIONS })
  }

  setStatus(id: bigint, status: 'active' | 'retired', at: Date): Promise<unknown> {
    return this.db.blueprint.update({ where: { id }, data: { status, updatedAt: at } })
  }

  insertActive(input: NewBlueprint, at: Date): Promise<BlueprintWithSections> {
    return this.db.blueprint.create({
      data: {
        subjectId: input.subjectId,
        kertas: input.kertas,
        code: input.code,
        version: input.version,
        status: 'active',
        source: input.source,
        durationMin: input.durationMin,
        totalMarks: input.totalMarks,
        instructions: input.instructions,
        referenceSheets: input.referenceSheets,
        createdAt: at,
        updatedAt: at,
        sections: {
          create: input.sections.map((s, i) => ({
            position: i + 1,
            label: s.label,
            instruction: s.instruction,
            ruleType: s.ruleType,
            ruleN: s.ruleN,
            questionCount: s.questionCount,
            markBudget: s.markBudget,
            compulsory: s.compulsory,
            pool: s.pool,
          })),
        },
      },
      include: WITH_SECTIONS,
    })
  }

  /** Active, non-Draf blueprints, id ascending, with the total for the paging meta. */
  async listActive(f: BlueprintListFilter): Promise<{ rows: BlueprintWithSections[]; total: number }> {
    const where: Prisma.BlueprintWhereInput = {
      status: 'active',
      source: { not: 'draft' },
      ...(f.subjectId !== undefined ? { subjectId: f.subjectId } : {}),
      ...(f.kertas !== undefined ? { kertas: f.kertas } : {}),
    }
    const [rows, total] = await Promise.all([
      this.db.blueprint.findMany({ where, orderBy: { id: 'asc' }, skip: f.skip, take: f.take, include: WITH_SECTIONS }),
      this.db.blueprint.count({ where }),
    ])
    return { rows, total }
  }
}
