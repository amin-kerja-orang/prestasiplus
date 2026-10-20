import { Inject, Injectable } from '@nestjs/common'
import { type AudioKbatStatus } from '@pp/contract'
import { z } from 'zod'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

/** A section as stored in `audio_kbat_sets.sections` (the audio is referenced by `audioFileId`, no FK). */
const StoredSectionSchema = z.object({
  no: z.number().int(),
  title: z.string(),
  audioFileId: z.string().nullable(),
  audioFileName: z.string().nullable(),
  transcript: z.string().nullable(),
  questionFrom: z.number().int(),
  questionTo: z.number().int(),
})
export type StoredSection = z.infer<typeof StoredSectionSchema>

/** A question as stored, WITH the answer key. It never leaves the service as is. */
const StoredQuestionSchema = z.object({
  no: z.number().int(),
  questionText: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  marks: z.number().int(),
  kbatLevel: z.number().int(),
  dskpSpId: z.string().nullable(),
  explanation: z.string().nullable(),
})
export type StoredQuestion = z.infer<typeof StoredQuestionSchema>

export interface SetSummary {
  id: string
  title: string
  educationLevelId: string
  subjectId: string
}

export interface AdminSetRow extends SetSummary {
  status: AudioKbatStatus
  questionCount: number
}

export interface SetRow extends SetSummary {
  status: AudioKbatStatus
  sourceLabel: string | null
  instructions: string | null
  sections: StoredSection[]
  questions: StoredQuestion[]
  createdAt: Date
}

export interface AdminFilter {
  educationLevelId?: string
  subjectId?: string
  status?: AudioKbatStatus
  search: string
}

export interface NewSet {
  title: string
  educationLevelId: string
  subjectId: string
  status: AudioKbatStatus
  sourceLabel: string | null
  instructions: string | null
  sections: StoredSection[]
  questions: StoredQuestion[]
  createdById: string
  now: Date
}

export interface NewAttempt {
  setId: string
  userId: string
  answers: { no: number; choice: string }[]
  score: number
  totalMarks: number
  isTest: boolean
  now: Date
}

export interface SetStats {
  sets: number
  approved: number
  draftPending: number
  questions: number
}

/** Escapes `%`, `_` and `\` of a LIKE pattern. */
const likeEscape = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * The only doorway to `audio_kbat_sets` and `audio_kbat_attempts`. Methods use `prisma.client`, so they join
 * the caller's transaction when there is one. The student list never loads the sections or the questions
 * (they hold the answer key); only `getApproved` and `getAny` do, and the service maps them to the wire.
 */
