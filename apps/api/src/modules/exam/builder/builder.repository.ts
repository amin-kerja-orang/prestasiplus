import { Inject, Injectable } from '@nestjs/common'

import type { Blueprint, BlueprintSection, Paper, PaperPlacement, PaperSection, Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import { storedReferenceImages, writableReferenceSheet } from '../reference-images'

export type PaperTree = Paper & { sections: (PaperSection & { placements: PaperPlacement[] })[] }
export type BlueprintWithSections = Blueprint & { sections: BlueprintSection[] }

/** R12: optional list filters. `subjectId` narrows to one subject; `search` is a substring of the title or the paper code. */
export interface PaperListFilter {
  subjectId?: bigint
  search?: string
}

export interface SubjectRef {
  id: bigint
  code: string
  name: string
}

export interface NewPaperSection {
  /** 1-based. Omitted: the list order. A scaled set keeps the position of the Kontrak section it comes from (S3-T02). */
  position?: number
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
  /** S3-T02 `Dilihat murid`; null (not restricted) only for a copy of a paper older than PO decision item 6, and for a paper a seed writes. */
  levelScope?: string | null
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

  /**
   * `select ... for share` on the placed question rows, in id order (no deadlock between two Terbit). A concurrent hard delete
   * (`questions` row `for update`) then waits until this transaction ends and sees the paper as held (409).
   * Call inside the open transaction.
   */
  async lockQuestionsShared(ids: readonly bigint[]): Promise<void> {
    if (ids.length === 0) return
    const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    await this.prisma.client.$queryRaw`select id from questions where id = any(${sorted}::bigint[]) order by id for share`
  }

  findPilihan(id: bigint): Promise<PaperTree | null> {
    return this.prisma.client.paper.findFirst({ where: { id, kind: 'pilihan' }, include: TREE })
  }

  countPilihan(statuses: readonly string[] | undefined, filter?: PaperListFilter): Promise<number> {
    return this.prisma.client.paper.count({ where: this.listWhere(statuses, filter) })
  }

  listPilihan(statuses: readonly string[] | undefined, skip: number, take: number, filter?: PaperListFilter): Promise<PaperTree[]> {
    return this.prisma.client.paper.findMany({
      where: this.listWhere(statuses, filter),
      include: TREE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    })
  }

  private listWhere(statuses: readonly string[] | undefined, filter?: PaperListFilter): Prisma.PaperWhereInput {
    // `contains` passes the text to LIKE unescaped, so a typed % or _ would match everything: escape them (backslash is the LIKE default).
    const search = filter?.search?.replace(/[\\%_]/g, (c) => `\\${c}`)
    return {
      kind: 'pilihan',
      ...(statuses ? { status: { in: [...statuses] } } : {}),
      ...(filter?.subjectId !== undefined ? { subjectId: filter.subjectId } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { paperCode: { contains: search, mode: 'insensitive' } }] } : {}),
    }
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

  /** One version of a Kontrak (any status), or null. */
  blueprintVersion(subjectId: bigint, kertas: number, version: number): Promise<BlueprintWithSections | null> {
    return this.prisma.client.blueprint.findFirst({
      where: { subjectId, kertas, version },
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
        levelScope: input.levelScope ?? null,
        status: 'draft',
        version: 1,
        isTest: input.isTest,
        createdById: input.createdById,
        sections: {
          create: input.sections.map((s, i) => ({
            position: s.position ?? i + 1,
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

  /**
   * True when the question has ever been served: it has a live version, or any version that is, or was, approved (an archived one was approved before).
   * "Padam soalan" never deletes such a question from the bank, whatever its newest version reads (R1-T48 pre-review: approve, then a new Draf v2).
   */
  async hasBeenApproved(questionId: bigint): Promise<boolean> {
    const q = await this.prisma.client.question.findUnique({ where: { id: questionId }, select: { liveVersionNo: true } })
    if (q?.liveVersionNo != null) return true
    const n = await this.prisma.client.questionVersion.count({ where: { questionId, status: { in: ['approved', 'archived'] } } })
    return n > 0
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

  /** See `exam/reference-images`: the sheet to store for a write by this admin, or null when a picture is refused. */
  writableSheet<P extends { imageFileId?: string | undefined }>(sheet: readonly P[], ownerUserId: bigint, onPaper: readonly string[]): Promise<P[] | null> {
    return writableReferenceSheet(this.prisma.client, sheet, ownerUserId, onPaper)
  }

  /** The refs that are a token naming a stored question image uploaded by an admin: the re-check at Terbit. */
  storedImages(refs: readonly string[]): Promise<Set<string>> {
    return storedReferenceImages(this.prisma.client, refs)
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
