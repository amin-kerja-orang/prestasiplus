import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { capPercent, compareIds, pct, round } from '../domain/rules'
import { DIRECTORY_PORT, PerformancePorts, type AnswerFactRow, type DirectoryPort, type QuestionContent } from '../ports'
import type { Ctx, ItemAnalysisMeQuery, PerformanceItemAnalysisMe } from './types'

type Category = PerformanceItemAnalysisMe['items'][number]['category']

/** Most question ids sent to the S1 question read in one call (one hydrate round trip). */
const CONTENT_BATCH = 500

/** One question of the pupil, every mode and chapter summed. */
interface Mine {
  questionId: string
  subjectId: string
  chapterId: string | null
  attempts: number
  correct: number
  lastAnsweredAt: Date
}

/**
 * The category of a question by the pupil's own attempts (FR-MUR-6-3): one attempt and none right is Isyarat Awal; two or more
 * and none right is Pemulihan; two or more with some right and some wrong is Pengukuhan. Anything else (all right, or one
 * attempt that was right) is in no list.
 */
export function categoryOf(attempts: number, correct: number): Category | null {
  if (correct === 0) return attempts >= 2 ? 'pemulihan' : attempts === 1 ? 'isyarat_awal' : null
  return attempts >= 2 && correct < attempts ? 'pengukuhan' : null
}

const keepsTapis = (tapis: NonNullable<ItemAnalysisMeQuery['tapis']>, m: Pick<Mine, 'attempts' | 'correct'>): boolean =>
  tapis === 'semua' || (tapis === 'ada_betul' ? m.correct > 0 : m.attempts >= 2 && m.correct === 0)

/**
 * API-RPT-05 `GET /item-analysis/me` (R1-MUR-6): the pupil's OWN item analysis from `answerFacts({ userIds: [me] })` summed per question
 * over every mode (a Battle row counts, AC-MUR-6-8; a Latih Tubi row and a Bijak row of one question are two attempts, AC-MUR-6-7).
 * Read-only. The user comes from the session only; the query narrows by subject and by `tapis`. `tapis` filters `items` only: the tiles,
 * the subject cards and the counts follow `subjectCode` (decision 7). Question text, explanation, source and stimulus group come from the
 * S1 question content port; a question it does not return (archived, inactive, unknown) is dropped from every figure that counts questions.
 */
/**
 * API-RPT-05. Lists only questions that are active with an approved live version and in the default
 * question scope (PKSK excluded, as `QuestionsRepository.getMany`); answers to other questions still count
 * in `tiles.answered` and `mastery` (all answers, XS-4/XS-5) but are not listed.
 */
