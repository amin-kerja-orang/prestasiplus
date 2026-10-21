import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  SPM_MESSAGES,
  SPM_MOCK_ANSWER_MAX_CHARS,
  SPM_MOCK_SUBJECTS,
  type SpmMockExamView,
  type SpmMockListItem,
  type SpmMockResult,
} from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { fnv1a32, mulberry32, type Prng } from '../../db/prng'
import { CurriculumRepository } from '../curriculum'
import { QuestionsRepository, type QuestionRecord } from '../questions'
import { SpmCatalogService } from './catalog.service'
import { fieldError, notFound } from './errors'
import { MOCK_SUBJECT_CODES, P1_ITEMS, P2_ITEMS, P2_ITEM_MARKS } from './config'
import { SpmPoolService } from './pool.service'
import { gradeOf, heroClassOf, markPaper2, mcqItemOf, paper1Feedback, paper2Feedback, round2, structuredItemOf, weakTopicsOf } from './rules'
import { SpmRepository, type MockExamRow, type MockItemRow } from './spm.repository'

const SUBJECT_SET: ReadonlySet<string> = new Set(SPM_MOCK_SUBJECTS)

export interface MockCaller {
  userId: string
  isTest: boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `answers` of the submit body, or null when malformed (no entry kept on null). */
export function parseAnswers(value: unknown, maxNo: number): Map<number, string> | null {
  if (!Array.isArray(value)) return null
  const byNo = new Map<number, string>()
  for (const a of value as unknown[]) {
    if (!isRecord(a)) return null
    const { no, answer } = a
    if (typeof no !== 'number' || !Number.isInteger(no) || no < 1 || no > maxNo) return null
    if (answer !== undefined && answer !== null && typeof answer !== 'string') return null
    byNo.set(no, typeof answer === 'string' ? answer.slice(0, SPM_MOCK_ANSWER_MAX_CHARS).trim() : '')
  }
  return byNo
}

/** Fisher-Yates in place with the stream. */
function shuffle<T>(items: T[], rng: Prng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = items[i] as T
    items[i] = items[j] as T
    items[j] = tmp
  }
  return items
}

/**
 * Mock exams (M06-08 to M06-12). Writes only `spm_mock_exams` and `spm_mock_exam_items`: never a practice session,
 * answer, revision-queue, mastery or wallet row (SRS 6.5). Only the owner opens a mock (BR-M06-26: others get 404).
 */
