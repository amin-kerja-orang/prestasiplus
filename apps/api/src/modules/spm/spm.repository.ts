import { Inject, Injectable } from '@nestjs/common'
import type { SpmMockGrade, SpmMockStatus, SpmTargetType } from '@pp/contract'

import { Prisma } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

/** One row of `spm_subject_configs`; ids are decimal strings. */
export interface SubjectConfigRow {
  subjectId: string
  group: 'teras' | 'elektif'
  displayOrder: number
  databankOrder: number | null
  targetType: SpmTargetType | null
  targetSize: number | null
}

/** One Tracking A set with its questions in set order. */
export interface TrackingSetRow {
  id: string
  subjectId: string
  year: number
  setNo: number
  dskpTagged: number
  questionIds: string[]
}

export interface MockItemRow {
  no: number
  questionId: string | null
  text: string
  options: string[]
  modelAnswer: string
  studentAnswer: string | null
  marks: number | null
  maxMarks: number
  feedback: string | null
  topic: string
}

export interface MockExamRow {
  id: string
  userId: string
  subjectId: string
  subject: string
  paperNumber: 1 | 2
  status: SpmMockStatus
  createdAt: Date
  submittedAt: Date | null
  score: number | null
  maxScore: number
  percent: number | null
  grade: SpmMockGrade | null
  isTest: boolean
  items: MockItemRow[]
}

export type NewMockExam = Omit<MockExamRow, 'submittedAt' | 'score' | 'percent' | 'grade' | 'status'>

export interface MockGrading {
  submittedAt: Date
  score: number
  percent: number
  grade: SpmMockGrade
  items: MockItemRow[]
}

export interface DutaRow {
  slug: string
  name: string
  initials: string
  tier: 'bintang' | 'inspirasi' | 'tetamu'
  tagline: string
  subject: string
  state: string
  rating: number
  isActive: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The only doorway to the six M06 tables. Questions, subjects, users and practice rows are read through
 * their owners' services, never here. Every method uses `prisma.client`, so it joins an open transaction.
 */
@Injectable()
export class SpmRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- subject configuration --------------------------------------------------------------------