@Injectable()
export class ItemAnalysisMeService {
  constructor(
    @Inject(PerformancePorts) private readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) private readonly directory: DirectoryPort,
  ) {}

  async me(ctx: Ctx, query: ItemAnalysisMeQuery): Promise<PerformanceItemAnalysisMe> {
    if (ctx.role !== 'student') throw ApiError.of('FORBIDDEN')
    const tapis = query.tapis ?? 'semua'
    const empty = (): PerformanceItemAnalysisMe => ({
      tiles: { answered: 0, needRemedial: 0, needStrengthen: 0, mastery: null },
      subjects: [],
      counts: { isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 },
      items: [],
    })

    let subjectFilter: { subjectId: string } | Record<string, never> = {}
    if (query.subjectCode !== undefined && query.subjectCode !== '') {
      const subjectId = (await this.directory.subjectIdsOfCodes([query.subjectCode])).get(query.subjectCode)
      if (subjectId === undefined) return empty()
      subjectFilter = { subjectId }
    }

    const rows = await this.ports.answerFacts.answerFacts({ userIds: [ctx.userId], ...subjectFilter })
    if (rows.length === 0) return empty()

    const mine = this.perQuestion(rows)
    const candidates = [...mine.values()].filter((m) => categoryOf(m.attempts, m.correct) !== null)
    const content = await this.contentOf(candidates.map((m) => m.questionId))
    // Archived (or unknown) questions are dropped.
    const kept = candidates.filter((m) => content.has(m.questionId))

    const subjectIds = [...new Set(rows.map((r) => r.subjectId))].filter((id) => id !== '0')
    const subjects = await this.directory.subjectsOfIds(subjectIds)
    const chapterIds = [...new Set(kept.flatMap((m) => (m.chapterId === null ? [] : [m.chapterId])))]
    const chapters = new Map(
      (chapterIds.length === 0 ? [] : await this.ports.answerFacts.spInfo({ topicIds: [], chapterIds })).filter((i) => i.kind === 'chapter').map((i) => [i.id, i.label]),
    )

    const counts = { isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 }
    const weak = new Map<string, { weakRepeated: number; earlySignalWeak: number }>()
    for (const m of kept) {
      const category = categoryOf(m.attempts, m.correct) as Category
      if (category === 'isyarat_awal') counts.isyaratAwal++
      else if (category === 'pemulihan') counts.pemulihan++
      else counts.pengukuhan++
      const w = weak.get(m.subjectId) ?? { weakRepeated: 0, earlySignalWeak: 0 }
      if (category === 'isyarat_awal') w.earlySignalWeak++
      else w.weakRepeated++
      weak.set(m.subjectId, w)
    }

    const answered = rows.reduce((n, r) => n + r.attempts, 0)
    const right = rows.reduce((n, r) => n + r.correct, 0)

    const bySubject = new Map<string, AnswerFactRow[]>()
    for (const r of rows) bySubject.set(r.subjectId, [...(bySubject.get(r.subjectId) ?? []), r])
    const subjectCards = [...bySubject]
      .flatMap(([subjectId, list]) => {
        const info = subjects.get(subjectId)
        if (!info) return []
        const attempts = list.reduce((n, r) => n + r.attempts, 0)
        const correct = list.reduce((n, r) => n + r.correct, 0)
        const w = weak.get(subjectId)
        return [
          {
            code: info.code,
            name: info.name,
            attempts,
            uniqueQuestions: new Set(list.map((r) => r.questionId).filter((id) => id !== '0')).size,
            accuracy: attempts === 0 ? null : round(capPercent(pct(correct, attempts)), 1),
            wrongAnswers: attempts - correct,
            weakRepeated: w?.weakRepeated ?? 0,
            earlySignalWeak: w?.earlySignalWeak ?? 0,
          },
        ]
      })
      // Ascending accuracy (a subject with no accuracy last), then by code.
      .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || a.code.localeCompare(b.code))

    const items = kept
      .filter((m) => keepsTapis(tapis, m))
      // Inside a list: attempts descending, then the last attempt descending.
      .sort((a, b) => b.attempts - a.attempts || b.lastAnsweredAt.getTime() - a.lastAnsweredAt.getTime() || compareIds(a.questionId, b.questionId))
      .map((m) => {
        const c = content.get(m.questionId) as QuestionContent
        const chapter = m.chapterId === null ? '' : (chapters.get(m.chapterId) ?? '')
        return {
          questionId: m.questionId,
          category: categoryOf(m.attempts, m.correct) as Category,
          attempts: m.attempts,
          correct: m.correct,
          wrongTimes: m.attempts - m.correct,
          lastAnsweredAt: toMytTimestamp(m.lastAnsweredAt),
          subject: subjects.get(m.subjectId)?.name ?? '',
          chapter: chapter === '' ? null : chapter,
          source: c.source,
          question: c.question,
          stimulusGroup: c.stimulusGroup,
          explanation: c.explanation,
        }
      })

    return {
      tiles: {
        answered,
        needRemedial: counts.pemulihan,
        needStrengthen: counts.pengukuhan,
        mastery: answered === 0 ? null : round(capPercent(pct(right, answered)), 1),
      },
      subjects: subjectCards,
      counts,
      items,
    }
  }

  /** The pupil's rows folded to one record per question: every mode summed, the latest chapter, the last time. */
  private perQuestion(rows: readonly AnswerFactRow[]): Map<string, Mine> {
    const out = new Map<string, Mine>()
    for (const r of rows) {
      if (r.questionId === '0') continue
      const m = out.get(r.questionId)
      if (!m) {
        out.set(r.questionId, { questionId: r.questionId, subjectId: r.subjectId, chapterId: r.chapterId, attempts: r.attempts, correct: r.correct, lastAnsweredAt: r.lastAnsweredAt })
        continue
      }
      m.attempts += r.attempts
      m.correct += r.correct
      if (r.lastAnsweredAt > m.lastAnsweredAt) {
        m.lastAnsweredAt = r.lastAnsweredAt
        if (r.chapterId !== null) m.chapterId = r.chapterId
      } else if (m.chapterId === null) {
        m.chapterId = r.chapterId
      }
      if (m.subjectId === '0') m.subjectId = r.subjectId
    }
    return out
  }

  private async contentOf(ids: readonly string[]): Promise<Map<string, QuestionContent>> {
    const out = new Map<string, QuestionContent>()
    for (let i = 0; i < ids.length; i += CONTENT_BATCH) {
      for (const [id, c] of await this.ports.questionContent.questionContent(ids.slice(i, i + CONTENT_BATCH))) out.set(id, c)
    }
    return out
  }
}
