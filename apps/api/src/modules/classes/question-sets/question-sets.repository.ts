import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

export interface QuestionSetRecord {
  id: string
  teacherId: string
  classroomId: string
  subjectId: string | null
  title: string
  timeLimitMinutes: number | null
  maxAttempts: number
  status: 'draft' | 'scheduled' | 'published'
  scheduledAt: Date | null
  needsRebuild: boolean
  isTest: boolean
  createdAt: Date
}

export interface DskpRow {
  id: string
  code: string | null
  name?: string
  description?: string
}

const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)

/**
 * The only doorway to `question_sets`, `question_set_items` and the teacher DSKP picking tables
 * (`dskp_bidang`, `dskp_sk`, `dskp_sp`; OWN-11, not the admin DSKP tree). Question and practice tables are
 * read through their owners' repositories, never here.
 */
@Injectable()
export class QuestionSetsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /**
   * The sets a student of `classroomIds` may start at `at`: published, or scheduled and due (BR-M10-18);
   * a draft never. Oldest created first.
   */
  async visibleIn(classroomIds: readonly string[], at: Date): Promise<QuestionSetRecord[]> {
    const keys = [...new Set(classroomIds)].flatMap((i) => (idOf(i) === null ? [] : [idFromString(i)]))
    if (keys.length === 0) return []
    const rows = await this.db.questionSet.findMany({
      where: {
        classroomId: { in: keys },
        OR: [{ status: 'published' }, { status: 'scheduled', scheduledAt: { lte: at } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map(toRecord)
  }

  /** One set by id (any status), or null. */
  async get(id: string): Promise<QuestionSetRecord | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.questionSet.findUnique({ where: { id: key } })
    return row ? toRecord(row) : null
  }

  /** The question ids of the sets in stored (position) order, per set id. */
  async itemIds(setIds: readonly string[]): Promise<Map<string, string[]>> {
    const keys = setIds.flatMap((i) => (idOf(i) === null ? [] : [idFromString(i)]))
    const out = new Map<string, string[]>()
    if (keys.length === 0) return out
    const rows = await this.db.questionSetItem.findMany({
      where: { questionSetId: { in: keys } },
      orderBy: [{ questionSetId: 'asc' }, { position: 'asc' }],
      select: { questionSetId: true, questionId: true },
    })
    for (const r of rows) {
      const k = idToString(r.questionSetId)
      const list = out.get(k) ?? []
      list.push(idToString(r.questionId))
      out.set(k, list)
    }
    return out
  }

  // --- DSKP picks -----------------------------------------------------------------------------

  async bidangExists(id: string): Promise<boolean> {
    const key = idOf(id)
    return key !== null && (await this.db.dskpBidang.count({ where: { id: key } })) > 0
  }

  async skExists(id: string): Promise<boolean> {
    const key = idOf(id)
    return key !== null && (await this.db.dskpSk.count({ where: { id: key } })) > 0
  }

  async createBidang(
    input: { subjectId: string; educationLevelId: string; code: string | null; name: string; createdById: string; isTest: boolean },
  ): Promise<DskpRow> {
    const row = await this.db.dskpBidang.create({
      data: {
        subjectId: idFromString(input.subjectId),
        educationLevelId: idFromString(input.educationLevelId),
        code: input.code,
        name: input.name,
        createdById: idFromString(input.createdById),
        isTest: input.isTest,
      },
    })
    return { id: idToString(row.id), code: row.code, name: row.name }
  }

  async createSk(
    input: { bidangId: string; code: string; description: string; createdById: string; isTest: boolean },
  ): Promise<DskpRow> {
    const row = await this.db.dskpSk.create({
      data: {
        bidangId: idFromString(input.bidangId),
        code: input.code,
        description: input.description,
        createdById: idFromString(input.createdById),
        isTest: input.isTest,
      },
    })
    return { id: idToString(row.id), code: row.code, description: row.description }
  }

  async createSp(
    input: { skId: string; code: string; description: string; createdById: string; isTest: boolean },
  ): Promise<DskpRow> {
    const row = await this.db.dskpSp.create({
      data: {
        skId: idFromString(input.skId),
        code: input.code,
        description: input.description,
        createdById: idFromString(input.createdById),
        isTest: input.isTest,
      },
    })
    return { id: idToString(row.id), code: row.code, description: row.description }
  }
}

function toRecord(row: {
  id: bigint
  teacherId: bigint
  classroomId: bigint
  subjectId: bigint | null
  title: string
  timeLimitMinutes: number | null
  maxAttempts: number
  status: string
  scheduledAt: Date | null
  needsRebuild: boolean
  isTest: boolean
  createdAt: Date
}): QuestionSetRecord {
  return {
    id: idToString(row.id),
    teacherId: idToString(row.teacherId),
    classroomId: idToString(row.classroomId),
    subjectId: row.subjectId === null ? null : idToString(row.subjectId),
    title: row.title,
    timeLimitMinutes: row.timeLimitMinutes,
    maxAttempts: row.maxAttempts,
    status: row.status as QuestionSetRecord['status'],
    scheduledAt: row.scheduledAt,
    needsRebuild: row.needsRebuild,
    isTest: row.isTest,
    createdAt: row.createdAt,
  }
}
