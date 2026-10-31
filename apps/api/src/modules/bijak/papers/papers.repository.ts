import { Inject, Injectable } from '@nestjs/common'

import type { Blueprint, BlueprintSection, Paper, PaperPlacement, PaperSection, Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'

export type { Blueprint, BlueprintSection, Paper, PaperPlacement, PaperSection }

export type PaperWithTree = Paper & { sections: (PaperSection & { placements: PaperPlacement[] })[] }
export type BlueprintWithSections = Blueprint & { sections: BlueprintSection[] }

export interface SubjectRef {
  id: bigint
  code: string
  name: string
}

export interface NewPlacement {
  questionId: bigint
  pinnedVersionNo: number
}

export interface NewSection {
  label: string
  instruction: string | null
  ruleType: 'all' | 'choose'
  ruleN: number | null
  questionCount: number
  markBudget: number
  compulsory: boolean
  placements: NewPlacement[]
}

export interface NewJanaPaper {
  title: string
  subjectId: bigint
  kertas: number
  year: number
  paperCode: string
  printedDurationMin: number
  instructions: string[]
  referenceSheets: Prisma.InputJsonValue
  blueprintId: bigint
  userId: bigint
  isTest: boolean
  publishedAt: Date
  sections: NewSection[]
}

const TREE = {
  sections: { orderBy: { position: 'asc' as const }, include: { placements: { orderBy: { position: 'asc' as const } } } },
}

/**
 * The only doorway to papers, sections, placements and blueprints (M28). Reads are ordered by id /
 * position so lists are stable. Questions are not read here: they belong to M04 (see `ports.ts`).
 * `subjects` (M03) is read for the code and name only.
 */
@Injectable()
export class PapersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Published curated papers (Kertas Pilihan), oldest first. */
  listPublishedPilihan(): Promise<PaperWithTree[]> {
    return this.prisma.client.paper.findMany({
      where: { kind: 'pilihan', status: 'published' },
      include: TREE,
      orderBy: { id: 'asc' },
    })
  }

  findPaper(id: bigint): Promise<PaperWithTree | null> {
    return this.prisma.client.paper.findUnique({ where: { id }, include: TREE })
  }

  /** Active blueprints (one per subject and kertas), oldest first. */
  listActiveBlueprints(): Promise<BlueprintWithSections[]> {
    return this.prisma.client.blueprint.findMany({
      where: { status: 'active' },
      include: { sections: { orderBy: { position: 'asc' } } },
      orderBy: { id: 'asc' },
    })
  }

  findActiveBlueprint(subjectId: bigint, kertas: number): Promise<BlueprintWithSections | null> {
    return this.prisma.client.blueprint.findFirst({
      where: { subjectId, kertas, status: 'active' },
      include: { sections: { orderBy: { position: 'asc' } } },
    })
  }

  /** The version students generate from (BJS-02 `serves_students`): may be a retired row while a Spec head is edited. */
  findServingBlueprint(subjectId: bigint, kertas: number): Promise<BlueprintWithSections | null> {
    return this.prisma.client.blueprint.findFirst({
      where: { subjectId, kertas, servesStudents: true, source: 'verified' },
      include: { sections: { orderBy: { position: 'asc' } } },
    })
  }

  /** Every row students generate from (`serves_students`, Disahkan); the key set of `canGenerate` (N1). */
  listServingBlueprints(): Promise<Pick<Blueprint, 'subjectId' | 'kertas'>[]> {
    return this.prisma.client.blueprint.findMany({
      where: { servesStudents: true, source: 'verified' },
      select: { subjectId: true, kertas: true },
    })
  }

  async subjectsByIds(ids: readonly bigint[]): Promise<Map<string, SubjectRef>> {
    if (ids.length === 0) return new Map()
    const rows = await this.prisma.client.subject.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, code: true, name: true },
    })
    return new Map(rows.map((r) => [r.id.toString(), r]))
  }

  async subjectByCode(code: string): Promise<SubjectRef | null> {
    return this.prisma.client.subject.findUnique({ where: { code }, select: { id: true, code: true, name: true } })
  }

  /** Subjects with an active blueprint or a published curated paper, in curriculum order. */
  async hubSubjects(): Promise<SubjectRef[]> {
    const [bp, papers] = await Promise.all([
      this.prisma.client.blueprint.findMany({ where: { status: 'active' }, select: { subjectId: true } }),
      this.prisma.client.paper.findMany({ where: { kind: 'pilihan', status: 'published' }, select: { subjectId: true } }),
    ])
    const ids = [...bp, ...papers].map((r) => r.subjectId)
    if (ids.length === 0) return []
    return this.prisma.client.subject.findMany({
      where: { id: { in: [...new Set(ids)] }, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
  }

  countJanaPapers(userId: bigint): Promise<number> {
    return this.prisma.client.paper.count({ where: { kind: 'jana', generatedForUserId: userId } })
  }

  /** Inserts a generated paper with its sections and placements in one transaction; returns its id. */
  async createJanaPaper(input: NewJanaPaper): Promise<bigint> {
    return this.prisma.transaction(async (tx) => {
      const paper = await tx.paper.create({
        data: {
          kind: 'jana',
          title: input.title,
          subjectId: input.subjectId,
          kertas: input.kertas,
          year: input.year,
          paperCode: input.paperCode,
          printedDurationMin: input.printedDurationMin,
          instructions: input.instructions,
          referenceSheets: input.referenceSheets,
          blueprintId: input.blueprintId,
          status: 'published',
          version: 1,
          generatedForUserId: input.userId,
          isTest: input.isTest,
          publishedAt: input.publishedAt,
          createdById: input.userId,
        },
        select: { id: true },
      })
      let position = 0
      for (const s of input.sections) {
        position += 1
        await tx.paperSection.create({
          data: {
            paperId: paper.id,
            position,
            label: s.label,
            instruction: s.instruction,
            ruleType: s.ruleType,
            ruleN: s.ruleN,
            questionCount: s.questionCount,
            markBudget: s.markBudget,
            compulsory: s.compulsory,
            placements: {
              create: s.placements.map((p, i) => ({
                questionId: p.questionId,
                pinnedVersionNo: p.pinnedVersionNo,
                position: i + 1,
              })),
            },
          },
        })
      }
      return paper.id
    })
  }
}