  async configs(): Promise<SubjectConfigRow[]> {
    const rows = await this.db.spmSubjectConfig.findMany({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] })
    return rows.map((r) => ({
      subjectId: idToString(r.subjectId),
      group: r.grp as 'teras' | 'elektif',
      displayOrder: r.displayOrder,
      databankOrder: r.databankOrder,
      targetType: r.targetType as SpmTargetType | null,
      targetSize: r.targetSize,
    }))
  }

  // --- Tracking A sets --------------------------------------------------------------------------

  /** Sets (optionally of one subject and year) by subject then set number, with their question ids in `position` order. */
  async sets(filter: { subjectId?: string; year?: number } = {}): Promise<TrackingSetRow[]> {
    const rows = await this.db.spmTrackingSet.findMany({
      where: {
        ...(filter.subjectId === undefined ? {} : { subjectId: idFromString(filter.subjectId) }),
        ...(filter.year === undefined ? {} : { year: filter.year }),
      },
      include: { questions: { orderBy: { position: 'asc' } } },
      orderBy: [{ subjectId: 'asc' }, { setNo: 'asc' }, { year: 'asc' }],
    })
    return rows.map((r) => ({
      id: idToString(r.id),
      subjectId: idToString(r.subjectId),
      year: r.year,
      setNo: r.setNo,
      dskpTagged: r.dskpTagged,
      questionIds: r.questions.map((q) => idToString(q.questionId)),
    }))
  }

  async set(subjectId: string, year: number, setNo: number): Promise<TrackingSetRow | null> {
    const [row] = (await this.sets({ subjectId, year })).filter((s) => s.setNo === setNo)
    return row ?? null
  }

  // --- mock exams -------------------------------------------------------------------------------

  /** Inserts the exam and its item snapshot in one unit of work. */
  createMock(input: NewMockExam): Promise<void> {
    return this.prisma.transaction(async () => {
      await this.db.spmMockExam.create({
        data: {
          id: input.id,
          userId: idFromString(input.userId),
          subjectId: idFromString(input.subjectId),
          subjectLabel: input.subject,
          paperNumber: input.paperNumber,
          status: 'in_progress',
          createdAt: input.createdAt,
          maxScore: input.maxScore,
          isTest: input.isTest,
        },
      })
      await this.db.spmMockExamItem.createMany({
        data: input.items.map((i) => ({
          mockExamId: input.id,
          itemNo: i.no,
          questionId: i.questionId === null ? null : idFromString(i.questionId),
          questionText: i.text,
          options: i.options,
          modelAnswer: i.modelAnswer,
          maxMarks: i.maxMarks,
          topic: i.topic,
        })),
      })
    })
  }

  /** The caller's mocks, newest first; rows written under Mod Pelajar only when `includeTest`. No items. */
  async mocksOf(userId: string, includeTest: boolean): Promise<Omit<MockExamRow, 'items'>[]> {
    const rows = await this.db.spmMockExam.findMany({
      where: { userId: idFromString(userId), ...(includeTest ? {} : { isTest: false }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((r) => toExam(r))
  }

  /** The caller's own mock with its items; `null` for an unknown id, a non-uuid id or someone else's mock. */
  async mockOf(id: string, userId: string): Promise<MockExamRow | null> {
    if (!UUID.test(id)) return null
    const row = await this.db.spmMockExam.findFirst({
      where: { id: id.toLowerCase(), userId: idFromString(userId) },
      include: { items: { orderBy: { itemNo: 'asc' } } },
    })
    return row ? { ...toExam(row), items: row.items.map(toItem) } : null
  }

  /**
   * Stores the grading of an `in_progress` mock. Returns false when the mock was already submitted (a
   * concurrent submit): the status flip is a conditional update, so exactly one caller wins.
   */
  gradeMock(id: string, grading: MockGrading): Promise<boolean> {
    return this.prisma.transaction(async () => {
      const res = await this.db.spmMockExam.updateMany({
        where: { id, status: 'in_progress' },
        data: {
          status: 'submitted',
          submittedAt: grading.submittedAt,
          score: grading.score,
          percent: new Prisma.Decimal(grading.percent),
          grade: grading.grade,
        },
      })
      if (res.count === 0) return false
      for (const it of grading.items) {
        await this.db.spmMockExamItem.update({
          where: { mockExamId_itemNo: { mockExamId: id, itemNo: it.no } },
          data: { studentAnswer: it.studentAnswer, marks: it.marks, feedback: it.feedback },
        })
      }
      return true
    })
  }

  // --- Duta -------------------------------------------------------------------------------------

  /** Active `bintang` profiles in slug order. */
  async activeBintang(): Promise<DutaRow[]> {
    const rows = await this.db.dutaProfile.findMany({ where: { isActive: true, tier: 'bintang' }, orderBy: { slug: 'asc' } })
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      initials: r.initials,
      tier: r.tier as DutaRow['tier'],
      tagline: r.tagline,
      subject: r.subject,
      state: r.state,
      rating: Number(r.rating),
      isActive: r.isActive,
    }))
  }
}

type ExamRecord = Prisma.SpmMockExamGetPayload<object>
type ItemRecord = Prisma.SpmMockExamItemGetPayload<object>

function toExam(r: ExamRecord): Omit<MockExamRow, 'items'> {
  return {
    id: r.id,
    userId: idToString(r.userId),
    subjectId: idToString(r.subjectId),
    subject: r.subjectLabel,
    paperNumber: r.paperNumber === 2 ? 2 : 1,
    status: r.status as SpmMockStatus,
    createdAt: r.createdAt,
    submittedAt: r.submittedAt,
    score: r.score,
    maxScore: r.maxScore,
    percent: r.percent === null ? null : Number(r.percent),
    grade: r.grade as SpmMockGrade | null,
    isTest: r.isTest,
  }
}

function toItem(r: ItemRecord): MockItemRow {
  return {
    no: r.itemNo,
    questionId: r.questionId === null ? null : idToString(r.questionId),
    text: r.questionText,
    options: r.options,
    modelAnswer: r.modelAnswer,
    studentAnswer: r.studentAnswer,
    marks: r.marks,
    maxMarks: r.maxMarks,
    feedback: r.feedback,
    topic: r.topic,
  }
}
