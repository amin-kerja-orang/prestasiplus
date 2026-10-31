/**
 * SRS M05 v1.17 §7 #7 `GET /api/practice/chapter-subjects` (S4) and #8
 * `GET /api/practice/chapter-subjects/:code?levelId=` (S5, BR-11, BR-15, BR-16). Any session (A).
 *
 * The teacher (5) may open S4 (build-plan M05-T5): there is no role rule. A locked chapter is refused
 * at session start (#4 `CHAPTER_LOCKED`), not here.
 */

import { notFound, ok, queryInt, requireAuth, route, unpaged, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import type { ChapterCard, ChapterSubject, ChapterSubjectDetail } from '../../api/types'
import {
  activeSubjectByCode,
  chapterEntries,
  offeredLevelIds,
  practiceChapters,
  practiceSubjects,
  practiceLevelCount,
  round,
  userIdOf,
} from './common'

export const chapterRoutes: RouteDef[] = [
  route('GET', '/api/practice/chapter-subjects', [requireAuth()], () => {
    const items: ChapterSubject[] = []
    for (const s of practiceSubjects()) {
      const levels = offeredLevelIds(s)
      const chapterCount = levels.reduce((a, l) => a + practiceChapters(s.id, l).length, 0)
      // BR-15: subjects with at least one chapter at an offered level.
      if (chapterCount === 0) continue
      items.push({
        code: s.code,
        name: s.name,
        icon: s.icon,
        color: s.color,
        chapterCount,
        // FR-M05-58: the practice-drawable questions of the offered levels (D72).
        questionCount: levels.reduce((a, l) => a + practiceLevelCount(s.id, l), 0),
      })
    }
    return unpaged(items)
  }),

  route('GET', '/api/practice/chapter-subjects/:code', [requireAuth()], (req) => {
    const s = activeSubjectByCode(String(req.params.code))
    if (!s) return notFound()
    const offered = offeredLevelIds(s)
    const levels = offered.flatMap((id) => {
      const level = curriculum.level(id)
      if (!level) return []
      // BR-15: the option count is the level's chapter questions.
      const count = practiceChapters(s.id, id).reduce(
        (a, c) => a + questions.count('Q-CHAPTER', c.id),
        0,
      )
      return [{ id, name: level.name, count }]
    })
    // Default: the first offered level; an unknown or non-offered `levelId` falls back to it.
    const asked = queryInt(req.query, 'levelId')
    const levelId = asked !== undefined && offered.includes(asked) ? asked : (offered[0] ?? null)
    const chapters: ChapterCard[] =
      levelId === null
        ? []
        : chapterEntries(userIdOf(req), s.id, levelId).map(({ chapter, stats, open }) => ({
            id: chapter.id,
            number: chapter.chapterNumber,
            name: chapter.name ?? '',
            total: stats.total,
            answered: stats.answered,
            correct: stats.correct,
            scorePct: round(stats.scorePct, 1),
            remaining: stats.remaining,
            state: open ? 'open' : 'locked',
            complete: stats.complete,
          }))
    const detail: ChapterSubjectDetail = {
      subject: { code: s.code, name: s.name, color: s.color },
      levels,
      levelId,
      chapters,
    }
    return ok(detail)
  }),
]
