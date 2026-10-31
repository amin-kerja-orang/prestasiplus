import { Inject, Injectable } from '@nestjs/common'

import type { Blueprint, BlueprintSection, Paper, PaperPlacement, PaperSection, Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'

export type PaperTree = Paper & { sections: (PaperSection & { placements: PaperPlacement[] })[] }
export type BlueprintWithSections = Blueprint & { sections: BlueprintSection[] }

export interface SubjectRef {
  id: bigint
  code: string
  name: string
}

export interface NewPaperSection {
  label: string
  instruction: string | null
  ruleType: 'all' | 'choose'
  ruleN: number | null
  questionCount: number
  markBudget: number
  compulsory: boolean
  /** R1-T48: copied as is when a paper is cloned; false otherwise. */
  adminCreated?: boolean
}

export interface NewPaper {
  title: string
  subjectId: bigint
  kertas: number
  year: number
  paperCode: string
  printedDurationMin: number
  instructions: string[]
  referenceSheets: Prisma.InputJsonValue
  blueprintId: bigint
  createdById: bigint
  isTest: boolean
  sections: NewPaperSection[]
}

const TREE = {
  sections: { orderBy: { position: 'asc' as const }, include: { placements: { orderBy: { position: 'asc' as const } } } },
}

/**
 * The only doorway of the paper builder to papers, sections, placements, blueprints and subjects
 * (M28). It never reads question tables: questions come through `BijakBuilderPorts`. Only curated
 * (`pilihan`) papers are visible; a generated (`jana`) paper does not exist here.
 */
@Injectable()
export class BuilderRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** `select ... for update` on the paper row; call inside the open transaction. */
  async lockPaper(id: bigint): Promise<void> {
    await this.prisma.client.$queryRaw`select id from papers where id = ${id} and kind = 'pilihan' for update`
  }

  /** `select ... for update` on a blueprint row; call inside the open transaction. */
  async lockBlueprint(id: bigint): Promise<void> {
    await this.prisma.client.$queryRaw`select id from blueprints where id = ${id} for update`
  }

  findPilihan(id: bigint): Promise<PaperTree | null> {
    return this.prisma.client.paper.findFirst({ where: { id, kind: 'pilihan' }, include: TREE })
  }

  countPilihan(statuses: readonly string[] | undefined): Promise<number> {
    return this.prisma.client.paper.count({ where: this.listWhere(statuses) })
  }

  listPilihan(statuses: readonly string[] | undefined, skip: number, take: number): Promise<PaperTree[]> {
    return this.prisma.client.paper.findMany({
      where: this.listWhere(statuses),
      include: TREE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    })
  }

  private listWhere(statuses: readonly string[] | undefined): Prisma.PaperWhereInput {
    return { kind: 'pilihan', ...(statuses ? { status: { in: [...statuses] } } : {}) }
  }

  async subjectsByIds(ids: readonly bigint[]): Promise<Map<string, SubjectRef>> {
    if (ids.length === 0) return new Map()
    const rows = await this.prisma.client.subject.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, code: true, name: true },
    })
    return new Map(rows.map((r) => [r.id.toString(), r]))
  }

  subjectByCode(code: string): Promise<SubjectRef | null> {
    return this.prisma.client.subject.findUnique({ where: { code }, select: { id: true, code: true, name: true } })
  }

  /** The active blueprint row of a subject and kertas (any source), or null. */
  activeBlueprint(subjectId: bigint, kertas: number): Promise<BlueprintWithSections | null> {
    return this.prisma.client.blueprint.findFirst({
      where: { subjectId, kertas, status: 'active' },
      include: { sections: { orderBy: { position: 'asc' } } },
    })
  }

  /** A blueprint row (any status) by id: the version a paper conforms to. */
  blueprintById(id: bigint): Promise<BlueprintWithSections | null> {
    return this.prisma.client.blueprint.findUnique({ where: { id }, include: { sections: { orderBy: { position: 'asc' } } } })
  }

  async createPaper(input: NewPaper): Promise<bigint> {
    const row = await this.prisma.client.paper.create({
      data: {
        kind: 'pilihan',
        title: input.title,
        subjectId: input.subjectId,
        kertas: input.kertas,
        year: input.year,
        paperCode: input.paperCode,
        printedDurationMin: input.printedDurationMin,
        instructions: input.instructions,
        referenceSheets: input.referenceSheets,
        blueprintId: input.blueprintId,
        status: 'draft',
        version: 1,
        isTest: input.isTest,
        createdById: input.createdById,
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
            adminCreated: s.adminCreated ?? false,
          })),
        },
      },
      select: { id: true },
    })
    return row.id
  }

  async updatePaper(id: bigint, data: Prisma.PaperUncheckedUpdateInput): Promise<void> {
    await this.prisma.client.paper.update({ where: { id }, data })
  }

  /**
   * Replaces the placements of one section (positions 1..n). The Nombor soalan of R1-T48 survives a replace: `numberLabel` is the given one,
   * else the one the question already had in this section.
   */
  async replacePlacements(sectionId: bigint, placements: readonly { questionId: bigint; pinnedVersionNo: number; numberLabel?: string | null }[]): Promise<void> {
    const kept = new Map(
      (await this.prisma.client.paperPlacement.findMany({ where: { paperSectionId: sectionId }, select: { questionId: true, numberLabel: true } })).map((r) => [r.questionId.toString(), r.numberLabel]),
    )
    await this.prisma.client.paperPlacement.deleteMany({ where: { paperSectionId: sectionId } })
    if (placements.length === 0) return
    await this.prisma.client.paperPlacement.createMany({
      data: placements.map((p, i) => ({
        paperSectionId: sectionId,
        questionId: p.questionId,
        pinnedVersionNo: p.pinnedVersionNo,
        position: i + 1,
        numberLabel: p.numberLabel === undefined ? (kept.get(p.questionId.toString()) ?? null) : p.numberLabel,
        marksOverride: null,
      })),
    })
  }

  /** R1-T48 "Tambah bahagian": appends an admin-added Bahagian (rule Jawab Semua; its counts follow its placements). */
  async addSection(paperId: bigint, position: number, label: string): Promise<void> {
    await this.prisma.client.paperSection.create({
      data: { paperId, position, label, ruleType: 'all', ruleN: null, questionCount: 0, markBudget: 0, compulsory: false, adminCreated: true },
    })
  }

  /** Placements of a question on any paper (the "Padam soalan" check before a question is deleted from the bank). */
  placementCount(questionId: bigint): Promise<number> {
    return this.prisma.client.paperPlacement.count({ where: { questionId } })
  }

  /** The level of a question created inside a paper: the highest active upper-secondary level (SPM, Tingkatan 5), else the highest active secondary one. */
  async defaultQuestionLevelId(): Promise<bigint | null> {
    const upper = await this.prisma.client.educationLevel.findFirst({ where: { isActive: true, stage: 'upper_secondary' }, orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }], select: { id: true } })
    if (upper) return upper.id
    const secondary = await this.prisma.client.educationLevel.findFirst({ where: { isActive: true, stage: { not: 'primary' } }, orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }], select: { id: true } })
    return secondary?.id ?? null
  }

  /** Freezes the counts of an admin-added Bahagian at Terbit (the student side reads the stored values). */
  async setSectionFigures(id: bigint, questionCount: number, markBudget: number): Promise<void> {
    await this.prisma.client.paperSection.update({ where: { id }, data: { questionCount, markBudget } })
  }

  /** R1-T34: edits the label, instruction or compulsory flag of one section. */
  async updateSection(id: bigint, data: Prisma.PaperSectionUncheckedUpdateInput): Promise<void> {
    await this.prisma.client.paperSection.update({ where: { id }, data })
  }

  /** The given references (public token or decimal id) that name a stored question image. */
  async existingImages(refs: readonly string[]): Promise<Set<string>> {
    const unique = [...new Set(refs)]
    const ids = unique.filter((r) => /^[1-9][0-9]{0,17}$/.test(r)).map((r) => BigInt(r))
    const rows = await this.prisma.client.file.findMany({
      where: { purpose: 'question_image', OR: [{ publicId: { in: unique } }, ...(ids.length > 0 ? [{ id: { in: ids } }] : [])] },
      select: { id: true, publicId: true },
    })
    return new Set(rows.flatMap((r) => [r.publicId, r.id.toString()]))
  }

  async pinPlacement(id: bigint, pinnedVersionNo: number, marksOverride: number): Promise<void> {
    await this.prisma.client.paperPlacement.update({ where: { id }, data: { pinnedVersionNo, marksOverride } })
  }

  async clearOverrides(paperId: bigint): Promise<void> {
    await this.prisma.client.paperPlacement.updateMany({
      where: { section: { paperId } },
      data: { marksOverride: null },
    })
  }

  async deletePaper(id: bigint): Promise<void> {
    await this.prisma.client.paper.delete({ where: { id } })
  }
}
