import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import type { BlueprintEvidence, BlueprintVerification } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import type { UnitInfo } from './blueprint-standard'
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
  pool: string | null
  allowedModes: string[]
  /** Json documents; null = SQL NULL. */
  profile: Prisma.InputJsonValue | null
  quota: Prisma.InputJsonValue | null
  kbatMarks: number | null
  kbatReviewed: boolean
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
  notes: string | null
  subPartRamp: boolean
  kbatMarks: number | null
  levelShare: Prisma.InputJsonValue | null
  structureHash: string
  /** Set only by a carried (cosmetic) verified version; the client can never cause it. */
  verificationId?: bigint | null
  servesStudents?: boolean
  sections: NewBlueprintSection[]
}

export interface NewEvidence {
  blueprintId: bigint
  kind: string
  body: string
  year: number
  paperCode: string
  setLabel: string | null
  sourceRef: string | null
  values: Prisma.InputJsonValue
  origin: 'study' | 'admin'
  note: string | null
  createdById: bigint | null
  createdAt?: Date
}

export interface NewVerification {
  blueprintId: bigint
  verifiedById: bigint
  note: string | null
  structureHash: string
  checkResult: Prisma.InputJsonValue
  evidenceSnapshot: Prisma.InputJsonValue
  verifiedAt: Date
}

export interface BlueprintListFilter {
  subjectId?: bigint
  kertas?: number
  skip: number
  take: number
}

export interface SubjectKertas {
  subjectId: bigint
  kertas: number
}

const WITH_SECTIONS = { sections: { orderBy: { position: 'asc' } } } as const

const jsonOrNull = (v: Prisma.InputJsonValue | null) => (v === null ? Prisma.JsonNull : v)

