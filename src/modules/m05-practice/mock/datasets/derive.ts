/**
 * Non-facet fields of generated rows (SRS M05 §6.14: "A generated answer takes its `questionId`
 * deterministically from the M04 active questions of the answering user's level (T4/T5: the M04
 * SPM pool; other levels: that level), with `subjectId`, `levelId` and `chapterId` from that
 * question"). Read at call time from the M04 `questions` repository (reads start after finalise).
 *
 * A generated session draws its questions once (`n` distinct rows of its subject and level, seeded
 * by the session key); its answers are those rows in order. A sessionless answer draws one row of
 * the user's level. The draw reads the rows eligible for practice (approved, active, objective MCQ;
 * for T4/T5 the SPM pool), the SRS's "active questions". INFERRED consequence: a later report
 * deactivation can change which question a generated row shows, never a count (every count is a
 * facet of the log).
 */

import { toIsoMyt } from '@/lib/time'
import { hashKey } from '@/mock/dataset'
import { mulberry32 } from '@/mock/determinism'
import type { Question } from '@/modules/m04-question-bank/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import { sessionCoins } from './pins'
import { MODE_CODES, requirePracticePrime } from './prime'
import type { AnswerRow, PracticeMode, SessionRow } from './types'

const LRU_SIZE = 512

class SmallLru<K, V> {
  private readonly map = new Map<K, V>()
  constructor(private readonly size: number) {}
  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) {
      this.map.delete(key)
      this.map.set(key, v)
    }
    return v
  }
  set(key: K, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.size) this.map.delete(this.map.keys().next().value as K)
  }
  clear(): void {
    this.map.clear()
  }
}

const drawCache = new SmallLru<string, readonly Question[]>(LRU_SIZE)

export function clearDrawCache(): void {
  drawCache.clear()
  questionMeta.clear()
  sessionIds.clear()
  poolCache.clear()
}

/** What a generated answer needs of its question (memoised per question until the caches are cleared). */
interface QuestionMeta {
  id: number
  subjectId: number | null
  levelId: number | null
  chapterId: number | null
  correctAnswer: number
}
const questionMeta = new Map<number, QuestionMeta>()

function metaOf(q: Question): QuestionMeta {
  let m = questionMeta.get(q.id)
  if (!m) {
    const row = questions.get(q.id) ?? q
    m = {
      id: row.id,
      subjectId: row.subjectId,
      levelId: row.educationLevelId,
      chapterId: row.curriculumChapterId,
      correctAnswer: row.correctAnswer ?? 0,
    }
    questionMeta.set(q.id, m)
  }
  return m
}

/** Question ids of generated sessions, memoised (a session is drawn once per boot). */
const sessionIds = new Map<number, readonly number[]>()

/**
 * The eligible pool of a subject (optional) and level, as ids in ascending order: every approved,
 * active objective MCQ row (the SPM pool for T4/T5), read once per (subject, level) and kept until the
 * caches are cleared. A draw over it is the same sparse Fisher–Yates over ranks as the dataset's
 * `sample`, so the drawn rows are exactly those of `questions.sampleKeyless` but cost O(n) instead of a
 * scan (about 15 ms) per session.
 */
const poolCache = new Map<string, readonly number[]>()

function poolIds(subjectId: number | null, level: number): readonly number[] {
  const key = `${String(subjectId)}:${String(level)}`
  const hit = poolCache.get(key)
  if (hit) return hit
  const filter = {
    questionType: 'mcq' as const,
    eligible: true,
    educationLevelIds: [level],
    ...(level >= 10 ? { spmPool: true } : {}),
  }
  const pick = (f: typeof filter & { subjectId?: number }) => {
    const total = questions.countWhere({
      ...(f.subjectId !== undefined ? { subjectId: f.subjectId } : {}),
      educationLevelId: level,
      questionType: 'mcq',
      status: 'approved',
      isActive: true,
      ...(level >= 10 ? { spmPool: true } : {}),
    })
    return questions
      .sampleKeyless(f, total, mulberry32(1))
      .map((r) => r.id)
      .sort((a, b) => a - b)
  }
  let ids = pick(subjectId !== null ? { ...filter, subjectId } : filter)
  // A subject without rows at this level (never in the seed): any row of the level.
  if (ids.length === 0 && subjectId !== null) ids = pick(filter)
  poolCache.set(key, ids)
  return ids
}

/** `n` distinct rows of the pool, seeded by `seed` (sparse Fisher–Yates over the ranks). */
function draw(
  subjectId: number | null,
  level: number,
  n: number,
  seed: number,
): readonly Question[] {
  const key = `${String(subjectId)}:${String(level)}:${String(n)}:${String(seed)}`
  const hit = drawCache.get(key)
  if (hit) return hit
  const ids = poolIds(subjectId, level)
  const m = ids.length
  const k = Math.min(n, m)
  const rng = mulberry32(seed >>> 0)
  const swapped = new Map<number, number>()
  const rows: Question[] = []
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng.next() * (m - i))
    const vj = swapped.get(j) ?? j
    const vi = swapped.get(i) ?? i
    swapped.set(j, vi)
    rows.push({ id: ids[vj] as number } as Question)
  }
  drawCache.set(key, rows)
  return rows
}

