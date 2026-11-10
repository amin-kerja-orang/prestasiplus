import { createHash, randomInt } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  normaliseKuizCount,
  BijakKuizCheckResultSchema,
  BijakKuizPaperPageSchema,
  BijakKuizResultSchema,
  BijakKuizSessionSchema,
  type BijakKuizCheckRequest,
  type BijakKuizCheckResult,
  type BijakKuizItem,
  type BijakKuizPaperPage,
  type BijakKuizResult,
  type BijakKuizSession,
  type BijakKuizStartRequest,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { mulberry32 } from '../../../db/prng'
import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import { FilesService } from '../../files'
import { AnswerLogPort } from '../../practice/answer-log.port'
import { KUIZ_ORIGIN, selectedLabelOf } from '../../practice'
import { PracticePorts, type PracticeRewardResult, practiceRewardSource } from '../../practice/ports'
import { type CompletedSession, type GradedAnswer, PracticeRepository, type ServedRef, type SessionRecord, type StoredCheck } from '../../practice/practice.repository'
import { pinServableForNewSitting, QuestionsRepository } from '../../questions'
import { type DrawCandidate, drawUnits } from '../../questions/serving'
import type { QuestionRecord, StimulusGroupRecord } from '../../questions/types'
import { PapersRepository } from '../papers/papers.repository'
import { levelScopeAllows } from '../papers/rules'
import {
  alreadyFinished,
  invalidAnswer,
  invalidValue,
  kuizPaperNotFound,
  kuizPaperUnavailable,
  KUIZ_OVER_FETCH,
  noQuestions,
  quizNotFound,
} from './kuiz.constants'
import {
  type ItemContext,
  leafOf,
  leavesOf,
  markableLeaf,
  multiKeyOf,
  selectionVerdict,
  optionImageIds,
  questionIdOfItem,
  resolveStimuli,
  stimuliWithTokens,
  toItem,
} from './kuiz.mapper'
import { ownStimuliOf } from './own-stimuli'
/** Internal: rolls back a `closeIdle` transaction whose session turned out not to be idle any more. */
class StillActive extends Error {}