/** Blueprint ("Kontrak") rows of BE-15's tables, for the admin writes of BE-39 and BJS-08/09. Runs on the open transaction when there is one. */
@Injectable()
export class BlueprintsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /* ------------------------------------------------------------------------------- subjects */

  /** Curriculum subject of a curriculum code (the caller maps the Bijak code first). */
  subjectByCode(code: string): Promise<SubjectRef | null> {
    return this.db.subject.findUnique({ where: { code }, select: { id: true, code: true, name: true } })
  }

  subjectsByIds(ids: bigint[]): Promise<SubjectRef[]> {
    if (ids.length === 0) return Promise.resolve([])
    return this.db.subject.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } })
  }

  /** Every active subject (architecture 15.2), by display order then name. */
  activeSubjects(): Promise<SubjectRef[]> {
    return this.db.subject.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true },
    })
  }

  /* -------------------------------------------------------------------------- DSKP units */

  private unitInfo(n: {
    id: bigint
    code: string
    title: string
    educationLevel: { code: string }
  }): UnitInfo | null {
    const level = n.educationLevel.code
    return level === 'T4' || level === 'T5' ? { nodeId: n.id.toString(), code: n.code, level, title: n.title } : null
  }

  /** Units (kind unit) of a subject at T4 and T5, by `sortOrder` (architecture 15.1). */
  async unitsOfSubject(subjectId: bigint, level?: 'T4' | 'T5'): Promise<(UnitInfo & { elective: boolean })[]> {
    const rows = await this.db.curriculumNode.findMany({
      where: { subjectId, kind: 'unit', educationLevel: { code: level ?? { in: ['T4', 'T5'] } } },
      orderBy: [{ educationLevel: { code: 'asc' } }, { sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, title: true, isElective: true, educationLevel: { select: { code: true } } },
    })
    return rows.flatMap((r) => {
      const info = this.unitInfo(r)
      return info ? [{ ...info, elective: r.isElective }] : []
    })
  }

  /** Display fields of the units with these node ids (any subject). */
  async unitsByIds(ids: bigint[]): Promise<UnitInfo[]> {
    if (ids.length === 0) return []
    const rows = await this.db.curriculumNode.findMany({
      where: { id: { in: ids }, kind: 'unit' },
      select: { id: true, code: true, title: true, educationLevel: { select: { code: true } } },
    })
    return rows.flatMap((r) => {
      const info = this.unitInfo(r)
      return info ? [info] : []
    })
  }

  /* ------------------------------------------------------------------------- blueprint rows */

  /** The active row (the head) of (subject, kertas), any source. */
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

  /** The head of the pair, locked and re-read; null when none is active any more (call inside a transaction). */
  async lockActive(subjectId: bigint, kertas: number): Promise<BlueprintWithSections | null> {
    const seen = await this.active(subjectId, kertas)
    if (!seen) return null
    if (!(await this.lock(seen.id))) return null
    const fresh = await this.byId(seen.id)
    return fresh && fresh.status === 'active' ? fresh : null
  }

  /** The row re-read after the lock (status as of now). */
  byId(id: bigint): Promise<BlueprintWithSections | null> {
    return this.db.blueprint.findUnique({ where: { id }, include: WITH_SECTIONS })
  }

  /** Every version of (subject, kertas), newest first (the history). */
  versions(subjectId: bigint, kertas: number): Promise<BlueprintWithSections[]> {
    return this.db.blueprint.findMany({ where: { subjectId, kertas }, orderBy: { version: 'desc' }, include: WITH_SECTIONS })
  }

  /** Retires a row. A retired row keeps `serves_students` only when `keepServing` (a Spec head took over from it). */
  retireRow(id: bigint, at: Date, keepServing: boolean): Promise<unknown> {
    return this.db.blueprint.update({
      where: { id },
      data: { status: 'retired', updatedAt: at, ...(keepServing ? {} : { servesStudents: false }) },
    })
  }

  /** Retires every version of (subject, kertas) and clears the serving flag: the only way to stop serving (3.5 rule 6). */
  retireAll(subjectId: bigint, kertas: number, at: Date): Promise<unknown> {
    return this.db.blueprint.updateMany({
      where: { subjectId, kertas, OR: [{ status: { not: 'retired' } }, { servesStudents: true }] },
      data: { status: 'retired', servesStudents: false, updatedAt: at },
    })
  }

  /** Clears the serving flag on every other row of the pair (before it is set on the verified head: unique index). */
  clearServing(subjectId: bigint, kertas: number, exceptId: bigint, at: Date): Promise<unknown> {
    return this.db.blueprint.updateMany({
      where: { subjectId, kertas, servesStudents: true, id: { not: exceptId } },
      data: { servesStudents: false, updatedAt: at },
    })
  }

  /** Stores the canonical structural hash of a row that still holds a legacy (SQL backfill) value. */
  rehash(id: bigint, structureHash: string): Promise<unknown> {
    return this.db.blueprint.update({ where: { id }, data: { structureHash } })
  }

  /**
   * Spec -> Disahkan in place: `source`, `verification_id` and `serves_students` change in ONE update, because
   * the 0092 CHECKs (`source <> 'verified' OR verification_id IS NOT NULL` and the converse) hold per statement.
   */
  markVerified(id: bigint, verificationId: bigint, structureHash: string, at: Date): Promise<BlueprintWithSections> {
    return this.db.blueprint.update({
      where: { id },
      data: { source: 'verified', verificationId, servesStudents: true, structureHash, updatedAt: at },
      include: WITH_SECTIONS,
    })
  }

  /** Review stamp of one section: quota lines and KBAT value reviewed, in place (no content change, no hash change). */
  async stampSectionReviewed(blueprintId: bigint, position: number, quota: Prisma.InputJsonValue | null, at: Date): Promise<void> {
    await this.db.blueprintSection.update({
      where: { blueprintId_position: { blueprintId, position } },
      data: { kbatReviewed: true, ...(quota === null ? {} : { quota }) },
    })
    await this.db.blueprint.update({ where: { id: blueprintId }, data: { updatedAt: at } })
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
        notes: input.notes,
        subPartRamp: input.subPartRamp,
        kbatMarks: input.kbatMarks,
        levelShare: jsonOrNull(input.levelShare),
        structureHash: input.structureHash,
        verificationId: input.verificationId ?? null,
        servesStudents: input.servesStudents ?? false,
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
            allowedModes: s.allowedModes,
            profile: jsonOrNull(s.profile),
            quota: jsonOrNull(s.quota),
            kbatMarks: s.kbatMarks,
            kbatReviewed: s.kbatReviewed,
          })),
        },
      },
      include: WITH_SECTIONS,
    })
  }

  /** Active blueprints (the heads), id ascending, with the total for the paging meta. Draf heads are included (6.3). */
  async listActive(f: BlueprintListFilter): Promise<{ rows: BlueprintWithSections[]; total: number }> {
    const where: Prisma.BlueprintWhereInput = {
      status: 'active',
      ...(f.subjectId !== undefined ? { subjectId: f.subjectId } : {}),
      ...(f.kertas !== undefined ? { kertas: f.kertas } : {}),
    }
    const [rows, total] = await Promise.all([
      this.db.blueprint.findMany({ where, orderBy: { id: 'asc' }, skip: f.skip, take: f.take, include: WITH_SECTIONS }),
      this.db.blueprint.count({ where }),
    ])
    return { rows, total }
  }

  /* ------------------------------------------------------------------------------ view data */

  async evidenceCounts(blueprintIds: bigint[]): Promise<Map<bigint, number>> {
    if (blueprintIds.length === 0) return new Map()
    const groups = await this.db.blueprintEvidence.groupBy({
      by: ['blueprintId'],
      where: { blueprintId: { in: blueprintIds } },
      _count: { _all: true },
    })
    return new Map(groups.map((g) => [g.blueprintId, g._count._all]))
  }

  verificationsByIds(ids: bigint[]): Promise<BlueprintVerification[]> {
    if (ids.length === 0) return Promise.resolve([])
    return this.db.blueprintVerification.findMany({ where: { id: { in: ids } } })
  }

  async userNames(ids: bigint[]): Promise<Map<bigint, string>> {
    if (ids.length === 0) return new Map()
    const users = await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    return new Map(users.map((u) => [u.id, u.name]))
  }

  /** Version of the row with the serving flag, per (subject, kertas). */
  async servingVersions(pairs: SubjectKertas[]): Promise<Map<string, number>> {
    if (pairs.length === 0) return new Map()
    const rows = await this.db.blueprint.findMany({
      where: { servesStudents: true, OR: pairs.map((p) => ({ subjectId: p.subjectId, kertas: p.kertas })) },
      select: { subjectId: true, kertas: true, version: true },
    })
    return new Map(rows.map((r) => [pairKey(r), r.version]))
  }

  /** Published pilihan papers whose blueprint is any version of the pair (architecture 15.6). */
  async dependentPaperCounts(pairs: SubjectKertas[]): Promise<Map<string, number>> {
    if (pairs.length === 0) return new Map()
    const bps = await this.db.blueprint.findMany({
      where: { OR: pairs.map((p) => ({ subjectId: p.subjectId, kertas: p.kertas })) },
      select: { id: true, subjectId: true, kertas: true },
    })
    if (bps.length === 0) return new Map()
    const groups = await this.db.paper.groupBy({
      by: ['blueprintId'],
      where: { kind: 'pilihan', status: 'published', blueprintId: { in: bps.map((b) => b.id) } },
      _count: { _all: true },
    })
    const byBlueprint = new Map(groups.map((g) => [g.blueprintId, g._count._all]))
    const out = new Map<string, number>()
    for (const b of bps) out.set(pairKey(b), (out.get(pairKey(b)) ?? 0) + (byBlueprint.get(b.id) ?? 0))
    return out
  }

  /* ---------------------------------------------------------------------- evidence (BJS-09) */

  evidenceOf(blueprintId: bigint): Promise<BlueprintEvidence[]> {
    return this.db.blueprintEvidence.findMany({ where: { blueprintId }, orderBy: { id: 'asc' } })
  }

  evidenceById(blueprintId: bigint, id: bigint): Promise<BlueprintEvidence | null> {
    return this.db.blueprintEvidence.findFirst({ where: { id, blueprintId } })
  }

  addEvidence(input: NewEvidence, at: Date): Promise<BlueprintEvidence> {
    return this.db.blueprintEvidence.create({ data: { ...input, createdAt: input.createdAt ?? at } })
  }

  async deleteEvidence(blueprintId: bigint, id: bigint): Promise<boolean> {
    const res = await this.db.blueprintEvidence.deleteMany({ where: { id, blueprintId } })
    return res.count > 0
  }

  /** Copies the evidence rows of one version to another (a new version starts from the history, 3.4). */
  async copyEvidence(fromId: bigint, toId: bigint): Promise<number> {
    const rows = await this.evidenceOf(fromId)
    if (rows.length === 0) return 0
    const res = await this.db.blueprintEvidence.createMany({
      data: rows.map((r) => ({
        blueprintId: toId,
        kind: r.kind,
        body: r.body,
        year: r.year,
        paperCode: r.paperCode,
        setLabel: r.setLabel,
        sourceRef: r.sourceRef,
        values: r.values as Prisma.InputJsonValue,
        origin: r.origin,
        note: r.note,
        createdById: r.createdById,
        createdAt: r.createdAt,
      })),
    })
    return res.count
  }

  /* ------------------------------------------------------------------ verification (BJS-09) */

  insertVerification(input: NewVerification): Promise<BlueprintVerification> {
    return this.db.blueprintVerification.create({
      data: {
        blueprintId: input.blueprintId,
        verifiedById: input.verifiedById,
        verifierRole: 'admin',
        verifiedAt: input.verifiedAt,
        note: input.note,
        structureHash: input.structureHash,
        checkResult: input.checkResult,
        evidenceSnapshot: input.evidenceSnapshot,
      },
    })
  }
}

export const pairKey = (p: SubjectKertas): string => `${p.subjectId.toString()}:${String(p.kertas)}`