@Injectable()
export class SpmMockService {
  constructor(
    @Inject(SpmRepository) private readonly repo: SpmRepository,
    @Inject(SpmCatalogService) private readonly catalog: SpmCatalogService,
    @Inject(SpmPoolService) private readonly pool: SpmPoolService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- M06-08 -----------------------------------------------------------------------------------

  async list(caller: MockCaller): Promise<SpmMockListItem[]> {
    const rows = await this.repo.mocksOf(caller.userId, caller.isTest)
    return rows.map((m) => ({
      id: m.id,
      subject: m.subject,
      paperNumber: m.paperNumber,
      status: m.status,
      createdAt: toMytTimestamp(m.createdAt),
      score: m.score,
      maxScore: m.maxScore,
      percent: m.percent,
      grade: m.grade,
    }))
  }

  // --- M06-09 -----------------------------------------------------------------------------------

  /** Topic of a drawn question: its chapter name, else the subject name (the mock's `topicOf`). */
  private async topics(records: readonly QuestionRecord[], subjectName: string): Promise<Map<string, string>> {
    const chapterIds = [...new Set(records.flatMap((r) => (r.version.chapterId === null ? [] : [r.version.chapterId])))]
    const chapters = chapterIds.length === 0 ? [] : await this.curriculum.chaptersByIds(chapterIds.map(idFromString))
    const names = new Map(chapters.map((c) => [c.id.toString(), c.name]))
    return new Map(records.map((r) => [r.id, (r.version.chapterId !== null ? names.get(r.version.chapterId) : undefined) ?? subjectName]))
  }

  private async paper1Items(subjectId: string, subjectName: string, rng: Prng): Promise<MockItemRow[]> {
    const records = await this.pool.sample(subjectId, P1_ITEMS, rng)
    const topics = await this.topics(records, subjectName)
    return records.flatMap((r, i) => {
      const mcq = mcqItemOf(r.version.stemMs, r.version.parts)
      if (!mcq) return []
      return [{ no: i + 1, questionId: r.id, text: mcq.text, options: mcq.options, modelAnswer: mcq.letter, studentAnswer: null, marks: null, maxMarks: 1, feedback: null, topic: topics.get(r.id) ?? subjectName }]
    })
  }

  private async paper2Items(subjectId: string, subjectName: string, rng: Prng): Promise<MockItemRow[]> {
    const ids = shuffle(await this.questions.eligibleIds({ subjectId, type: 'structured' }), rng)
    const picked: { record: QuestionRecord; item: { text: string; modelAnswer: string } }[] = []
    for (let i = 0; i < ids.length && picked.length < P2_ITEMS; i += P2_ITEMS) {
      const chunk = ids.slice(i, i + P2_ITEMS)
      const records = new Map((await this.questions.getMany(chunk, 'live')).map((r) => [r.id, r]))
      for (const id of chunk) {
        const record = records.get(id)
        const item = record && record.isActive && record.version.status === 'published' ? structuredItemOf(record.version.stemMs, record.version.parts) : null
        if (record && item && picked.length < P2_ITEMS) picked.push({ record, item })
      }
    }
    const topics = await this.topics(picked.map((p) => p.record), subjectName)
    return picked.map((p, i) => ({
      no: i + 1,
      questionId: p.record.id,
      text: p.item.text,
      options: [],
      modelAnswer: p.item.modelAnswer,
      studentAnswer: null,
      marks: null,
      maxMarks: P2_ITEM_MARKS,
      feedback: null,
      topic: topics.get(p.record.id) ?? subjectName,
    }))
  }

  async create(caller: MockCaller, body: unknown): Promise<{ id: string }> {
    const b = isRecord(body) ? body : {}
    const subject = typeof b.subject === 'string' ? b.subject : ''
    if (!SUBJECT_SET.has(subject)) throw fieldError({ subject: SPM_MESSAGES.subjectInvalid })
    const paper = b.paperNumber === undefined || b.paperNumber === null ? 1 : Number(b.paperNumber)
    if (paper !== 1 && paper !== 2) throw fieldError({ paperNumber: SPM_MESSAGES.paperInvalid })

    const code = MOCK_SUBJECT_CODES[subject as keyof typeof MOCK_SUBJECT_CODES]
    const meta = (await this.catalog.subjectsByCode()).get(code)
    if (!meta) throw fieldError({ subject: SPM_MESSAGES.subjectInvalid })

    const id = randomUUID()
    // Seeded stream: the same mock id always draws the same paper (never Math.random).
    const rng = mulberry32(fnv1a32(`m06.mock:${id}`))
    const items = paper === 1 ? await this.paper1Items(meta.subjectId, meta.name, rng) : await this.paper2Items(meta.subjectId, meta.name, rng)
    if (items.length === 0) throw new ApiError({ code: 'NOT_ENOUGH_QUESTIONS', status: 422, message: 'Soalan tidak mencukupi.' })

    await this.repo.createMock({
      id,
      userId: caller.userId,
      subjectId: meta.subjectId,
      subject,
      paperNumber: paper,
      createdAt: this.clock.now(),
      maxScore: items.reduce((a, i) => a + i.maxMarks, 0),
      isTest: caller.isTest,
      items,
    })
    return { id }
  }

  // --- M06-10 -----------------------------------------------------------------------------------

  private async own(id: string, userId: string): Promise<MockExamRow> {
    const m = await this.repo.mockOf(id, userId)
    if (!m) throw notFound()
    return m
  }

  /** The exam paper to sit: never a key, an answer, a mark, feedback, topic or question id. */
  async view(caller: MockCaller, id: string): Promise<SpmMockExamView> {
    const m = await this.own(id, caller.userId)
    return {
      id: m.id,
      subject: m.subject,
      paperNumber: m.paperNumber,
      status: m.status,
      createdAt: toMytTimestamp(m.createdAt),
      items: m.items.map((i) => ({ no: i.no, text: i.text, ...(m.paperNumber === 1 ? { options: [...i.options] } : {}), maxMarks: i.maxMarks })),
    }
  }

  // --- M06-11 / M06-12 --------------------------------------------------------------------------

  private resultOf(m: MockExamRow): SpmMockResult {
    const grade = m.grade ?? 'G'
    return {
      id: m.id,
      subject: m.subject,
      paperNumber: m.paperNumber,
      score: m.score ?? 0,
      maxScore: m.maxScore,
      percent: m.percent ?? 0,
      grade,
      heroClass: heroClassOf(grade),
      weakTopics: weakTopicsOf(m.items),
      items: m.items.map((i) => ({
        no: i.no,
        // A deleted question leaves the snapshot without an id; the wire id is "0" then.
        questionId: i.questionId ?? '0',
        text: i.text,
        ...(m.paperNumber === 1 ? { options: [...i.options] } : {}),
        modelAnswer: i.modelAnswer,
        studentAnswer: i.studentAnswer,
        marks: i.marks,
        maxMarks: i.maxMarks,
        feedback: i.feedback,
        topic: i.topic,
      })),
    }
  }

  async submit(caller: MockCaller, id: string, body: unknown): Promise<SpmMockResult> {
    const m = await this.own(id, caller.userId)
    if (m.status === 'submitted') throw ApiError.of('CONFLICT', { message: SPM_MESSAGES.mockAlreadySubmitted })
    const answers = parseAnswers(isRecord(body) ? body.answers : undefined, m.items.length)
    if (answers === null) throw fieldError({ answers: SPM_MESSAGES.answersInvalid })

    const items = m.items.map((it): MockItemRow => {
      const given = answers.get(it.no) ?? ''
      const answer = given === '' ? null : given
      if (m.paperNumber === 1) {
        const right = answer !== null && answer.toUpperCase() === it.modelAnswer
        return { ...it, studentAnswer: answer, marks: right ? 1 : 0, feedback: paper1Feedback(right, it.modelAnswer) }
      }
      const marks = markPaper2(answer, it.maxMarks)
      return { ...it, studentAnswer: answer, marks, feedback: paper2Feedback(marks, it.maxMarks) }
    })
    const score = items.reduce((a, i) => a + (i.marks ?? 0), 0)
    const percent = m.maxScore === 0 ? 0 : round2((score / m.maxScore) * 100)
    const grade = gradeOf(percent)
    const submittedAt = this.clock.now()
    const won = await this.repo.gradeMock(m.id, { submittedAt, score, percent, grade, items })
    if (!won) throw ApiError.of('CONFLICT', { message: SPM_MESSAGES.mockAlreadySubmitted })
    return this.resultOf({ ...m, status: 'submitted', submittedAt, score, percent, grade, items })
  }

  async result(caller: MockCaller, id: string): Promise<SpmMockResult> {
    const m = await this.own(id, caller.userId)
    if (m.status !== 'submitted') throw new ApiError({ code: 'NOT_SUBMITTED', status: 409, message: SPM_MESSAGES.mockNotSubmitted })
    return this.resultOf(m)
  }
}
