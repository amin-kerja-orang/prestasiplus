/**
 * SRS v1.10 §7 #25–#27: the student catalogue (S12 Topik, S13 detail, S14 Peta Belajar). Any session
 * (`A`): a guest gets 401. Read-only; M03 never writes progress (BR-19).
 *
 * | # | Route | Success |
 * |---|---|---|
 * | 25 | `GET /api/topics?gradeLevel=&subject=` | 200 unpaged `{data: TopicCard[]}` (BR-13, case-insensitive AND) |
 * | 26 | `GET /api/topics/:id` | 200 `{data: TopicDetail}` for the current user; 404 |
 * | 27 | `GET /api/learning-map?subject=&grade=` | 200 `{data: LearningMap}` (BR-14/15) |
 *
 * Topic progress is derived on every read from the M05 answer log (BR-19, DATA-M03-07). The M05
 * contract (`practice.answers(userId, {chapterId})`) is connected lazily at the first student
 * request: M05 imports M03 (`curriculum`), so a static import here would be a cycle. A reader that
 * was connected earlier (tests) is kept.
 */

import { notFound, ok, requireAuth, route, unpaged, int, queryString } from '@/mock/define'
import type { RouteDef } from '@/mock/define'

import type {
  LearningMap,
  LearningMapSubject,
  LearningMapTopic,
  TopicCard,
  TopicDetail,
  TopicState,
} from '../../api/student-curriculum'
import { curriculumRepo } from '../repository/curriculum'
import { answerLog, connectAnswerLog, EMPTY_ANSWER_LOG } from '../repository/progress'
import { PRACTICE_CODE } from '../repository/rules'
import type { LegacyTopicRow, LearnerTopicProgress } from '../repository/types'

// ---------------------------------------------------------------------------------------------
// Constants (SRS §6.8, FR-82/83/84, BR-14/15)
// ---------------------------------------------------------------------------------------------

/** S14 subject pills (Geografi is not rendered, DV-M03-08). Colours OBSERVED (§6.8). */
export const MAP_SUBJECTS: readonly LearningMapSubject[] = Object.freeze([
  { code: 'MATEMATIK', label: 'Matematik', emoji: '🔢', color: '#3B82F6' },
  { code: 'BAHASA_MELAYU', label: 'Bahasa Melayu', emoji: '📝', color: '#10B981' },
  { code: 'BAHASA_INGGERIS', label: 'Bahasa Inggeris', emoji: '🇬🇧', color: '#8B5CF6' },
  { code: 'SAINS', label: 'Sains', emoji: '🔬', color: '#F59E0B' },
  { code: 'PENDIDIKAN_ISLAM', label: 'Pend. Islam', emoji: '☪️', color: '#14B8A6' },
  { code: 'PENDIDIKAN_MORAL', label: 'Pend. Moral', emoji: '🤝', color: '#F97316' },
  { code: 'SEJARAH', label: 'Sejarah', emoji: '🏛️', color: '#EF4444' },
])

export const MAP_GRADES = Object.freeze(['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4'] as const)
export const DEFAULT_MAP_SUBJECT = 'MATEMATIK'
export const DEFAULT_MAP_GRADE = 'DARJAH_4'

/** BR-14: `mastered` from this progress % (INFERRED threshold). */
export const MASTERED_FROM = 80
/** BR-14: the first two topics are open with no history. */
const OPEN_FROM_START = 2
const PREVIEW_MAX = 3

/** Code with "_" → " " (S12/S13). */
export const subjectLabelOf = (code: string): string => code.replaceAll('_', ' ')