/** [PROPOSED] The attempt id of a pupil's per-paper kuiz rows: a name-based uuid (v5 layout) of the pupil and the paper. */
export function paperKuizAttemptId(userId: string, paperId: string): string {
  const h = createHash('sha1').update(`bijak-kuiz-paper:${userId}:${paperId}`).digest()
  h[6] = (h[6]! & 0x0f) | 0x50
  h[8] = (h[8]! & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}

export interface KuizCaller {
  userId: string
  /** True under Mod Pelajar: every row written is stamped `is_test`. */
  isTest: boolean
}

/** Stored mode of a random quiz: decision U8 "disimpan sebagai sesi latih tubi". */
const KUIZ_MODE = 'latih_tubi' as const
/** S3-T04 (R2): a kuiz session with no check and no start for this long is closed as `abandoned` (API-BIJAK-06). */
export const KUIZ_IDLE_MS = 2 * 60 * 60 * 1000
/** Sessions looked at per pass of the sweep. */
export const KUIZ_SWEEP_BATCH = 200
/** The most batches read in one pass of the sweep. */
const KUIZ_SWEEP_ROUNDS = 20

/**
 * Simulasi Kuiz (R1-B16). The random quiz is a practice session written through `PracticeRepository` (U8), so Soalan Aku
 * Salah, mastery and the reward port see it like any other practice. The per-paper quiz writes nothing.
 *
 * Marking is done here and not by `PracticeService.check`: that path serves plain text MCQs only (its question source
 * refuses a stimulus or an option picture), while the quiz serves them. The key is read from the pinned version, never
 * from the request, and is returned only after the check.
 */
@Injectable()
export class KuizService {
  private readonly logger = new Logger(KuizService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
    @Inject(PapersRepository) private readonly papers: PapersRepository,
    @Inject(AnswerLogPort) private readonly answerLog: AnswerLogPort,
  ) {}

  // --- random quiz -------------------------------------------------------------------------------

  async start(caller: KuizCaller, req: BijakKuizStartRequest): Promise<BijakKuizSession> {
    const count = normaliseKuizCount(req.count)
    let subjectId: string | null = null
    if (req.subject !== undefined) {
      const subject = await this.curriculum.subjectByCode(req.subject)
      // V2: a subject filter that matches nothing is the empty state, not an error.
      if (!subject?.isActive) throw noQuestions()
      subjectId = idToString(subject.id)
    }
    // Published + active + learner-visible (secondary, not PKSK) are forced by the bank's `sample`; the shape is one objective leaf.
    // S1-T06 (FR-MUR-QP-6, D90): `wholeGroups` keeps a member only of a complete group; the draw below then takes whole units.
    const ids = await this.questions.sample(
      { servesMcqMulti: true, singleMcqLeaf: true, wholeGroups: true, ...(subjectId ? { subjectId } : {}) },
      count * KUIZ_OVER_FETCH,
      mulberry32(randomInt(0, 0x1_0000_0000)),
    )
    const { records, sizes } = await this.withGroupMembers((await this.questions.getMany(ids, 'live')).filter((r) => r.isActive && r.version.status === 'approved'))
    const prepared = await this.prepare(records)
    const answerable = prepared.flatMap((p) => {
      const leaf = leavesOf(p.record.id, p.record.version.parts)[0]
      return p.complete && leaf && markableLeaf(leaf) !== null ? [{ ...p, leaf }] : []
    })
    // A group is drawn whole or not at all (`drawUnits`): one member that cannot be answered, or is missing, drops the whole group.
    const byId = new Map(answerable.map((p) => [p.record.id, p]))
    const candidates: DrawCandidate[] = answerable.map((p) =>
      p.record.groupId === null
        ? { id: p.record.id, groupId: null, groupPosition: null }
        : { id: p.record.id, groupId: p.record.groupId, groupPosition: p.record.groupPosition, groupSize: sizes.get(p.record.groupId) ?? 0 },
    )
    const chosen = drawUnits(candidates, count, mulberry32(randomInt(0, 0x1_0000_0000))).flatMap((id) => byId.get(id) ?? [])
    if (chosen.length === 0) throw noQuestions()

    const startedAt = this.clock.now()
    const session = await this.practice.startSession({
      userId: caller.userId,
      clientUuid: null,
      mode: KUIZ_MODE,
      origin: KUIZ_ORIGIN,
      subjectId,
      educationLevelId: null,
      difficulty: null,
      chapterId: null,
      year: null,
      setNo: null,
      targetQuestionId: null,
      missionId: null,
      remedialTestId: null,
      questionSetId: null,
      timeLimitSec: null,
      coinsPerCorrect: null,
      startedAt,
      isTest: caller.isTest,
      served: chosen.map((p) => ({ questionId: p.record.id, versionNo: p.record.version.versionNo })),
    })
    const tokens = await this.tokensOf(chosen.flatMap((p) => p.fileIds))
    const subjects = await this.subjectNames(chosen.map((p) => p.record))
    const items = chosen.map((p) => toItem(p.record, p.leaf, this.context(p, tokens, subjects)))
    return BijakKuizSessionSchema.parse({ sessionId: session.id, count: items.length, items })
  }

  /** The ticked option ids of a check request. Every id must belong to the leaf; a single-choice leaf takes exactly one (`optionId`), an `mcq_multi` leaf `optionIds`. */
  private selectionOf(req: BijakKuizCheckRequest, leaf: Parameters<typeof multiKeyOf>[0]): string[] {
    const multi = multiKeyOf(leaf) !== null
    const given = multi ? req.optionIds : [req.optionId]
    if (given === undefined) throw invalidAnswer('optionId')
    const unique = [...new Set(given)]
    if (!unique.every((id) => leaf.options.some((o) => o.label === id))) throw invalidAnswer('optionId')
    return unique.sort()
  }

  async check(caller: KuizCaller, sessionId: string, req: BijakKuizCheckRequest): Promise<BijakKuizCheckResult> {
    const now = this.clock.now()
    return this.prisma.transaction(async () => {
      const session = await this.practice.lockSession(sessionId, caller.userId, 'update')
      // Any other session of the pupil (a Latih Tubi one) is not a kuiz: 404, so check cannot read keys outside the BR-07 trial counter.
      if (!session || session.legacyPaper !== KUIZ_ORIGIN) throw quizNotFound()
      if (session.status !== 'in_progress') throw alreadyFinished()
      const questionId = questionIdOfItem(req.itemId)
      const served = (await this.practice.sessionQuestions(session.id)).find((s) => s.questionId === questionId)
      if (!served || questionId === null || req.itemId !== questionId) throw invalidAnswer('itemId')

      const [record] = await this.questions.getVersions([{ questionId, versionNo: served.versionNo }])
      const ref = record ? leafOf(record, req.itemId) : null
      const leaf = ref ? markableLeaf(ref) : null
      if (!record || !leaf) throw invalidAnswer('itemId')
      const selected = this.selectionOf(req, leaf)
      const marked = selectionVerdict(leaf, selected)

      const verdict = (correct: boolean): BijakKuizCheckResult =>
        BijakKuizCheckResultSchema.parse({
          correct,
          correctOptionId: marked.correctOptionId,
          ...(marked.correctOptionIds ? { correctOptionIds: marked.correctOptionIds } : {}),
          explanation: record.version.explanationMs,
        })
      // One check per question: a repeat returns the stored verdict and counts nothing.
      const stored = await this.practice.check(session.id, questionId)
      // A multi check keeps its verdict in `is_correct` (the stored label is the comma-joined ticks, not one letter to compare).
      const storedVerdict = (c: StoredCheck): boolean => (multiKeyOf(leaf) !== null ? c.isCorrect : c.selectedLabel === marked.correctOptionId)
      if (stored) return verdict(storedVerdict(stored))
      const label = selectedLabelOf(selected)
      if (label === null) throw invalidAnswer('optionId')
      const correct = marked.correct
      const inserted = await this.practice.insertCheck({
        sessionId: session.id,
        userId: caller.userId,
        questionId,
        questionVersionNo: served.versionNo,
        selectedLabel: label,
        isCorrect: correct,
        checkedAt: now,
        isTest: caller.isTest || session.isTest,
      })
      if (!inserted) {
        const winner = await this.practice.check(session.id, questionId)
        return verdict(winner ? storedVerdict(winner) : correct)
      }
      return verdict(correct)
    })
  }

  async finish(caller: KuizCaller, sessionId: string, timeSpent: number | undefined): Promise<BijakKuizResult> {
    const now = this.clock.now()
    let finished: { done: CompletedSession; result: PracticeRewardResult }
    try {
      finished = await this.practice.completeSession(
        { sessionId, userId: caller.userId, now, timeSpent: timeSpent ?? 0, isTest: caller.isTest, answerMode: 'kuiz' },
        {
          guard: (session) => {
            if (session.mode !== KUIZ_MODE || session.legacyPaper !== KUIZ_ORIGIN) throw quizNotFound()
            return Promise.resolve()
          },
          regrade: (_session, served, checks) => this.regrade(served, checks),
          completed: (completed, tx) => {
            return this.ports.reward.onSessionCompleted(
              {
                userId: completed.session.userId,
                sessionId: completed.session.id,
                mode: completed.session.mode,
                source: practiceRewardSource(completed.session.mode),
                correct: completed.correct,
                total: completed.total,
                timeSpent: completed.timeSpentSec,
                completedAt: completed.completedAt,
                pointsEarned: completed.pointsEarned,
                sessionCoins: completed.coinsEarned,
                isTest: caller.isTest || completed.session.isTest,
              },
              tx,
            )
          },
        },
      )
    } catch (err) {
      // A second finish, or a finish after the idle sweep: 200 with the stored result, nothing is paid (API-BIJAK-06).
      if (err instanceof ApiError && err.code === 'ALREADY_SUBMITTED') return this.storedResult(caller, sessionId)
      throw err
    }
    const { done, result } = finished
    return BijakKuizResultSchema.parse({
      score: done.correct,
      total: done.total,
      answered: done.answers.length,
      gamification: {
        coinsEarned: result.coinsEarned,
        streakCount: result.streakCount,
        pointsEarned: done.pointsEarned,
        totalBalance: result.totalBalance,
      },
    })
  }

  /** The result of a kuiz session that is already completed or abandoned. No reward is called: coins and points are the stored figures (0 when abandoned). */
  private async storedResult(caller: KuizCaller, sessionId: string): Promise<BijakKuizResult> {
    const session = await this.practice.session(sessionId, caller.userId)
    if (!session || session.mode !== KUIZ_MODE || session.legacyPaper !== KUIZ_ORIGIN) throw quizNotFound()
    const rows = await this.practice.answers(caller.userId, { sessionId: session.id, includeTest: true })
    let correct = rows.filter((r) => r.isCorrect).length
    let answered = rows.length
    if (answered === 0 && session.status === 'abandoned') {
      // Abandoned by the practice sweeper before this change (it now skips kuiz sessions), so no rows were written: the kept checks are the answers.
      const checks = await this.practice.checks(session.id)
      answered = checks.length
      correct = checks.filter((c) => c.isCorrect).length
    }
    const paid = session.status === 'completed'
    return BijakKuizResultSchema.parse({
      score: paid ? session.correctCount : correct,
      total: session.questionCount,
      answered,
      gamification: {
        coinsEarned: paid ? session.coinsEarned : 0,
        streakCount: 0,
        pointsEarned: paid ? session.pointsEarned : 0,
        totalBalance: 0,
      },
    })
  }

  /** One `kuiz` answer row per graded check, through the port, in the caller's transaction (idempotent per session and question). */
  private async writeRows(session: SessionRecord, graded: readonly GradedAnswer[], isTest: boolean): Promise<void> {
    for (const g of graded) {
      await this.answerLog.record({
        userId: session.userId,
        attemptId: session.id,
        questionId: g.check.questionId,
        partRef: null,
        mode: 'kuiz',
        isCorrect: g.isCorrect,
        marksAwarded: g.isCorrect ? 1 : 0,
        marksMax: 1,
        answeredAt: g.check.checkedAt,
        isTest,
        selectedLabel: g.check.selectedLabel,
        questionVersionNo: g.check.questionVersionNo,
      })
    }
  }

  // --- idle sweep (S3-T04 R2) ----------------------------------------------------------------------

  /**
   * The scheduled sweep for kuiz sessions: closes every one idle for 2 h. A session that fails (logged with its id) or is not closed
   * is skipped for the rest of the run and the next batch is read past it, so one permanently failing session never starves the others.
   * Returns how many were closed.
   */
  async sweepIdle(now: Date = this.clock.now()): Promise<number> {
    const cutoff = new Date(now.getTime() - KUIZ_IDLE_MS)
    const skipped = new Set<string>()
    let closed = 0
    for (let round = 0; round < KUIZ_SWEEP_ROUNDS; round++) {
      const batch = (await this.practice.idleKuizSessions(cutoff, KUIZ_SWEEP_BATCH + skipped.size)).filter((s) => !skipped.has(s.id)).slice(0, KUIZ_SWEEP_BATCH)
      if (batch.length === 0) break
      for (const s of batch) {
        skipped.add(s.id)
        try {
          if (await this.closeIdle(s.id, s.userId, now)) closed += 1
        } catch (err) {
          this.logger.warn(`Could not close idle kuiz session ${s.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
    return closed
  }

  /**
   * Closes ONE idle kuiz session: its checked questions become `kuiz` answer rows (the checks are kept), the session becomes
   * `abandoned` ("ditinggalkan") and NOTHING is paid (no reward call, no coins or points, no revision queue or mastery change).
   * Safe from several instances: the session row is locked and re-checked. Returns true when this call closed it.
   */
  async closeIdle(sessionId: string, userId: string, now: Date = this.clock.now()): Promise<boolean> {
    const cutoff = new Date(now.getTime() - KUIZ_IDLE_MS)
    return this.prisma.transaction(async () => {
      const session = await this.practice.lockSession(sessionId, userId, 'update')
      if (!session || session.legacyPaper !== KUIZ_ORIGIN || session.mode !== KUIZ_MODE || session.status !== 'in_progress') return false
      const checks = await this.practice.checks(session.id)
      const last = checks.reduce((m, c) => (c.checkedAt > m ? c.checkedAt : m), session.startedAt)
      if (last >= cutoff) return false
      if (checks.length > 0) {
        const graded = await this.regrade(await this.practice.sessionQuestions(session.id), checks)
        await this.writeRows(session, graded, session.isTest)
      }
      // Re-checks the same cutoff in its UPDATE; false means the session is no longer idle, so undo the rows written above.
      if (!(await this.practice.abandonSession(session.id, cutoff, now))) throw new StillActive()
      return true
    }).catch((err: unknown) => {
      if (err instanceof StillActive) return false
      throw err
    })
  }

  /** Grades the stored checks against the versions the session served, copying the dimensions the answer row keeps. */
  private async regrade(served: readonly ServedRef[], checks: readonly StoredCheck[]): Promise<GradedAnswer[]> {
    const versionOf = new Map(served.map((s) => [s.questionId, s.versionNo]))
    const refs = checks.map((c) => ({ questionId: c.questionId, versionNo: versionOf.get(c.questionId) ?? c.questionVersionNo }))
    const records = refs.length > 0 ? await this.questions.getVersions(refs) : []
    const byKey = new Map(records.map((r) => [`${r.id}@${String(r.version.versionNo)}`, r]))
    return checks.map((check, i) => {
      const ref = refs[i] as { questionId: string; versionNo: number }
      const record = byKey.get(`${ref.questionId}@${String(ref.versionNo)}`)
      const leaf = record ? leavesOf(record.id, record.version.parts).map(markableLeaf).find((l) => l !== null) : undefined
      const v = record?.version
      // A multi row stores the comma-joined ticks ("A,C"): split back and graded by the one S1 grader (`selectionVerdict`).
      const multi = leaf !== undefined && leaf !== null && multiKeyOf(leaf) !== null
      const isCorrect = !leaf ? check.isCorrect : multi ? selectionVerdict(leaf, check.selectedLabel.split(',')).correct : leaf.key.correct === check.selectedLabel
      // The answer row keeps the comma-joined ticks too (`practice_answers.selected_label`, S5 migration 0262; 46:270).
      return {
        check,
        isCorrect,
        subjectId: v?.subjectId ?? null,
        educationLevelId: v?.educationLevelId ?? null,
        chapterId: v?.chapterId ?? null,
        topicId: v?.topicId ?? null,
        difficulty: v?.difficultyTp == null ? null : Math.min(5, Math.max(1, v.difficultyTp)),
        questionType: multi ? 'mcq_multi' : 'mcq',
      }
    })
  }

  // --- per-paper quiz (not stored) -----------------------------------------------------------------

  async paperPage(caller: KuizCaller, paperId: string, page: number | undefined): Promise<BijakKuizPaperPage> {
    const paper = await this.visiblePaper(caller.userId, paperId)
    const sections = [...paper.sections].sort((a, b) => a.position - b.position)
    const pins = sections.flatMap((s) =>
      [...s.placements].sort((a, b) => a.position - b.position).map((p) => ({ questionId: idToString(p.questionId), versionNo: p.pinnedVersionNo })),
    )
    const records = await this.questions.getVersions(pins)
    // A question whose required stimulus cannot be shown is skipped everywhere (page, score total, check), as in random mode
    // (V2 §1.8 is silent on this case; deviation row UX-22). The pager and `markableTotal` count only what is shown.
    const allPrepared = await this.prepare(records)
    const preparedById = new Map(allPrepared.filter((p) => p.complete).map((p) => [`${p.record.id}@${String(p.record.version.versionNo)}`, p]))
    const byKey = new Map([...preparedById].map(([k, p]) => [k, p.record]))
    // A section without a question to show is not a page (V2 PaperViewBuilder).
    const pages = sections
      .map((s) => ({
        section: s,
        questions: [...s.placements]
          .sort((a, b) => a.position - b.position)
          .flatMap((p) => {
            const r = byKey.get(`${idToString(p.questionId)}@${String(p.pinnedVersionNo)}`)
            return r ? [r] : []
          }),
      }))
      .filter((p) => p.questions.length > 0)
    const markableTotal = pages.reduce(
      (n, p) => n + p.questions.reduce((m, r) => m + leavesOf(r.id, r.version.parts).filter((l) => markableLeaf(l) !== null).length, 0),
      0,
    )
    const subject = (await this.papers.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const head = { id: idToString(paper.id), title: paper.title, subjectName: subject?.name ?? '', code: paper.paperCode ?? '' }
    const wanted = page ?? 1
    if (pages.length === 0) {
      if (wanted !== 1) throw invalidValue('page')
      return BijakKuizPaperPageSchema.parse({ paper: head, page: 1, pageCount: 0, section: null, items: [], groups: [], markableTotal })
    }
    const current = pages[wanted - 1]
    if (!current) throw invalidValue('page')

    const prepared = current.questions.flatMap((q) => preparedById.get(`${q.id}@${String(q.version.versionNo)}`) ?? [])
    const tokens = await this.tokensOf(prepared.flatMap((p) => p.fileIds))
    const subjects = await this.subjectNames(current.questions)
    // D90: members of one stimulus group are kept together at the place of the first member, in group order, and the group
    // stimulus is rendered once in `groups`, never repeated on each member.
    const byId = new Map(prepared.map((p) => [p.record.id, p]))
    const ordered: typeof prepared = []
    const groupsSeen = new Set<string>()
    for (const q of current.questions) {
      const p = byId.get(q.id)
      if (!p) continue
      const gid = p.record.groupId
      if (gid === null) {
        ordered.push(p)
      } else if (!groupsSeen.has(gid)) {
        groupsSeen.add(gid)
        ordered.push(
          ...current.questions
            .filter((m) => m.groupId === gid)
            .sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0))
            .flatMap((m) => byId.get(m.id) ?? []),
        )
      }
    }
    const groups: Array<{ id: string; stimuli: ReturnType<typeof stimuliWithTokens> }> = []
    const items: BijakKuizItem[] = []
    for (const p of ordered) {
      const ctx = this.context(p, tokens, subjects, 'own')
      const gid = p.record.groupId
      if (gid !== null && !groups.some((g) => g.id === gid)) groups.push({ id: gid, stimuli: stimuliWithTokens(p.resolved, tokens, 'group') })
      // The question's own stimuli are shown once, on its first leaf; later parts follow it without repeating them.
      leavesOf(p.record.id, p.record.version.parts).forEach((ref, i) => items.push(toItem(p.record, ref, i === 0 ? ctx : { ...ctx, stimuli: [] })))
    }
    return BijakKuizPaperPageSchema.parse({
      paper: head,
      page: wanted,
      pageCount: pages.length,
      section: { id: idToString(current.section.id), label: current.section.label, instruction: current.section.instruction ?? null },
      items,
      groups,
      markableTotal,
    })
  }

  async paperCheck(caller: KuizCaller, paperId: string, req: BijakKuizCheckRequest): Promise<BijakKuizCheckResult> {
    const paper = await this.visiblePaper(caller.userId, paperId)
    const questionId = questionIdOfItem(req.itemId)
    if (questionId === null) throw invalidAnswer('itemId')
    // The question must be placed on THIS paper: the pinned version of the placement is the one marked.
    const placement = paper.sections.flatMap((s) => s.placements).find((p) => idToString(p.questionId) === questionId)
    if (!placement) throw invalidAnswer('itemId')
    const [record] = await this.questions.getVersions([{ questionId, versionNo: placement.pinnedVersionNo }])
    const ref = record ? leafOf(record, req.itemId) : null
    const leaf = ref ? markableLeaf(ref) : null
    if (!record || !leaf) throw invalidAnswer('itemId')
    // A question the page skips (its stimulus cannot be shown) is not marked either.
    if (!(await this.prepare([record]))[0]?.complete) throw invalidAnswer('itemId')
    // V2: the option must belong to the part it claims.
    const selected = this.selectionOf(req, leaf)
    const marked = selectionVerdict(leaf, selected)
    const label = selectedLabelOf(selected)
    if (label === null) throw invalidAnswer('optionId')
    // One-writer rule: a failed row write fails this request (no swallowing).
    // [PROPOSED] (S3-T04 R4): a paper kuiz has no session, so its rows hang on a deterministic attempt uuid of (pupil, paper):
    // one `kuiz` row per question, a re-check updates it (DM-44 key). No new table, no S5 file.
    await this.answerLog.record({
      userId: caller.userId,
      attemptId: paperKuizAttemptId(caller.userId, paperId),
      questionId,
      partRef: req.itemId === questionId ? null : req.itemId,
      mode: 'kuiz',
      isCorrect: marked.correct,
      marksAwarded: marked.correct ? 1 : 0,
      marksMax: 1,
      answeredAt: this.clock.now(),
      isTest: caller.isTest,
      selectedLabel: label,
      questionVersionNo: placement.pinnedVersionNo,
    })
    return BijakKuizCheckResultSchema.parse({
      correct: marked.correct,
      correctOptionId: marked.correctOptionId,
      ...(marked.correctOptionIds ? { correctOptionIds: marked.correctOptionIds } : {}),
      explanation: record.version.explanationMs,
    })
  }

  /** Published only; a generated (Jana) paper only for the user it was made for. Same 404 for every other case. */
  private async visiblePaper(userId: string, paperId: string) {
    if (!isIdString(paperId)) throw kuizPaperNotFound()
    const paper = await this.papers.findPaper(idFromString(paperId))
    // A Kertas Subjektif paper (DM-23) is not a Kuiz paper: the same 404 as an unknown one.
    if (!paper || paper.status !== 'published' || paper.surface === 'subjektif') throw kuizPaperNotFound()
    if (paper.kind === 'jana' && paper.generatedForUserId?.toString() !== userId) throw kuizPaperNotFound()
    // S3-T07: a curated paper outside the pupil's form (`level_scope`) is hidden from the list and answers the same 404 here.
    // A pupil with their own open sitting on it (re-scoped or promoted mid-sitting) keeps it, like the resume in `attempts.service.ts`.
    if (paper.kind === 'pilihan' && !levelScopeAllows(paper.levelScope, await this.papers.gradeOf(userId))) {
      const open = await this.prisma.client.examAttempt.count({ where: { userId: idFromString(userId), paperId: paper.id, status: 'in_progress' } })
      if (open === 0) throw kuizPaperNotFound()
    }
    // H-A13 / AC-R1-18.4: a paper that places a question the bank no longer serves (archived after Terbit) is refused. This is the
    // first half of the new-sitting rule (`attempt-source.ts`: a live approved version; `is_active` is NOT checked, the placement is
    // what the paper froze). It is NOT the whole rule: a new sitting also refuses a question the Bijak bridge cannot map (bridge
    // refusals), which the kuiz does not check; the kuiz serves such a question or skips it on its own `complete` test. Nothing is
    // shown or marked from a refused paper.
    const placed = [...new Set(paper.sections.flatMap((s) => s.placements.map((p) => idToString(p.questionId))))]
    if (placed.length === 0 || (await this.questions.getMany(placed, 'live')).filter((r) => r.version.status === 'approved').length < placed.length) throw kuizPaperUnavailable()
    // REQ-B-058: the same refusal when a placement's PINNED version is taken down (archived "withdrawn" / "source_takedown") while a later
    // version is live. A `superseded` pin is still served. The pinned reads do not check status, so it is checked here.
    const pins = paper.sections.flatMap((s) => s.placements.map((p) => ({ questionId: idToString(p.questionId), versionNo: p.pinnedVersionNo })))
    if ((await this.questions.getVersions(pins, { withSourceTakedown: true })).some((r) => !pinServableForNewSitting(r.version))) throw kuizPaperUnavailable()
    return paper
  }

  // --- shared -------------------------------------------------------------------------------------

  /**
   * The records plus the not-yet-loaded live members of their groups, so a group cut by the sample window is judged whole, not dropped
   * for the cut. Also each group's size: its members whose latest version is not archived (the count `groupCompleteSql` uses; an
   * archived member stays in the group but is no longer a member to serve).
   */
  private async withGroupMembers(records: readonly QuestionRecord[]): Promise<{ records: QuestionRecord[]; sizes: Map<string, number> }> {
    const groupIds = [...new Set(records.flatMap((r) => (r.groupId === null ? [] : [r.groupId])))]
    const sizes = new Map<string, number>()
    if (groupIds.length === 0) return { records: [...records], sizes }
    const groups = await this.questions.groupsByIds(groupIds)
    const latest = new Map((await this.questions.getMany(groups.flatMap((g) => g.questionIds), 'latest')).map((r) => [r.id, r]))
    for (const g of groups) sizes.set(g.id, g.questionIds.filter((id) => latest.get(id)?.version.status !== 'archived').length)
    const have = new Set(records.map((r) => r.id))
    const missing = [...new Set(groups.flatMap((g) => g.questionIds))].filter((id) => !have.has(id))
    const loadedMissing = missing.length === 0 ? [] : (await this.questions.getMany(missing, 'live')).filter(
      (r) => r.isActive && r.version.status === 'approved' && r.version.type === 'mcq' && leavesOf(r.id, r.version.parts).length === 1,
    )
    // M1: a flagged / held / taken-down member is not added; the group then has fewer records than `sizes` and `drawUnits` drops it whole.
    const blocked = await this.questions.unservableAmong(loadedMissing.map((r) => r.id))
    const extra = loadedMissing.filter((r) => !blocked.has(r.id))
    return { records: [...records, ...extra], sizes }
  }

  /** Groups, linked pictures and whether every stimulus can be shown, for each record (one query per kind, not per record). */
  private async prepare(records: readonly QuestionRecord[]) {
    const groupIds = [...new Set(records.flatMap((r) => (r.groupId === null ? [] : [r.groupId])))]
    const groups = new Map<string, StimulusGroupRecord | null>((await this.questions.groupsByIds(groupIds)).map((g) => [g.id, g]))
    const assets = await ownStimuliOf(this.questions, records, groups)
    const out = []
    for (const record of records) {
      const group = record.groupId ? (groups.get(record.groupId) ?? null) : null
      const resolved = resolveStimuli(record, group, assets)
      const fileIds = [...resolved.entries.flatMap((e) => (e.file ? [e.file] : [])), ...optionImageIds(record)]
      out.push({ record, resolved, complete: resolved.complete, fileIds, group })
    }
    return out
  }

  private context(
    p: { record: QuestionRecord; resolved: ReturnType<typeof resolveStimuli> },
    tokens: ReadonlyMap<string, string>,
    subjects: ReadonlyMap<string, string>,
    part: 'all' | 'own' = 'all',
  ): ItemContext {
    const subjectId = p.record.version.subjectId
    return {
      stimuli: stimuliWithTokens(p.resolved, tokens, part),
      subjectName: subjectId ? (subjects.get(subjectId) ?? null) : null,
      tokens,
      pick: (n) => randomInt(0, n),
    }
  }

  private async tokensOf(fileIds: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(fileIds)]
    return unique.length === 0 ? new Map() : this.files.publicIdsOf(unique)
  }

  private async subjectNames(records: readonly QuestionRecord[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (const id of new Set(records.flatMap((r) => (r.version.subjectId ? [r.version.subjectId] : [])))) {
      const s = await this.curriculum.subject(idFromString(id))
      if (s) out.set(id, s.name)
    }
    return out
  }
}