@Injectable()
export class AudioRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Approved sets for a level and subject, newest first. A missing filter matches every set. */
  async listApproved(filter: { educationLevelId?: string; subjectId?: string }): Promise<SetSummary[]> {
    const rows = await this.prisma.client.audioKbatSet.findMany({
      where: {
        status: 'approved',
        ...(filter.educationLevelId ? { educationLevelId: idFromString(filter.educationLevelId) } : {}),
        ...(filter.subjectId ? { subjectId: idFromString(filter.subjectId) } : {}),
      },
      select: { id: true, title: true, educationLevelId: true, subjectId: true },
      orderBy: { id: 'desc' },
    })
    return rows.map((r) => ({
      id: idToString(r.id),
      title: r.title,
      educationLevelId: idToString(r.educationLevelId),
      subjectId: idToString(r.subjectId),
    }))
  }

  /** An APPROVED set with its sections and questions, or null (a draft, pending, archived or unknown set is "not found"). */
  async getApproved(id: string): Promise<SetRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.audioKbatSet.findFirst({ where: { id: idFromString(id), status: 'approved' } })
    return row ? toSetRow(row) : null
  }

  /** The admin list: every status, newest first; the question count comes from SQL, the questions are not loaded. */
  async adminList(filter: AdminFilter, skip: number, take: number): Promise<{ rows: AdminSetRow[]; total: number }> {
    const conditions: Prisma.Sql[] = []
    if (filter.educationLevelId) conditions.push(Prisma.sql`education_level_id = ${idFromString(filter.educationLevelId)}`)
    if (filter.subjectId) conditions.push(Prisma.sql`subject_id = ${idFromString(filter.subjectId)}`)
    if (filter.status) conditions.push(Prisma.sql`status = ${filter.status}`)
    if (filter.search !== '') {
      const like = `%${likeEscape(filter.search.toLowerCase())}%`
      conditions.push(Prisma.sql`(lower(title) LIKE ${like} ESCAPE '\\' OR lower(coalesce(source_label, '')) LIKE ${like} ESCAPE '\\')`)
    }
    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty
    const [rows, totals] = await Promise.all([
      this.prisma.client.$queryRaw<
        { id: bigint; title: string; education_level_id: bigint; subject_id: bigint; status: string; question_count: number }[]
      >`SELECT id, title, education_level_id, subject_id, status, jsonb_array_length(questions)::int AS question_count
          FROM audio_kbat_sets ${where} ORDER BY id DESC LIMIT ${take} OFFSET ${skip}`,
      this.prisma.client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM audio_kbat_sets ${where}`,
    ])
    return {
      rows: rows.map((r) => ({
        id: idToString(r.id),
        title: r.title,
        educationLevelId: idToString(r.education_level_id),
        subjectId: idToString(r.subject_id),
        status: r.status as AudioKbatStatus,
        questionCount: r.question_count,
      })),
      total: totals[0]?.total ?? 0,
    }
  }

  /** The stat cards: counted over every set, never the filtered ones. */
  async stats(): Promise<SetStats> {
    const rows = await this.prisma.client.$queryRaw<
      { sets: number; approved: number; draft_pending: number; questions: number }[]
    >`SELECT count(*)::int AS sets,
             (count(*) FILTER (WHERE status = 'approved'))::int AS approved,
             (count(*) FILTER (WHERE status IN ('draft', 'pending_review')))::int AS draft_pending,
             coalesce(sum(jsonb_array_length(questions)), 0)::int AS questions
        FROM audio_kbat_sets`
    const r = rows[0]
    return { sets: r?.sets ?? 0, approved: r?.approved ?? 0, draftPending: r?.draft_pending ?? 0, questions: r?.questions ?? 0 }
  }

  async createSet(input: NewSet): Promise<{ id: string; createdAt: Date }> {
    const row = await this.prisma.client.audioKbatSet.create({
      data: {
        title: input.title,
        educationLevelId: idFromString(input.educationLevelId),
        subjectId: idFromString(input.subjectId),
        status: input.status,
        sourceLabel: input.sourceLabel,
        instructions: input.instructions,
        sections: input.sections as unknown as Prisma.InputJsonValue,
        questions: input.questions as unknown as Prisma.InputJsonValue,
        createdById: idFromString(input.createdById),
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: { id: true, createdAt: true },
    })
    return { id: idToString(row.id), createdAt: row.createdAt }
  }

  /** One attempt row per submit. */
  async createAttempt(input: NewAttempt): Promise<string> {
    const row = await this.prisma.client.audioKbatAttempt.create({
      data: {
        setId: idFromString(input.setId),
        userId: idFromString(input.userId),
        answers: input.answers as unknown as Prisma.InputJsonValue,
        score: input.score,
        totalMarks: input.totalMarks,
        isTest: input.isTest,
        submittedAt: input.now,
        createdAt: input.now,
      },
      select: { id: true },
    })
    return idToString(row.id)
  }
}

function toSetRow(row: {
  id: bigint
  title: string
  educationLevelId: bigint
  subjectId: bigint
  status: string
  sourceLabel: string | null
  instructions: string | null
  sections: unknown
  questions: unknown
  createdAt: Date
}): SetRow {
  return {
    id: idToString(row.id),
    title: row.title,
    educationLevelId: idToString(row.educationLevelId),
    subjectId: idToString(row.subjectId),
    status: row.status as AudioKbatStatus,
    sourceLabel: row.sourceLabel,
    instructions: row.instructions,
    sections: z.array(StoredSectionSchema).parse(row.sections),
    questions: z.array(StoredQuestionSchema).parse(row.questions),
    createdAt: row.createdAt,
  }
}