/** BR-15 / FR-81: the pill label, "Geografi" for GEOGRAFI, else the code title-cased. */
export function mapSubjectLabel(code: string): string {
  const pill = MAP_SUBJECTS.find((s) => s.code === code)
  if (pill) return pill.label
  const text = subjectLabelOf(code)
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/** BR-14: the island state of every topic, in `sequence` order (input order). */
export function islandStates(progress: readonly LearnerTopicProgress[]): TopicState[] {
  const states: TopicState[] = []
  progress.forEach((p, i) => {
    const prev = states[i - 1]
    let state: TopicState
    if (p.progress >= MASTERED_FROM) state = 'mastered'
    else if (p.sessions >= 1 || p.questionsAnswered >= 1) state = 'started'
    else if (i < OPEN_FROM_START || prev === 'started' || prev === 'mastered') state = 'unlocked'
    else state = 'locked'
    states.push(state)
  })
  return states
}

// ---------------------------------------------------------------------------------------------
// M05 answer-log wiring (BR-19)
// ---------------------------------------------------------------------------------------------

async function ensureAnswerLog(): Promise<void> {
  if (answerLog() !== EMPTY_ANSWER_LOG) return
  const { practice } = await import('@/modules/m05-practice/mock')
  if (answerLog() !== EMPTY_ANSWER_LOG) return
  connectAnswerLog({
    answersFor: (userId, chapterId) => practice.answers(userId, { chapterId }),
  })
}

// ---------------------------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------------------------

const asCard = (t: LegacyTopicRow): TopicCard => {
  const subtopics = curriculumRepo.legacySubtopics(t.id)
  return {
    id: t.id,
    gradeLevel: t.gradeLevel,
    subject: t.subject,
    subjectLabel: subjectLabelOf(t.subject),
    name: t.name,
    description: t.description,
    subtopicCount: subtopics.length,
    subtopicsPreview: subtopics.slice(0, PREVIEW_MAX).map((s) => s.name),
  }
}

export const studentCurriculumRoutes: RouteDef[] = [
  route('GET', '/api/topics', [requireAuth()], (req) => {
    const items = curriculumRepo
      .legacyTopics({
        gradeLevel: queryString(req.query, 'gradeLevel') ?? null,
        subject: queryString(req.query, 'subject') ?? null,
      })
      .map(asCard)
    return unpaged(items)
  }),

  route(
    'GET',
    '/api/topics/:id',
    [requireAuth()],
    async (req) => {
      const topic = curriculumRepo.legacyTopic(req.params.id as number)
      if (!topic) return notFound()
      await ensureAnswerLog()
      const userId = req.session?.userId ?? 0
      const p = curriculumRepo.topicProgress(userId, topic.id)
      const data: TopicDetail = {
        id: topic.id,
        gradeLevel: topic.gradeLevel,
        subject: topic.subject,
        subjectLabel: subjectLabelOf(topic.subject),
        practiceCode: PRACTICE_CODE[topic.subject],
        name: topic.name,
        description: topic.description,
        icon: topic.icon,
        sequence: topic.sequence,
        // BR-19: no subtopic tagging exists, so every subtopic bar shows the topic progress.
        subtopics: curriculumRepo.legacySubtopics(topic.id).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          progress: p.progress,
        })),
        progress: { questionsAnswered: p.questionsAnswered, progress: p.progress },
      }
      return ok(data)
    },
    { params: { id: int() } },
  ),

  route('GET', '/api/learning-map', [requireAuth()], async (req) => {
    // FR-84 / BR-15: an empty or absent subject is the default; an unknown code is kept as typed.
    const subject = queryString(req.query, 'subject') || DEFAULT_MAP_SUBJECT
    const gradeParam = queryString(req.query, 'grade')
    const grade = (MAP_GRADES as readonly (string | undefined)[]).includes(gradeParam)
      ? (gradeParam as string)
      : DEFAULT_MAP_GRADE

    await ensureAnswerLog()
    const userId = req.session?.userId ?? 0
    // The filter is case-insensitive (BR-13); S14 keeps exact codes (a typed lower-case code is unknown).
    const rows = curriculumRepo
      .legacyTopics({ gradeLevel: grade, subject })
      .filter((t) => t.subject === subject)
    const progress = rows.map((t) => curriculumRepo.topicProgress(userId, t.id))
    const states = islandStates(progress)

    const topics: LearningMapTopic[] = rows.map((t, i) => {
      const p = progress[i] as LearnerTopicProgress
      const state = states[i] as TopicState
      return {
        id: t.id,
        name: t.name,
        icon: t.icon,
        state,
        progress: p.progress,
        sessions: p.sessions,
        questionsAnswered: p.questionsAnswered,
        practiceUrl: state === 'locked' ? null : `/practice?topic_id=${String(t.id)}`,
      }
    })
    const done = states.filter((s) => s === 'mastered').length
    const average = progress.length
      ? Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / progress.length)
      : 0
    const data: LearningMap = {
      subject,
      subjectLabel: mapSubjectLabel(subject),
      grade,
      gradeOptions: [...MAP_GRADES],
      subjects: MAP_SUBJECTS.map((s) => ({ ...s })),
      stats: { done, total: rows.length, progress: average },
      topics,
    }
    return ok(data)
  }),
]