/** The questions of generated session `key` (served order). */
export function sessionQuestions(key: number): readonly Question[] {
  const p = requirePracticePrime()
  const n = p.sCount[key] as number
  if (n <= 0) return []
  // Designed question lists (class 228, M08 §6.10) replace the draw.
  const designed = p.sessionQuestions.get(key)
  if (designed) return designed.map((id) => ({ id }) as Question)
  const subject = p.sSubject[key] as number
  return draw(subject > 0 ? subject : null, p.sLevel[key] as number, n, hashKey(key, 61))
}

/** The eligible pool (ascending ids) of a subject and level: the ids a draw picks from. */
export function poolQuestionIds(subjectId: number | null, level: number): readonly number[] {
  return poolIds(subjectId, level)
}

/** The question ids of generated session `key` (memoised; bulk reads use it). */
export function sessionQuestionIds(key: number): readonly number[] {
  let ids = sessionIds.get(key)
  if (!ids) {
    ids = sessionQuestions(key).map((q) => q.id)
    sessionIds.set(key, ids)
  }
  return ids
}

/** `deriveAnswer` without the full row: the fields bulk reads fold (no level or chapter). */
export function deriveAnswerFact(
  key: number,
  isCorrect: boolean,
): { questionId: number; subjectId: number | null; selectedOptionId: number | null } {
  const a = deriveAnswer(key, isCorrect)
  return { questionId: a.questionId, subjectId: a.subjectId, selectedOptionId: a.selectedOptionId }
}

/** Derived fields of a generated answer. */
export function deriveAnswer(
  key: number,
  isCorrect: boolean,
): Pick<AnswerRow, 'questionId' | 'subjectId' | 'levelId' | 'chapterId' | 'selectedOptionId'> {
  const p = requirePracticePrime()
  const sess = p.aSess[key] as number
  let q: Question | undefined
  if (sess > 0) {
    const list = sessionQuestionIds(sess)
    const pos = Math.max(0, p.aPos[key] as number)
    const id = list.length > 0 ? list[pos % list.length] : undefined
    q = id === undefined ? undefined : ({ id } as Question)
  } else {
    const user = p.aUser[key] as number
    const level = p.userLevel.get(user) ?? 11
    const subjects = p.levelSubjects.get(level) ?? []
    const subject =
      subjects.length > 0 ? (subjects[hashKey(key, 62) % subjects.length] as number) : null
    q = draw(subject, level, 1, hashKey(key, 63))[0]
  }
  if (!q) {
    return {
      questionId: 0,
      subjectId: null,
      levelId: null,
      chapterId: null,
      selectedOptionId: null,
    }
  }
  const row = metaOf(q)
  const key4 = row.correctAnswer
  return {
    questionId: row.id,
    subjectId: row.subjectId,
    levelId: row.levelId,
    chapterId: row.chapterId,
    selectedOptionId: isCorrect ? key4 : (key4 + 1 + (hashKey(key, 64) % 3)) % 4,
  }
}

/** Cheap fields of a generated answer. */
export const answerCheap = {
  userId: (key: number) => requirePracticePrime().aUser[key] as number,
  sessionId: (key: number) => {
    const s = requirePracticePrime().aSess[key] as number
    return s > 0 ? `g${String(s)}` : null
  },
  answeredAtMs: (key: number) => requirePracticePrime().aMs[key] as number,
  answeredAt: (key: number) => toIsoMyt(requirePracticePrime().aMs[key] as number),
}

const modeOf = (key: number): PracticeMode =>
  MODE_CODES[requirePracticePrime().sMode[key] as number] ?? 'random'

/** Cheap fields of a generated session. */
export const sessionCheap = {
  userId: (key: number) => requirePracticePrime().sUser[key] as number,
  mode: (key: number) => modeOf(key),
  subjectId: (key: number) => {
    const s = requirePracticePrime().sSubject[key] as number
    return s > 0 ? s : null
  },
  questionCount: (key: number) => requirePracticePrime().sCount[key] as number,
  correctCount: (key: number) => requirePracticePrime().sCorrect[key] as number,
  timeSpent: (key: number) => requirePracticePrime().sTime[key] as number,
  coinsEarned: (key: number) =>
    sessionCoins(modeOf(key), requirePracticePrime().sCorrect[key] as number),
  pointsEarned: (key: number) => 10 * (requirePracticePrime().sCorrect[key] as number),
  completedAtMs: (key: number) => requirePracticePrime().sMs[key] as number,
  completedAt: (key: number) => toIsoMyt(requirePracticePrime().sMs[key] as number),
  remedialTestId: () => null,
  questionSetId: () => null,
}

/** Non-cheap fields of a generated session. */
export function deriveSession(
  key: number,
): Omit<
  SessionRow,
  | 'id'
  | keyof typeof sessionCheap
  | 'seg'
  | 'schoolId'
  | 'week'
  | 'band'
  | 'inP'
  | 'missionId'
  | 'status'
> {
  const p = requirePracticePrime()
  const qs = sessionQuestions(key)
  const end = p.sMs[key] as number
  return {
    levelId: p.sLevel[key] as number,
    difficulty: null,
    chapterId: null,
    year: null,
    setNo: null,
    targetQuestionId: null,
    timeLimitSec: null,
    pkskDomainId: null,
    pkskTargetLevel: null,
    questionIds: qs.map((q) => q.id),
    startedAt: toIsoMyt(end - (p.sTime[key] as number) * 1_000),
  }
}
